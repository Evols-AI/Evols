#!/usr/bin/env python3
"""
Evols PostToolUse Hook
Runs after every tool call completes.
- Counts output tokens from tool results
- Captures notable outputs (file writes, decisions) for later sync
"""

import sys
import json
from pathlib import Path

EVOLS_DIR = Path.home() / ".evols"
SESSION_STATE_FILE = EVOLS_DIR / "session_state.json"

# Tools that produce knowledge worth tracking
KNOWLEDGE_TOOLS = {"Write", "Edit", "Bash", "WebFetch"}


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def main():
    try:
        hook_input = json.loads(sys.stdin.read())
    except Exception:
        sys.exit(0)

    tool_name = hook_input.get("tool_name", "")
    tool_output = hook_input.get("tool_output", "")
    if isinstance(tool_output, dict):
        tool_output = json.dumps(tool_output)

    tokens = estimate_tokens(str(tool_output))

    try:
        if SESSION_STATE_FILE.exists():
            with open(SESSION_STATE_FILE) as f:
                state = json.load(f)
            state["tokens_output"] = state.get("tokens_output", 0) + tokens

            # Track notable tool outputs for knowledge sync
            if tool_name in KNOWLEDGE_TOOLS and len(str(tool_output)) > 200:
                outputs = state.get("tool_outputs", [])
                outputs.append({"tool": tool_name, "summary": str(tool_output)[:300]})
                state["tool_outputs"] = outputs[-20:]  # Keep last 20

            with open(SESSION_STATE_FILE, "w") as f:
                json.dump(state, f)
    except Exception:
        pass

    sys.exit(0)


if __name__ == "__main__":
    main()
