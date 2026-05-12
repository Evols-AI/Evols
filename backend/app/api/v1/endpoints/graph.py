"""
Knowledge Graph Proxy
Proxies LightRAG API calls so the frontend never talks to LightRAG directly.
Handles auth and returns graph data (nodes + edges) for visualization.
Also provides a /sync endpoint to bulk-push existing Evols data into LightRAG.

Loading strategy
----------------
The frontend loads the graph in two phases:
  1. GET /graph/hubs   — top-N nodes by degree + their edges. Fast first paint.
                         Unloaded neighbor IDs are included so the frontend can
                         render stub dots for them.
  2. GET /graph/node/{id} — full node data for one node, fetched on click or
                            zoom-in. Served from the same cache as /hubs.

Both endpoints share a per-tenant in-process cache (GRAPH_CACHE_TTL seconds).
The full LightRAG fetch happens at most once per TTL window, making /hubs and
/node responses near-instant after the first call.
"""


import asyncio
import json as _json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.context import ContextSource, ExtractedEntity, ContextProcessingStatus
from app.models.tenant import Tenant
from app.models.user import User
from app.models.work_context import WorkContext, ActiveProject, KeyRelationship, MeetingNote, PMDecision
from app.services.lightrag_ingestion_service import (
    TenantGraphConfig,
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
GRAPH_CACHE_TTL = 300  # seconds — cache full graph per tenant for 5 minutes

router = APIRouter()


# ── Per-tenant graph cache ────────────────────────────────────────────────────

@dataclass
class _GraphCache:
    # nodes keyed by id, edges keyed by id
    nodes: dict[str, dict] = field(default_factory=dict)
    edges: list[dict] = field(default_factory=list)
    # adjacency: node_id → set of neighbor node ids
    adjacency: dict[str, set[str]] = field(default_factory=dict)
    # degree map: node_id → connection count
    degree: dict[str, int] = field(default_factory=dict)
    # nodes that originate from personal user data (work_context, meeting_notes, pm_decisions)
    personal_node_ids: dict[int, set[str]] = field(default_factory=dict)  # user_id → set of node_ids
    fetched_at: float = 0.0
    # asyncio lock so concurrent requests share one in-flight fetch
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    def is_fresh(self) -> bool:
        return (time.monotonic() - self.fetched_at) < GRAPH_CACHE_TTL

    def invalidate(self) -> None:
        self.fetched_at = 0.0


# tenant_id → _GraphCache
_CACHE: dict[int, _GraphCache] = {}


def _get_cache(tenant_id: int) -> _GraphCache:
    if tenant_id not in _CACHE:
        _CACHE[tenant_id] = _GraphCache()
    return _CACHE[tenant_id]


def _lightrag_url() -> str:
    url = getattr(settings, "LIGHTRAG_URL", None) or os.environ.get("LIGHTRAG_URL", "")
    return url.rstrip("/")




def _require_lightrag() -> str:
    url = _lightrag_url()
    if not url:
        raise HTTPException(status_code=503, detail="Knowledge graph service not configured (LIGHTRAG_URL missing)")
    return url


async def _fetch_and_populate_cache(
    cache: _GraphCache,
    tenant_id: int,
    user_id: int,
    db: AsyncSession,
) -> None:
    """Fetch full graph from LightRAG, filter to tenant, populate cache."""
    url = _require_lightrag()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{url}/graphs",
            params={"label": "*", "max_depth": 1, "max_nodes": 2000},
            headers=await lightrag_auth_headers(),
        )
        if resp.status_code == 401:
            invalidate_lightrag_jwt()
            resp = await client.get(
                f"{url}/graphs",
                params={"label": "*", "max_depth": 1, "max_nodes": 2000},
                headers=await lightrag_auth_headers(),
            )
    if resp.status_code != 200:
        raise HTTPException(status_code=503, detail="Knowledge graph service unavailable")

    data = resp.json()
    valid_paths = await _tenant_file_paths(tenant_id, user_id, db)
    personal_paths = await _user_personal_paths(user_id, db)

    if not valid_paths:
        cache.nodes = {}
        cache.edges = []
        cache.adjacency = {}
        cache.degree = {}
        cache.fetched_at = time.monotonic()
        return

    raw_nodes: list[dict] = data.get("nodes", [])
    raw_edges: list[dict] = data.get("edges", [])

    tenant_node_ids: set[str] = set()
    personal_node_ids: set[str] = set()
    nodes: dict[str, dict] = {}
    for n in raw_nodes:
        if not _node_belongs(n, valid_paths):
            continue
        props = n.get("properties") or {}
        raw_attrs = props.get("attributes")
        if isinstance(raw_attrs, str) and raw_attrs:
            try:
                props["attributes"] = _json.loads(raw_attrs)
            except _json.JSONDecodeError:
                props["attributes"] = None
        tenant_node_ids.add(n["id"])
        # Tag as personal if any source file_path is a personal path
        fp: str = props.get("file_path", "")
        is_personal = any(part.strip() in personal_paths for part in fp.split(GRAPH_FIELD_SEP) if part.strip())
        props["is_personal"] = is_personal
        if is_personal:
            personal_node_ids.add(n["id"])
        nodes[n["id"]] = n

    edges: list[dict] = []
    adjacency: dict[str, set[str]] = {nid: set() for nid in tenant_node_ids}
    degree: dict[str, int] = {nid: 0 for nid in tenant_node_ids}
    for e in raw_edges:
        s, t = e.get("source"), e.get("target")
        if s in tenant_node_ids and t in tenant_node_ids:
            edges.append(e)
            adjacency[s].add(t)
            adjacency[t].add(s)
            degree[s] = degree.get(s, 0) + 1
            degree[t] = degree.get(t, 0) + 1

    cache.nodes = nodes
    cache.edges = edges
    cache.adjacency = adjacency
    cache.degree = degree
    # Store personal node ids per user so multi-user tenants get correct tagging
    cache.personal_node_ids[user_id] = personal_node_ids
    # Only mark cache fresh when there are actual nodes — if LightRAG returned
    # empty results (still processing documents), leave fetched_at=0 so the
    # next request retries immediately instead of waiting the full TTL.
    if nodes:
        cache.fetched_at = time.monotonic()


async def _get_tenant_cache(tenant_id: int, user_id: int, db: AsyncSession) -> _GraphCache:
    """Return a fresh cache entry, fetching from LightRAG if stale."""
    cache = _get_cache(tenant_id)
    if cache.is_fresh():
        return cache
    async with cache._lock:
        # Re-check after acquiring lock — another coroutine may have refreshed
        if cache.is_fresh():
            return cache
        await _fetch_and_populate_cache(cache, tenant_id, user_id, db)
    return cache


async def _user_personal_paths(user_id: int, db: AsyncSession) -> set[str]:
    """
    Paths for data contributed by this specific user.
    Covers: context sources they uploaded, their PM-OS data, and their AI session entries.
    """
    paths: set[str] = set()

    # PM-OS data (always user-scoped)
    for model, prefix in [
        (WorkContext, "work_context"),
        (MeetingNote, "meeting_note"),
        (PMDecision, "pm_decision"),
    ]:
        r = await db.execute(select(model.id).where(model.user_id == user_id))
        for (rid,) in r.all():
            paths.add(f"{prefix}:{rid}")

    # Context sources uploaded by this user
    r = await db.execute(
        select(ContextSource.id).where(ContextSource.user_id == user_id)
    )
    for (sid,) in r.all():
        paths.add(f"context_source:{sid}")

    # AI session knowledge entries authored by this user
    try:
        from app.models.team_knowledge import KnowledgeEntry
        r = await db.execute(
            select(KnowledgeEntry.id).where(KnowledgeEntry.user_id == user_id)
        )
        for (kid,) in r.all():
            paths.add(f"knowledge_entry:{kid}")
    except Exception:
        pass

    return paths


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


@router.get("/hubs")
async def get_hub_nodes(
    limit: int = Query(default=50, ge=5, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Return the top-N highest-degree nodes (hubs) plus their edges, served from
    a 5-minute server-side cache. Also returns stub descriptors for every
    neighbor of a hub that isn't itself a hub — these let the frontend render
    small placeholder dots without loading the full node data yet.

    Response shape:
      {
        "nodes": [...],          # full node objects for hubs
        "edges": [...],          # edges between hubs
        "stubs": {               # lightweight placeholders for unloaded neighbors
          "<node_id>": {
            "id": "...",
            "entity_type": "...",
            "label": "...",
            "degree": N
          }
        },
        "total_nodes": N,
        "total_edges": N,
        "cached": true/false
      }
    """
    if current_user.tenant_id is None:
        return {"nodes": [], "edges": [], "stubs": {}, "total_nodes": 0, "total_edges": 0, "cached": False}

    cache = await _get_tenant_cache(current_user.tenant_id, current_user.id, db)

    if not cache.nodes:
        return {"nodes": [], "edges": [], "stubs": {}, "total_nodes": 0, "total_edges": 0, "cached": True}

    # Sort all nodes by degree desc, take top `limit` as hubs
    sorted_ids = sorted(cache.degree.keys(), key=lambda nid: cache.degree.get(nid, 0), reverse=True)
    hub_ids: set[str] = set(sorted_ids[:limit])

    hub_nodes = [cache.nodes[nid] for nid in hub_ids if nid in cache.nodes]
    hub_edges = [e for e in cache.edges if e["source"] in hub_ids and e["target"] in hub_ids]

    # Build stubs for neighbors of hubs that aren't hubs themselves.
    # Also track which hub each stub connects to (first encountered hub anchor)
    # so the frontend can place it near that hub rather than at the canvas centre.
    stub_ids: set[str] = set()
    stub_hub_anchor: dict[str, str] = {}  # stub_id → hub_id
    for hub_id in hub_ids:
        for neighbor_id in cache.adjacency.get(hub_id, set()):
            if neighbor_id not in hub_ids:
                stub_ids.add(neighbor_id)
                if neighbor_id not in stub_hub_anchor:
                    stub_hub_anchor[neighbor_id] = hub_id

    personal_ids = cache.personal_node_ids.get(current_user.id, set())
    stubs: dict[str, dict] = {}
    for sid in stub_ids:
        n = cache.nodes.get(sid)
        if not n:
            continue
        props = n.get("properties", {})
        stubs[sid] = {
            "id": sid,
            "entity_type": props.get("entity_type", "default"),
            "label": props.get("entity_id", sid),
            "degree": cache.degree.get(sid, 0),
            "hub_anchor": stub_hub_anchor.get(sid),
            "is_personal": sid in personal_ids,
        }

    # Include hub→stub edges so the frontend can draw connections to stub dots
    # and use them for positioning. Only include edges where exactly one endpoint
    # is a hub and the other is a stub (hub-hub edges are already in hub_edges).
    hub_stub_edges = [
        e for e in cache.edges
        if (e["source"] in hub_ids and e["target"] in stub_ids)
        or (e["target"] in hub_ids and e["source"] in stub_ids)
    ]

    return {
        "nodes": hub_nodes,
        "edges": hub_edges + hub_stub_edges,
        "stubs": stubs,
        "total_nodes": len(cache.nodes),
        "total_edges": len(cache.edges),
        "cached": True,
    }


@router.get("/node/{node_id:path}")
async def get_node(
    node_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Return the full node data for a single node plus its immediate neighbors'
    full data and the edges connecting them. Served from the 5-minute cache.
    Used when the user clicks a stub dot or zooms into a region.
    """
    if current_user.tenant_id is None:
        raise HTTPException(status_code=404, detail="Node not found")

    cache = await _get_tenant_cache(current_user.tenant_id, current_user.id, db)

    node = cache.nodes.get(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    neighbor_ids = cache.adjacency.get(node_id, set())
    neighbor_nodes = [cache.nodes[nid] for nid in neighbor_ids if nid in cache.nodes]
    relevant_edges = [
        e for e in cache.edges
        if (e["source"] == node_id or e["target"] == node_id)
        and e["source"] in cache.nodes and e["target"] in cache.nodes
    ]

    return {
        "node": node,
        "neighbors": neighbor_nodes,
        "edges": relevant_edges,
    }


@router.get("/graph")
async def get_graph(
    label: str = Query(default="*"),
    max_depth: int = Query(default=3, ge=1, le=10),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Full graph fetch — kept for backwards compatibility. Uses cache."""
    if current_user.tenant_id is None:
        return {"nodes": [], "edges": [], "is_truncated": False}

    cache = await _get_tenant_cache(current_user.tenant_id, current_user.id, db)
    return {
        "nodes": list(cache.nodes.values()),
        "edges": cache.edges,
        "is_truncated": False,
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
    result = await _lightrag_post(url, "/graph/entity/edit", request.model_dump())
    if current_user.tenant_id:
        _get_cache(current_user.tenant_id).invalidate()
    return result


@router.post("/entities/merge")
async def merge_entities(
    request: EntityMergeRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Merge multiple entities into one, transferring all relationships."""
    url = _require_lightrag()
    result = await _lightrag_post(url, "/graph/entities/merge", request.model_dump())
    if current_user.tenant_id:
        _get_cache(current_user.tenant_id).invalidate()
    return result


@router.post("/entity/create")
async def create_entity(
    request: EntityCreateRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Create a new entity node in the knowledge graph."""
    url = _require_lightrag()
    result = await _lightrag_post(url, "/graph/entity/create", request.model_dump())
    if current_user.tenant_id:
        _get_cache(current_user.tenant_id).invalidate()
    return result


@router.post("/relation/edit")
async def edit_relation(
    request: RelationEditRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Update a relationship's description or keywords."""
    url = _require_lightrag()
    result = await _lightrag_post(url, "/graph/relation/edit", request.model_dump())
    if current_user.tenant_id:
        _get_cache(current_user.tenant_id).invalidate()
    return result


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

    # Load tenant's custom entity extraction config once for the whole sync.
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant_obj = tenant_result.scalar_one_or_none()
    tenant_cfg = TenantGraphConfig.from_tenant_settings(
        getattr(tenant_obj, "settings", None)
    )

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
        ok = await ingest_context_source(source, "", tenant_config=tenant_cfg)
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
        ok = await ingest_extracted_entities(entities, source_map, "", tenant_config=tenant_cfg)
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

        ok = await ingest_work_context(wc, user_name, projects, relationships, tenant_config=tenant_cfg)
        if ok:
            counts["work_contexts"] += 1
        else:
            counts["errors"] += 1

    # ── 5. Meeting notes ──────────────────────────────────────────────────────
    notes_result = await db.execute(
        select(MeetingNote).where(MeetingNote.user_id == user_id)
    )
    for note in notes_result.scalars().all():
        ok = await ingest_meeting_note(note, user_name, tenant_config=tenant_cfg)
        if ok:
            counts["meeting_notes"] += 1
        else:
            counts["errors"] += 1

    # ── 6. PM decisions ───────────────────────────────────────────────────────
    decisions_result = await db.execute(
        select(PMDecision).where(PMDecision.user_id == user_id)
    )
    for decision in decisions_result.scalars().all():
        ok = await ingest_pm_decision(decision, user_name, "", tenant_config=tenant_cfg)
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
            ok = await ingest_knowledge_entries(knowledge_entries, tenant_config=tenant_cfg)
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

    # Invalidate the graph cache so the next /hubs call re-fetches fresh data
    _get_cache(current_user.tenant_id).invalidate()

    total = sum(v for k, v in counts.items() if k != "errors")
    return {
        "status": "ok",
        "message": f"Pushed {total} items to LightRAG for graph extraction.",
        "details": counts,
    }
