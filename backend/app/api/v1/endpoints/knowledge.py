"""
Knowledge API Endpoints
Manage product knowledge documents (strategy, segments, competitive, etc.)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.unified_pm_os import KnowledgeManager

router = APIRouter()


# ===================================
# REQUEST/RESPONSE MODELS
# ===================================

class KnowledgeResponse(BaseModel):
    strategy_doc: str
    customer_segments_doc: str
    competitive_landscape_doc: str
    value_proposition_doc: str
    metrics_and_targets_doc: str


class KnowledgeUpdateRequest(BaseModel):
    doc_type: str  # 'strategy', 'customer_segments', 'competitive_landscape', 'value_proposition', 'metrics_and_targets'
    content: str


class KnowledgeSummaryResponse(BaseModel):
    has_strategy: bool
    has_customer_segments: bool
    has_competitive_landscape: bool
    has_value_proposition: bool
    has_metrics_and_targets: bool
    completeness_percentage: int


# ===================================
# ENDPOINTS
# ===================================

@router.get("/products/{product_id}/knowledge", response_model=KnowledgeResponse)
async def get_product_knowledge(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all knowledge documents for a product.

    Returns all 5 knowledge documents (strategy, segments, competitive, value prop, metrics).
    Empty strings are returned for documents that haven't been filled out yet.
    """
    km = KnowledgeManager(db)
    knowledge = await km.get_product_knowledge(product_id)

    if not knowledge:
        # Return empty template
        return KnowledgeResponse(
            strategy_doc="",
            customer_segments_doc="",
            competitive_landscape_doc="",
            value_proposition_doc="",
            metrics_and_targets_doc=""
        )

    return KnowledgeResponse(**knowledge)


@router.put("/products/{product_id}/knowledge")
async def update_knowledge_doc(
    product_id: int,
    request: KnowledgeUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a specific knowledge document.

    Args:
        product_id: Product ID
        doc_type: One of: 'strategy', 'customer_segments', 'competitive_landscape',
                  'value_proposition', 'metrics_and_targets'
        content: Markdown content of the document
    """
    km = KnowledgeManager(db)

    try:
        result = await km.update_knowledge_doc(
            product_id=product_id,
            tenant_id=current_user.tenant_id,
            doc_type=request.doc_type,
            content=request.content
        )

        return {
            "status": "success",
            "message": f"Updated {request.doc_type} successfully"
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update knowledge: {str(e)}")


@router.get("/products/{product_id}/knowledge/summary", response_model=KnowledgeSummaryResponse)
async def get_knowledge_summary(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a summary of what knowledge is available for a product.

    Returns which documents have been filled out and overall completeness percentage.
    Useful for showing onboarding progress.
    """
    km = KnowledgeManager(db)
    summary = await km.get_knowledge_summary(product_id)

    return KnowledgeSummaryResponse(**summary)


@router.delete("/products/{product_id}/knowledge")
async def delete_product_knowledge(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete all knowledge for a product.

    Use with caution - this removes all knowledge documents for the product.
    """
    # TODO: Add admin-only check if needed
    km = KnowledgeManager(db)
    await km.delete_product_knowledge(product_id)

    return {
        "status": "success",
        "message": "Product knowledge deleted successfully"
    }
