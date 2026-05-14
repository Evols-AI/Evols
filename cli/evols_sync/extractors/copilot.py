"""
GitHub Copilot chat transcript extractor.

Sources:
  - ~/Library/Application Support/Code/User/workspaceStorage/*/github.copilot*chat*.json
  - ~/Library/Application Support/Code/User/globalStorage/github.copilot-chat/*.json
  - ~/.config/Code/User/workspaceStorage/*/github.copilot*chat*.json
  - ~/.config/Code/User/globalStorage/github.copilot-chat/*.json

Copilot stores chat conversations in JSON files with varying formats depending
on the version. This extractor handles multiple known shapes.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, Optional

from .base import Extractor, SessionRef, ExtractedSession


def _copilot_conversations_dirs() -> list[Path]:
    """Return paths to GitHub Copilot chat history directories."""
    candidates = [
        Path.home() / "Library" / "Application Support" / "Code" / "User" / "workspaceStorage",
        Path.home() / ".config" / "Code" / "User" / "workspaceStorage",
    ]
    return [p for p in candidates if p.is_dir()]


class CopilotExtractor:
    name = "copilot"
    schema_version = "copilot:1"
    experimental = True

    def is_present(self) -> bool:
        return bool(_copilot_conversations_dirs())

    def discover(self) -> Iterable[SessionRef]:
        # Workspace-scoped chat files
        for ws_dir in _copilot_conversations_dirs():
            for workspace in ws_dir.iterdir():
                if not workspace.is_dir():
                    continue
                chat_files = list(workspace.glob("**/github.copilot*chat*.json"))
                for chat_file in chat_files:
                    try:
                        stat = chat_file.stat()
                    except OSError:
                        continue
                    yield SessionRef(
                        agent="copilot",
                        source_id=f"{workspace.name}:{chat_file.stem}",
                        source_path=str(chat_file),
                        source_mtime=int(stat.st_mtime),
                        source_size=stat.st_size,
                    )
        # Global storage chat files
        global_candidates = [
            Path.home() / "Library" / "Application Support" / "Code" / "User" / "globalStorage" / "github.copilot-chat",
            Path.home() / ".config" / "Code" / "User" / "globalStorage" / "github.copilot-chat",
        ]
        for gdir in global_candidates:
            if not gdir.is_dir():
                continue
            for chat_file in gdir.rglob("*.json"):
                try:
                    stat = chat_file.stat()
                    if stat.st_size < 100:
                        continue
                except OSError:
                    continue
                yield SessionRef(
                    agent="copilot",
                    source_id=chat_file.stem,
                    source_path=str(chat_file),
                    source_mtime=int(stat.st_mtime),
                    source_size=stat.st_size,
                )

    def extract(self, ref: SessionRef) -> Optional[ExtractedSession]:
        path = Path(ref.source_path)
        if not path.exists():
            return None
        text_lines: list[str] = []
        started_at = ended_at = model = None
        try:
            data = json.loads(path.read_text(encoding="utf-8", errors="replace"))
            conversations: list = []
            if isinstance(data, list):
                conversations = data
            elif isinstance(data, dict):
                conversations = data.get("conversations") or data.get("threads") or data.get("messages") or []
                if not conversations and "turns" in data:
                    conversations = data["turns"]

            for conv in conversations:
                if not isinstance(conv, dict):
                    continue
                messages = conv.get("messages") or conv.get("turns") or [conv]
                for msg in messages:
                    if not isinstance(msg, dict):
                        continue
                    ts = msg.get("timestamp") or msg.get("createdAt") or msg.get("date")
                    if ts:
                        started_at = started_at or str(ts)
                        ended_at = str(ts)
                    role = msg.get("role") or msg.get("author") or ""
                    content = msg.get("content") or msg.get("text") or msg.get("message") or ""
                    if isinstance(content, str) and content.strip():
                        if role in ("user", "human"):
                            text_lines.append(f"User: {content[:600]}")
                        elif role in ("assistant", "bot", "copilot"):
                            text_lines.append(f"Assistant: {content[:800]}")
                    elif isinstance(content, list):
                        for block in content:
                            if isinstance(block, dict):
                                txt = block.get("text") or block.get("value") or ""
                                if txt:
                                    prefix = "User" if role in ("user", "human") else "Assistant"
                                    text_lines.append(f"{prefix}: {txt[:800]}")
        except Exception:
            return None
        if not text_lines:
            return None
        return ExtractedSession(
            agent="copilot",
            source_session_id=ref.source_id,
            transcript_text="\n".join(text_lines[-100:]),
            started_at=started_at, ended_at=ended_at, cwd=None,
            model=model, tokens_used=None,
            files_read=[], files_modified=[],
            schema_version=self.schema_version,
        )
