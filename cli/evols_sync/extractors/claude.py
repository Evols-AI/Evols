"""
Claude Code transcript extractor.

Source: ~/.claude/projects/<slug>/<session_id>.jsonl

Each line is a JSON entry with `message.role`, `message.content`, optional
`message.usage`, and the original `cwd` of the session. The slug is
"-Users-akshay-Desktop-workspace" — i.e. the absolute path with `/` → `-`.

We reuse the existing parsing primitives from hooks/stop.py to stay aligned
with what live hooks already ship to the backend.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, Optional

from .base import Extractor, ExtractedSession, SessionRef


CLAUDE_PROJECTS_DIR = Path.home() / ".claude" / "projects"


def _slug_to_path(slug: str) -> Optional[str]:
    """Reverse the Claude Code slug encoding: '-Users-akshay-foo' → '/Users/akshay/foo'."""
    if not slug.startswith("-"):
        return None
    return "/" + slug[1:].replace("-", "/")


class ClaudeExtractor:
    name = "claude"
    schema_version = "claude:1"
    experimental = False

    def is_present(self) -> bool:
        return CLAUDE_PROJECTS_DIR.is_dir()

    def discover(self) -> Iterable[SessionRef]:
        if not self.is_present():
            return
        for project_dir in CLAUDE_PROJECTS_DIR.iterdir():
            if not project_dir.is_dir():
                continue
            cwd = _slug_to_path(project_dir.name)
            for jsonl in project_dir.glob("*.jsonl"):
                try:
                    stat = jsonl.stat()
                except OSError:
                    continue
                # session_id is the filename without extension
                source_id = jsonl.stem
                yield SessionRef(
                    agent=self.name,
                    source_id=source_id,
                    source_path=str(jsonl),
                    source_mtime=int(stat.st_mtime),
                    source_size=stat.st_size,
                    cwd=cwd,
                )

    def extract(self, ref: SessionRef) -> Optional[ExtractedSession]:
        path = Path(ref.source_path)
        if not path.exists():
            return None

        # Re-implementing the bits of hooks/stop.py we need rather than
        # importing it (avoids loading the whole hook module + its sys.argv
        # parsing). Behaviour kept compatible.
        text_lines: list[str] = []
        files_read: set[str] = set()
        files_modified: set[str] = set()
        per_message: dict[str, dict] = {}
        no_id_totals = {
            "input_tokens": 0,
            "output_tokens": 0,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 0,
        }
        model = ""
        started_at = None
        ended_at = None

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
                        if not started_at:
                            started_at = ts
                        ended_at = ts

                    msg = entry.get("message", {})
                    role = msg.get("role", "")
                    content = msg.get("content", "")

                    # Token usage — last record per message_id wins (stop.py logic).
                    usage = msg.get("usage", {})
                    if usage:
                        m = msg.get("model", "")
                        if m:
                            model = m
                        mid = msg.get("id")
                        if mid:
                            per_message[mid] = usage
                        else:
                            for k in no_id_totals:
                                no_id_totals[k] += usage.get(k, 0)

                    # Transcript text
                    if role == "user" and isinstance(content, str) and content.strip():
                        text_lines.append(f"User: {content[:600]}")
                    elif role == "assistant":
                        if isinstance(content, str) and content.strip():
                            text_lines.append(f"Assistant: {content[:800]}")
                        elif isinstance(content, list):
                            for block in content:
                                if not isinstance(block, dict):
                                    continue
                                btype = block.get("type")
                                if btype == "text":
                                    text_lines.append(f"Assistant: {block.get('text', '')[:800]}")
                                elif btype == "tool_use":
                                    name = block.get("name")
                                    inp = block.get("input", {})
                                    text_lines.append(f"Tool: {name}({json.dumps(inp)[:300]})")
                                    # Track files
                                    fpath = inp.get("file_path") or inp.get("filePath") or inp.get("path")
                                    if fpath:
                                        if name in ("Read", "Glob", "Grep"):
                                            files_read.add(fpath)
                                        elif name in ("Edit", "Write", "MultiEdit", "NotebookEdit"):
                                            files_modified.add(fpath)
        except Exception:
            return None

        if not text_lines:
            return None

        # Sum tokens
        totals = dict(no_id_totals)
        for usage in per_message.values():
            for k in totals:
                totals[k] += usage.get(k, 0)
        tokens_used = (
            totals["input_tokens"]
            + totals["output_tokens"]
            + totals["cache_creation_input_tokens"]
        ) or None

        # Keep last 120 turns to bound transcript size — server does extraction.
        transcript = "\n".join(text_lines[-120:])

        return ExtractedSession(
            agent=self.name,
            source_session_id=ref.source_id,
            transcript_text=transcript,
            started_at=started_at,
            ended_at=ended_at,
            cwd=ref.cwd,
            model=model or None,
            tokens_used=tokens_used,
            files_read=sorted(files_read),
            files_modified=sorted(files_modified),
            partial_transcript=False,
            schema_version=self.schema_version,
        )
