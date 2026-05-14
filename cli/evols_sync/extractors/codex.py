"""
Codex CLI / Codex Desktop transcript extractor.

Sources:
  - ~/.codex/session_index.jsonl   — master index (id + thread_name + updated_at)
  - ~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-<ts>-<id>.jsonl  — per-session log

Per-line shape:
  {"timestamp": "...", "type": "session_meta", "payload": {"id": ..., "cwd": ..., "model_provider": ...}}
  {"timestamp": "...", "type": "turn_context",  "payload": {...}}
  {"timestamp": "...", "type": "response_item", "payload": {"type":"message", "role":"user|assistant", "content":[{"type":"input_text|output_text","text":...}]}}
  {"timestamp": "...", "type": "response_item", "payload": {"type":"function_call", "name":..., "arguments":"{...}"}}
  {"timestamp": "...", "type": "event_msg",     "payload": {"type":"task_started", "model_context_window": ..., ...}}

Note: Codex's session_index.jsonl is the source of truth for "what sessions
exist". The actual log file path encodes the date — we glob to find it.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, Optional

from .base import Extractor, ExtractedSession, SessionRef


CODEX_DIR = Path.home() / ".codex"
CODEX_SESSIONS_DIR = CODEX_DIR / "sessions"
CODEX_SESSION_INDEX = CODEX_DIR / "session_index.jsonl"


def _find_session_file(session_id: str) -> Optional[Path]:
    """Locate the rollout-*.jsonl for a session id under sessions/YYYY/MM/DD/."""
    if not CODEX_SESSIONS_DIR.is_dir():
        return None
    # Glob is fast enough for typical user volumes (low thousands).
    matches = list(CODEX_SESSIONS_DIR.rglob(f"rollout-*-{session_id}.jsonl"))
    return matches[0] if matches else None


class CodexExtractor:
    name = "codex"
    schema_version = "codex:1"
    experimental = False

    def is_present(self) -> bool:
        return CODEX_SESSIONS_DIR.is_dir() or CODEX_SESSION_INDEX.exists()

    def discover(self) -> Iterable[SessionRef]:
        if not self.is_present():
            return
        seen: set[str] = set()

        # Prefer the index — it has the user-friendly thread_name we don't
        # otherwise have access to. Fallback to walking the sessions dir.
        if CODEX_SESSION_INDEX.exists():
            try:
                with open(CODEX_SESSION_INDEX, encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            entry = json.loads(line)
                        except Exception:
                            continue
                        sid = entry.get("id")
                        if not sid or sid in seen:
                            continue
                        seen.add(sid)
                        path = _find_session_file(sid)
                        if not path:
                            continue
                        try:
                            stat = path.stat()
                        except OSError:
                            continue
                        yield SessionRef(
                            agent=self.name,
                            source_id=sid,
                            source_path=str(path),
                            source_mtime=int(stat.st_mtime),
                            source_size=stat.st_size,
                        )
            except Exception:
                pass

        # Walk the sessions dir for anything not in the index.
        if CODEX_SESSIONS_DIR.is_dir():
            for path in CODEX_SESSIONS_DIR.rglob("rollout-*.jsonl"):
                try:
                    stem = path.stem  # rollout-2026-05-10T19-49-19-<id>
                    sid = stem.rsplit("-", 5)[-1] if "-" in stem else None
                    # Defensive: try to find a UUID-shaped tail
                    parts = stem.split("-")
                    # last 5 parts joined with '-' usually form the UUID
                    if len(parts) >= 5:
                        sid = "-".join(parts[-5:])
                    if not sid or sid in seen:
                        continue
                    stat = path.stat()
                    seen.add(sid)
                    yield SessionRef(
                        agent=self.name,
                        source_id=sid,
                        source_path=str(path),
                        source_mtime=int(stat.st_mtime),
                        source_size=stat.st_size,
                    )
                except OSError:
                    continue

    def extract(self, ref: SessionRef) -> Optional[ExtractedSession]:
        path = Path(ref.source_path)
        if not path.exists():
            return None

        text_lines: list[str] = []
        files_read: set[str] = set()
        files_modified: set[str] = set()
        cwd: Optional[str] = None
        model: Optional[str] = None
        started_at: Optional[str] = None
        ended_at: Optional[str] = None

        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        rec = json.loads(line)
                    except Exception:
                        continue

                    ts = rec.get("timestamp")
                    if ts:
                        if not started_at:
                            started_at = ts
                        ended_at = ts

                    rtype = rec.get("type")
                    payload = rec.get("payload", {}) or {}

                    if rtype == "session_meta":
                        cwd = payload.get("cwd") or cwd
                        # Codex Desktop stores model_provider; CLI stores model
                        model = payload.get("model") or model
                        continue

                    if rtype == "turn_context":
                        m = payload.get("model")
                        if m:
                            model = m
                        continue

                    if rtype == "response_item":
                        ptype = payload.get("type")
                        # Standard message turns
                        if ptype == "message":
                            role = payload.get("role", "")
                            content = payload.get("content") or []
                            text_pieces: list[str] = []
                            if isinstance(content, list):
                                for block in content:
                                    if not isinstance(block, dict):
                                        continue
                                    btype = block.get("type")
                                    if btype in ("input_text", "output_text", "text"):
                                        t = block.get("text") or ""
                                        if t:
                                            text_pieces.append(t)
                            elif isinstance(content, str):
                                text_pieces.append(content)
                            txt = " ".join(text_pieces).strip()
                            if not txt:
                                continue
                            if role == "user":
                                text_lines.append(f"User: {txt[:600]}")
                            elif role == "assistant":
                                text_lines.append(f"Assistant: {txt[:800]}")
                            elif role == "developer":
                                # System / harness preamble — skip the heavy
                                # boilerplate but keep short developer notes.
                                if len(txt) < 500:
                                    text_lines.append(f"System: {txt[:400]}")
                            continue

                        if ptype == "function_call":
                            name = payload.get("name", "")
                            args_raw = payload.get("arguments") or ""
                            try:
                                args = json.loads(args_raw) if args_raw else {}
                            except Exception:
                                args = {"_raw": str(args_raw)[:200]}
                            text_lines.append(f"Tool: {name}({json.dumps(args)[:300]})")
                            # Best-effort file tracking — Codex tools usually
                            # use shell, apply_patch, etc.; not always
                            # introspectable, so this is fuzzy.
                            for k in ("path", "file", "file_path"):
                                v = args.get(k) if isinstance(args, dict) else None
                                if v:
                                    if name in ("read", "shell", "apply_patch"):
                                        # apply_patch can both read and modify
                                        if name == "apply_patch":
                                            files_modified.add(v)
                                        else:
                                            files_read.add(v)
                                    else:
                                        files_read.add(v)
                            continue
                        # function_call_output, reasoning, etc — skip
                        continue
                    # event_msg, etc. — skip
        except Exception:
            return None

        if not text_lines:
            return None

        transcript = "\n".join(text_lines[-150:])

        return ExtractedSession(
            agent=self.name,
            source_session_id=ref.source_id,
            transcript_text=transcript,
            started_at=started_at,
            ended_at=ended_at,
            cwd=cwd,
            model=model,
            tokens_used=None,  # Codex doesn't write token totals to the rollout
            files_read=sorted(files_read),
            files_modified=sorted(files_modified),
            partial_transcript=False,
            schema_version=self.schema_version,
        )
