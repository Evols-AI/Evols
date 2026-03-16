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
