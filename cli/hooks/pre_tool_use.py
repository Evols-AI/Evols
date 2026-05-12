#!/usr/bin/env python3
"""
Evols PreToolUse Hook
Fires BEFORE Bash/WebFetch/Agent tool calls execute.
- Checks redundancy against team knowledge graph
- Returns additionalContext warning if match found (does not block)
- Runs in <100ms to avoid slowing tool execution
"""

import sys
import json
import os
import urllib.request
import urllib.parse
from pathlib import Path

EVOLS_DIR = Path.home() / ".evols"
CONFIG_FILE = EVOLS_DIR / "config.json"

REDUNDANCY_CHECK_TOOLS = {"Bash", "WebFetch", "Agent"}
SIMILARITY_THRESHOLD = 0.65
LOOKBACK_HOURS = 720
MIN_QUERY_LEN = 40
LOG_FILE = EVOLS_DIR / "hook.log"


def log(msg: str):
    import datetime
    ts = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    try:
        with LOG_FILE.open("a") as f:
            f.write(f"{ts} [pre_tool_use] {msg}\n")
    except Exception:
        pass


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


def extract_query(tool_name: str, tool_input: dict) -> str:
    if tool_name == "Bash":
        return tool_input.get("command", "").strip()[:300]
    elif tool_name == "WebFetch":
        url = tool_input.get("url", "")
        prompt = tool_input.get("prompt", "")
        return f"{prompt} {url}".strip()[:300]
    elif tool_name == "Agent":
        return tool_input.get("prompt", "").strip()[:300]
    return ""


def check_redundancy(api_url: str, api_key: str, query: str) -> dict | None:
    params = urllib.parse.urlencode({
        "query": query,
        "hours": LOOKBACK_HOURS,
        "similarity_threshold": SIMILARITY_THRESHOLD,
    })
    url = f"{api_url.rstrip('/')}/api/v1/team-knowledge/redundancy-check?{params}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {api_key}"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            return json.loads(resp.read())
    except Exception:
        return None


def main():
    try:
        hook_input = json.loads(sys.stdin.read())
    except Exception:
        log("failed to parse stdin")
        sys.exit(0)

    tool_name = hook_input.get("tool_name", "")
    if tool_name not in REDUNDANCY_CHECK_TOOLS:
        sys.exit(0)

    config = load_config()
    if not config:
        log("no config, skipping")
        sys.exit(0)

    query = extract_query(tool_name, hook_input.get("tool_input", {}))
    if len(query) < MIN_QUERY_LEN:
        log(f"query too short for {tool_name} ({len(query)} chars), skipping")
        sys.exit(0)

    log(f"checking redundancy for {tool_name}: {query[:60]!r}")
    result = check_redundancy(config["api_url"], config["api_key"], query)
    if not result or not result.get("found"):
        log(f"no match (found={result.get('found') if result else 'error'})")
        sys.exit(0)

    entries = result["similar_entries"]
    best = entries[0]
    saving = result.get("estimated_saving", 0)
    is_soft = result.get("is_soft_match", False)
    log(f"match found: {best.get('title')!r} soft={is_soft}")
    sep = "-" * 60

    if is_soft:
        titles_block = "\n".join(
            f"  {i+1}. \"{e['title']}\" · {e.get('hours_ago', 0):.0f}h ago · ~{e.get('token_count', 0):,} tokens"
            for i, e in enumerate(entries)
        )
        msg = (
            f"[Evols] Related team knowledge found. Review these titles — if any cover your request, "
            f"call get_team_context before proceeding:\n"
            f"{sep}\n"
            f"{titles_block}\n"
            f"{sep}"
        )
    else:
        msg = (
            f"[Evols] A teammate already did similar work ({best.get('similarity', 0):.0%} match):\n"
            f"{sep}\n"
            f"  \"{best['title']}\"\n"
            f"  {best.get('hours_ago', '?'):.0f}h ago · ~{best.get('token_count', 0):,} tokens · ~{saving:,} tokens saved if reused\n"
            f"{sep}\n"
            f"{best.get('content_preview', '')}\n"
            f"{sep}\n"
            f"Reuse the above if it covers your need. Proceed only if this is genuinely different work."
        )

    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "additionalContext": msg,
        }
    }))
    sys.exit(0)


if __name__ == "__main__":
    main()
