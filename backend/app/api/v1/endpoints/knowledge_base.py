"""
Product RAG (Retrieval-Augmented Generation) Endpoints
Knowledge Base for product capabilities and documentation
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_tenant_id
from app.models.knowledge_base import KnowledgeSource, Capability
from app.schemas.knowledge_base import (
    KnowledgeSourceCreate,
    KnowledgeSourceResponse,
    CapabilityResponse,
    KnowledgeBaseAskRequest,
    KnowledgeBaseAskResponse,
    SourceStatus
)
from app.services.knowledge_extraction import KnowledgeExtractionService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/sources", response_model=List[KnowledgeSourceResponse])
async def list_knowledge_sources(
    product_ids: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """List all Product RAG sources for tenant, optionally filtered by products"""
    query = select(KnowledgeSource).where(KnowledgeSource.tenant_id == tenant_id)

    # Filter by product_ids if provided
    if product_ids:
        ids = [int(id.strip()) for id in product_ids.split(',') if id.strip()]
        if ids:
            query = query.where(KnowledgeSource.product_id.in_(ids))

    query = query.order_by(KnowledgeSource.created_at.desc())
    result = await db.execute(query)
    sources = result.scalars().all()
    return sources


@router.post("/sources", response_model=KnowledgeSourceResponse)
async def create_knowledge_source(
    source: KnowledgeSourceCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Create a new Product RAG source"""

    # Validate type-specific fields
    if source.type == "url" and not source.url:
        raise HTTPException(status_code=400, detail="URL is required for URL type")
    if source.type == "github" and not source.github_repo:
        raise HTTPException(status_code=400, detail="GitHub repo is required for GitHub type")
    if source.type == "mcp" and not source.mcp_endpoint:
        raise HTTPException(status_code=400, detail="MCP endpoint is required for MCP type")

    # Create source
    new_source = KnowledgeSource(
        tenant_id=tenant_id,
        name=source.name,
        type=source.type.value,
        description=source.description,
        url=source.url,
        github_repo=source.github_repo,
        mcp_endpoint=source.mcp_endpoint,
        status=SourceStatus.PENDING.value
    )

    db.add(new_source)
    await db.commit()
    await db.refresh(new_source)

    # Process source to extract capabilities
    logger.info(f"Created knowledge source {new_source.id} for tenant {tenant_id}")

    # Extract capabilities in the background (non-blocking)
    try:
        extraction_service = KnowledgeExtractionService(db)
        await extraction_service.process_source(new_source)
        await db.refresh(new_source)
    except Exception as e:
        logger.error(f"Error extracting capabilities: {e}")
        # Don't fail the request if extraction fails

    return new_source


@router.post("/sources/upload", response_model=KnowledgeSourceResponse)
async def upload_knowledge_source(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Upload a PDF Product RAG source"""

    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # TODO: Save file to storage (S3, local, etc.)
    # For now, just create the record
    file_path = f"uploads/tenant_{tenant_id}/{file.filename}"

    new_source = KnowledgeSource(
        tenant_id=tenant_id,
        name=name,
        type="pdf",
        description=description,
        file_path=file_path,
        status=SourceStatus.PENDING.value
    )

    db.add(new_source)
    await db.commit()
    await db.refresh(new_source)

    logger.info(f"Uploaded PDF knowledge source {new_source.id} for tenant {tenant_id}")

    # Extract capabilities
    try:
        extraction_service = KnowledgeExtractionService(db)
        await extraction_service.process_source(new_source)
        await db.refresh(new_source)
    except Exception as e:
        logger.error(f"Error extracting capabilities: {e}")

    return new_source


@router.delete("/sources/{source_id}")
async def delete_knowledge_source(
    source_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Delete a Product RAG source"""
    result = await db.execute(
        select(KnowledgeSource).where(
            KnowledgeSource.id == source_id,
            KnowledgeSource.tenant_id == tenant_id
        )
    )
    source = result.scalar_one_or_none()

    if not source:
        raise HTTPException(status_code=404, detail="Product RAG source not found")

    await db.delete(source)
    await db.commit()

    return {"success": True, "message": "Product RAG source deleted"}


@router.post("/sources/{source_id}/refresh", response_model=KnowledgeSourceResponse)
async def refresh_knowledge_source(
    source_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Manually refresh a Product RAG source to extract latest capabilities"""
    # Get the source
    result = await db.execute(
        select(KnowledgeSource).where(
            KnowledgeSource.id == source_id,
            KnowledgeSource.tenant_id == tenant_id
        )
    )
    source = result.scalar_one_or_none()

    if not source:
        raise HTTPException(status_code=404, detail="Product RAG source not found")

    logger.info(f"Manual refresh triggered for source {source_id}: {source.name}")

    try:
        # Delete existing capabilities for this source
        await db.execute(
            Capability.__table__.delete().where(Capability.source_id == source_id)
        )
        await db.commit()

        # Re-extract capabilities
        extraction_service = KnowledgeExtractionService(db)
        count = await extraction_service.process_source(source)

        # Refresh the source object to get updated data
        await db.refresh(source)

        logger.info(f"Successfully refreshed source {source_id}: extracted {count} capabilities")

        return source

    except Exception as e:
        logger.error(f"Error refreshing source {source_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to refresh source: {str(e)}"
        )


@router.get("/capabilities", response_model=List[CapabilityResponse])
async def list_capabilities(
    product_ids: Optional[str] = None,
    source_id: Optional[int] = None,
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """List all capabilities for tenant"""
    query = select(Capability).where(Capability.tenant_id == tenant_id)

    # Filter by product_ids if provided
    if product_ids:
        ids = [int(id.strip()) for id in product_ids.split(',') if id.strip()]
        if ids:
            query = query.where(Capability.product_id.in_(ids))

    if source_id:
        query = query.where(Capability.source_id == source_id)
    if category:
        query = query.where(Capability.category == category)

    query = query.options(selectinload(Capability.source)).order_by(Capability.name)

    result = await db.execute(query)
    capabilities = result.scalars().all()

    # Format response with source details
    response = []
    for cap in capabilities:
        cap_dict = {
            "id": cap.id,
            "tenant_id": cap.tenant_id,
            "source_id": cap.source_id,
            "name": cap.name,
            "description": cap.description,
            "category": cap.category,
            "endpoints": cap.endpoints,
            "dependencies": cap.dependencies,
            "dependents": cap.dependents,
            "source_url": cap.source_url,
            "source_section": cap.source_section,
            "created_at": cap.created_at,
            "updated_at": cap.updated_at,
            "source": {
                "id": cap.source.id,
                "name": cap.source.name,
                "type": cap.source.type,
                "url": cap.source.url
            } if cap.source else None
        }
        response.append(cap_dict)

    return response


@router.get("/capabilities/{capability_id}", response_model=CapabilityResponse)
async def get_capability(
    capability_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Get a specific capability"""
    result = await db.execute(
        select(Capability)
        .where(
            Capability.id == capability_id,
            Capability.tenant_id == tenant_id
        )
        .options(selectinload(Capability.source))
    )
    capability = result.scalar_one_or_none()

    if not capability:
        raise HTTPException(status_code=404, detail="Capability not found")

    # Format response with source details
    cap_dict = {
        "id": capability.id,
        "tenant_id": capability.tenant_id,
        "source_id": capability.source_id,
        "name": capability.name,
        "description": capability.description,
        "category": capability.category,
        "endpoints": capability.endpoints,
        "dependencies": capability.dependencies,
        "dependents": capability.dependents,
        "source_url": capability.source_url,
        "source_section": capability.source_section,
        "created_at": capability.created_at,
        "updated_at": capability.updated_at,
        "source": {
            "id": capability.source.id,
            "name": capability.source.name,
            "type": capability.source.type,
            "url": capability.source.url
        } if capability.source else None
    }

    return cap_dict


@router.post("/ask", response_model=KnowledgeBaseAskResponse)
async def ask_knowledge_base(
    request: KnowledgeBaseAskRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Ask a question about your product using RAG (Retrieval-Augmented Generation)"""

    # Get capabilities (optionally filtered by source_ids)
    query = select(Capability).where(Capability.tenant_id == tenant_id)

    if request.source_ids:
        query = query.where(Capability.source_id.in_(request.source_ids))

    query = query.options(selectinload(Capability.source))
    result = await db.execute(query)
    capabilities = result.scalars().all()

    if not capabilities:
        return KnowledgeBaseAskResponse(
            answer="I don't have enough information to answer that question. Please add some Product RAG sources first.",
            citations=[]
        )

    # Simple keyword-based search for now
    # TODO: Implement proper RAG (Retrieval-Augmented Generation) with embeddings
    question_lower = request.question.lower()
    matching_caps = []

    for cap in capabilities:
        if (question_lower in cap.name.lower() or
            question_lower in cap.description.lower()):
            matching_caps.append(cap)

    if not matching_caps:
        # Fallback: show first few capabilities
        matching_caps = capabilities[:3]

    # Generate simple answer
    answer_parts = []
    citations = []

    for cap in matching_caps[:5]:  # Limit to 5 capabilities
        answer_parts.append(f"- **{cap.name}**: {cap.description}")

        citations.append({
            "title": cap.name,
            "url": cap.source_url or cap.source.url if cap.source else "#",
            "source": cap.source.name if cap.source else "Unknown",
            "type": cap.category or "capability"
        })

    answer = "Based on your Product RAG:\n\n" + "\n\n".join(answer_parts)

    return KnowledgeBaseAskResponse(
        answer=answer,
        citations=citations,
        confidence=0.7  # Placeholder confidence score
    )


@router.post("/capabilities/deduplicate")
async def deduplicate_capabilities(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Remove duplicate capabilities (keeping the oldest one for each name)"""

    # Get all capabilities for tenant
    result = await db.execute(
        select(Capability)
        .where(Capability.tenant_id == tenant_id)
        .order_by(Capability.name, Capability.created_at)
    )
    capabilities = result.scalars().all()

    # Group by name
    seen_names = {}
    duplicates_to_delete = []

    for cap in capabilities:
        if cap.name in seen_names:
            # This is a duplicate, mark for deletion
            duplicates_to_delete.append(cap)
        else:
            # First occurrence, keep it
            seen_names[cap.name] = cap

    # Delete duplicates
    deleted_count = 0
    for cap in duplicates_to_delete:
        await db.delete(cap)
        deleted_count += 1

    await db.commit()

    logger.info(f"Removed {deleted_count} duplicate capabilities for tenant {tenant_id}")

    return {
        "success": True,
        "message": f"Removed {deleted_count} duplicate capabilities",
        "deleted_count": deleted_count,
        "unique_capabilities": len(seen_names)
    }
