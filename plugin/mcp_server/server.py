#!/usr/bin/env python3
"""
Evols MCP Server
Provides Claude Code (and other MCP-compatible tools) with:
  - get_team_context: Retrieve relevant team knowledge for current task
  - sync_session_context: Add a knowledge entry to the team graph
  - get_quota_status: Team token savings summary

Install dependencies: pip install mcp requests
"""

import json
import os
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("Error: 'requests' package required. Run: pip install requests", file=sys.stderr)
    sys.exit(1)

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    print("Error: 'mcp' package required. Run: pip install mcp", file=sys.stderr)
    sys.exit(1)

# ------------------------------------------------------------------ #
# Config
# ------------------------------------------------------------------ #

CONFIG_FILE = Path.home() / ".evols" / "config.json"


def load_config():
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE) as f:
            return json.load(f)
    # Fallback to environment variables
    return {
        "api_url": os.environ.get("EVOLS_API_URL", ""),
        "api_key": os.environ.get("EVOLS_API_KEY", ""),
        "plan_type": os.environ.get("EVOLS_PLAN", "pro"),
    }


def api_headers(api_key: str) -> dict:
    return {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}


# ------------------------------------------------------------------ #
# MCP Server
# ------------------------------------------------------------------ #

mcp = FastMCP("evols")


@mcp.tool()
def get_team_context(
    query: str,
    role: str = "",
    top_k: int = 5,
) -> str:
    """
    Retrieve relevant team knowledge for your current task.

    Use this at the start of a session or before tackling a problem to:
    - Find what your teammates already know about this topic
    - Get pre-compiled context instead of starting from scratch
    - See estimated tokens saved vs. compiling fresh

    Args:
        query: Describe what you're working on (e.g. "onboarding drop-off analysis", "pricing research")
        role: Optional filter — pm, engineer, designer, qa (leave blank for all)
        top_k: Number of entries to retrieve (default 5, max 20)
    """
    config = load_config()
    api_url = config.get("api_url", "")
    api_key = config.get("api_key", "")

    if not api_url or not api_key:
        return "Evols not configured. Run the install script: bash ~/.evols/install.sh"

    params = {"query": query, "top_k": min(top_k, 20)}
    if role:
        params["role"] = role

    try:
        resp = requests.get(
            f"{api_url.rstrip('/')}/api/v1/team-knowledge/relevant",
            params=params,
            headers=api_headers(api_key),
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return f"Could not reach Evols API: {e}"

    if data.get("entry_count", 0) == 0:
        return "No relevant team knowledge found yet. Your team's knowledge graph grows as sessions complete."

    tokens_retrieved = data.get("tokens_retrieved", 0)
    tokens_saved = data.get("tokens_saved_estimate", 0)
    entry_count = data.get("entry_count", 0)

    header = (
        f"## Team Knowledge — {entry_count} entries retrieved\n"
        f"*{tokens_retrieved} tokens · ~{tokens_saved} tokens saved vs. compiling fresh*\n\n"
    )
    return header + data.get("context_text", "")


@mcp.tool()
def sync_session_context(
    title: str,
    content: str,
    role: str = "other",
    session_type: str = "other",
    entry_type: str = "insight",
    tags: str = "",
    product_area: str = "",
) -> str:
    """
    Add a knowledge entry to the team graph from this session.

    Call this at the end of a session to capture insights, decisions,
    or research findings so your team inherits this context automatically.

    Args:
        title: Short descriptive title (e.g. "SMB churn triggers — retention research")
        content: The compiled knowledge (insights, decisions, key findings)
        role: Your role — pm, engineer, designer, qa, other
        session_type: Session type — research, planning, code, analysis, review, other
        entry_type: insight, decision, artifact, research_finding, pattern, context
        tags: Comma-separated tags (e.g. "onboarding,retention,smb")
        product_area: Product area this relates to (e.g. "onboarding", "billing")
    """
    config = load_config()
    api_url = config.get("api_url", "")
    api_key = config.get("api_key", "")

    if not api_url or not api_key:
        return "Evols not configured. Run the install script: bash ~/.evols/install.sh"

    payload = {
        "title": title,
        "content": content,
        "role": role,
        "session_type": session_type,
        "entry_type": entry_type,
        "tags": [t.strip() for t in tags.split(",") if t.strip()],
        "product_area": product_area or None,
    }

    try:
        resp = requests.post(
            f"{api_url.rstrip('/')}/api/v1/team-knowledge/entries",
            json=payload,
            headers=api_headers(api_key),
            timeout=10,
        )
        resp.raise_for_status()
        entry = resp.json()
    except Exception as e:
        return f"Could not sync to Evols: {e}"

    token_count = entry.get("token_count", 0)
    entry_id = entry.get("id")
    return (
        f"✓ Added to team knowledge graph (entry #{entry_id})\n"
        f"  Title: {title}\n"
        f"  Role: {role} · Type: {entry_type}\n"
        f"  Size: ~{token_count} tokens\n"
        f"  Your team inherits this context from their next session."
    )


@mcp.tool()
def get_quota_status(days: int = 7) -> str:
    """
    Show your team's token savings summary.

    Displays:
    - Total tokens saved this week vs. compiling knowledge fresh
    - Quota extension percentage
    - Knowledge graph growth
    - Rate limit incidents

    Args:
        days: Lookback period in days (default 7)
    """
    config = load_config()
    api_url = config.get("api_url", "")
    api_key = config.get("api_key", "")

    if not api_url or not api_key:
        return "Evols not configured."

    try:
        resp = requests.get(
            f"{api_url.rstrip('/')}/api/v1/team-knowledge/quota/summary",
            params={"days": days},
            headers=api_headers(api_key),
            timeout=10,
        )
        resp.raise_for_status()
        s = resp.json()
    except Exception as e:
        return f"Could not reach Evols API: {e}"

    lines = [
        f"## Evols Team Intelligence — Last {s['period_days']} days",
        f"",
        f"  Sessions tracked:          {s['sessions']}",
        f"  Tokens used:               ~{s['tokens_used']:,}",
        f"  Tokens retrieved (graph):  ~{s['tokens_retrieved']:,}",
        f"  Est. tokens saved:         ~{s['tokens_saved_estimate']:,}  ✦",
        f"  Quota extended by:         ~{s['quota_extended_pct']}%",
        f"",
        f"  Knowledge graph entries:   {s['knowledge_entries_total']} total  (+{s['knowledge_entries_new']} this period)",
    ]
    if s.get("rate_limit_hits", 0) > 0:
        lines.append(f"  Rate limit hits:           {s['rate_limit_hits']} (recorded for team visibility)")

    return "\n".join(lines)


# ------------------------------------------------------------------ #
# Entry point
# ------------------------------------------------------------------ #

if __name__ == "__main__":
    mcp.run(transport="stdio")
