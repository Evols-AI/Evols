"""
LightRAG Ingestion Service
Formats Evols data (context sources, extracted entities, personas, work context)
as rich natural-language text and pushes it to LightRAG for graph extraction.

Each data type is formatted to make the three target clusters emerge naturally:
  - Team cluster  : anchored on the individual user / their name+role
  - Product cluster: anchored on the product / service name
  - Customer cluster: anchored on customer persona names
"""

import asyncio
import logging
import os
import time
from typing import Any, Optional

import httpx
from jose import jwt as jose_jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

_jwt_cache: dict[str, Any] = {}
_jwt_lock = asyncio.Lock()

# LightRAG TOKEN_SECRET — must match the value deployed to evols-lightrag.
# Generating the JWT locally avoids an HTTP round-trip to /login, which fails
# when the backend's VPC egress cannot reach LightRAG's public Cloud Run URL.
_LIGHTRAG_TOKEN_SECRET = os.environ.get(
    "LIGHTRAG_TOKEN_SECRET",
    "81cedc8e5042e71ccfb779dee55a8480d9e92f76080b1ccd8e34d7356a5b1b02",
)

# Set LIGHTRAG_AUTH_ENABLED=false in local/docker environments where LightRAG
# runs with auth_mode=disabled. Sending an Authorization header to a no-auth
# LightRAG instance causes it to return empty results silently.
def _lightrag_auth_enabled() -> bool:
    """Check LIGHTRAG_AUTH_ENABLED via settings (loads .env) with fallback to os.environ."""
    try:
        from app.core.config import settings
        val = str(getattr(settings, "LIGHTRAG_AUTH_ENABLED", "true")).lower()
    except Exception:
        val = os.environ.get("LIGHTRAG_AUTH_ENABLED", "true").lower()
    return val not in ("false", "0", "no")


def _lightrag_url() -> str:
    url = getattr(settings, "LIGHTRAG_URL", None) or os.environ.get("LIGHTRAG_URL", "")
    return url.rstrip("/")


def _mint_lightrag_jwt() -> str:
    """Mint a LightRAG-compatible HS256 JWT locally — no network call required."""
    now = int(time.time())
    payload = {"sub": "evols", "exp": now + 3600}
    return jose_jwt.encode(payload, _LIGHTRAG_TOKEN_SECRET, algorithm="HS256")


async def lightrag_auth_headers() -> dict[str, str]:
    """Return headers for LightRAG requests. Omits Authorization when auth is disabled."""
    if not _lightrag_auth_enabled():
        return {"Content-Type": "application/json"}
    async with _jwt_lock:
        if _jwt_cache.get("token") and _jwt_cache.get("expires_at", 0) > time.time() + 30:
            return {"Content-Type": "application/json", "Authorization": f"Bearer {_jwt_cache['token']}"}
        token = _mint_lightrag_jwt()
        _jwt_cache["token"] = token
        _jwt_cache["expires_at"] = time.time() + 3300  # ~55 min
        return {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}


def invalidate_lightrag_jwt() -> None:
    """Force-expire the cached JWT so the next call mints a fresh one."""
    _jwt_cache.clear()


async def _delete_document(file_source: str) -> bool:
    """Delete a document from LightRAG by its file_source label. Returns True on success."""
    url = _lightrag_url()
    if not url:
        return False
    try:
        headers = await lightrag_auth_headers()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.delete(
                f"{url}/documents",
                params={"file_path": file_source},
                headers=headers,
            )
            if resp.status_code == 401:
                invalidate_lightrag_jwt()
                resp = await client.delete(
                    f"{url}/documents",
                    params={"file_path": file_source},
                    headers=await lightrag_auth_headers(),
                )
        if resp.status_code not in (200, 204, 404):
            logger.warning(f"LightRAG delete {file_source}: {resp.status_code} {resp.text[:200]}")
            return False
        logger.info(f"LightRAG: deleted document {file_source}")
        return True
    except Exception as e:
        logger.warning(f"LightRAG delete error ({file_source}): {e}")
        return False


async def _insert_texts(
    texts: list[str],
    file_sources: list[str],
    extra_entity_types: list[str] | None = None,
    extra_entity_attributes: list[str] | None = None,
    entity_type_definitions: dict[str, str] | None = None,
    entity_attribute_definitions: dict[str, str] | None = None,
) -> bool:
    """POST a batch of texts to LightRAG /documents/texts. Returns True on success.

    extra_entity_types / extra_entity_attributes are forwarded to LightRAG so
    that the patched image can merge them with the global defaults for this batch.
    entity_type_definitions / entity_attribute_definitions are name→definition
    maps injected into the extraction prompt so the LLM understands each type
    and attribute precisely, improving extraction confidence.
    """
    url = _lightrag_url()
    if not url:
        logger.warning("LightRAG URL not configured — skipping ingestion")
        return False
    # Append the file_source label as a hidden comment so identical content re-uploaded
    # under a different source label produces a different content hash in LightRAG.
    pairs = [
        (f"{t}\n<!-- source:{s} -->", s)
        for t, s in zip(texts, file_sources)
        if t and t.strip()
    ]
    if not pairs:
        logger.warning("_insert_texts: all texts were empty after filtering")
        return True
    texts_clean, sources_clean = zip(*pairs)
    body: dict = {"texts": list(texts_clean), "file_sources": list(sources_clean)}
    if extra_entity_types:
        body["extra_entity_types"] = extra_entity_types
    if extra_entity_attributes:
        body["extra_entity_attributes"] = extra_entity_attributes
    if entity_type_definitions:
        body["entity_type_definitions"] = entity_type_definitions
    if entity_attribute_definitions:
        body["entity_attribute_definitions"] = entity_attribute_definitions
    try:
        headers = await lightrag_auth_headers()
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{url}/documents/texts",
                json=body,
                headers=headers,
            )
            if resp.status_code == 401:
                invalidate_lightrag_jwt()
                resp = await client.post(
                    f"{url}/documents/texts",
                    json=body,
                    headers=await lightrag_auth_headers(),
                )
        if resp.status_code not in (200, 202):
            logger.error(f"LightRAG insert failed: {resp.status_code} {resp.text[:400]}")
            return False
        logger.info(f"LightRAG: inserted {len(texts_clean)} document(s)")
        return True
    except Exception as e:
        logger.error(f"LightRAG insert error: {e}", exc_info=True)
        return False


# ── Formatters ────────────────────────────────────────────────────────────────

def format_context_source(source) -> str:
    """Format a ContextSource ORM object as natural-language text for LightRAG."""
    lines = []
    if source.title or source.name:
        lines.append(f"# {source.title or source.name}")
    if source.source_type:
        lines.append(f"Source type: {source.source_type}")
    if source.customer_name:
        lines.append(f"Customer: {source.customer_name}")
    if source.customer_segment:
        lines.append(f"Customer segment: {source.customer_segment}")
    if source.source_date:
        lines.append(f"Date: {source.source_date}")
    if source.description:
        lines.append(f"\n{source.description}")
    body = source.content or source.raw_content or ""
    if body:
        lines.append(f"\n{body[:8000]}")  # cap to avoid token blowout
    return "\n".join(lines).strip()


def format_extracted_entity(entity, source_name: str = "", product_name: str = "") -> str:
    """Format an ExtractedEntity as relationship-rich text for LightRAG."""
    lines = []
    lines.append(f"# Entity: {entity.name}")
    lines.append(f"Type: {entity.entity_type}")
    if entity.description:
        lines.append(f"Description: {entity.description}")
    if entity.confidence_score is not None:
        lines.append(f"Confidence: {entity.confidence_score:.2f}")
    if entity.category:
        lines.append(f"Category: {entity.category}")
    if entity.context_snippet:
        lines.append(f'Context: "{entity.context_snippet}"')
    if source_name:
        lines.append(f"Extracted from: {source_name}")
    if product_name:
        lines.append(f"Related product: {product_name}")
    attrs = entity.attributes or {}
    if attrs.get("sentiment"):
        lines.append(f"Sentiment: {attrs['sentiment']}")
    if attrs.get("urgency"):
        lines.append(f"Urgency: {attrs['urgency']}")
    if attrs.get("business_impact"):
        lines.append(f"Business impact: {attrs['business_impact']}")
    if attrs.get("job_role"):
        lines.append(f"Job role: {attrs['job_role']}")
    if attrs.get("customer_name"):
        lines.append(f"Customer: {attrs['customer_name']}")
    if attrs.get("customer_segment"):
        lines.append(f"Customer segment: {attrs['customer_segment']}")
    return "\n".join(lines).strip()


def format_persona(persona, product_name: str = "") -> str:
    """Format a Persona as relationship-rich text for LightRAG."""
    lines = []
    lines.append(f"# Customer Persona: {persona.name}")
    if product_name:
        lines.append(f"Product: {product_name}")
    if persona.segment:
        lines.append(f"Segment: {persona.segment}")
    if persona.industry:
        lines.append(f"Industry: {persona.industry}")
    if persona.company_size_range:
        lines.append(f"Company size: {persona.company_size_range}")
    if persona.description:
        lines.append(f"\n{persona.description}")
    if persona.persona_summary:
        lines.append(f"\n{persona.persona_summary}")
    pain_points = persona.key_pain_points or []
    if pain_points:
        lines.append("\nKey pain points:")
        for p in pain_points[:10]:
            lines.append(f"  - {p}")
    triggers = persona.buying_triggers or []
    if triggers:
        lines.append("\nBuying triggers:")
        for t in triggers[:5]:
            lines.append(f"  - {t}")
    priorities = persona.feature_priorities or []
    if priorities:
        lines.append("\nFeature priorities:")
        for f in priorities[:5]:
            lines.append(f"  - {f}")
    if persona.confidence_score:
        lines.append(f"\nConfidence score: {persona.confidence_score:.2f}")
    if persona.based_on_feedback_count:
        lines.append(f"Based on {persona.based_on_feedback_count} feedback items.")
    return "\n".join(lines).strip()


def format_work_context(wc, user_name: str = "", projects=None, relationships=None) -> str:
    """Format a WorkContext + related data as text anchored on the user."""
    lines = []
    anchor = user_name or wc.name or "Team Member"
    lines.append(f"# Work Context: {anchor}")
    if wc.title:
        lines.append(f"Role: {wc.title}")
    if wc.team:
        lines.append(f"Team: {wc.team}")
    if wc.team_description:
        lines.append(f"Team description: {wc.team_description}")
    if wc.manager_name:
        lines.append(f"Manager: {wc.manager_name}" + (f" ({wc.manager_title})" if wc.manager_title else ""))
    if wc.team_size:
        lines.append(f"Team size: {wc.team_size}")
    if wc.team_composition:
        lines.append(f"Team composition: {wc.team_composition}")
    if wc.capacity_status:
        lines.append(f"Capacity: {wc.capacity_status}")
    if wc.biggest_time_sink:
        lines.append(f"Biggest time sink: {wc.biggest_time_sink}")

    if projects:
        lines.append("\nActive projects:")
        for p in projects:
            status_str = f" [{p.status}]" if p.status else ""
            lines.append(f"  - {p.name}{status_str}")
            if p.next_milestone:
                lines.append(f"    Next milestone: {p.next_milestone}")
            stakeholders = p.key_stakeholders or []
            if stakeholders:
                lines.append(f"    Stakeholders: {', '.join(str(s) for s in stakeholders[:5])}")

    if relationships:
        lines.append("\nKey relationships:")
        for r in relationships:
            lines.append(f"  - {r.name} ({r.role}, {r.relationship_type})")
            if r.cares_about:
                lines.append(f"    Cares about: {r.cares_about}")

    return "\n".join(lines).strip()


def format_meeting_note(note, user_name: str = "") -> str:
    """Format a MeetingNote as text anchored on the user."""
    lines = []
    lines.append(f"# Meeting: {note.title}")
    if user_name:
        lines.append(f"PM: {user_name}")
    if note.meeting_type:
        lines.append(f"Meeting type: {note.meeting_type}")
    if note.meeting_date:
        lines.append(f"Date: {note.meeting_date}")
    attendees = note.attendees or []
    if attendees:
        lines.append(f"Attendees: {', '.join(str(a) for a in attendees)}")
    if note.notes:
        lines.append(f"\nNotes:\n{note.notes[:3000]}")
    decisions = note.decisions or []
    if decisions:
        lines.append("\nDecisions made:")
        for d in decisions[:10]:
            lines.append(f"  - {d}")
    action_items = note.action_items or []
    if action_items:
        lines.append("\nAction items:")
        for a in action_items[:10]:
            lines.append(f"  - {a}")
    return "\n".join(lines).strip()


def format_pm_decision(decision, user_name: str = "", product_name: str = "") -> str:
    """Format a PMDecision as text."""
    lines = []
    lines.append(f"# Decision: {decision.title}")
    if user_name:
        lines.append(f"Decision maker: {user_name}")
    if product_name:
        lines.append(f"Product: {product_name}")
    if decision.category:
        lines.append(f"Category: {decision.category}")
    if decision.decision_date:
        lines.append(f"Date: {decision.decision_date}")
    if decision.context:
        lines.append(f"\nContext: {decision.context}")
    if decision.decision:
        lines.append(f"\nDecision: {decision.decision}")
    if decision.reasoning:
        lines.append(f"\nReasoning: {decision.reasoning}")
    if decision.tradeoffs:
        lines.append(f"\nTradeoffs: {decision.tradeoffs}")
    stakeholders = decision.stakeholders or []
    if stakeholders:
        lines.append(f"\nStakeholders: {', '.join(str(s) for s in stakeholders)}")
    if decision.expected_outcome:
        lines.append(f"\nExpected outcome: {decision.expected_outcome}")
    if decision.actual_outcome:
        lines.append(f"\nActual outcome: {decision.actual_outcome}")
    if decision.lessons:
        lines.append(f"\nLessons learned: {decision.lessons}")
    return "\n".join(lines).strip()


# ── Built-in type/attribute names (LightRAG knows these natively) ─────────────
_BUILTIN_TYPE_NAMES: frozenset[str] = frozenset([
    "Person", "Organization", "Product", "Feature", "PainPoint",
    "FeatureRequest", "Persona", "Competitor", "BusinessGoal", "Metric",
    "Decision", "Meeting", "Project", "Technology", "Market",
])


def _parse_entry_list(raw: list) -> list[dict]:
    """Normalise a stored list to [{name, definition}] — handles legacy plain strings."""
    out = []
    for item in raw:
        if isinstance(item, dict) and item.get("name", "").strip():
            out.append({"name": item["name"].strip(), "definition": item.get("definition") or None})
        elif isinstance(item, str) and item.strip():
            out.append({"name": item.strip(), "definition": None})
    return out


# ── Tenant graph extraction config ───────────────────────────────────────────

class TenantGraphConfig:
    """Per-tenant entity types and attributes loaded from Tenant.settings.

    Tenants own the full list. Types not in _BUILTIN_TYPE_NAMES are sent as
    extra_entity_types so LightRAG merges them with its global defaults.
    All types (builtin + custom) with definitions are sent as
    entity_type_definitions for prompt injection.
    """
    __slots__ = (
        "extra_entity_types",
        "extra_entity_attributes",
        "entity_type_definitions",
        "entity_attribute_definitions",
    )

    def __init__(
        self,
        extra_entity_types: list[str] | None = None,
        extra_entity_attributes: list[str] | None = None,
        entity_type_definitions: dict[str, str] | None = None,
        entity_attribute_definitions: dict[str, str] | None = None,
    ):
        self.extra_entity_types: list[str] = extra_entity_types or []
        self.extra_entity_attributes: list[str] = extra_entity_attributes or []
        self.entity_type_definitions: dict[str, str] = entity_type_definitions or {}
        self.entity_attribute_definitions: dict[str, str] = entity_attribute_definitions or {}

    @classmethod
    def from_tenant_settings(cls, settings: dict | None) -> "TenantGraphConfig":
        s = settings or {}

        # Prefer new unified format; fall back to legacy custom_entity_types key
        if "entity_types" in s:
            raw_types = _parse_entry_list(s["entity_types"])
        else:
            raw_types = _parse_entry_list(s.get("custom_entity_types") or [])
            # Prepend built-in names with no definitions if not already present
            existing = {e["name"] for e in raw_types}
            raw_types = [
                {"name": n, "definition": None}
                for n in _BUILTIN_TYPE_NAMES if n not in existing
            ] + raw_types

        if "entity_attributes" in s:
            raw_attrs = _parse_entry_list(s["entity_attributes"])
        else:
            # Legacy: custom_entity_attributes were plain strings
            raw_attrs = [
                {"name": a, "definition": None}
                for a in (s.get("custom_entity_attributes") or [])
                if isinstance(a, str) and a.strip()
            ]

        extra_types = [e["name"] for e in raw_types if e["name"] not in _BUILTIN_TYPE_NAMES]
        extra_attrs = [e["name"] for e in raw_attrs]
        type_defs = {e["name"]: e["definition"] for e in raw_types if e.get("definition")}
        attr_defs = {e["name"]: e["definition"] for e in raw_attrs if e.get("definition")}

        return cls(
            extra_entity_types=extra_types,
            extra_entity_attributes=extra_attrs,
            entity_type_definitions=type_defs,
            entity_attribute_definitions=attr_defs,
        )

    @property
    def has_custom(self) -> bool:
        return bool(self.extra_entity_types or self.extra_entity_attributes)


async def load_tenant_graph_config(tenant_id: int | None, db: Any) -> TenantGraphConfig:
    """Load TenantGraphConfig from the database for a given tenant_id.

    Returns an empty config (no custom types) when tenant_id is None or the
    tenant cannot be found — safe to call from any endpoint.
    """
    if not tenant_id:
        return TenantGraphConfig()
    try:
        from sqlalchemy import select as _select
        from app.models.tenant import Tenant as _Tenant
        result = await db.execute(_select(_Tenant).where(_Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        return TenantGraphConfig.from_tenant_settings(getattr(tenant, "settings", None))
    except Exception:
        return TenantGraphConfig()


# ── High-level ingestion calls ────────────────────────────────────────────────

async def ingest_context_source(
    source, product_name: str = "", tenant_config: TenantGraphConfig | None = None
) -> bool:
    """Push a single ContextSource (with its content) into LightRAG."""
    text = format_context_source(source)
    if not text:
        return True
    source_label = f"context_source:{source.id}"
    cfg = tenant_config
    return await _insert_texts(
        [text], [source_label],
        extra_entity_types=cfg.extra_entity_types if cfg else None,
        extra_entity_attributes=cfg.extra_entity_attributes if cfg else None,
        entity_type_definitions=cfg.entity_type_definitions if cfg else None,
        entity_attribute_definitions=cfg.entity_attribute_definitions if cfg else None,
    )


async def ingest_extracted_entities(
    entities: list, source_map: dict = None, product_name: str = "",
    tenant_config: TenantGraphConfig | None = None,
) -> bool:
    """Push a list of ExtractedEntity objects as a single batch into LightRAG."""
    source_map = source_map or {}
    texts, sources = [], []
    for e in entities:
        src_name = source_map.get(e.source_id, "")
        text = format_extracted_entity(e, src_name, product_name)
        if text:
            texts.append(text)
            sources.append(f"entity:{e.id}")
    cfg = tenant_config
    return await _insert_texts(
        texts, sources,
        extra_entity_types=cfg.extra_entity_types if cfg else None,
        extra_entity_attributes=cfg.extra_entity_attributes if cfg else None,
        entity_type_definitions=cfg.entity_type_definitions if cfg else None,
        entity_attribute_definitions=cfg.entity_attribute_definitions if cfg else None,
    )


async def ingest_personas(
    personas: list, product_name: str = "",
    tenant_config: TenantGraphConfig | None = None,
) -> bool:
    """Push a list of Persona objects into LightRAG."""
    texts = [format_persona(p, product_name) for p in personas]
    sources = [f"persona:{p.id}" for p in personas]
    cfg = tenant_config
    return await _insert_texts(
        texts, sources,
        extra_entity_types=cfg.extra_entity_types if cfg else None,
        extra_entity_attributes=cfg.extra_entity_attributes if cfg else None,
        entity_type_definitions=cfg.entity_type_definitions if cfg else None,
        entity_attribute_definitions=cfg.entity_attribute_definitions if cfg else None,
    )


async def ingest_work_context(
    wc, user_name: str = "", projects=None, relationships=None,
    tenant_config: TenantGraphConfig | None = None,
) -> bool:
    """Push a WorkContext (with projects + relationships) into LightRAG."""
    text = format_work_context(wc, user_name, projects, relationships)
    if not text:
        return True
    cfg = tenant_config
    return await _insert_texts(
        [text], [f"work_context:{wc.id}"],
        extra_entity_types=cfg.extra_entity_types if cfg else None,
        extra_entity_attributes=cfg.extra_entity_attributes if cfg else None,
        entity_type_definitions=cfg.entity_type_definitions if cfg else None,
        entity_attribute_definitions=cfg.entity_attribute_definitions if cfg else None,
    )


async def ingest_meeting_note(
    note, user_name: str = "",
    tenant_config: TenantGraphConfig | None = None,
) -> bool:
    """Push a single MeetingNote into LightRAG."""
    text = format_meeting_note(note, user_name)
    if not text:
        return True
    cfg = tenant_config
    return await _insert_texts(
        [text], [f"meeting_note:{note.id}"],
        extra_entity_types=cfg.extra_entity_types if cfg else None,
        extra_entity_attributes=cfg.extra_entity_attributes if cfg else None,
        entity_type_definitions=cfg.entity_type_definitions if cfg else None,
        entity_attribute_definitions=cfg.entity_attribute_definitions if cfg else None,
    )


async def ingest_pm_decision(
    decision, user_name: str = "", product_name: str = "",
    tenant_config: TenantGraphConfig | None = None,
) -> bool:
    """Push a single PMDecision into LightRAG."""
    text = format_pm_decision(decision, user_name, product_name)
    if not text:
        return True
    cfg = tenant_config
    return await _insert_texts(
        [text], [f"pm_decision:{decision.id}"],
        extra_entity_types=cfg.extra_entity_types if cfg else None,
        extra_entity_attributes=cfg.extra_entity_attributes if cfg else None,
        entity_type_definitions=cfg.entity_type_definitions if cfg else None,
        entity_attribute_definitions=cfg.entity_attribute_definitions if cfg else None,
    )


async def ingest_knowledge_entries(
    entries: list,
    tenant_config: TenantGraphConfig | None = None,
) -> bool:
    """Push team knowledge entries (from Claude Code sessions) into LightRAG."""
    texts, sources = [], []
    for e in entries:
        parts = [f"# {e.title}"]
        if e.role and e.role != "other":
            parts.append(f"Role: {e.role}")
        if e.entry_type:
            parts.append(f"Type: {e.entry_type}")
        if e.product_area:
            parts.append(f"Product area: {e.product_area}")
        if e.tags:
            parts.append(f"Tags: {', '.join(e.tags)}")
        parts.append("")
        parts.append(e.content or "")
        text = "\n".join(parts).strip()
        if text:
            texts.append(text)
            sources.append(f"knowledge_entry:{e.id}")
    cfg = tenant_config
    return await _insert_texts(
        texts, sources,
        extra_entity_types=cfg.extra_entity_types if cfg else None,
        extra_entity_attributes=cfg.extra_entity_attributes if cfg else None,
        entity_type_definitions=cfg.entity_type_definitions if cfg else None,
        entity_attribute_definitions=cfg.entity_attribute_definitions if cfg else None,
    )
