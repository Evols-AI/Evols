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
from app.core.dependencies import get_current_user
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

@router.get("/products/{product_id}/memory", response_model=List[SkillMemoryItem])
async def get_skill_memory(
    product_id: int,
    category: Optional[str] = Query(None, description="Filter by skill category"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of results"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get skill execution history for a product.

    Returns a list of past skill executions with summaries.
    Use this to see what work has been done and build on it.

    Args:
        product_id: Product ID
        category: Optional filter by skill category (e.g., 'discovery', 'strategy')
        limit: Maximum number of results (default: 50, max: 200)
    """
    mm = MemoryManager(db)

    memory = await mm.get_recent_skill_outputs(
        product_id=product_id,
        limit=limit,
        category=category
    )

    return [SkillMemoryItem(**m) for m in memory]


@router.get("/products/{product_id}/memory/{memory_id}", response_model=SkillMemoryDetail)
async def get_skill_memory_detail(
    product_id: int,
    memory_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get full details of a specific skill execution.

    Includes complete input and output data.
    """
    mm = MemoryManager(db)

    memory = await mm.get_skill_memory_by_id(memory_id)

    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    # TODO: Verify memory belongs to this product/tenant (security)

    return SkillMemoryDetail(**memory)


@router.get("/products/{product_id}/memory/stats", response_model=MemoryStatsResponse)
async def get_memory_stats(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get statistics about skill usage for a product.

    Returns:
    - Total skill executions
    - Breakdown by category
    - Most frequently used skills
    - Recent activity timeline

    Useful for retrospective analysis and understanding workflow patterns.
    """
    mm = MemoryManager(db)
    stats = await mm.get_memory_stats(product_id)

    return MemoryStatsResponse(**stats)


@router.get("/products/{product_id}/memory/search", response_model=List[SkillMemoryItem])
async def search_memory(
    product_id: int,
    q: str = Query(..., description="Search term"),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Search skill memory by keyword.

    Searches in skill names and summaries.
    Useful for finding past work on a specific topic.

    Args:
        product_id: Product ID
        q: Search query
        limit: Maximum results (default: 20, max: 100)
    """
    mm = MemoryManager(db)

    results = await mm.search_memory(
        product_id=product_id,
        search_term=q,
        limit=limit
    )

    return [SkillMemoryItem(**m) for m in results]


@router.delete("/products/{product_id}/memory")
async def delete_product_memory(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete all skill memory for a product.

    Use with caution - this removes all execution history.
    """
    # TODO: Add admin-only check if needed
    mm = MemoryManager(db)
    await mm.delete_product_memory(product_id)

    return {
        "status": "success",
        "message": "Product memory deleted successfully"
    }
