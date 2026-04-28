"""
MCP Streamable-HTTP endpoint
Exposes Evols tools via the MCP protocol so LibreChat and other MCP-compatible
clients can connect without running a subprocess.

Transport: MCP Streamable-HTTP (2025-03-26 spec)
  POST   /mcp  — send JSON-RPC request, receive response (or 202 for notifications)
  DELETE /mcp  — close session
  GET    /mcp  — SSE keep-alive stream (minimal; most clients use POST-only mode)

Auth: Bearer token (JWT or evols_... API key) via the standard Authorization header.
      Each request is independently authenticated — session state is only used to
      associate the Mcp-Session-Id with a tenant/user without re-verifying on every call.

Tool sets:
  Team knowledge:
    - get_team_context      — semantic search over the team knowledge graph
    - check_redundancy      — find prior work before starting a task
    - sync_session_context  — add a new knowledge entry to the graph

  Evols AI (skills + product data):
    - get_skill_details         — fetch full instructions for a named skill
    - get_work_context_summary  — user's role, projects, tasks, relationships
    - get_personas              — customer persona profiles
    - get_themes                — clustered feedback themes
    - get_feedback_items        — raw customer feedback
    - get_product_strategy      — product strategy document
    - get_customer_segments     — customer segment definitions
    - get_competitive_landscape — competitive analysis
    - get_features              — product initiatives / feature list
    - get_past_skill_work       — recent AI skill execution history
"""

import uuid
import json
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from fastapi import APIRouter, Request, Response, Header, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select as _select

from app.core.database import get_db
from app.core.security import decode_access_token, decrypt_llm_config
from app.models.user import User
from app.models.tenant import Tenant
from app.services.team_knowledge_service import team_knowledge_service
from app.services.skill_tools import tool_registry
from app.services.skill_loader_service import get_skill_loader

router = APIRouter()

# ── In-memory session registry ─────────────────────────────────────────────
# Maps session_id → {"tenant_id": int, "user_id": int, "created_at": datetime}
# Sessions expire after 24h; cleanup happens lazily on new session creation.
_SESSIONS: Dict[str, Dict] = {}
_SESSION_TTL = timedelta(hours=24)


def _purge_expired_sessions() -> None:
    cutoff = datetime.utcnow() - _SESSION_TTL
    expired = [sid for sid, s in _SESSIONS.items() if s["created_at"] < cutoff]
    for sid in expired:
        del _SESSIONS[sid]


def _ok(req_id: Any, result: Any) -> dict:
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


def _rpc_error(req_id: Any, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}


# ── Tool catalogue ─────────────────────────────────────────────────────────

TOOLS = [
    {
        "name": "get_team_context",
        "description": (
            "Retrieve the most relevant team knowledge entries for a query. "
            "Returns pre-compiled context text and token savings estimates. "
            "Use this when starting work on a task to find relevant prior knowledge from teammates."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The current task, working directory, or topic to search for"
                },
                "top_k": {
                    "type": "integer",
                    "description": "Number of entries to retrieve (1-20, default 5)",
                    "default": 5
                },
                "role": {
                    "type": "string",
                    "description": "Filter by contributor role: pm, engineer, designer, qa, other"
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "check_redundancy",
        "description": (
            "Check whether a teammate already solved a similar problem recently. "
            "Call this before starting significant work. "
            "Returns matching entries with token cost and savings estimates."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "What you're about to work on"
                },
                "hours": {
                    "type": "integer",
                    "description": "How many hours to look back (default 48)",
                    "default": 48
                },
                "similarity_threshold": {
                    "type": "number",
                    "description": "Minimum similarity score to flag (0.4–1.0, default 0.75)",
                    "default": 0.75
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "sync_session_context",
        "description": (
            "Add a knowledge entry to the shared team graph. "
            "Call this at the end of a productive session to share insights with teammates. "
            "The entry is immediately available for semantic search in future sessions."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Short title for this knowledge entry (max 500 chars)"
                },
                "content": {
                    "type": "string",
                    "description": "The knowledge content to store (decisions, insights, patterns, research findings, etc.)"
                },
                "role": {
                    "type": "string",
                    "description": "Contributor role: pm, engineer, designer, qa, other",
                    "default": "other"
                },
                "entry_type": {
                    "type": "string",
                    "description": "Type: insight, decision, artifact, research_finding, pattern, context",
                    "default": "insight"
                },
                "tags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional tags for categorisation"
                },
                "product_area": {
                    "type": "string",
                    "description": "Optional product area this knowledge relates to"
                },
                "session_tokens_used": {
                    "type": "integer",
                    "description": "Exact token count from the session (for accurate ROI tracking)"
                }
            },
            "required": ["title", "content"]
        }
    },

    # ── Evols AI: skills ──────────────────────────────────────────────────────
    {
        "name": "get_skill_details",
        "description": (
            "Fetch the full instructions for a named Evols skill. "
            "Call this after deciding which skill to use — it returns the complete "
            "system prompt and recommended tools for that skill. "
            "Use the skill name exactly as it appears in the skills catalog."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "skill_name": {
                    "type": "string",
                    "description": "Exact skill name (e.g. 'swot-analysis', 'prd-writer', 'competitive-analysis')"
                }
            },
            "required": ["skill_name"]
        }
    },

    # ── Evols AI: product data tools ──────────────────────────────────────────
    {
        "name": "get_work_context_summary",
        "description": (
            "Get a summary of what is known about the current user's work context: "
            "their role, active projects, key relationships, tasks, and weekly focus. "
            "Call this to personalise responses or understand the user's current priorities."
        ),
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "get_personas",
        "description": "Get customer persona profiles from the knowledge graph with pain points, feature requests, and extracted attributes (sentiment, urgency, business_impact, confidence).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of personas to return (default: all)"
                },
                "search": {
                    "type": "string",
                    "description": "Filter personas by name (partial match)"
                }
            }
        }
    },
    {
        "name": "get_pain_points",
        "description": "Get PainPoint entities from the knowledge graph with urgency, sentiment, and business impact. Use this to understand what customers struggle with.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Max items to return"},
                "search": {"type": "string", "description": "Filter by keyword"}
            }
        }
    },
    {
        "name": "get_feature_requests",
        "description": "Get FeatureRequest entities from the knowledge graph with urgency, business impact, and related personas.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Max items to return"},
                "search": {"type": "string", "description": "Filter by keyword"}
            }
        }
    },
    {
        "name": "get_competitors",
        "description": "Get Competitor entities from the knowledge graph.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Max items to return"},
                "search": {"type": "string", "description": "Filter by keyword"}
            }
        }
    },
    {
        "name": "get_business_goals",
        "description": "Get BusinessGoal entities from the knowledge graph with confidence and business impact.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Max items to return"},
                "search": {"type": "string", "description": "Filter by keyword"}
            }
        }
    },
    {
        "name": "get_metrics",
        "description": "Get Metric entities from the knowledge graph.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Max items to return"},
                "search": {"type": "string", "description": "Filter by keyword"}
            }
        }
    },
    {
        "name": "engage_persona_twin",
        "description": "Have a conversation with a persona's AI digital twin grounded in their knowledge graph context (pain points, feature requests, attributes). Ask for their opinion on any topic.",
        "inputSchema": {
            "type": "object",
            "required": ["persona_name", "question"],
            "properties": {
                "persona_name": {"type": "string", "description": "Name of the persona as it appears in the knowledge graph"},
                "question": {"type": "string", "description": "Question or topic to ask the persona"}
            }
        }
    },
    {
        "name": "get_themes",
        "description": "Get clustered feedback themes showing what customers care about most.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of themes to return (default: all)"
                }
            }
        }
    },
    {
        "name": "get_feedback_items",
        "description": "Get raw customer feedback items with source, sentiment, and context.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Maximum items to return (default: 50)"
                },
                "date_range": {
                    "type": "string",
                    "description": "Time range filter: 'all', '7d', '30d', '90d' (default: 'all')"
                }
            }
        }
    },
    {
        "name": "get_product_strategy",
        "description": "Get the product strategy document including vision, goals, and strategic bets.",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "get_customer_segments",
        "description": "Get customer segment definitions with size, value, and characteristics.",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "get_competitive_landscape",
        "description": "Get competitive analysis including key competitors, positioning, and differentiation.",
        "inputSchema": {"type": "object", "properties": {}}
    },
    {
        "name": "get_features",
        "description": "Get product initiatives and features with RICE scores and status.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "description": "Filter by status (e.g. 'planned', 'in_progress', 'completed')"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of features to return"
                }
            }
        }
    },
    {
        "name": "get_past_skill_work",
        "description": (
            "Get recent AI skill execution history — previous analyses, documents, and outputs "
            "generated by Evols AI for this team. Useful for avoiding duplication and building "
            "on prior work."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Number of past executions to return (default: 10)"
                },
                "category": {
                    "type": "string",
                    "description": "Filter by skill category (e.g. 'strategy', 'research')"
                }
            }
        }
    },
]


# ── Auth helper (used only for tools/call) ───────────────────────────────────

async def _resolve_auth(
    token: str,
    db: AsyncSession,
    user_id_header: Optional[str] = None,
) -> tuple[User, int, Optional[dict]]:
    """
    Resolve user, tenant_id, and llm_config.
    Accepts either:
    - user_id_header: X-Evols-User-Id (Evols Postgres int ID injected by LibreChat)
    - token: Bearer JWT or evols_... API key
    Raises ValueError on failure.
    """
    from app.core.dependencies import _authenticate_api_key

    if user_id_header:
        try:
            uid = int(user_id_header.strip())
        except ValueError:
            raise ValueError("Invalid X-Evols-User-Id header")
        result = await db.execute(_select(User).where(User.id == uid))
        user = result.scalar_one_or_none()
        if user is None or not user.is_active:
            raise ValueError("User not found or inactive")
    elif token.startswith("evols_"):
        user = await _authenticate_api_key(token, db)
        if user is None:
            raise ValueError("Invalid API key")
    else:
        payload = decode_access_token(token)
        if payload is None:
            raise ValueError("Invalid or expired token")
        user_id = payload.get("user_id")
        if user_id is None:
            raise ValueError("Token missing user_id")
        result = await db.execute(_select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None or not user.is_active:
            raise ValueError("User not found or inactive")

    if user.tenant_id is None:
        raise ValueError("User has no tenant context")

    result = await db.execute(_select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = result.scalar_one_or_none()
    llm_config: Optional[dict] = None
    if tenant and tenant.llm_config:
        try:
            llm_config = decrypt_llm_config(tenant.llm_config)
        except Exception:
            pass

    return user, user.tenant_id, llm_config


# ── POST /mcp ───────────────────────────────────────────────────────────────

@router.post("")
async def mcp_post(
    request: Request,
    mcp_session_id: Optional[str] = Header(None, alias="Mcp-Session-Id"),
    db: AsyncSession = Depends(get_db),
):
    """
    MCP Streamable-HTTP POST handler.

    Auth model (per MCP spec — tool discovery must work without credentials):
      initialize              — public (creates anonymous session)
      notifications/initialized — public
      tools/list              — public (LibreChat calls this at startup)
      tools/call              — requires Bearer token
    """
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content=_rpc_error(None, -32700, "Parse error"))

    method = body.get("method", "")
    params = body.get("params") or {}
    req_id = body.get("id")

    # ── initialize (public) ──────────────────────────────────────────────────
    if method == "initialize":
        _purge_expired_sessions()
        session_id = str(uuid.uuid4())
        # Store partial session — tenant/user filled in on first authenticated call
        _SESSIONS[session_id] = {
            "tenant_id": None,
            "user_id": None,
            "created_at": datetime.utcnow(),
        }
        result = {
            "protocolVersion": "2025-03-26",
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {"name": "evols", "version": "1.0.0"},
        }
        response = JSONResponse(content=_ok(req_id, result))
        response.headers["Mcp-Session-Id"] = session_id
        return response

    # ── notifications/initialized (public, fire-and-forget) ──────────────────
    if method == "notifications/initialized":
        return Response(status_code=202)

    # ── tools/list (public) ──────────────────────────────────────────────────
    if method == "tools/list":
        return JSONResponse(content=_ok(req_id, {"tools": TOOLS}))

    # ── tools/call (requires auth) ────────────────────────────────────────────
    if method == "tools/call":
        user_id_header = request.headers.get("X-Evols-User-Id", "").strip()
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.split(" ", 1)[1] if auth_header.startswith("Bearer ") else ""

        if not user_id_header and not token:
            return JSONResponse(
                status_code=401,
                content=_rpc_error(req_id, -32001, "Authentication required for tool calls"),
            )
        try:
            current_user, tenant_id, llm_config = await _resolve_auth(
                token, db, user_id_header=user_id_header or None
            )
        except Exception as exc:
            return JSONResponse(
                status_code=401,
                content=_rpc_error(req_id, -32001, f"Authentication failed: {exc}"),
            )

        # Backfill session with resolved identity
        if mcp_session_id and mcp_session_id in _SESSIONS:
            _SESSIONS[mcp_session_id]["tenant_id"] = tenant_id
            _SESSIONS[mcp_session_id]["user_id"] = current_user.id

        tool_name = params.get("name", "")
        tool_args = params.get("arguments") or {}
        try:
            text = await _call_tool(tool_name, tool_args, db, tenant_id, current_user, llm_config)
            return JSONResponse(content=_ok(req_id, {
                "content": [{"type": "text", "text": text}],
                "isError": False,
            }))
        except ValueError as exc:
            return JSONResponse(content=_ok(req_id, {
                "content": [{"type": "text", "text": str(exc)}],
                "isError": True,
            }))
        except Exception as exc:
            return JSONResponse(content=_ok(req_id, {
                "content": [{"type": "text", "text": f"Tool execution failed: {exc}"}],
                "isError": True,
            }))

    # ── Unknown method ────────────────────────────────────────────────────────
    return JSONResponse(
        status_code=200,
        content=_rpc_error(req_id, -32601, f"Method not found: {method}"),
    )


# ── DELETE /mcp ─────────────────────────────────────────────────────────────

@router.delete("")
async def mcp_delete(
    mcp_session_id: Optional[str] = Header(None, alias="Mcp-Session-Id"),
):
    """Close an MCP session and release its state. Public — session ID is the credential."""
    if mcp_session_id and mcp_session_id in _SESSIONS:
        del _SESSIONS[mcp_session_id]
    return Response(status_code=204)


# ── GET /mcp (SSE keep-alive) ────────────────────────────────────────────────

@router.get("")
async def mcp_get(
    mcp_session_id: Optional[str] = Header(None, alias="Mcp-Session-Id"),
):
    """
    Server-Sent Events stream for server-initiated messages.
    Minimal implementation — most clients (including LibreChat) use POST-only mode.
    Sends a ping every 30 seconds to keep the connection alive.
    """
    async def event_stream():
        yield f"event: endpoint\ndata: {json.dumps({'type': 'endpoint'})}\n\n"
        while True:
            yield ": ping\n\n"
            await asyncio.sleep(30)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


# ── Tool implementations ───────────────────────────────────────────────────

async def _call_tool(
    tool_name: str,
    args: dict,
    db: AsyncSession,
    tenant_id: int,
    current_user: User,
    llm_config: Optional[dict],
) -> str:
    """
    Dispatch a tool call to the appropriate service method and return a
    human-readable text result (MCP content item type "text").
    Raises ValueError for invalid arguments, Exception for service failures.
    """

    if tool_name == "get_team_context":
        query = (args.get("query") or "").strip()
        if not query:
            raise ValueError("'query' is required")
        top_k = min(max(int(args.get("top_k", 5)), 1), 20)
        role = args.get("role") or None

        result = await team_knowledge_service.get_relevant_context(
            db=db,
            tenant_id=tenant_id,
            query=query,
            role=role,
            top_k=top_k,
            llm_config=llm_config,
        )

        if result["entry_count"] == 0:
            return "No relevant team knowledge found for this query yet."

        header = (
            f"Found {result['entry_count']} relevant entries "
            f"({result['tokens_retrieved']:,} tokens retrieved, "
            f"~{result['tokens_saved_estimate']:,} tokens saved vs. compiling fresh)."
        )
        return f"{header}\n\n{result['context_text']}"

    elif tool_name == "check_redundancy":
        query = (args.get("query") or "").strip()
        if not query:
            raise ValueError("'query' is required")
        hours = int(args.get("hours", 48))
        threshold = float(args.get("similarity_threshold", 0.75))

        result = await team_knowledge_service.check_redundancy(
            db=db,
            tenant_id=tenant_id,
            query=query,
            lookback_hours=hours,
            similarity_threshold=threshold,
            llm_config=llm_config,
        )

        if not result["found"]:
            return f"No similar work found in the last {hours}h. This appears to be new work."

        best = result["similar_entries"][0]
        sep = "-" * 60
        return (
            f"Prior team work found ({best['similarity']:.0%} match)\n"
            f"{sep}\n"
            f"  \"{best['title']}\"\n"
            f"  {best['hours_ago']:.0f}h ago · ~{best['token_count']:,} tokens\n"
            f"  ~{result['estimated_saving']:,} tokens saved if reused\n"
            f"{sep}\n"
            f"{best['content_preview']}\n"
            f"{sep}\n"
            f"Consider reusing or building on this work."
        )

    elif tool_name == "sync_session_context":
        title = (args.get("title") or "").strip()
        content = (args.get("content") or "").strip()
        if not title:
            raise ValueError("'title' is required")
        if not content:
            raise ValueError("'content' is required")
        if len(title) > 500:
            raise ValueError("'title' must be 500 characters or fewer")
        if len(content) < 10:
            raise ValueError("'content' must be at least 10 characters")

        entry = await team_knowledge_service.add_entry(
            db=db,
            tenant_id=tenant_id,
            user_id=current_user.id,
            title=title,
            content=content,
            role=args.get("role", "other"),
            entry_type=args.get("entry_type", "insight"),
            tags=args.get("tags"),
            product_area=args.get("product_area"),
            session_tokens_used=args.get("session_tokens_used"),
            llm_config=llm_config,
        )

        return (
            f"Knowledge entry #{entry.id} added to team graph.\n"
            f"  Title: \"{entry.title}\"\n"
            f"  Tokens stored: {entry.token_count:,}\n"
            f"  This entry is now searchable by all teammates."
        )

    # ── Evols AI: skill details ───────────────────────────────────────────────

    elif tool_name == "get_skill_details":
        skill_name = (args.get("skill_name") or "").strip()
        if not skill_name:
            raise ValueError("'skill_name' is required")

        loader = get_skill_loader()
        skill = loader.get_skill_by_name(skill_name)
        if not skill:
            available = ", ".join(sorted(loader.load_all_skills().keys()))
            raise ValueError(
                f"Skill '{skill_name}' not found. Available skills: {available}"
            )

        lines = [
            f"# Skill: {skill['name']}",
            f"**Category**: {skill.get('category', 'unknown')}",
            f"**Description**: {skill.get('description', '')}",
        ]
        if skill.get("tools"):
            lines.append(f"**Recommended tools**: {', '.join(skill['tools'])}")
        lines.append("\n## Instructions\n")
        lines.append(skill.get("instructions", ""))
        if skill.get("output_template"):
            lines.append(f"\n## Output Template\n{skill['output_template']}")

        return "\n".join(lines)

    # ── Evols AI: product data tools ──────────────────────────────────────────

    elif tool_name == "get_work_context_summary":
        result = await tool_registry.execute_tool(
            "get_work_context_summary", {}, tenant_id, db, user_id=current_user.id
        )
        return json.dumps(result, default=str)

    elif tool_name in (
        "get_personas",
        "get_pain_points",
        "get_feature_requests",
        "get_competitors",
        "get_business_goals",
        "get_metrics",
        "engage_persona_twin",
        "get_themes",
        "get_feedback_items",
        "get_product_strategy",
        "get_customer_segments",
        "get_competitive_landscape",
        "get_features",
        "get_past_skill_work",
    ):
        result = await tool_registry.execute_tool(
            tool_name, dict(args), tenant_id, db, user_id=current_user.id
        )
        return json.dumps(result, default=str)

    else:
        available = ", ".join(t["name"] for t in TOOLS)
        raise ValueError(f"Unknown tool: '{tool_name}'. Available: {available}")
