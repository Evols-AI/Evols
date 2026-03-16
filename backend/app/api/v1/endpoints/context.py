"""
Context API Endpoints
Unified context ingestion system
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.context import ContextSource, ExtractedEntity, ContextSourceType, ContextProcessingStatus, EntityType
from app.models.user import User
from app.services.context_extraction_service import extract_entities_from_source

router = APIRouter()


# ===================================
# Schemas
# ===================================

class ContextSourceCreate(BaseModel):
    product_id: Optional[int] = None
    source_type: ContextSourceType
    name: str
    description: Optional[str] = None
    source_url: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    github_repo: Optional[str] = None
    mcp_endpoint: Optional[str] = None
    account_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None


class ContextSourceResponse(BaseModel):
    id: int
    tenant_id: int
    product_id: Optional[int]
    source_type: str
    name: str
    description: Optional[str]
    source_url: Optional[str]
    status: str
    entities_extracted_count: int
    error_message: Optional[str] = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ExtractedEntityResponse(BaseModel):
    id: int
    tenant_id: int
    product_id: Optional[int]
    source_id: int
    entity_type: str
    name: str
    description: str
    confidence_score: Optional[float]
    category: Optional[str]
    attributes: Optional[dict]
    created_at: str

    class Config:
        from_attributes = True


# ===================================
# Context Source Endpoints
# ===================================

@router.get("/sources", response_model=List[ContextSourceResponse])
async def get_context_sources(
    product_ids: Optional[str] = None,
    source_type: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get context sources for current tenant"""
    query = select(ContextSource).where(ContextSource.tenant_id == current_user.tenant_id)

    # Filter by product IDs
    if product_ids:
        product_id_list = [int(pid) for pid in product_ids.split(',')]
        query = query.where(ContextSource.product_id.in_(product_id_list))

    # Filter by source type
    if source_type and source_type != 'all':
        query = query.where(ContextSource.source_type == source_type)

    # Filter by status
    if status and status != 'all':
        query = query.where(ContextSource.status == status)

    query = query.offset(skip).limit(limit).order_by(ContextSource.created_at.desc())

    result = await db.execute(query)
    sources = result.scalars().all()

    return [
        ContextSourceResponse(
            id=s.id,
            tenant_id=s.tenant_id,
            product_id=s.product_id,
            source_type=s.source_type.value,
            name=s.name,
            description=s.description,
            source_url=s.source_url,
            status=s.status.value,
            entities_extracted_count=s.entities_extracted_count or 0,
            error_message=s.error_message,
            created_at=s.created_at.isoformat(),
            updated_at=s.updated_at.isoformat(),
        )
        for s in sources
    ]


@router.post("/sources", response_model=ContextSourceResponse, status_code=201)
async def create_context_source(
    source: ContextSourceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new context source"""
    new_source = ContextSource(
        tenant_id=current_user.tenant_id,
        product_id=source.product_id,
        source_type=source.source_type,
        name=source.name,
        description=source.description,
        source_url=source.source_url,
        title=source.title,
        content=source.content,
        github_repo=source.github_repo,
        mcp_endpoint=source.mcp_endpoint,
        account_id=source.account_id,
        customer_name=source.customer_name,
        customer_email=source.customer_email,
        status=ContextProcessingStatus.PENDING,
        entities_extracted_count=0,
    )

    db.add(new_source)
    await db.commit()
    await db.refresh(new_source)

    # TODO: Trigger async extraction job

    return ContextSourceResponse(
        id=new_source.id,
        tenant_id=new_source.tenant_id,
        product_id=new_source.product_id,
        source_type=new_source.source_type.value,
        name=new_source.name,
        description=new_source.description,
        source_url=new_source.source_url,
        status=new_source.status.value,
        entities_extracted_count=new_source.entities_extracted_count,
        error_message=new_source.error_message,
        created_at=new_source.created_at.isoformat(),
        updated_at=new_source.updated_at.isoformat(),
    )


@router.post("/sources/upload", response_model=ContextSourceResponse)
async def upload_context_file(
    file: UploadFile = File(...),
    name: str = Form(...),
    product_id: Optional[int] = Form(None),
    description: Optional[str] = Form(None),
    source_type: str = Form("csv_survey"),
    retention_policy: str = Form("30_days"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a file as a context source (TXT, CSV, PDF, etc.)"""

    # Validate file extension
    allowed_extensions = {'.txt', '.csv', '.pdf', '.md', '.json'}
    file_ext = '.' + file.filename.split('.')[-1].lower() if '.' in file.filename else ''

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"File type {file_ext} not supported. Allowed: {', '.join(allowed_extensions)}"
        )

    # Read file content
    try:
        contents = await file.read()

        # For text files, decode to string
        if file_ext in {'.txt', '.csv', '.md', '.json'}:
            try:
                content_text = contents.decode('utf-8')
            except UnicodeDecodeError:
                content_text = contents.decode('latin-1')  # Fallback encoding
        else:
            # For binary files like PDF, store raw bytes (future implementation)
            content_text = f"Binary file uploaded: {file.filename}"

        # Map source_type string to enum
        try:
            source_type_enum = ContextSourceType(source_type)
        except ValueError:
            source_type_enum = ContextSourceType.DOCUMENT_PDF

        # Validate retention policy
        valid_policies = ['delete_immediately', '30_days', '90_days', 'retain_encrypted']
        if retention_policy not in valid_policies:
            retention_policy = '30_days'  # Default fallback

        # Create context source
        new_source = ContextSource(
            tenant_id=current_user.tenant_id,
            product_id=product_id,
            source_type=source_type_enum,
            name=name,
            description=description,
            content=content_text,
            status=ContextProcessingStatus.PENDING,  # Start as pending for extraction
            entities_extracted_count=0,
            retention_policy=retention_policy,
        )

        db.add(new_source)
        await db.commit()
        await db.refresh(new_source)

        # Trigger entity extraction in background (or inline for demo)
        extraction_error = None
        try:
            # For demo: extract inline (faster, user sees results immediately)
            # In production: use background_tasks for async processing
            entities_count = await extract_entities_from_source(
                db=db,
                tenant_id=current_user.tenant_id,
                source_id=new_source.id
            )
            await db.refresh(new_source)  # Refresh to get updated status and count

            # Apply retention policy after successful extraction
            from app.services.retention_service import RetentionPolicyService
            retention_service = RetentionPolicyService(db)
            await retention_service.apply_retention_policy(
                new_source,
                policy=retention_policy,
                encrypt_if_needed=True
            )
            await db.refresh(new_source)  # Refresh to get updated retention fields

        except ValueError as e:
            # LLM configuration error - return clear message to user
            error_msg = str(e)
            print(f"Entity extraction failed for source {new_source.id}: {error_msg}")
            new_source.status = ContextProcessingStatus.FAILED
            new_source.error_message = error_msg
            new_source.entities_extracted_count = 0
            extraction_error = error_msg
            await db.commit()
            await db.refresh(new_source)
        except Exception as e:
            # If extraction fails, mark as failed with error message
            error_msg = f"Entity extraction failed: {str(e)}"
            print(f"Entity extraction failed for source {new_source.id}: {error_msg}")
            new_source.status = ContextProcessingStatus.FAILED
            new_source.error_message = error_msg
            new_source.entities_extracted_count = 0
            extraction_error = error_msg
            await db.commit()
            await db.refresh(new_source)

        return ContextSourceResponse(
            id=new_source.id,
            tenant_id=new_source.tenant_id,
            product_id=new_source.product_id,
            source_type=new_source.source_type.value,
            name=new_source.name,
            description=new_source.description,
            source_url=new_source.source_url,
            status=new_source.status.value,
            entities_extracted_count=new_source.entities_extracted_count,
            error_message=new_source.error_message,
            created_at=new_source.created_at.isoformat(),
            updated_at=new_source.updated_at.isoformat(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")


@router.post("/sources/{source_id}/extract")
async def trigger_extraction(
    source_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger entity extraction for a source"""
    query = select(ContextSource).where(
        and_(
            ContextSource.id == source_id,
            ContextSource.tenant_id == current_user.tenant_id
        )
    )
    result = await db.execute(query)
    source = result.scalar_one_or_none()

    if not source:
        raise HTTPException(status_code=404, detail="Context source not found")

    try:
        entities_count = await extract_entities_from_source(
            db=db,
            tenant_id=current_user.tenant_id,
            source_id=source.id
        )
        await db.refresh(source)

        return {
            "message": "Extraction completed",
            "entities_extracted": entities_count,
            "status": source.status.value
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@router.delete("/sources/{source_id}")
async def delete_context_source(
    source_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a context source and all its extracted entities"""
    query = select(ContextSource).where(
        and_(
            ContextSource.id == source_id,
            ContextSource.tenant_id == current_user.tenant_id
        )
    )
    result = await db.execute(query)
    source = result.scalar_one_or_none()

    if not source:
        raise HTTPException(status_code=404, detail="Context source not found")

    await db.delete(source)
    await db.commit()

    return {"message": "Context source deleted successfully"}


@router.get("/retention/policies")
async def get_retention_policies(
    current_user: User = Depends(get_current_user),
):
    """Get available retention policies"""
    from app.services.retention_service import RetentionPolicyService

    return {
        "policies": [
            {
                "id": "delete_immediately",
                "name": "Maximum Privacy",
                "description": "Delete original file after AI extraction completes. You'll keep extracted insights and short quotes.",
                "days": 0,
                "recommended": False
            },
            {
                "id": "30_days",
                "name": "Balanced (Recommended)",
                "description": "Keep original for 30 days, then auto-delete. Allows re-extraction if needed.",
                "days": 30,
                "recommended": True
            },
            {
                "id": "90_days",
                "name": "Extended Retention",
                "description": "Keep original for 90 days, then auto-delete.",
                "days": 90,
                "recommended": False
            },
            {
                "id": "retain_encrypted",
                "name": "Full Retention (Encrypted)",
                "description": "Keep original file indefinitely, encrypted. Best for audit/compliance requirements.",
                "days": None,
                "recommended": False
            }
        ]
    }


@router.put("/sources/{source_id}/retention")
async def update_retention_policy(
    source_id: int,
    policy: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update retention policy for a source"""
    from app.services.retention_service import RetentionPolicyService

    query = select(ContextSource).where(
        and_(
            ContextSource.id == source_id,
            ContextSource.tenant_id == current_user.tenant_id
        )
    )
    result = await db.execute(query)
    source = result.scalar_one_or_none()

    if not source:
        raise HTTPException(status_code=404, detail="Context source not found")

    retention_service = RetentionPolicyService(db)
    try:
        await retention_service.apply_retention_policy(source, policy, encrypt_if_needed=True)
        return {"message": "Retention policy updated successfully", "policy": policy}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sources/{source_id}/delete-content")
async def manually_delete_content(
    source_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually delete content from a source (preserves metadata and entities)"""
    from app.services.retention_service import RetentionPolicyService

    query = select(ContextSource).where(
        and_(
            ContextSource.id == source_id,
            ContextSource.tenant_id == current_user.tenant_id
        )
    )
    result = await db.execute(query)
    source = result.scalar_one_or_none()

    if not source:
        raise HTTPException(status_code=404, detail="Context source not found")

    if source.content_deleted_at:
        raise HTTPException(status_code=400, detail="Content already deleted")

    retention_service = RetentionPolicyService(db)
    await retention_service._delete_content(source)

    return {"message": "Content deleted successfully", "summary": source.content_summary}


@router.get("/sources/{source_id}/content")
async def get_source_content(
    source_id: int,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get raw content from source (logged for audit).
    Requires justification for accessing raw data.
    """
    from app.services.retention_service import RetentionPolicyService

    query = select(ContextSource).where(
        and_(
            ContextSource.id == source_id,
            ContextSource.tenant_id == current_user.tenant_id
        )
    )
    result = await db.execute(query)
    source = result.scalar_one_or_none()

    if not source:
        raise HTTPException(status_code=404, detail="Context source not found")

    retention_service = RetentionPolicyService(db)

    # Log access
    await retention_service.log_content_access(
        source_id=source_id,
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        reason=reason
    )

    # Get content (decrypt if needed)
    if source.is_encrypted:
        try:
            content = await retention_service.decrypt_content(source)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    elif source.content:
        content = source.content
    elif source.content_deleted_at:
        raise HTTPException(
            status_code=410,
            detail=f"Content deleted on {source.content_deleted_at.isoformat()}. Summary: {source.content_summary}"
        )
    else:
        raise HTTPException(status_code=404, detail="No content available")

    return {
        "content": content,
        "is_encrypted": source.is_encrypted,
        "retention_policy": source.retention_policy,
        "access_count": source.access_count,
        "last_accessed_at": source.last_accessed_at.isoformat() if source.last_accessed_at else None
    }


@router.get("/retention/stats")
async def get_retention_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get retention statistics for current tenant"""
    from app.services.retention_service import RetentionPolicyService

    retention_service = RetentionPolicyService(db)
    stats = await retention_service.get_retention_stats(current_user.tenant_id)

    return stats


# ===================================
# Extracted Entities Endpoints
# ===================================

@router.get("/entities", response_model=List[ExtractedEntityResponse])
async def get_extracted_entities(
    product_ids: Optional[str] = None,
    entity_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get extracted entities for current tenant"""
    query = select(ExtractedEntity).where(ExtractedEntity.tenant_id == current_user.tenant_id)

    # Filter by product IDs
    if product_ids:
        product_id_list = [int(pid) for pid in product_ids.split(',')]
        query = query.where(ExtractedEntity.product_id.in_(product_id_list))

    # Filter by entity type
    if entity_type and entity_type != 'all':
        query = query.where(ExtractedEntity.entity_type == entity_type)

    query = query.offset(skip).limit(limit).order_by(ExtractedEntity.created_at.desc())

    result = await db.execute(query)
    entities = result.scalars().all()

    return [
        ExtractedEntityResponse(
            id=e.id,
            tenant_id=e.tenant_id,
            product_id=e.product_id,
            source_id=e.source_id,
            entity_type=e.entity_type.value,
            name=e.name,
            description=e.description,
            confidence_score=e.confidence_score,
            category=e.category,
            attributes=e.attributes,
            created_at=e.created_at.isoformat(),
        )
        for e in entities
    ]


@router.get("/entities/summary")
async def get_entities_summary(
    product_ids: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get summary statistics of extracted entities"""
    # TODO: Implement aggregation queries for entity counts by type
    return {
        "total": 0,
        "by_type": {
            "persona": 0,
            "pain_point": 0,
            "use_case": 0,
            "feature_request": 0,
            "product_capability": 0,
            "competitor": 0,
            "stakeholder": 0,
        }
    }


# ===================================
# Evidence & Initiative Endpoints
# ===================================

@router.post("/evidence/initiative/{initiative_id}")
async def build_initiative_evidence(
    initiative_id: int,
    entity_ids: Optional[List[int]] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Build or update evidence for an initiative from extracted entities

    Args:
        initiative_id: Initiative to build evidence for
        entity_ids: Optional list of entity IDs to link to this initiative
    """
    from app.services.evidence_service import EvidenceService

    evidence_service = EvidenceService(db)

    try:
        evidence = await evidence_service.build_initiative_evidence(
            initiative_id=initiative_id,
            tenant_id=current_user.tenant_id,
            entity_ids=entity_ids or []
        )

        return {
            "id": evidence.id,
            "initiative_id": evidence.initiative_id,
            "total_mentions": evidence.total_mentions,
            "total_arr_impacted": evidence.total_arr_impacted,
            "customer_segments": evidence.customer_segments,
            "representative_quotes": evidence.representative_quotes,
            "sources": evidence.sources,
            "confidence_avg": evidence.confidence_avg,
            "sentiment_avg": evidence.sentiment_avg,
            "last_updated_at": evidence.last_updated_at.isoformat()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to build evidence: {str(e)}")


@router.get("/evidence/initiative/{initiative_id}")
async def get_initiative_evidence(
    initiative_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get evidence for an initiative"""
    from app.services.evidence_service import EvidenceService

    evidence_service = EvidenceService(db)
    evidence = await evidence_service.get_initiative_evidence(
        initiative_id=initiative_id,
        tenant_id=current_user.tenant_id
    )

    if not evidence:
        raise HTTPException(status_code=404, detail="No evidence found for this initiative")

    return {
        "id": evidence.id,
        "initiative_id": evidence.initiative_id,
        "total_mentions": evidence.total_mentions,
        "total_arr_impacted": evidence.total_arr_impacted,
        "customer_segments": evidence.customer_segments,
        "representative_quotes": evidence.representative_quotes,
        "sources": evidence.sources,
        "confidence_avg": evidence.confidence_avg,
        "sentiment_avg": evidence.sentiment_avg,
        "last_updated_at": evidence.last_updated_at.isoformat()
    }


@router.get("/evidence/initiative/{initiative_id}/entities")
async def get_supporting_entities(
    initiative_id: int,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get entities supporting an initiative"""
    from app.services.evidence_service import EvidenceService

    evidence_service = EvidenceService(db)
    entities = await evidence_service.get_supporting_entities(
        initiative_id=initiative_id,
        tenant_id=current_user.tenant_id,
        limit=limit
    )

    return {
        "initiative_id": initiative_id,
        "entities": [
            {
                "id": e.id,
                "entity_type": e.entity_type.value,
                "name": e.name,
                "description": e.description,
                "confidence_score": e.confidence_score,
                "context_snippet": e.context_snippet,
                "attributes": e.attributes,
                "created_at": e.created_at.isoformat()
            }
            for e in entities
        ]
    }
