"""
Team Knowledge Graph API
Endpoints used by the Evols Claude Code plugin and MCP server
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

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
    event_type: str = Field(default="session_end")
    tool_name: str = Field(default="claude-code")
    plan_type: Optional[str] = None
    cwd: Optional[str] = None


class QuotaSummaryResponse(BaseModel):
    period_days: int
    sessions: int
    tokens_used: int
    tokens_retrieved: int
    tokens_saved_estimate: int
    quota_extended_pct: float
    rate_limit_hits: int
    knowledge_entries_total: int
    knowledge_entries_new: int


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
        event_type=request.event_type,
        tool_name=request.tool_name,
        plan_type=request.plan_type,
        cwd=request.cwd,
    )
    return {"id": event.id, "tokens_saved_estimate": event.tokens_saved_estimate}


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
