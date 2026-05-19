#!/usr/bin/env python3
"""
Evols PreCompact Hook
Fires BEFORE Claude Code compacts the conversation context.
This is the right moment to sync knowledge — the full conversation is still intact
and hasn't been truncated yet. Replaces relying on the Stop hook which fires after
compaction has already discarded most of the conversation.
"""

import sys
import json
import os
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from knowledge_extract import (  # noqa: E402
    is_worthwhile_transcript,
    try_local_llm_extraction,
    build_structured_payload,
)

EVOLS_DIR = Path.home() / ".evols"
CONFIG_FILE = EVOLS_DIR / "config.json"
SESSION_STATE_FILE = EVOLS_DIR / "session_state.json"

MIN_TOKENS_TO_SYNC = 300  # skip trivial sessions


def load_config():
    env_url = os.environ.get("EVOLS_API_URL", "")
    env_key = os.environ.get("EVOLS_API_KEY", "")
    env_plan = os.environ.get("EVOLS_PLAN", "")

    file_cfg = {}
    if CONFIG_FILE.exists():
        try:
            file_cfg = json.loads(CONFIG_FILE.read_text())
        except Exception:
            pass

    api_url = env_url or file_cfg.get("api_url", "")
    api_key = env_key or file_cfg.get("api_key", "")
    plan_type = env_plan or file_cfg.get("plan_type", "pro")
    if not api_url or not api_key:
        return None
    return {"api_url": api_url, "api_key": api_key, "plan_type": plan_type}


def extract_transcript_text(transcript_path: str) -> str:
    """Read transcript JSONL and return last 80 turns of conversation text."""
    lines_out = []
    try:
        with open(transcript_path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    msg = entry.get("message", {})
                    role = msg.get("role", "")
                    content = msg.get("content", "")

                    if role == "user" and isinstance(content, str) and content.strip():
                        lines_out.append(f"User: {content[:400]}")
                    elif role == "assistant":
                        if isinstance(content, str) and content.strip():
                            lines_out.append(f"Assistant: {content[:600]}")
                        elif isinstance(content, list):
                            for block in content:
                                if isinstance(block, dict):
                                    if block.get("type") == "text":
                                        lines_out.append(f"Assistant: {block.get('text', '')[:600]}")
                                    elif block.get("type") == "tool_use":
                                        lines_out.append(f"Tool: {block.get('name')}({json.dumps(block.get('input', {}))[:200]})")
                except Exception:
                    continue
    except Exception:
        pass
    return "\n".join(lines_out[-80:])


def sync_knowledge(api_url: str, api_key: str, transcript_text: str,
                   session_id: str, files_read: list, files_modified: list) -> dict | None:
    """
    Extract and sync session knowledge before compaction.
    Tries on-device LLM first (Apple Foundation Models, then Phi Silica),
    falls back to server-side extraction via /auto-sync which uses the
    tenant's BYOK LLM config.
    """
    extracted = try_local_llm_extraction(transcript_text)
    if extracted:
        try:
            sync_payload = build_structured_payload(
                extracted,
                source_session_id=session_id,
                files_read=files_read,
                files_modified=files_modified,
                source="claude-code",
            )
            req = urllib.request.Request(
                f"{api_url.rstrip('/')}/api/v1/team-knowledge/entries",
                data=json.dumps(sync_payload).encode("utf-8"),
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read())
        except Exception:
            pass  # fall through to server-side

    # Server-side extraction via BYOK LLM config
    try:
        sync_payload = {
            "session_text": transcript_text,
            "source_session_id": session_id,
            "files_read": files_read or [],
            "files_modified": files_modified or [],
            "tool_name": "claude-code",
        }
        req = urllib.request.Request(
            f"{api_url.rstrip('/')}/api/v1/team-knowledge/auto-sync",
            data=json.dumps(sync_payload).encode("utf-8"),
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read())
    except Exception:
        return None


def main():
    try:
        hook_input = json.loads(sys.stdin.read())
    except Exception:
        sys.exit(0)

    config = load_config()
    if not config:
        sys.exit(0)

    transcript_path = hook_input.get("transcript_path", "")
    if not transcript_path:
        sys.exit(0)

    # Load session state for file tracking and session_id
    session_id = hook_input.get("session_id", "unknown")
    files_read, files_modified = [], []
    if SESSION_STATE_FILE.exists():
        try:
            state = json.loads(SESSION_STATE_FILE.read_text())
            session_id = state.get("session_id", session_id)
            files_read = state.get("files_read", [])
            files_modified = state.get("files_modified", [])
        except Exception:
            pass

    transcript_text = extract_transcript_text(transcript_path)
    if not transcript_text or len(transcript_text) < MIN_TOKENS_TO_SYNC * 4:
        sys.exit(0)

    if not is_worthwhile_transcript(transcript_text, len(transcript_text) // 4):
        sys.exit(0)

    entry = sync_knowledge(
        config["api_url"], config["api_key"],
        transcript_text, session_id,
        files_read, files_modified,
    )

    if entry:
        entry_id = entry.get("id") or entry.get("entry_id", "?")
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreCompact",
                "additionalContext": f"[Evols] Knowledge synced before compaction → entry #{entry_id} saved to team graph.",
            }
        }))

    sys.exit(0)


if __name__ == "__main__":
    main()
