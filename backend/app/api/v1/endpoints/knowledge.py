"""
Knowledge API Endpoints
Manage team knowledge documents (strategy, segments, competitive, etc.)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.unified_pm_os import KnowledgeManager

router = APIRouter()


class KnowledgeResponse(BaseModel):
    strategy_doc: str
    customer_segments_doc: str
    competitive_landscape_doc: str
    value_proposition_doc: str
    metrics_and_targets_doc: str


class KnowledgeUpdateRequest(BaseModel):
    doc_type: str
    content: str


class KnowledgeSummaryResponse(BaseModel):
    has_strategy: bool
    has_customer_segments: bool
    has_competitive_landscape: bool
    has_value_proposition: bool
    has_metrics_and_targets: bool
    completeness_percentage: int


@router.get("/knowledge", response_model=KnowledgeResponse)
async def get_knowledge(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    km = KnowledgeManager(db)
    knowledge = await km.get_product_knowledge(current_user.tenant_id)

    if not knowledge:
        return KnowledgeResponse(
            strategy_doc="",
            customer_segments_doc="",
            competitive_landscape_doc="",
            value_proposition_doc="",
            metrics_and_targets_doc=""
        )

    return KnowledgeResponse(**knowledge)


@router.put("/knowledge")
async def update_knowledge_doc(
    request: KnowledgeUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    km = KnowledgeManager(db)

    try:
        await km.update_knowledge_doc(
            tenant_id=current_user.tenant_id,
            doc_type=request.doc_type,
            content=request.content
        )
        return {"status": "success", "message": f"Updated {request.doc_type} successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update knowledge: {str(e)}")


@router.get("/knowledge/summary", response_model=KnowledgeSummaryResponse)
async def get_knowledge_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    km = KnowledgeManager(db)
    summary = await km.get_knowledge_summary(current_user.tenant_id)
    return KnowledgeSummaryResponse(**summary)


@router.delete("/knowledge")
async def delete_knowledge(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    km = KnowledgeManager(db)
    await km.delete_product_knowledge(current_user.tenant_id)
    return {"status": "success", "message": "Knowledge deleted successfully"}


# ── Legacy product-scoped endpoints (redirect to tenant-scoped) ─────────────

@router.get("/products/{product_id}/knowledge", response_model=KnowledgeResponse)
async def get_product_knowledge_legacy(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Legacy endpoint — product_id ignored, uses tenant scope."""
    return await get_knowledge(current_user=current_user, db=db)


@router.put("/products/{product_id}/knowledge")
async def update_knowledge_doc_legacy(
    product_id: int,
    request: KnowledgeUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Legacy endpoint — product_id ignored, uses tenant scope."""
    return await update_knowledge_doc(request=request, current_user=current_user, db=db)


@router.get("/products/{product_id}/knowledge/summary", response_model=KnowledgeSummaryResponse)
async def get_knowledge_summary_legacy(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Legacy endpoint — product_id ignored, uses tenant scope."""
    return await get_knowledge_summary(current_user=current_user, db=db)


@router.delete("/products/{product_id}/knowledge")
async def delete_product_knowledge_legacy(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Legacy endpoint — product_id ignored, uses tenant scope."""
    return await delete_knowledge(current_user=current_user, db=db)
