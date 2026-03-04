"""
Decision Endpoints
Decision brief generation and management
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.models.decision import Decision
from app.schemas.decision import (
    DecisionCreate,
    DecisionUpdate,
    DecisionResponse,
    DecisionGenerateRequest,
    DecisionBriefResponse,
)

router = APIRouter()


@router.post("/", response_model=DecisionResponse, status_code=201)
async def create_decision(
    decision_data: DecisionCreate,
    tenant_id: int = 1,  # TODO: Get from auth token
    user_id: int = 1,  # TODO: Get from auth token
    db: AsyncSession = Depends(get_db),
):
    """Create a new decision"""
    decision = Decision(
        **decision_data.model_dump(exclude={"options"}),
        tenant_id=tenant_id,
        created_by=user_id,
    )
    db.add(decision)
    await db.commit()
    await db.refresh(decision)
    return decision


@router.get("/", response_model=List[DecisionResponse])
async def list_decisions(
    tenant_id: int = 1,  # TODO: Get from auth token
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """List decisions"""
    query = (
        select(Decision)
        .where(Decision.tenant_id == tenant_id)
        .offset(skip)
        .limit(limit)
        .order_by(Decision.created_at.desc())
    )

    result = await db.execute(query)
    decisions = result.scalars().all()
    return decisions


@router.get("/{decision_id}", response_model=DecisionResponse)
async def get_decision(
    decision_id: int,
    tenant_id: int = 1,  # TODO: Get from auth token
    db: AsyncSession = Depends(get_db),
):
    """Get a specific decision"""
    result = await db.execute(
        select(Decision).where(
            and_(Decision.id == decision_id, Decision.tenant_id == tenant_id)
        )
    )
    decision = result.scalar_one_or_none()

    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")

    return decision


@router.post("/generate", response_model=DecisionBriefResponse)
async def generate_decision_brief(
    request: DecisionGenerateRequest,
    tenant_id: int = 1,  # TODO: Get from auth token
    user_id: int = 1,  # TODO: Get from auth token
    db: AsyncSession = Depends(get_db),
):
    """
    Generate an AI-powered decision brief
    Analyzes themes, feedback, accounts and creates evidence-backed options
    """
    # TODO: Implement decision brief generation service
    from datetime import datetime

    return DecisionBriefResponse(
        decision_id=1,
        title=request.title,
        markdown_content="# Decision Brief\n\nGeneration pending...",
        executive_summary="Decision brief generation endpoint - implementation pending",
        problem_statement=request.objective,
        options=[],
        key_insights=[],
        citations=[],
        generated_at=datetime.utcnow(),
    )
