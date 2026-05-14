"""
Cline (VSCode extension saoudrizwan.claude-dev) transcript extractor.

Sources:
  - ~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/tasks/<task_id>/api_conversation_history.json
  - ~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/tasks/<task_id>/api_conversation_history.json
  - ~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/tasks/<task_id>/api_conversation_history.json

Each task folder contains a JSON array of messages with role/content blocks
matching the Anthropic API format.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, Optional

from .base import Extractor, SessionRef, ExtractedSession


def _cline_task_dirs() -> list[Path]:
    """Return all possible Cline task directories (VSCode + Cursor)."""
    candidates = [
        Path.home() / "Library" / "Application Support" / "Code" / "User" / "globalStorage" / "saoudrizwan.claude-dev" / "tasks",
        Path.home() / "Library" / "Application Support" / "Cursor" / "User" / "globalStorage" / "saoudrizwan.claude-dev" / "tasks",
        Path.home() / ".config" / "Code" / "User" / "globalStorage" / "saoudrizwan.claude-dev" / "tasks",
    ]
    return [p for p in candidates if p.is_dir()]


class ClineExtractor:
    name = "cline"
    schema_version = "cline:1"
    experimental = False

    def is_present(self) -> bool:
        return bool(_cline_task_dirs())

    def discover(self) -> Iterable[SessionRef]:
        for tasks_dir in _cline_task_dirs():
            for task_dir in tasks_dir.iterdir():
                if not task_dir.is_dir():
                    continue
                conv_file = task_dir / "api_conversation_history.json"
                if not conv_file.exists():
                    continue
                try:
                    stat = conv_file.stat()
                except OSError:
                    continue
                yield SessionRef(
                    agent="cline",
                    source_id=task_dir.name,
                    source_path=str(conv_file),
                    source_mtime=int(stat.st_mtime),
                    source_size=stat.st_size,
                )

    def extract(self, ref: SessionRef) -> Optional[ExtractedSession]:
        path = Path(ref.source_path)
        if not path.exists():
            return None
        text_lines, files_read, files_modified = [], set(), set()
        model = started_at = ended_at = None
        try:
            data = json.loads(path.read_text(encoding="utf-8", errors="replace"))
            if not isinstance(data, list):
                return None
            for msg in data:
                if not isinstance(msg, dict):
                    continue
                ts = msg.get("ts") or msg.get("timestamp")
                if ts:
                    started_at = started_at or str(ts)
                    ended_at = str(ts)
                role = msg.get("role", "")
                content = msg.get("content", "")
                if isinstance(content, list):
                    for block in content:
                        if not isinstance(block, dict):
                            continue
                        btype = block.get("type", "")
                        if btype == "text":
                            txt = block.get("text", "")
                            if txt and role == "user":
                                text_lines.append(f"User: {txt[:600]}")
                            elif txt and role == "assistant":
                                text_lines.append(f"Assistant: {txt[:800]}")
                        elif btype == "tool_use":
                            name = block.get("name", "")
                            inp = block.get("input", {})
                            text_lines.append(f"Tool: {name}({json.dumps(inp)[:300]})")
                            fpath = inp.get("path") or inp.get("file_path")
                            if fpath:
                                if name in ("read_file", "search_files", "list_files"):
                                    files_read.add(fpath)
                                elif name in ("write_to_file", "replace_in_file"):
                                    files_modified.add(fpath)
                elif isinstance(content, str) and content.strip():
                    prefix = "User" if role == "user" else ("Assistant" if role == "assistant" else None)
                    if prefix:
                        text_lines.append(f"{prefix}: {content[:800]}")
        except Exception:
            return None
        if not text_lines:
            return None
        return ExtractedSession(
            agent="cline",
            source_session_id=ref.source_id,
            transcript_text="\n".join(text_lines[-120:]),
            started_at=started_at, ended_at=ended_at, cwd=None,
            model=model, tokens_used=None,
            files_read=sorted(files_read), files_modified=sorted(files_modified),
            schema_version=self.schema_version,
        )
