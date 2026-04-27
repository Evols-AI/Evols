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

from app.core.config import settings

logger = logging.getLogger(__name__)

_jwt_cache: dict[str, Any] = {}
_jwt_lock = asyncio.Lock()


def _lightrag_url() -> str:
    url = getattr(settings, "LIGHTRAG_URL", None) or os.environ.get("LIGHTRAG_URL", "")
    return url.rstrip("/")


async def lightrag_auth_headers() -> dict[str, str]:
    """Return headers with a valid LightRAG JWT, obtained via POST /login. Cached ~55 min."""
    async with _jwt_lock:
        if _jwt_cache.get("token") and _jwt_cache.get("expires_at", 0) > time.time() + 30:
            return {"Content-Type": "application/json", "Authorization": f"Bearer {_jwt_cache['token']}"}
        api_key = getattr(settings, "LIGHTRAG_API_KEY", None) or os.environ.get("LIGHTRAG_API_KEY", "")
        if not api_key:
            logger.error("LIGHTRAG_API_KEY not configured — cannot authenticate to LightRAG")
            return {"Content-Type": "application/json"}
        url = _lightrag_url()
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{url}/login",
                data={"username": "evols", "password": api_key},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if resp.status_code != 200:
            logger.error(f"LightRAG login failed: {resp.status_code} {resp.text[:200]}")
            return {"Content-Type": "application/json"}
        token = resp.json().get("access_token") or resp.json().get("token", "")
        _jwt_cache["token"] = token
        _jwt_cache["expires_at"] = time.time() + 3300  # ~55 min
        return {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}


def invalidate_lightrag_jwt() -> None:
    """Force-expire the cached LightRAG JWT so the next call re-authenticates."""
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


async def _insert_texts(texts: list[str], file_sources: list[str]) -> bool:
    """POST a batch of texts to LightRAG /documents/texts. Returns True on success."""
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
    try:
        headers = await lightrag_auth_headers()
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{url}/documents/texts",
                json={"texts": list(texts_clean), "file_sources": list(sources_clean)},
                headers=headers,
            )
            if resp.status_code == 401:
                invalidate_lightrag_jwt()
                resp = await client.post(
                    f"{url}/documents/texts",
                    json={"texts": list(texts_clean), "file_sources": list(sources_clean)},
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


# ── High-level ingestion calls ────────────────────────────────────────────────

async def ingest_context_source(source, product_name: str = "") -> bool:
    """Push a single ContextSource (with its content) into LightRAG."""
    text = format_context_source(source)
    if not text:
        return True
    source_label = f"context_source:{source.id}"
    return await _insert_texts([text], [source_label])


async def ingest_extracted_entities(entities: list, source_map: dict = None, product_name: str = "") -> bool:
    """Push a list of ExtractedEntity objects as a single batch into LightRAG."""
    source_map = source_map or {}
    texts, sources = [], []
    for e in entities:
        src_name = source_map.get(e.source_id, "")
        text = format_extracted_entity(e, src_name, product_name)
        if text:
            texts.append(text)
            sources.append(f"entity:{e.id}")
    return await _insert_texts(texts, sources)


async def ingest_personas(personas: list, product_name: str = "") -> bool:
    """Push a list of Persona objects into LightRAG."""
    texts = [format_persona(p, product_name) for p in personas]
    sources = [f"persona:{p.id}" for p in personas]
    return await _insert_texts(texts, sources)


async def ingest_work_context(wc, user_name: str = "", projects=None, relationships=None) -> bool:
    """Push a WorkContext (with projects + relationships) into LightRAG."""
    text = format_work_context(wc, user_name, projects, relationships)
    if not text:
        return True
    return await _insert_texts([text], [f"work_context:{wc.id}"])


async def ingest_meeting_note(note, user_name: str = "") -> bool:
    """Push a single MeetingNote into LightRAG."""
    text = format_meeting_note(note, user_name)
    if not text:
        return True
    return await _insert_texts([text], [f"meeting_note:{note.id}"])


async def ingest_pm_decision(decision, user_name: str = "", product_name: str = "") -> bool:
    """Push a single PMDecision into LightRAG."""
    text = format_pm_decision(decision, user_name, product_name)
    if not text:
        return True
    return await _insert_texts([text], [f"pm_decision:{decision.id}"])


async def ingest_knowledge_entries(entries: list) -> bool:
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
    return await _insert_texts(texts, sources)
