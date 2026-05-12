#!/usr/bin/env python3
"""
Evols UserPromptSubmit Hook
Fires before every user prompt is sent to Claude.
- Checks the prompt itself for redundancy against team knowledge graph
- Catches "a teammate already researched this" before Claude starts planning
- Complements PreToolUse (which catches individual tool calls mid-execution)
"""

import sys
import json
import os
import urllib.request
import urllib.parse
from pathlib import Path

EVOLS_DIR = Path.home() / ".evols"
CONFIG_FILE = EVOLS_DIR / "config.json"

SIMILARITY_THRESHOLD = 0.65
LOOKBACK_HOURS = 720
MIN_PROMPT_LEN = 30
LOG_FILE = EVOLS_DIR / "hook.log"


def log(msg: str):
    import datetime
    ts = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    try:
        with LOG_FILE.open("a") as f:
            f.write(f"{ts} [user_prompt_submit] {msg}\n")
    except Exception:
        pass


def load_config():
    env_url = os.environ.get("EVOLS_API_URL", "")
    env_key = os.environ.get("EVOLS_API_KEY", "")

    file_cfg = {}
    if CONFIG_FILE.exists():
        try:
            file_cfg = json.loads(CONFIG_FILE.read_text())
        except Exception:
            pass

    api_url = env_url or file_cfg.get("api_url", "")
    api_key = env_key or file_cfg.get("api_key", "")
    if not api_url or not api_key:
        return None
    return {"api_url": api_url, "api_key": api_key}


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

    prompt = hook_input.get("prompt", "").strip()
    if len(prompt) < MIN_PROMPT_LEN:
        log(f"prompt too short ({len(prompt)} chars), skipping")
        sys.exit(0)

    config = load_config()
    if not config:
        log("no config, skipping")
        sys.exit(0)

    log(f"checking redundancy for prompt: {prompt[:80]!r}")
    result = check_redundancy(config["api_url"], config["api_key"], prompt[:300])
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
            f"call get_team_context before starting fresh:\n"
            f"{sep}\n"
            f"{titles_block}\n"
            f"{sep}"
        )
    else:
        msg = (
            f"[Evols] A teammate already worked on something similar ({best.get('similarity', 0):.0%} match):\n"
            f"{sep}\n"
            f"  \"{best['title']}\"\n"
            f"  {best.get('hours_ago', '?'):.0f}h ago · ~{best.get('token_count', 0):,} tokens · ~{saving:,} tokens saved if reused\n"
            f"{sep}\n"
            f"{best.get('content_preview', '')}\n"
            f"{sep}\n"
            f"Reference the above if it covers your need before starting fresh."
        )

    print(json.dumps({"systemMessage": msg}))
    sys.exit(0)


if __name__ == "__main__":
    main()
