"""
Roadmap Endpoints
Product roadmap with strategic initiatives, themes, and prioritized projects
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_tenant_id
from app.models.initiative import Initiative, InitiativeStatus
from app.schemas.initiative import InitiativeResponse

router = APIRouter()


@router.get("/", response_model=List[InitiativeResponse])
async def list_initiatives(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    status: Optional[InitiativeStatus] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0, description="Skip N results"),
    limit: int = Query(100, ge=1, le=1000, description="Limit results"),
):
    """
    List initiatives with linked themes and projects.
    Results include theme count and project count for each initiative.
    """
    query = select(Initiative).where(Initiative.tenant_id == tenant_id)

    # Apply filters
    if status is not None:
        query = query.where(Initiative.status == status)

    # Load related themes eagerly
    query = query.options(selectinload(Initiative.themes))

    # Order by created_at descending
    query = query.order_by(Initiative.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    initiatives = result.scalars().all()

    return initiatives


@router.get("/{initiative_id}", response_model=InitiativeResponse)
async def get_initiative(
    initiative_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Get a specific initiative by ID with linked themes"""
    result = await db.execute(
        select(Initiative)
        .where(
            and_(
                Initiative.id == initiative_id,
                Initiative.tenant_id == tenant_id
            )
        )
        .options(selectinload(Initiative.themes))
    )
    initiative = result.scalar_one_or_none()

    if not initiative:
        raise HTTPException(status_code=404, detail="Initiative not found")

    return initiative
