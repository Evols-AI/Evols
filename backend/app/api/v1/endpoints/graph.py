"""
Knowledge Graph Proxy
Proxies LightRAG API calls so the frontend never talks to LightRAG directly.
Handles auth and returns graph data (nodes + edges) for visualization.
Also provides a /sync endpoint to bulk-push existing Evols data into LightRAG.
"""


import logging
import os
from typing import Any

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.context import ContextSource, ExtractedEntity, ContextProcessingStatus
from app.models.user import User
from app.models.work_context import WorkContext, ActiveProject, KeyRelationship, MeetingNote, PMDecision
from app.services.lightrag_ingestion_service import (
    ingest_context_source,
    ingest_extracted_entities,
    ingest_work_context,
    ingest_meeting_note,
    ingest_pm_decision,
    ingest_knowledge_entries,
    lightrag_auth_headers,
    invalidate_lightrag_jwt,
)

logger = logging.getLogger(__name__)

GRAPH_FIELD_SEP = "<SEP>"

router = APIRouter()


def _lightrag_url() -> str:
    url = getattr(settings, "LIGHTRAG_URL", None) or os.environ.get("LIGHTRAG_URL", "")
    return url.rstrip("/")




def _require_lightrag() -> str:
    url = _lightrag_url()
    if not url:
        raise HTTPException(status_code=503, detail="Knowledge graph service not configured (LIGHTRAG_URL missing)")
    return url


async def _tenant_file_paths(tenant_id: int, user_id: int, db: AsyncSession) -> set[str]:
    """
    Build the set of file_path labels that belong to this tenant/user.
    LightRAG has no multi-tenancy — we scope at the proxy layer by filtering
    nodes/edges whose file_path was set by us during ingestion.
    """
    paths: set[str] = set()

    # Context sources
    r = await db.execute(select(ContextSource.id).where(ContextSource.tenant_id == tenant_id))
    for (sid,) in r.all():
        paths.add(f"context_source:{sid}")

    # Extracted entities
    r = await db.execute(select(ExtractedEntity.id).where(ExtractedEntity.tenant_id == tenant_id))
    for (eid,) in r.all():
        paths.add(f"entity:{eid}")


    # Work context (user-scoped)
    r = await db.execute(select(WorkContext.id).where(WorkContext.user_id == user_id))
    for (wid,) in r.all():
        paths.add(f"work_context:{wid}")

    # Meeting notes (user-scoped)
    r = await db.execute(select(MeetingNote.id).where(MeetingNote.user_id == user_id))
    for (mid,) in r.all():
        paths.add(f"meeting_note:{mid}")

    # PM decisions (user-scoped)
    r = await db.execute(select(PMDecision.id).where(PMDecision.user_id == user_id))
    for (did,) in r.all():
        paths.add(f"pm_decision:{did}")

    # Team knowledge entries — import here to avoid circular deps
    try:
        from app.models.team_knowledge import KnowledgeEntry
        r = await db.execute(select(KnowledgeEntry.id).where(KnowledgeEntry.tenant_id == tenant_id))
        for (kid,) in r.all():
            paths.add(f"knowledge_entry:{kid}")
    except Exception:
        pass

    return paths


def _node_belongs(node: dict, valid_paths: set[str]) -> bool:
    """
    A node belongs to this tenant if any of its source file_paths is in valid_paths.
    LightRAG stores multiple file_paths as SEP-separated strings when an entity
    appears across several documents.
    """
    fp: str = node.get("properties", {}).get("file_path", "")
    if not fp or fp == "unknown_source":
        return False
    for part in fp.split(GRAPH_FIELD_SEP):
        if part.strip() in valid_paths:
            return True
    return False


@router.get("/graph")
async def get_graph(
    label: str = Query(default="*", description="Entity label filter, '*' for all"),
    max_depth: int = Query(default=3, ge=1, le=10),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Fetch the knowledge graph nodes and edges from LightRAG, filtered to the
    current tenant. LightRAG has no native multi-tenancy so we scope at the
    proxy layer using the file_path labels set during ingestion.
    """
    url = _require_lightrag()

    # Fetch the full graph from LightRAG; retry once if JWT expired (401)
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{url}/graphs",
            params={"label": label, "max_depth": max_depth, "max_nodes": 1000},
            headers=await lightrag_auth_headers(),
        )
        if resp.status_code == 401:
            invalidate_lightrag_jwt()
            resp = await client.get(
                f"{url}/graphs",
                params={"label": label, "max_depth": max_depth, "max_nodes": 1000},
                headers=await lightrag_auth_headers(),
            )
    if resp.status_code != 200:
        logger.warning(f"LightRAG /graphs returned {resp.status_code}: {resp.text[:200]}")
        raise HTTPException(status_code=503, detail="Knowledge graph service unavailable")

    data = resp.json()

    # No tenant context → return empty (SUPER_ADMIN without tenant scope)
    if current_user.tenant_id is None:
        return {"nodes": [], "edges": [], "is_truncated": False}

    # Build the set of file_path labels owned by this tenant
    valid_paths = await _tenant_file_paths(current_user.tenant_id, current_user.id, db)

    if not valid_paths:
        return {"nodes": [], "edges": [], "is_truncated": False}

    # Filter nodes
    all_nodes: list[dict] = data.get("nodes", [])
    tenant_nodes = [n for n in all_nodes if _node_belongs(n, valid_paths)]
    tenant_node_ids = {n["id"] for n in tenant_nodes}

    # Deserialise the `attributes` field from JSON string → dict so the frontend
    # can read node.properties.attributes directly without a JSON.parse call.
    import json as _json
    for node in tenant_nodes:
        props = node.get("properties") or {}
        raw_attrs = props.get("attributes")
        if isinstance(raw_attrs, str) and raw_attrs:
            try:
                props["attributes"] = _json.loads(raw_attrs)
            except _json.JSONDecodeError:
                props["attributes"] = None

    # Filter edges — keep only edges where BOTH endpoints are in tenant nodes
    all_edges: list[dict] = data.get("edges", [])
    tenant_edges = [
        e for e in all_edges
        if e.get("source") in tenant_node_ids and e.get("target") in tenant_node_ids
    ]

    return {
        "nodes": tenant_nodes,
        "edges": tenant_edges,
        "is_truncated": data.get("is_truncated", False),
    }


@router.get("/query")
async def query_graph(
    q: str = Query(..., description="Natural language query"),
    mode: str = Query(default="hybrid", description="Query mode: naive, local, global, hybrid"),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Query the knowledge graph with a natural language question."""
    url = _require_lightrag()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{url}/query",
            json={"query": q, "mode": mode},
            headers=await lightrag_auth_headers(),
        )
        if resp.status_code == 401:
            invalidate_lightrag_jwt()
            resp = await client.post(
                f"{url}/query",
                json={"query": q, "mode": mode},
                headers=await lightrag_auth_headers(),
            )
    if resp.status_code != 200:
        raise HTTPException(status_code=503, detail="Knowledge graph query failed")
    return resp.json()


@router.get("/processing-status")
async def get_processing_status(
    source_ids: str = Query(..., description="Comma-separated context_source IDs to check"),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Check LightRAG processing status for recently uploaded context sources.
    Returns per-source status: pending | processing | processed | failed | unknown.
    """
    url = _lightrag_url()
    if not url:
        return {"sources": {}}

    ids = [s.strip() for s in source_ids.split(",") if s.strip()]
    file_paths = {f"context_source:{sid}" for sid in ids}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{url}/documents", headers=await lightrag_auth_headers())
            if resp.status_code == 401:
                invalidate_lightrag_jwt()
                resp = await client.get(f"{url}/documents", headers=await lightrag_auth_headers())
        if resp.status_code != 200:
            return {"sources": {sid: "unknown" for sid in ids}}

        data = resp.json()
        # LightRAG returns {"statuses": {"processed": [...], "pending": [...], "failed": [...]}}
        statuses_by_path: dict[str, str] = {}
        for status_name, docs in data.get("statuses", {}).items():
            for doc in (docs or []):
                fp = doc.get("file_path", "")
                for part in fp.split("<SEP>"):
                    part = part.strip()
                    if part in file_paths:
                        statuses_by_path[part] = status_name

        result = {}
        for sid in ids:
            fp = f"context_source:{sid}"
            result[sid] = statuses_by_path.get(fp, "pending")
        return {"sources": result}
    except Exception as e:
        logger.warning(f"LightRAG processing-status check failed: {e}")
        return {"sources": {sid: "unknown" for sid in ids}}


# ── Entity / Relation mutation endpoints (proxy to LightRAG) ─────────────────

from pydantic import BaseModel  # noqa: E402 — local import avoids circular issues at module level


class EntityEditRequest(BaseModel):
    entity_name: str
    updated_data: dict
    allow_rename: bool = False
    allow_merge: bool = False


class EntityMergeRequest(BaseModel):
    entities_to_change: list[str]
    entity_to_change_into: str


class EntityCreateRequest(BaseModel):
    entity_name: str
    entity_data: dict


class RelationEditRequest(BaseModel):
    source_id: str
    target_id: str
    updated_data: dict


async def _lightrag_post(url: str, path: str, body: dict) -> Any:
    """POST to LightRAG with auth, raise HTTPException on error."""
    headers = await lightrag_auth_headers()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{url}{path}", json=body, headers=headers)
        if resp.status_code == 401:
            invalidate_lightrag_jwt()
            headers = await lightrag_auth_headers()
            async with httpx.AsyncClient(timeout=30) as client2:
                resp = await client2.post(f"{url}{path}", json=body, headers=headers)
    if resp.status_code not in (200, 201):
        detail = resp.json().get("detail", resp.text[:300]) if resp.headers.get("content-type", "").startswith("application/json") else resp.text[:300]
        raise HTTPException(status_code=resp.status_code, detail=detail)
    return resp.json()


@router.post("/entity/edit")
async def edit_entity(
    request: EntityEditRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Update an entity's properties (description, entity_type, rename, merge)."""
    url = _require_lightrag()
    return await _lightrag_post(url, "/graph/entity/edit", request.model_dump())


@router.post("/entities/merge")
async def merge_entities(
    request: EntityMergeRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Merge multiple entities into one, transferring all relationships."""
    url = _require_lightrag()
    return await _lightrag_post(url, "/graph/entities/merge", request.model_dump())


@router.post("/entity/create")
async def create_entity(
    request: EntityCreateRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Create a new entity node in the knowledge graph."""
    url = _require_lightrag()
    return await _lightrag_post(url, "/graph/entity/create", request.model_dump())


@router.post("/relation/edit")
async def edit_relation(
    request: RelationEditRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Update a relationship's description or keywords."""
    url = _require_lightrag()
    return await _lightrag_post(url, "/graph/relation/edit", request.model_dump())


@router.get("/health")
async def graph_health(current_user: User = Depends(get_current_user)) -> dict[str, str]:
    """Check LightRAG service availability."""
    url = _lightrag_url()
    if not url:
        return {"status": "unconfigured"}
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{url}/health", headers=await lightrag_auth_headers())
        return {"status": "ok" if resp.status_code == 200 else "degraded"}
    except Exception:
        return {"status": "unreachable"}


# ── Sync ──────────────────────────────────────────────────────────────────────

async def _run_full_sync(tenant_id: int, user_id: int, db: AsyncSession) -> dict:
    """
    Bulk-push all tenant data into LightRAG.
    Runs through: context sources → extracted entities → personas →
                  work context (+ projects + relationships) → meeting notes → PM decisions.
    Returns a summary dict with counts.
    """
    counts = {
        "context_sources": 0,
        "extracted_entities": 0,
        "work_contexts": 0,
        "meeting_notes": 0,
        "pm_decisions": 0,
        "knowledge_entries": 0,
        "errors": 0,
    }

    # ── 1. Context sources (completed ones with actual content) ───────────────
    sources_result = await db.execute(
        select(ContextSource).where(
            ContextSource.tenant_id == tenant_id,
            ContextSource.status == ContextProcessingStatus.COMPLETED,
        )
    )
    sources = sources_result.scalars().all()
    source_map = {s.id: s.name or s.title or "" for s in sources}

    for source in sources:
        ok = await ingest_context_source(source, "")
        if ok:
            counts["context_sources"] += 1
        else:
            counts["errors"] += 1

    # ── 2. Extracted entities ─────────────────────────────────────────────────
    entities_result = await db.execute(
        select(ExtractedEntity).where(ExtractedEntity.tenant_id == tenant_id)
    )
    entities = entities_result.scalars().all()
    if entities:
        ok = await ingest_extracted_entities(entities, source_map, "")
        if ok:
            counts["extracted_entities"] = len(entities)
        else:
            counts["errors"] += 1

    # ── 3. Work context for this user ─────────────────────────────────────────
    wc_result = await db.execute(
        select(WorkContext).where(WorkContext.user_id == user_id)
    )
    work_contexts = wc_result.scalars().all()

    # Fetch user's full name for anchor
    user_result = await db.execute(select(User).where(User.id == user_id))
    user_obj = user_result.scalar_one_or_none()
    user_name = getattr(user_obj, "full_name", "") or getattr(user_obj, "email", "") or ""

    for wc in work_contexts:
        proj_result = await db.execute(
            select(ActiveProject).where(ActiveProject.work_context_id == wc.id)
        )
        projects = proj_result.scalars().all()

        rel_result = await db.execute(
            select(KeyRelationship).where(KeyRelationship.work_context_id == wc.id)
        )
        relationships = rel_result.scalars().all()

        ok = await ingest_work_context(wc, user_name, projects, relationships)
        if ok:
            counts["work_contexts"] += 1
        else:
            counts["errors"] += 1

    # ── 5. Meeting notes ──────────────────────────────────────────────────────
    notes_result = await db.execute(
        select(MeetingNote).where(MeetingNote.user_id == user_id)
    )
    for note in notes_result.scalars().all():
        ok = await ingest_meeting_note(note, user_name)
        if ok:
            counts["meeting_notes"] += 1
        else:
            counts["errors"] += 1

    # ── 6. PM decisions ───────────────────────────────────────────────────────
    decisions_result = await db.execute(
        select(PMDecision).where(PMDecision.user_id == user_id)
    )
    for decision in decisions_result.scalars().all():
        ok = await ingest_pm_decision(decision, user_name, "")
        if ok:
            counts["pm_decisions"] += 1
        else:
            counts["errors"] += 1

    # ── 7. Team knowledge entries (Claude Code / LibreChat sessions) ──────────
    try:
        from app.models.team_knowledge import KnowledgeEntry as KEntry
        ke_result = await db.execute(
            select(KEntry).where(KEntry.tenant_id == tenant_id)
        )
        knowledge_entries = ke_result.scalars().all()
        if knowledge_entries:
            ok = await ingest_knowledge_entries(knowledge_entries)
            if ok:
                counts["knowledge_entries"] = len(knowledge_entries)
            else:
                counts["errors"] += 1
    except Exception as e:
        logger.warning(f"Knowledge entries sync skipped: {e}")

    return counts


@router.post("/sync")
async def sync_to_graph(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Bulk-push all existing tenant data (context sources, entities, personas,
    work context, meeting notes, decisions) into LightRAG for graph extraction.

    Runs synchronously and returns a summary. For large datasets this may take
    30-120 seconds — LightRAG processes documents asynchronously in the background
    after receiving them.
    """
    _require_lightrag()

    if current_user.tenant_id is None:
        raise HTTPException(status_code=400, detail="Sync requires a tenant context")

    counts = await _run_full_sync(current_user.tenant_id, current_user.id, db)
    total = sum(v for k, v in counts.items() if k != "errors")
    return {
        "status": "ok",
        "message": f"Pushed {total} items to LightRAG for graph extraction.",
        "details": counts,
    }
