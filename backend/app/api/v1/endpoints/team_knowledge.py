"""
Team Knowledge Graph API
Endpoints used by the Evols Claude Code plugin and MCP server
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_tenant_llm_config, get_current_tenant_id
from app.models.user import User
from app.services.team_knowledge_service import team_knowledge_service

router = APIRouter()


# ===================================
# REQUEST / RESPONSE SCHEMAS
# ===================================

class AddEntryRequest(BaseModel):
    title: str = Field(..., max_length=500)
    content: str = Field(..., min_length=10)
    role: str = Field(default="other")
    session_type: str = Field(default="other")
    entry_type: str = Field(default="insight")
    tags: Optional[List[str]] = None
    product_area: Optional[str] = None
    source_session_id: Optional[str] = None
    session_tokens_used: Optional[int] = Field(None, ge=0, description="Compressed entry size — the token cost of loading this entry")
    discovery_tokens: Optional[int] = Field(None, ge=0, description="Raw tool output token cost before Haiku compression — honest savings basis")
    files_read: Optional[List[str]] = Field(None, description="File paths read during the session")
    files_modified: Optional[List[str]] = Field(None, description="File paths written or edited during the session")
    model: Optional[str] = Field(None, description="Claude model ID that produced this entry")


class EntryResponse(BaseModel):
    id: int
    title: str
    role: str
    session_type: str
    entry_type: str
    tags: Optional[List[str]]
    product_area: Optional[str]
    token_count: Optional[int]
    created_at: str

    class Config:
        from_attributes = True


class RelevantContextResponse(BaseModel):
    context_text: str
    entries: List[dict]
    tokens_retrieved: int
    tokens_to_compile_fresh: int
    tokens_saved_estimate: int
    compression_ratio: float
    entry_count: int


class RecordQuotaEventRequest(BaseModel):
    session_id: str
    tokens_used: int = Field(..., ge=0)
    tokens_retrieved: int = Field(default=0, ge=0)
    tokens_created: int = Field(default=0, ge=0, description="Tokens spent creating new knowledge entries this session")
    actual_savings_override: Optional[int] = Field(None, ge=0, description="Similarity-weighted actual savings computed by the plugin at retrieval time")
    event_type: str = Field(default="session_end")
    tool_name: str = Field(default="claude-code")
    plan_type: Optional[str] = None
    model: Optional[str] = None
    cost_usd: Optional[float] = Field(None, ge=0)
    cwd: Optional[str] = None


class QuotaSummaryResponse(BaseModel):
    period_days: int
    sessions: int
    tokens_used: int
    tokens_retrieved: int
    tokens_saved_estimate: int  # legacy
    quota_extended_pct: float
    rate_limit_hits: int
    knowledge_entries_total: int
    knowledge_entries_new: int
    # Investment vs realized savings
    tokens_invested: int = 0
    creation_sessions: int = 0
    potential_future_value: int = 0
    actual_savings: int = 0
    retrieval_sessions: int = 0
    net_impact: int = 0
    roi_pct: float = 0.0


# ===================================
# ENDPOINTS
# ===================================

@router.post("/entries", response_model=EntryResponse, status_code=status.HTTP_201_CREATED)
async def add_knowledge_entry(
    request: AddEntryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    llm_config: Optional[dict] = Depends(get_tenant_llm_config),
):
    """
    Add a new entry to the team knowledge graph.
    Called by the Evols plugin Stop hook at the end of each AI session.
    """
    entry = await team_knowledge_service.add_entry(
        db=db,
        tenant_id=tenant_id,
        user_id=current_user.id,
        title=request.title,
        content=request.content,
        role=request.role,
        session_type=request.session_type,
        entry_type=request.entry_type,
        tags=request.tags,
        product_area=request.product_area,
        source_session_id=request.source_session_id,
        session_tokens_used=request.session_tokens_used,
        discovery_tokens=request.discovery_tokens,
        files_read=request.files_read,
        files_modified=request.files_modified,
        model=request.model,
        llm_config=llm_config,
    )
    return EntryResponse(
        id=entry.id,
        title=entry.title,
        role=entry.role.value if hasattr(entry.role, 'value') else entry.role,
        session_type=entry.session_type.value if hasattr(entry.session_type, 'value') else entry.session_type,
        entry_type=entry.entry_type.value if hasattr(entry.entry_type, 'value') else entry.entry_type,
        tags=entry.tags,
        product_area=entry.product_area,
        token_count=entry.token_count,
        created_at=entry.created_at.isoformat(),
    )


@router.get("/relevant", response_model=RelevantContextResponse)
async def get_relevant_context(
    query: str = Query(..., description="Current session task or working directory description"),
    role: Optional[str] = Query(None, description="Filter by contributor role: pm, engineer, designer, qa"),
    session_type: Optional[str] = Query(None, description="Filter by session type: research, planning, code"),
    top_k: int = Query(default=5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    llm_config: Optional[dict] = Depends(get_tenant_llm_config),
):
    """
    Retrieve relevant team knowledge for the current session.
    Called by the Evols plugin SessionStart hook and the MCP get_team_context tool.
    Returns pre-compiled context text and token savings estimates.
    """
    result = await team_knowledge_service.get_relevant_context(
        db=db,
        tenant_id=tenant_id,
        query=query,
        role=role,
        session_type=session_type,
        top_k=top_k,
        llm_config=llm_config,
    )
    return RelevantContextResponse(**result)


@router.post("/quota/events", status_code=status.HTTP_201_CREATED)
async def record_quota_event(
    request: RecordQuotaEventRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Record token usage for a session.
    Called by the Evols plugin Stop hook.
    """
    event = await team_knowledge_service.record_quota_event(
        db=db,
        tenant_id=tenant_id,
        user_id=current_user.id,
        session_id=request.session_id,
        tokens_used=request.tokens_used,
        tokens_retrieved=request.tokens_retrieved,
        tokens_created=request.tokens_created,
        actual_savings_override=request.actual_savings_override,
        event_type=request.event_type,
        tool_name=request.tool_name,
        plan_type=request.plan_type,
        model=request.model,
        cost_usd=request.cost_usd,
        cwd=request.cwd,
    )
    return {
        "id": event.id,
        "tokens_saved_estimate": event.tokens_saved_estimate,  # legacy
        "actual_savings": event.actual_savings,
        "tokens_invested": event.tokens_invested,
        "event_category": event.event_category.value,
    }


@router.get("/redundancy-check")
async def check_redundancy(
    query: str = Query(..., description="What you're about to work on"),
    hours: int = Query(default=48, ge=1, le=720, description="How far back to look (hours)"),
    similarity_threshold: float = Query(default=0.75, ge=0.4, le=1.0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    llm_config: Optional[dict] = Depends(get_tenant_llm_config),
):
    """
    Before starting work, check if a teammate already solved this recently.
    Returns similar entries with their exact session token costs.
    """
    result = await team_knowledge_service.check_redundancy(
        db=db,
        tenant_id=tenant_id,
        query=query,
        lookback_hours=hours,
        similarity_threshold=similarity_threshold,
        llm_config=llm_config,
    )
    return result




@router.get("/entries", response_model=List[EntryResponse])
async def list_knowledge_entries(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Paginated list of knowledge entries for the Team Intelligence dashboard.
    Returns entries without embeddings (too large for list views).
    """
    entries = await team_knowledge_service.list_entries(
        db=db, tenant_id=tenant_id, limit=limit, offset=offset
    )
    return [
        EntryResponse(
            id=e.id,
            title=e.title,
            role=e.role.value if hasattr(e.role, "value") else e.role,
            session_type=e.session_type.value if hasattr(e.session_type, "value") else e.session_type,
            entry_type=e.entry_type.value if hasattr(e.entry_type, "value") else e.entry_type,
            tags=e.tags,
            product_area=e.product_area,
            token_count=e.token_count,
            created_at=e.created_at.isoformat(),
        )
        for e in entries
    ]


@router.get("/entries/{entry_id}")
async def get_knowledge_entry(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Single knowledge entry with full content (for detail view)."""
    entry = await team_knowledge_service.get_entry(
        db=db, tenant_id=tenant_id, entry_id=entry_id
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {
        "id": entry.id,
        "title": entry.title,
        "content": entry.content,
        "role": entry.role.value if hasattr(entry.role, "value") else entry.role,
        "session_type": entry.session_type.value if hasattr(entry.session_type, "value") else entry.session_type,
        "entry_type": entry.entry_type.value if hasattr(entry.entry_type, "value") else entry.entry_type,
        "tags": entry.tags,
        "product_area": entry.product_area,
        "token_count": entry.token_count,
        "retrieval_count": entry.retrieval_count,
        "created_at": entry.created_at.isoformat(),
        "last_retrieved_at": entry.last_retrieved_at.isoformat() if entry.last_retrieved_at else None,
    }


@router.get("/search/layer1")
async def search_layer1(
    query: str = Query(...),
    top_k: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    llm_config: Optional[dict] = Depends(get_tenant_llm_config),
):
    """Layer 1: compact index (~50 tokens/result). Returns title, tags, date, similarity only."""
    return await team_knowledge_service.search_layer1(
        db=db, tenant_id=tenant_id, query=query, top_k=top_k, llm_config=llm_config
    )


@router.get("/search/layer2")
async def search_layer2(
    ids: str = Query(..., description="Comma-separated entry IDs from layer1"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Layer 2: timeline + file context. Returns preview, files_read, files_modified, compression ratio."""
    try:
        entry_ids = [int(i.strip()) for i in ids.split(",") if i.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="ids must be comma-separated integers")
    return await team_knowledge_service.search_layer2(db=db, tenant_id=tenant_id, entry_ids=entry_ids)


@router.get("/search/layer3")
async def search_layer3(
    ids: str = Query(..., description="Comma-separated entry IDs from layer2"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Layer 3: full content. Only fetch after layer1/2 confirmed relevance. Increments retrieval counts."""
    try:
        entry_ids = [int(i.strip()) for i in ids.split(",") if i.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="ids must be comma-separated integers")
    return await team_knowledge_service.search_layer3(db=db, tenant_id=tenant_id, entry_ids=entry_ids)


@router.get("/quota/summary", response_model=QuotaSummaryResponse)
async def get_quota_summary(
    days: int = Query(default=7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Team token savings summary for the dashboard.
    """
    summary = await team_knowledge_service.get_quota_summary(
        db=db,
        tenant_id=tenant_id,
        days=days,
    )
    return QuotaSummaryResponse(**summary)
