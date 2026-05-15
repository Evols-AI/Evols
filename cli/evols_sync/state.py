"""
Persistent state for evols sync: paths, sqlite cursor, locks, config loading.

All on-disk artifacts live under ~/.evols/. The schema is intentionally
forward-compatible — extractors carry their own SCHEMA_VERSION so we can
re-extract a session when our parser improves.

Dedup strategy (important — read DAEMON_DESIGN.md §7.2):

  Hooks (session_start.py / stop.py) already POST to
  /api/v1/team-knowledge/entries with `source_session_id` set. So a user who
  installs evols, lets hooks run for a week, and *then* runs `evols sync`
  must NOT see those sessions re-shipped.

  We defend against re-shipping in three layers:
    1. seed_from_backend()  — on first run, pull existing entries from the
       backend and pre-populate this DB so we know what hooks already shipped.
    2. verify_remote_exists() — per-session pre-flight check before upload.
    3. Server-side upsert on (workspace_id, source_session_id) — final guard.

  This file owns layer (1) and (2) on the client; (3) is backend work.
"""

from __future__ import annotations

import contextlib
import errno
import fcntl
import json
import os
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Optional

EVOLS_DIR = Path.home() / ".evols"
CONFIG_FILE = EVOLS_DIR / "config.json"
LIVE_SESSION_STATE_FILE = EVOLS_DIR / "session_state.json"
SYNC_DB_FILE = EVOLS_DIR / "sync_state.sqlite"
SYNC_QUEUE_DIR = EVOLS_DIR / "sync_queue"
LOCKS_DIR = EVOLS_DIR / "locks"
DAEMON_LOG = EVOLS_DIR / "daemon.log"
HEARTBEAT_FILE = EVOLS_DIR / "hook_heartbeat.jsonl"
EXCLUDE_FILE = EVOLS_DIR / "sync_exclude.txt"
INCLUDE_FILE = EVOLS_DIR / "sync_include.txt"
DAEMON_PID_FILE = EVOLS_DIR / "daemon.pid"
SEED_DONE_MARKER = EVOLS_DIR / ".sync_seed_done"

EVOLS_API_URL_DEFAULT = "https://api.evols.ai"


def ensure_dirs() -> None:
    EVOLS_DIR.mkdir(parents=True, exist_ok=True)
    SYNC_QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    LOCKS_DIR.mkdir(parents=True, exist_ok=True)


def load_config() -> Optional[dict]:
    """Mirror the loader in the main CLI (env > file)."""
    env_url = os.environ.get("EVOLS_API_URL", "")
    env_key = os.environ.get("EVOLS_API_KEY", "")
    env_plan = os.environ.get("EVOLS_PLAN", "")

    file_cfg: dict = {}
    if CONFIG_FILE.exists():
        try:
            file_cfg = json.loads(CONFIG_FILE.read_text())
        except Exception:
            file_cfg = {}

    api_url = env_url or file_cfg.get("api_url", EVOLS_API_URL_DEFAULT)
    api_key = env_key or file_cfg.get("api_key", "")
    plan = env_plan or file_cfg.get("plan_type", "pro")

    if not api_key:
        return None
    return {"api_url": api_url, "api_key": api_key, "plan_type": plan}


# ── sqlite cursor (sync_state.sqlite) ──────────────────────────────────────────

_SCHEMA = """
CREATE TABLE IF NOT EXISTS synced_sessions (
  agent           TEXT NOT NULL,
  source_id       TEXT NOT NULL,
  source_path     TEXT,
  source_mtime    INTEGER NOT NULL,
  source_hash     TEXT,
  schema_version  TEXT,
  evols_entry_id  INTEGER,
  status          TEXT NOT NULL,    -- 'synced' | 'skipped' | 'failed' | 'queued' | 'seeded'
  attempts        INTEGER DEFAULT 0,
  last_error      TEXT,
  first_synced_at INTEGER,
  last_synced_at  INTEGER,
  PRIMARY KEY (agent, source_id)
);

CREATE INDEX IF NOT EXISTS idx_synced_source_id ON synced_sessions(source_id);

CREATE TABLE IF NOT EXISTS sync_runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at      INTEGER NOT NULL,
  ended_at        INTEGER,
  trigger         TEXT,
  agent_filter    TEXT,
  sessions_seen   INTEGER DEFAULT 0,
  sessions_synced INTEGER DEFAULT 0,
  sessions_failed INTEGER DEFAULT 0,
  sessions_skipped INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS project_decisions (
  project_path  TEXT PRIMARY KEY,
  decision      TEXT NOT NULL,
  decided_at    INTEGER NOT NULL
);
"""


def open_db() -> sqlite3.Connection:
    ensure_dirs()
    conn = sqlite3.connect(SYNC_DB_FILE)
    conn.executescript(_SCHEMA)
    conn.row_factory = sqlite3.Row
    return conn


@dataclass
class SyncedRow:
    agent: str
    source_id: str
    source_path: Optional[str]
    source_mtime: int
    source_hash: Optional[str]
    schema_version: Optional[str]
    evols_entry_id: Optional[int]
    status: str
    attempts: int
    last_error: Optional[str]
    first_synced_at: Optional[int]
    last_synced_at: Optional[int]


def get_synced(conn: sqlite3.Connection, agent: str, source_id: str) -> Optional[SyncedRow]:
    cur = conn.execute(
        "SELECT * FROM synced_sessions WHERE agent=? AND source_id=?",
        (agent, source_id),
    )
    row = cur.fetchone()
    if not row:
        return None
    return SyncedRow(**{k: row[k] for k in row.keys()})


def get_synced_by_source_id(conn: sqlite3.Connection, source_id: str) -> Optional[SyncedRow]:
    """Lookup ignoring agent — used when the same session_id is seen across agents."""
    cur = conn.execute(
        "SELECT * FROM synced_sessions WHERE source_id=? ORDER BY status='synced' DESC LIMIT 1",
        (source_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return SyncedRow(**{k: row[k] for k in row.keys()})


def upsert_synced(conn: sqlite3.Connection, **fields) -> None:
    now = int(time.time())
    fields.setdefault("first_synced_at", now)
    fields["last_synced_at"] = now
    cols = list(fields.keys())
    placeholders = ",".join("?" for _ in cols)
    setters = ",".join(
        f"{c}=excluded.{c}"
        for c in cols
        if c not in ("agent", "source_id", "first_synced_at")
    )
    sql = (
        f"INSERT INTO synced_sessions ({','.join(cols)}) VALUES ({placeholders})\n"
        f"ON CONFLICT(agent, source_id) DO UPDATE SET {setters}"
    )
    conn.execute(sql, [fields[c] for c in cols])
    conn.commit()


def start_run(conn: sqlite3.Connection, trigger: str, agent_filter: Optional[str]) -> int:
    cur = conn.execute(
        "INSERT INTO sync_runs (started_at, trigger, agent_filter) VALUES (?,?,?)",
        (int(time.time()), trigger, agent_filter),
    )
    conn.commit()
    return int(cur.lastrowid)


def end_run(
    conn: sqlite3.Connection,
    run_id: int,
    seen: int,
    synced: int,
    failed: int,
    skipped: int = 0,
) -> None:
    conn.execute(
        "UPDATE sync_runs SET ended_at=?, sessions_seen=?, sessions_synced=?, "
        "sessions_failed=?, sessions_skipped=? WHERE id=?",
        (int(time.time()), seen, synced, failed, skipped, run_id),
    )
    conn.commit()


def _api_key_fingerprint(api_key: str) -> str:
    """Short deterministic fingerprint of the API key — not a secret, just an identity marker."""
    import hashlib
    return hashlib.sha256(api_key.encode()).hexdigest()[:16]


def seed_marker_exists(api_key: str = "") -> bool:
    """Return True only if the seed was done for this specific API key."""
    if not SEED_DONE_MARKER.exists():
        return False
    if not api_key:
        return True
    try:
        content = SEED_DONE_MARKER.read_text().strip()
        # Legacy marker (just a timestamp) — treat as stale when key is known
        if content.isdigit():
            return False
        # New format: "<timestamp>:<fingerprint>"
        stored_fp = content.split(":", 1)[1] if ":" in content else ""
        return stored_fp == _api_key_fingerprint(api_key)
    except Exception:
        return False


def mark_seed_done(api_key: str = "") -> None:
    ensure_dirs()
    ts = str(int(time.time()))
    if api_key:
        SEED_DONE_MARKER.write_text(f"{ts}:{_api_key_fingerprint(api_key)}")
    else:
        SEED_DONE_MARKER.write_text(ts)


# ── Project decisions (privacy: opt-in/out per project) ───────────────────────


def get_project_decision(conn: sqlite3.Connection, project_path: str) -> Optional[str]:
    cur = conn.execute(
        "SELECT decision FROM project_decisions WHERE project_path=?",
        (project_path,),
    )
    row = cur.fetchone()
    return row["decision"] if row else None


def set_project_decision(conn: sqlite3.Connection, project_path: str, decision: str) -> None:
    assert decision in ("include", "exclude")
    conn.execute(
        "INSERT INTO project_decisions (project_path, decision, decided_at) VALUES (?,?,?)\n"
        "ON CONFLICT(project_path) DO UPDATE SET decision=excluded.decision, decided_at=excluded.decided_at",
        (project_path, decision, int(time.time())),
    )
    conn.commit()


# ── Locking ────────────────────────────────────────────────────────────────────


@contextlib.contextmanager
def session_lock(source_id: str, blocking: bool = False) -> Iterator[Optional[int]]:
    """Acquire fcntl flock on ~/.evols/locks/<source_id>.lock.

    If blocking=False, yields None when contended (caller should skip).
    Always yields the file descriptor when held.
    """
    ensure_dirs()
    safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in source_id)[:200]
    lock_path = LOCKS_DIR / f"{safe}.lock"
    fd = os.open(lock_path, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        flags = fcntl.LOCK_EX if blocking else fcntl.LOCK_EX | fcntl.LOCK_NB
        try:
            fcntl.flock(fd, flags)
        except OSError as e:
            if e.errno in (errno.EWOULDBLOCK, errno.EAGAIN) and not blocking:
                yield None
                return
            raise
        yield fd
    finally:
        try:
            fcntl.flock(fd, fcntl.LOCK_UN)
        except Exception:
            pass
        os.close(fd)


def is_live_session(source_id: str) -> bool:
    """True if ~/.evols/session_state.json names this same session."""
    if not LIVE_SESSION_STATE_FILE.exists():
        return False
    try:
        state = json.loads(LIVE_SESSION_STATE_FILE.read_text())
        return state.get("session_id") == source_id
    except Exception:
        return False


# ── Heartbeat (hooks → daemon) ────────────────────────────────────────────────


def append_heartbeat(event: dict) -> None:
    """Append-only JSONL of every hook fire. Used by `daemon doctor` and reconciliation."""
    ensure_dirs()
    line = json.dumps({"ts": int(time.time()), **event}) + "\n"
    try:
        with open(HEARTBEAT_FILE, "a") as f:
            f.write(line)
    except Exception:
        pass


def read_heartbeat_tail(max_lines: int = 5000) -> list[dict]:
    if not HEARTBEAT_FILE.exists():
        return []
    try:
        with open(HEARTBEAT_FILE) as f:
            lines = f.readlines()[-max_lines:]
        out = []
        for line in lines:
            try:
                out.append(json.loads(line))
            except Exception:
                continue
        return out
    except Exception:
        return []


def trim_heartbeat(keep_lines: int = 5000) -> None:
    if not HEARTBEAT_FILE.exists():
        return
    try:
        with open(HEARTBEAT_FILE) as f:
            lines = f.readlines()
        if len(lines) > keep_lines * 1.2:
            HEARTBEAT_FILE.write_text("".join(lines[-keep_lines:]))
    except Exception:
        pass


# ── Project allow/exclude (text files, gitignore-style) ──────────────────────


def _read_glob_file(path: Path) -> list[str]:
    if not path.exists():
        return []
    out = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            out.append(line)
    return out


def read_excludes() -> list[str]:
    return _read_glob_file(EXCLUDE_FILE)


def read_includes() -> list[str]:
    return _read_glob_file(INCLUDE_FILE)


def append_decision_file(path: Path, line: str) -> None:
    ensure_dirs()
    existing = ""
    if path.exists():
        existing = path.read_text()
    if line in existing.splitlines():
        return
    with open(path, "a") as f:
        if existing and not existing.endswith("\n"):
            f.write("\n")
        f.write(line + "\n")
