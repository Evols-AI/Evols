"""
Seed the "Evols AI" agent directly into LibreChat's MongoDB.

No LibreChat login required — writes the agent document directly, which means:
  - No timing dependency on LibreChat being up
  - No admin credentials needed at runtime
  - Safe to run as part of deploy (idempotent via upsert)

The agent is marked is_promoted=True so it is visible to all users without
any per-user setup.

Usage:
  python scripts/seed_librechat_agent.py

Environment variables:
  LIBRECHAT_MONGO_URI   MongoDB connection string (default: mongodb://localhost:27017/evols-workbench)
  EVOLS_ADMIN_OBJECT_ID 24-hex-char ObjectId to use as author (default: a stable sentinel ID)

Run from the evols/backend directory:
  python scripts/seed_librechat_agent.py
"""

import sys
import os
import string
import random
from datetime import datetime, timezone

from pymongo import MongoClient, UpdateOne

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.skill_loader_service import get_skill_loader

# ── Config ────────────────────────────────────────────────────────────────────

MONGO_URI = os.getenv("LIBRECHAT_MONGO_URI", "mongodb://localhost:27017/evols-workbench")

# Stable sentinel ObjectId used as agent author so the agent is never tied to a
# real user account. Must be a valid 24-char hex string.
SYSTEM_AUTHOR_OID = os.getenv("EVOLS_ADMIN_OBJECT_ID", "000000000000000000000001")

AGENT_NAME = "Evols AI"
AGENT_CATEGORY = "evols"
AGENT_ID = "agent_evols_ai"          # Fixed ID — stable across re-runs

# MCP tool names: {tool_name}_mcp_{server_name}
# server_name must match the key in librechat.yaml mcpServers block
_MCP_SERVER = "evols"

MCP_TOOLS = [
    f"get_skill_details_mcp_{_MCP_SERVER}",
    f"get_work_context_summary_mcp_{_MCP_SERVER}",
    f"get_personas_mcp_{_MCP_SERVER}",
    f"get_themes_mcp_{_MCP_SERVER}",
    f"get_feedback_items_mcp_{_MCP_SERVER}",
    f"get_product_strategy_mcp_{_MCP_SERVER}",
    f"get_customer_segments_mcp_{_MCP_SERVER}",
    f"get_competitive_landscape_mcp_{_MCP_SERVER}",
    f"get_features_mcp_{_MCP_SERVER}",
    f"get_past_skill_work_mcp_{_MCP_SERVER}",
]

# ── System prompt ─────────────────────────────────────────────────────────────

def build_system_prompt(catalog: str) -> str:
    return f"""You are Evols AI, an intelligent product management assistant with deep knowledge of the user's product, customers, and strategy.

## Available Skills

You have access to a library of PM skills. Each skill provides expert instructions for a specific type of analysis or document. When a user's request maps to a skill, call `get_skill_details` with the skill name to load the full instructions, then follow them.

{catalog}

## How to respond

1. **Identify intent** — Does the user's request match one of the skills above?
2. **If yes** — Call `get_skill_details("<skill-name>")` to get the full instructions. Follow those instructions exactly, calling the data tools the skill recommends.
3. **If no** — Answer directly using the available data tools as needed. You do not need to use a skill for every message.

## Data tools available

- `get_work_context_summary` — user's role, projects, tasks, and priorities
- `get_personas` — customer persona profiles
- `get_themes` — clustered feedback themes
- `get_feedback_items` — raw customer feedback
- `get_product_strategy` — product vision and strategic bets
- `get_customer_segments` — customer segment definitions
- `get_competitive_landscape` — competitive analysis
- `get_features` — product initiatives and RICE scores
- `get_past_skill_work` — prior AI-generated analyses and documents

## Generating Documents

When generating any substantial document (PRD, analysis, strategy brief, report), output it as a **single artifact** using this exact format:

:::artifact{{identifier="<kebab-case-id>" type="text/markdown" title="<Document Title>"}}
```
# Document content here (raw markdown, no wrapping code fences)
```
:::

Rules:
- One artifact per response — never split a document into multiple artifacts.
- Use `type="text/markdown"` for all PM documents so they render as formatted markdown.
- Put the **entire document** inside a single artifact block — do not mix artifact content with inline code fences.
- Do not wrap the artifact content in a named code fence (e.g. ` ```markdown ` or ` ```yaml `). Just use plain ` ``` `.

## Principles

- Always ground responses in the user's actual product data — call tools before drawing conclusions.
- Be concise in conversation but thorough in documents.
- If multiple skills are relevant, start with the most specific one. Skills can reference each other — follow those references.
"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def extract_mcp_server_names(tools: list[str]) -> list[str]:
    """Mirror LibreChat's extractMCPServerNames — split on '_mcp_', take last segment."""
    delimiter = "_mcp_"
    seen = set()
    for tool in tools:
        if delimiter in tool:
            parts = tool.split(delimiter)
            seen.add(parts[-1])
    return list(seen)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    from bson import ObjectId

    print("→ Loading skills catalog…")
    loader = get_skill_loader()
    catalog = loader.get_skill_catalog()
    skill_count = len(loader.load_all_skills())
    print(f"  Loaded {skill_count} skills")

    print(f"→ Connecting to MongoDB at {MONGO_URI}…")
    client = MongoClient(MONGO_URI)
    db_name = MONGO_URI.rsplit("/", 1)[-1].split("?")[0]
    db = client[db_name]
    agents_col = db["agents"]
    print(f"  Connected to database '{db_name}'")

    now = datetime.now(timezone.utc)
    system_prompt = build_system_prompt(catalog)
    author_oid = ObjectId(SYSTEM_AUTHOR_OID)

    doc = {
        "id": AGENT_ID,
        "name": AGENT_NAME,
        "description": (
            "Your intelligent PM assistant — grounded in your product data "
            "and equipped with expert skills for strategy, research, and execution."
        ),
        "instructions": system_prompt,
        "provider": "Bedrock (AWS)",
        "model": "us.anthropic.claude-sonnet-4-6",
        "tools": MCP_TOOLS,
        "mcpServerNames": extract_mcp_server_names(MCP_TOOLS),
        "category": AGENT_CATEGORY,
        "is_promoted": True,
        "author": author_oid,
        "authorName": "Evols",
        "conversation_starters": [
            "What are my top customer pain points?",
            "Help me write a PRD for my next feature",
            "Run a SWOT analysis on our current strategy",
            "What should I prioritize on the roadmap this quarter?",
        ],
        "edges": [],
        "versions": [],
        "tool_resources": {},
        "updatedAt": now,
    }

    result = agents_col.update_one(
        {"id": AGENT_ID},
        {
            "$set": doc,
            "$setOnInsert": {"createdAt": now},
        },
        upsert=True,
    )

    if result.upserted_id:
        print(f"✓ Created agent '{AGENT_NAME}' (id: {AGENT_ID})")
    else:
        print(f"✓ Updated agent '{AGENT_NAME}' (id: {AGENT_ID})")

    print(f"\n  Model:    us.anthropic.claude-sonnet-4-6 via Bedrock (AWS)")
    print(f"  Tools:    {len(MCP_TOOLS)} MCP tools")
    print(f"  Skills:   {skill_count} skills in system prompt")
    print(f"\nThe 'Evols AI' agent is now available to all users in LibreChat.")


if __name__ == "__main__":
    main()
