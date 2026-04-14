#!/usr/bin/env python3
"""
Evols Stop / StopFailure Hook
Runs when a Claude Code session ends (normally or due to rate limit).
- Reads accumulated session token counts
- Syncs quota event to Evols API
- Displays token savings summary to user
"""

import sys
import json
import os
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path
from datetime import datetime

EVOLS_DIR = Path.home() / ".evols"
CONFIG_FILE = EVOLS_DIR / "config.json"
SESSION_STATE_FILE = EVOLS_DIR / "session_state.json"


def load_config():
    if not CONFIG_FILE.exists():
        return None
    with open(CONFIG_FILE) as f:
        return json.load(f)


def post_quota_event(api_url, api_key, payload):
    url = f"{api_url.rstrip('/')}/api/v1/team-knowledge/quota/events"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read())
    except Exception:
        return None


def main():
    is_failure = "--failure" in sys.argv

    try:
        hook_input = json.loads(sys.stdin.read())
    except Exception:
        hook_input = {}

    config = load_config()
    if not config:
        sys.exit(0)

    api_url = config.get("api_url", "")
    api_key = config.get("api_key", "")
    if not api_url or not api_key:
        sys.exit(0)

    # Read session state
    if not SESSION_STATE_FILE.exists():
        sys.exit(0)

    try:
        with open(SESSION_STATE_FILE) as f:
            state = json.load(f)
    except Exception:
        sys.exit(0)

    session_id = state.get("session_id", "unknown")
    tokens_input = state.get("tokens_input", 0)
    tokens_output = state.get("tokens_output", 0)
    tokens_retrieved = state.get("tokens_retrieved", 0)
    plan_type = state.get("plan_type", "pro")
    cwd = state.get("cwd", "")
    total_tokens = tokens_input + tokens_output

    # Compression ratio = 8x, so savings = retrieved * 7
    tokens_saved = tokens_retrieved * 7
    compression_ratio = 8.0

    # Record event type
    event_type = "rate_limit_hit" if is_failure else "session_end"

    # Sync to API
    payload = {
        "session_id": session_id,
        "tokens_used": total_tokens,
        "tokens_retrieved": tokens_retrieved,
        "event_type": event_type,
        "tool_name": "claude-code",
        "plan_type": plan_type,
        "cwd": cwd,
    }
    post_quota_event(api_url, api_key, payload)

    # Display summary
    if is_failure:
        print(f"\n[Evols] ⚠  Session ended due to rate limit/quota.")
        print(f"         Session tokens used: ~{total_tokens:,}")
        print(f"         This event has been recorded for your team's quota tracking.\n")
    else:
        print(f"\n[Evols] Session complete.")
        print(f"  Tokens used this session:     ~{total_tokens:,}")
        if tokens_retrieved > 0:
            print(f"  Tokens retrieved from graph:   {tokens_retrieved:,}")
            print(f"  Est. tokens saved:             ~{tokens_saved:,}  ({compression_ratio:.0f}x compression)")
        print(f"\n  Use /evols-sync to add insights from this session to the team graph.\n")

    # Clean up session state
    try:
        SESSION_STATE_FILE.unlink()
    except Exception:
        pass

    sys.exit(0)


if __name__ == "__main__":
    main()
