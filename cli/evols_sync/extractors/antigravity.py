"""
Antigravity (Gemini CLI) transcript extractor.

Sources:
  - ~/.gemini/antigravity/sessions/*.jsonl — per-session JSONL logs

Per-line shape (Gemini-style):
  {"timestamp": "...", "type": "session_meta", "payload": {"cwd": ..., "model": ...}}
  {"timestamp": "...", "role": "user", "content": "..."}
  {"timestamp": "...", "role": "model", "content": [{"text": "..."}, {"functionCall": {...}}]}
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, Optional

from .base import Extractor, SessionRef, ExtractedSession

ANTIGRAVITY_DIR = Path.home() / ".gemini" / "antigravity"
ANTIGRAVITY_SESSIONS_DIR = ANTIGRAVITY_DIR / "sessions"


class AntigravityExtractor:
    name = "antigravity"
    schema_version = "antigravity:1"
    experimental = False

    def is_present(self) -> bool:
        return ANTIGRAVITY_SESSIONS_DIR.is_dir()

    def discover(self) -> Iterable[SessionRef]:
        if not ANTIGRAVITY_SESSIONS_DIR.is_dir():
            return
        for jsonl in ANTIGRAVITY_SESSIONS_DIR.rglob("*.jsonl"):
            try:
                stat = jsonl.stat()
            except OSError:
                continue
            yield SessionRef(
                agent="antigravity",
                source_id=jsonl.stem,
                source_path=str(jsonl),
                source_mtime=int(stat.st_mtime),
                source_size=stat.st_size,
            )

    def extract(self, ref: SessionRef) -> Optional[ExtractedSession]:
        path = Path(ref.source_path)
        if not path.exists():
            return None
        text_lines, files_read, files_modified = [], set(), set()
        model = cwd = started_at = ended_at = None
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                    except Exception:
                        continue
                    ts = entry.get("timestamp") or entry.get("ts")
                    if ts:
                        started_at = started_at or ts
                        ended_at = ts
                    etype = entry.get("type", "")
                    payload = entry.get("payload", {}) or entry
                    if etype == "session_meta":
                        cwd = payload.get("cwd") or cwd
                        model = payload.get("model") or model
                    role = entry.get("role") or payload.get("role", "")
                    content = entry.get("content") or payload.get("content", "")
                    if role == "user" and isinstance(content, str) and content.strip():
                        text_lines.append(f"User: {content[:600]}")
                    elif role in ("model", "assistant"):
                        if isinstance(content, str) and content.strip():
                            text_lines.append(f"Assistant: {content[:800]}")
                        elif isinstance(content, list):
                            for part in content:
                                if isinstance(part, dict):
                                    txt = part.get("text", "")
                                    if txt:
                                        text_lines.append(f"Assistant: {txt[:800]}")
                                    fc = part.get("functionCall") or part.get("function_call")
                                    if fc:
                                        name = fc.get("name", "")
                                        args = fc.get("args") or fc.get("arguments") or {}
                                        text_lines.append(f"Tool: {name}({json.dumps(args)[:300]})")
                                        fpath = args.get("path") or args.get("file_path") or args.get("filePath")
                                        if fpath and name:
                                            if "read" in name.lower() or "search" in name.lower():
                                                files_read.add(fpath)
                                            elif "write" in name.lower() or "edit" in name.lower():
                                                files_modified.add(fpath)
        except Exception:
            return None
        if not text_lines:
            return None
        return ExtractedSession(
            agent="antigravity",
            source_session_id=ref.source_id,
            transcript_text="\n".join(text_lines[-120:]),
            started_at=started_at, ended_at=ended_at, cwd=cwd,
            model=model, tokens_used=None,
            files_read=sorted(files_read), files_modified=sorted(files_modified),
            schema_version=self.schema_version,
        )
