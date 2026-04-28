"""
Memory API Endpoints
Access skill execution history and retrospective analytics
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_tenant_id
from app.models.user import User
from app.services.unified_pm_os import MemoryManager

router = APIRouter()


# ===================================
# RESPONSE MODELS
# ===================================

class SkillMemoryItem(BaseModel):
    id: int
    skill_name: str
    skill_category: Optional[str]
    summary: str
    created_at: datetime
    input_summary: str


class SkillMemoryDetail(BaseModel):
    id: int
    skill_name: str
    skill_category: Optional[str]
    summary: str
    created_at: datetime
    input_data: Dict[str, Any]
    output_data: Dict[str, Any]


class MemoryStatsResponse(BaseModel):
    total_executions: int
    category_breakdown: Dict[str, int]
    most_used_skills: List[Dict[str, Any]]
    recent_activity: List[Dict[str, Any]]


# ===================================
# ENDPOINTS
# ===================================

@router.get("/", response_model=List[SkillMemoryItem])
async def get_skill_memory(
    category: Optional[str] = Query(None, description="Filter by skill category"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of results"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """Get skill execution history for the current tenant."""
    mm = MemoryManager(db)
    memory = await mm.get_recent_skill_outputs(
        tenant_id=tenant_id,
        limit=limit,
        category=category
    )
    return [SkillMemoryItem(**m) for m in memory]


@router.get("/stats", response_model=MemoryStatsResponse)
async def get_memory_stats(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """Get statistics about skill usage for the current tenant."""
    mm = MemoryManager(db)
    stats = await mm.get_memory_stats(tenant_id)
    return MemoryStatsResponse(**stats)


@router.get("/search", response_model=List[SkillMemoryItem])
async def search_memory(
    q: str = Query(..., description="Search term"),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """Search skill memory by keyword."""
    mm = MemoryManager(db)
    results = await mm.search_memory(
        tenant_id=tenant_id,
        search_term=q,
        limit=limit
    )
    return [SkillMemoryItem(**m) for m in results]


@router.get("/{memory_id}", response_model=SkillMemoryDetail)
async def get_skill_memory_detail(
    memory_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get full details of a specific skill execution."""
    mm = MemoryManager(db)
    memory = await mm.get_skill_memory_by_id(memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return SkillMemoryDetail(**memory)


@router.delete("/")
async def delete_tenant_memory(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db)
):
    """Delete all skill memory for the current tenant."""
    mm = MemoryManager(db)
    await mm.delete_product_memory(tenant_id)
    return {"status": "success", "message": "Memory deleted successfully"}
