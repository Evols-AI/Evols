"""
Context API Endpoints
Unified context ingestion system
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from pydantic import BaseModel
import csv
import io

import logging

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.context import ContextSource, ContextSourceType, ContextProcessingStatus, SourceGroup
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


async def _push_raw_to_lightrag(content: str, source_label: str) -> None:
    """Push raw content to LightRAG for graph extraction. Never raises — failures are logged only."""
    if not content or not content.strip():
        logger.warning(f"LightRAG raw push skipped — empty content for {source_label}")
        return
    try:
        from app.services.lightrag_ingestion_service import _insert_texts
        await _insert_texts([content], [source_label])
    except Exception as e:
        logger.warning(f"LightRAG raw push failed ({source_label}): {e}")


# ===================================
# Schemas
# ===================================

class ContextSourceCreate(BaseModel):
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
    source_type: str
    name: str
    description: Optional[str]
    source_url: Optional[str]
    status: str
    entities_extracted_count: int
    error_message: Optional[str] = None
    source_group_id: Optional[int] = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class SourceGroupResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    description: Optional[str]
    event_date: Optional[str] = None
    created_at: str
    sources_count: int
    total_entities: int
    sources: Optional[List[ContextSourceResponse]] = None

    class Config:
        from_attributes = True


# ===================================
# Context Source Endpoints
# ===================================

@router.get("/sources", response_model=List[ContextSourceResponse])
async def get_context_sources(
    source_type: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get context sources for current tenant"""
    query = select(ContextSource).where(ContextSource.tenant_id == current_user.tenant_id)

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
            source_type=s.source_type.value,
            name=s.name,
            description=s.description,
            source_url=s.source_url,
            status=s.status.value,
            entities_extracted_count=s.entities_extracted_count or 0,
            error_message=s.error_message,
            source_group_id=s.source_group_id,
            created_at=s.created_at.isoformat(),
            updated_at=s.updated_at.isoformat(),
        )
        for s in sources
    ]


@router.get("/source-groups", response_model=List[SourceGroupResponse])
async def get_source_groups(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get source groups with aggregated stats"""
    from sqlalchemy import func

    query = select(
        SourceGroup,
        func.count(ContextSource.id).label('sources_count'),
        func.sum(ContextSource.entities_extracted_count).label('total_entities')
    ).outerjoin(
        ContextSource, ContextSource.source_group_id == SourceGroup.id
    ).where(
        SourceGroup.tenant_id == current_user.tenant_id
    ).group_by(SourceGroup.id).order_by(SourceGroup.created_at.desc())

    result = await db.execute(query)
    groups_with_stats = result.all()

    return [
        SourceGroupResponse(
            id=group.id,
            tenant_id=group.tenant_id,
            name=group.name,
            description=group.description,
            event_date=group.event_date.isoformat() if group.event_date else None,
            created_at=group.created_at.isoformat(),
            sources_count=sources_count or 0,
            total_entities=int(total_entities) if total_entities else 0
        )
        for group, sources_count, total_entities in groups_with_stats
    ]


@router.get("/source-groups/{group_id}/sources", response_model=List[ContextSourceResponse])
async def get_source_group_sources(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all sources belonging to a source group"""
    query = select(ContextSource).where(
        and_(
            ContextSource.source_group_id == group_id,
            ContextSource.tenant_id == current_user.tenant_id
        )
    ).order_by(ContextSource.created_at.asc())

    result = await db.execute(query)
    sources = result.scalars().all()

    return [
        ContextSourceResponse(
            id=s.id,
            tenant_id=s.tenant_id,
            source_type=s.source_type.value,
            name=s.name,
            description=s.description,
            source_url=s.source_url,
            status=s.status.value,
            entities_extracted_count=s.entities_extracted_count or 0,
            error_message=s.error_message,
            source_group_id=s.source_group_id,
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

    # Push raw content to LightRAG for graph extraction
    await _push_raw_to_lightrag(source.content or "", f"context_source:{new_source.id}")

    return ContextSourceResponse(
        id=new_source.id,
        tenant_id=new_source.tenant_id,
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


def _match_csv_column(column_name: str, patterns: List[str]) -> bool:
    """Check if a column name matches any of the given patterns (case-insensitive, exact match)"""
    column_lower = column_name.lower().strip().replace('_', '').replace('-', '').replace(' ', '')
    normalized_patterns = [p.lower().replace('_', '').replace('-', '').replace(' ', '') for p in patterns]
    return column_lower in normalized_patterns


def _parse_csv_row_to_source_fields(row: dict, source_type_enum: ContextSourceType) -> dict:
    """
    Parse a CSV row and map columns to ContextSource fields using flexible matching.
    Returns a dict with recognized fields and extra_data for unmapped columns.
    """
    from datetime import datetime

    # Define flexible column patterns for common fields
    column_mappings = {
        'content': ['content', 'feedback', 'description', 'text', 'comment', 'message', 'body'],
        'customer_name': ['customer_name', 'customer', 'company', 'account', 'company_name', 'account_name', 'client'],
        'customer_segment': ['segment', 'customer_segment', 'tier', 'plan', 'customer_tier'],
        'customer_email': ['email', 'customer_email', 'contact_email', 'user_email'],
        'title': ['title', 'subject', 'summary', 'headline'],
        'source_date': ['date', 'feedback_date', 'created_at', 'timestamp', 'created_date', 'submission_date'],
        'urgency_score': ['urgency', 'urgency_score', 'priority', 'priority_score'],
        'impact_score': ['impact', 'impact_score', 'importance'],
        'sentiment_score': ['sentiment', 'sentiment_score'],
    }

    # Initialize result
    mapped_fields = {}
    extra_data = {}

    # Process each column in the CSV row
    for col_name, col_value in row.items():
        if not col_name or col_value == '':
            continue

        col_value = str(col_value).strip()
        if not col_value:
            continue

        # Try to match to recognized fields
        matched = False
        for field_name, patterns in column_mappings.items():
            if _match_csv_column(col_name, patterns):
                # Special handling for date fields
                if field_name == 'source_date':
                    try:
                        # Try to parse date
                        from dateutil import parser
                        parsed_date = parser.parse(col_value)
                        mapped_fields[field_name] = parsed_date.date()
                    except:
                        # If parsing fails, store as string in extra_data
                        extra_data[col_name] = col_value
                # Special handling for numeric scores
                elif field_name in ['urgency_score', 'impact_score', 'sentiment_score']:
                    try:
                        mapped_fields[field_name] = float(col_value)
                    except (ValueError, TypeError):
                        extra_data[col_name] = col_value
                else:
                    # String fields
                    mapped_fields[field_name] = col_value
                matched = True
                break

        # If not matched to a known field, store in extra_data
        if not matched:
            extra_data[col_name] = col_value

    # Set source_type
    mapped_fields['source_type'] = source_type_enum

    # Store extra columns
    if extra_data:
        mapped_fields['extra_data'] = extra_data

    return mapped_fields


@router.post("/sources/upload")
async def upload_context_file(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    source_type: str = Form("csv_survey"),
    retention_policy: str = Form("30_days"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a file as a context source (TXT, CSV, PDF, etc.)

    For CSV files: Parses each row as a separate context source with flexible column mapping.
    For other files: Stores content as a single context source.
    """
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

        # === CSV SPECIAL HANDLING: Parse rows into separate sources ===
        if file_ext == '.csv':
            try:
                csv_reader = csv.DictReader(io.StringIO(content_text))
                rows = list(csv_reader)

                if not rows:
                    raise HTTPException(status_code=400, detail="CSV file is empty")

                # Create a SourceGroup to keep all CSV rows together
                source_group = SourceGroup(
                    tenant_id=current_user.tenant_id,
                    name=name,
                    description=f"CSV upload: {file.filename} ({len(rows)} rows)",
                )
                db.add(source_group)
                await db.flush()  # Get group ID

                created_sources = []
                extraction_errors = []

                # Create one ContextSource per CSV row, linked to the group
                for row_num, row in enumerate(rows, start=1):
                    try:
                        # Parse row with flexible column matching
                        parsed_fields = _parse_csv_row_to_source_fields(row, source_type_enum)

                        # Must have content
                        if 'content' not in parsed_fields or not parsed_fields['content']:
                            continue  # Skip rows without content

                        # Check for duplicate
                        from app.services.deduplication_service import DeduplicationService
                        dedup_service = DeduplicationService(db)
                        content_hash = dedup_service.compute_content_hash(parsed_fields['content'])

                        existing_source = await dedup_service.find_duplicate_source(
                            content_hash=content_hash,
                            tenant_id=current_user.tenant_id
                        )

                        if existing_source:
                            continue  # Skip duplicate rows

                        # Create source name with row number
                        row_name = f"{name} - Row {row_num}"
                        if 'customer_name' in parsed_fields and parsed_fields['customer_name']:
                            row_name = f"{name} - {parsed_fields['customer_name']}"

                        # Create ContextSource linked to the group
                        new_source = ContextSource(
                            tenant_id=current_user.tenant_id,
                            source_group_id=source_group.id,  # Link to group
                            name=row_name,
                            description=description,
                            content=parsed_fields['content'],
                            title=parsed_fields.get('title'),
                            customer_name=parsed_fields.get('customer_name'),
                            customer_segment=parsed_fields.get('customer_segment'),
                            customer_email=parsed_fields.get('customer_email'),
                            source_date=parsed_fields.get('source_date'),
                            urgency_score=parsed_fields.get('urgency_score'),
                            impact_score=parsed_fields.get('impact_score'),
                            sentiment_score=parsed_fields.get('sentiment_score'),
                            source_type=parsed_fields['source_type'],
                            extra_data=parsed_fields.get('extra_data'),
                            content_hash=content_hash,
                            status=ContextProcessingStatus.PENDING,
                            entities_extracted_count=0,
                            retention_policy=retention_policy,
                        )

                        db.add(new_source)
                        await db.flush()  # Get ID without committing

                        # Push raw content to LightRAG for graph extraction (single LLM pass)
                        await _push_raw_to_lightrag(
                            parsed_fields['content'],
                            f"context_source:{new_source.id}",
                        )

                        # Apply retention policy and mark completed
                        try:
                            from app.services.retention_service import RetentionPolicyService
                            retention_service = RetentionPolicyService(db)
                            await retention_service.apply_retention_policy(
                                new_source,
                                policy=retention_policy,
                                encrypt_if_needed=True
                            )
                            new_source.status = ContextProcessingStatus.COMPLETED
                        except Exception as e:
                            extraction_errors.append(f"Row {row_num}: {str(e)}")
                            new_source.status = ContextProcessingStatus.FAILED
                            new_source.error_message = str(e)

                        created_sources.append(new_source)

                    except Exception as e:
                        extraction_errors.append(f"Row {row_num}: {str(e)}")
                        continue

                # Commit all sources at once
                await db.commit()

                # Return summary
                return {
                    "success": True,
                    "message": f"CSV processed: {len(created_sources)} sources created from {len(rows)} rows (grouped under '{source_group.name}')",
                    "source_group_id": source_group.id,
                    "source_group_name": source_group.name,
                    "sources_created": len(created_sources),
                    "total_rows": len(rows),
                    "source_ids": [s.id for s in created_sources],
                    "errors": extraction_errors if extraction_errors else None
                }

            except csv.Error as e:
                raise HTTPException(status_code=400, detail=f"Invalid CSV format: {str(e)}")

        # === NON-CSV FILES: Create single source ===
        # Check for duplicate content
        from app.services.deduplication_service import DeduplicationService
        dedup_service = DeduplicationService(db)
        content_hash = dedup_service.compute_content_hash(content_text)

        existing_source = await dedup_service.find_duplicate_source(
            content_hash=content_hash,
            tenant_id=current_user.tenant_id
        )

        if existing_source:
            # Return 409 Conflict with existing source info
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "duplicate_content",
                    "message": f"This content was already uploaded as '{existing_source.name}'",
                    "existing_source": {
                        "id": existing_source.id,
                        "name": existing_source.name,
                        "created_at": existing_source.created_at.isoformat(),
                        "entities_count": existing_source.entities_extracted_count,
                        "uploader_id": existing_source.created_by if hasattr(existing_source, 'created_by') else None
                    }
                }
            )

        # Create context source
        new_source = ContextSource(
            tenant_id=current_user.tenant_id,
            source_type=source_type_enum,
            name=name,
            description=description,
            content=content_text,
            content_hash=content_hash,
            status=ContextProcessingStatus.PENDING,  # Start as pending for extraction
            entities_extracted_count=0,
            retention_policy=retention_policy,
        )

        db.add(new_source)
        await db.commit()
        await db.refresh(new_source)

        # Push raw content to LightRAG for graph extraction (single LLM pass)
        await _push_raw_to_lightrag(content_text, f"context_source:{new_source.id}")

        # Apply retention policy and mark completed
        try:
            from app.services.retention_service import RetentionPolicyService
            retention_service = RetentionPolicyService(db)
            await retention_service.apply_retention_policy(
                new_source,
                policy=retention_policy,
                encrypt_if_needed=True
            )
            new_source.status = ContextProcessingStatus.COMPLETED
            await db.commit()
            await db.refresh(new_source)
        except Exception as e:
            error_msg = f"Failed to apply retention policy: {str(e)}"
            new_source.status = ContextProcessingStatus.FAILED
            new_source.error_message = error_msg
            await db.commit()
            await db.refresh(new_source)

        return ContextSourceResponse(
            id=new_source.id,
            tenant_id=new_source.tenant_id,
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
    """Push source content to LightRAG knowledge graph"""
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
        content = source.content or ""
        await _push_raw_to_lightrag(content, f"context_source:{source.id}")
        source.status = ContextProcessingStatus.COMPLETED
        await db.commit()
        await db.refresh(source)

        return {
            "message": "Content pushed to knowledge graph",
            "status": source.status.value
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Knowledge graph push failed: {str(e)}")


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

    source_id_for_lightrag = source.id
    await db.delete(source)
    await db.commit()

    # Remove document from LightRAG so re-uploads don't get silently deduplicated
    try:
        from app.services.lightrag_ingestion_service import _delete_document
        await _delete_document(f"context_source:{source_id_for_lightrag}")
    except Exception:
        pass  # LightRAG deletion is best-effort; don't fail the response

    return {"message": "Context source deleted successfully"}


@router.delete("/source-groups/{group_id}")
async def delete_source_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a source group and all its sources (with their entities)"""
    # Get the group
    query = select(SourceGroup).where(
        and_(
            SourceGroup.id == group_id,
            SourceGroup.tenant_id == current_user.tenant_id
        )
    )
    result = await db.execute(query)
    group = result.scalar_one_or_none()

    if not group:
        raise HTTPException(status_code=404, detail="Source group not found")

    # Get all sources in this group
    sources_query = select(ContextSource).where(ContextSource.source_group_id == group_id)
    sources_result = await db.execute(sources_query)
    sources = sources_result.scalars().all()

    source_ids_for_lightrag = [s.id for s in sources]

    # Delete all sources (cascade will delete entities)
    for source in sources:
        await db.delete(source)

    # Delete the group
    await db.delete(group)
    await db.commit()

    # Remove documents from LightRAG (best-effort, don't fail on error)
    try:
        from app.services.lightrag_ingestion_service import _delete_document
        for sid in source_ids_for_lightrag:
            await _delete_document(f"context_source:{sid}")
    except Exception:
        pass

    return {"message": f"Source group and {len(sources)} sources deleted successfully"}


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


# ===================================
# Deduplication Endpoints
# ===================================

@router.post("/sources/{source_id}/link-duplicate")
async def link_to_duplicate(
    source_id: int,
    existing_source_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Link a source as duplicate of existing source"""
    from app.services.deduplication_service import DeduplicationService

    # Get both sources
    new_source_query = select(ContextSource).where(
        and_(
            ContextSource.id == source_id,
            ContextSource.tenant_id == current_user.tenant_id
        )
    )
    result = await db.execute(new_source_query)
    new_source = result.scalar_one_or_none()

    if not new_source:
        raise HTTPException(status_code=404, detail="Source not found")

    existing_source_query = select(ContextSource).where(
        and_(
            ContextSource.id == existing_source_id,
            ContextSource.tenant_id == current_user.tenant_id
        )
    )
    result = await db.execute(existing_source_query)
    existing_source = result.scalar_one_or_none()

    if not existing_source:
        raise HTTPException(status_code=404, detail="Existing source not found")

    dedup_service = DeduplicationService(db)
    await dedup_service.link_to_existing_source(new_source, existing_source)

    return {"message": "Source linked as duplicate", "duplicate_of_id": existing_source_id}


@router.post("/deduplication/source-groups")
async def create_source_group_endpoint(
    name: str,
    source_ids: List[int],
    event_date: Optional[str] = None,
    description: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a source group for related sources (same meeting/event)"""
    from app.services.deduplication_service import DeduplicationService

    dedup_service = DeduplicationService(db)
    group = await dedup_service.create_source_group(
        name=name,
        tenant_id=current_user.tenant_id,
        source_ids=source_ids,
        event_date=event_date,
        description=description
    )

    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "event_date": group.event_date.isoformat() if group.event_date else None,
        "source_count": len(source_ids)
    }


@router.get("/deduplication/stats")
async def get_deduplication_stats_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get deduplication statistics for current tenant"""
    from app.services.deduplication_service import DeduplicationService

    dedup_service = DeduplicationService(db)
    stats = await dedup_service.get_deduplication_stats(current_user.tenant_id)

    return stats
