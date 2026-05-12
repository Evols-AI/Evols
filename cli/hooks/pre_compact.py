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


def sync_knowledge_via_haiku(api_url: str, api_key: str, transcript_text: str,
                              session_id: str, files_read: list, files_modified: list) -> dict | None:
    """Call Haiku to extract structured knowledge, then POST to Evols team knowledge graph."""
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not anthropic_key:
        return fallback_sync_knowledge(api_url, api_key, session_id, transcript_text, files_read, files_modified)

    prompt = (
        "You are extracting team knowledge from an AI coding session transcript.\n\n"
        "Given the session below, extract a knowledge entry with:\n"
        "- title: one-line description of what was accomplished or decided (max 80 chars)\n"
        "- content: problem statement, approach taken, key decisions, outcome, "
        "and importantly — what alternatives were considered and rejected (4-10 sentences)\n"
        "- reasoning: the 'why' behind key decisions — constraints, tradeoffs, prior failures "
        "that shaped the approach (2-4 sentences)\n"
        "- entry_type: one of: insight, decision, artifact, research_finding, pattern, context\n"
        "- tags: 2-5 comma-separated keywords\n"
        "- product_area: the product/code area affected (or empty string)\n\n"
        "If the session is trivial (just questions, no real work done), respond with: SKIP\n\n"
        f"Session transcript:\n{transcript_text}\n\n"
        "Respond ONLY with a JSON object with keys: title, content, reasoning, entry_type, tags, product_area"
    )

    payload = {
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 700,
        "messages": [{"role": "user", "content": prompt}],
    }

    try:
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=json.dumps(payload).encode(),
            headers={
                "x-api-key": anthropic_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            result = json.loads(resp.read())

        raw = result.get("content", [{}])[0].get("text", "").strip()
        if raw == "SKIP" or not raw:
            return None

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        extracted = json.loads(raw.strip())

        # Merge reasoning into content so it's stored in the main text field
        content = extracted.get("content", "")
        reasoning = extracted.get("reasoning", "")
        if reasoning:
            content = f"{content}\n\n**Reasoning:** {reasoning}"

        sync_payload = {
            "title": extracted.get("title", "Untitled session"),
            "content": content,
            "role": "other",
            "session_type": "code",
            "entry_type": extracted.get("entry_type", "insight"),
            "tags": [t.strip() for t in extracted.get("tags", "").split(",") if t.strip()],
            "product_area": extracted.get("product_area") or None,
            "source_session_id": session_id,
            "files_read": files_read or [],
            "files_modified": files_modified or [],
        }

        sync_req = urllib.request.Request(
            f"{api_url.rstrip('/')}/api/v1/team-knowledge/entries",
            data=json.dumps(sync_payload).encode(),
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(sync_req, timeout=10) as resp:
            entry = json.loads(resp.read())
            return entry
    except Exception:
        return fallback_sync_knowledge(api_url, api_key, session_id, transcript_text, files_read, files_modified)


def fallback_sync_knowledge(api_url: str, api_key: str, session_id: str,
                            transcript_text: str, files_read: list, files_modified: list) -> dict | None:
    """Simple rule-based knowledge sync for pre-compaction fallback."""
    title = "Pre-compaction sync (fallback)"
    lines = transcript_text.split("\n")
    for line in lines:
        if line.startswith("User:"):
            title = line[5:].strip()[:80]
            break

    sync_payload = {
        "title": title,
        "content": f"Pre-compaction checkpoint for session {session_id}.\n\nTranscript snippet:\n" + transcript_text[-800:],
        "role": "other",
        "session_type": "code",
        "entry_type": "insight",
        "tags": ["checkpoint", "fallback"],
        "source_session_id": session_id,
        "files_read": files_read or [],
        "files_modified": files_modified or [],
    }

    try:
        sync_req = urllib.request.Request(
            f"{api_url.rstrip('/')}/api/v1/team-knowledge/entries",
            data=json.dumps(sync_payload).encode(),
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(sync_req, timeout=10) as resp:
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

    entry = sync_knowledge_via_haiku(
        config["api_url"], config["api_key"],
        transcript_text, session_id,
        files_read, files_modified,
    )

    if entry:
        entry_id = entry.get("id", "?")
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreCompact",
                "additionalContext": f"[Evols] Knowledge synced before compaction → entry #{entry_id} saved to team graph.",
            }
        }))

    sys.exit(0)


if __name__ == "__main__":
    main()
