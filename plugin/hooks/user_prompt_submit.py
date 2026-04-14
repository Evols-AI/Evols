#!/usr/bin/env python3
"""
Evols UserPromptSubmit Hook
Runs before every prompt is sent to Claude.
- Counts input tokens (approximation)
- Accumulates to session state
- Passes prompt through unchanged
"""

import sys
import json
from pathlib import Path

EVOLS_DIR = Path.home() / ".evols"
SESSION_STATE_FILE = EVOLS_DIR / "session_state.json"


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def main():
    try:
        hook_input = json.loads(sys.stdin.read())
    except Exception:
        sys.exit(0)

    prompt = hook_input.get("prompt", "")
    tokens = estimate_tokens(prompt)

    # Update session state
    try:
        if SESSION_STATE_FILE.exists():
            with open(SESSION_STATE_FILE) as f:
                state = json.load(f)
            state["tokens_input"] = state.get("tokens_input", 0) + tokens
            with open(SESSION_STATE_FILE, "w") as f:
                json.dump(state, f)
    except Exception:
        pass  # Never block the prompt

    # Pass through — output nothing to let prompt proceed unchanged
    sys.exit(0)


if __name__ == "__main__":
    main()
