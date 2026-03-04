"""
Feedback Endpoints
CRUD operations and analysis for customer feedback
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
import csv
import io
from datetime import datetime

from app.core.database import get_db
from app.core.dependencies import get_current_tenant_id
from app.models.feedback import Feedback, FeedbackCategory, FeedbackSource
from app.schemas.feedback import (
    FeedbackCreate,
    FeedbackUpdate,
    FeedbackResponse,
    FeedbackFilter,
)

router = APIRouter()


@router.post("/", response_model=FeedbackResponse, status_code=201)
async def create_feedback(
    feedback_data: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Create a new feedback item"""
    feedback = Feedback(
        **feedback_data.model_dump(),
        tenant_id=tenant_id,
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)

    # Auto-generate themes and personas from the new feedback
    try:
        from app.api.v1.endpoints.themes import auto_generate_themes
        from app.api.v1.endpoints.personas import auto_generate_personas
        await auto_generate_themes(tenant_id, db)
        await auto_generate_personas(tenant_id, db)
    except Exception as e:
        # Don't fail the creation if auto-generation fails
        print(f"Warning: Failed to auto-generate themes/personas: {e}")
        # Log more details for debugging
        import traceback
        traceback.print_exc()

    return feedback


@router.get("/")
async def list_feedback(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    category: Optional[FeedbackCategory] = None,
    theme_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),  # Default 100 items per page
):
    """List feedback with optional filters"""
    # Base query for counting
    count_query = select(Feedback).where(Feedback.tenant_id == tenant_id)

    if category:
        count_query = count_query.where(Feedback.category == category)
    if theme_id:
        count_query = count_query.where(Feedback.theme_id == theme_id)

    # Get total count
    from sqlalchemy import func
    total_result = await db.execute(
        select(func.count()).select_from(count_query.subquery())
    )
    total = total_result.scalar()

    # Get paginated items
    query = count_query.offset(skip).limit(limit).order_by(Feedback.created_at.desc())
    result = await db.execute(query)
    feedback_items = result.scalars().all()

    return {
        "items": [FeedbackResponse.model_validate(item) for item in feedback_items],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{feedback_id}", response_model=FeedbackResponse)
async def get_feedback(
    feedback_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Get a specific feedback item"""
    result = await db.execute(
        select(Feedback).where(
            and_(Feedback.id == feedback_id, Feedback.tenant_id == tenant_id)
        )
    )
    feedback = result.scalar_one_or_none()

    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    return feedback


@router.patch("/{feedback_id}", response_model=FeedbackResponse)
async def update_feedback(
    feedback_id: int,
    feedback_update: FeedbackUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Update a feedback item"""
    result = await db.execute(
        select(Feedback).where(
            and_(Feedback.id == feedback_id, Feedback.tenant_id == tenant_id)
        )
    )
    feedback = result.scalar_one_or_none()

    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    # Update fields
    for field, value in feedback_update.model_dump(exclude_unset=True).items():
        setattr(feedback, field, value)

    await db.commit()
    await db.refresh(feedback)
    return feedback


@router.post("/upload-csv")
async def upload_feedback_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Upload feedback from CSV file
    Expected columns: title, content, account_name, segment, category
    Optional columns: customer_name, customer_email, source, date
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    try:
        # Read file content
        contents = await file.read()
        csv_content = contents.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(csv_content))

        feedback_items = []
        errors = []

        for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 (1 is header)
            try:
                # Map CSV columns to feedback fields
                # Required fields
                title = row.get('title', '').strip()
                content = row.get('content', '').strip()

                if not content:
                    errors.append(f"Row {row_num}: Missing required field 'content'")
                    continue

                # Optional fields
                account_name = row.get('account_name', '') or row.get('customer', '') or row.get('company_name', '')
                segment = row.get('segment', '') or row.get('customer_segment', '')

                # Auto-map company_size to segment if segment is not provided
                if not segment and row.get('company_size'):
                    try:
                        company_size = int(row.get('company_size', 0))
                        if company_size <= 50:
                            segment = 'SMB'
                        elif company_size <= 500:
                            segment = 'Mid-Market'
                        else:
                            segment = 'Enterprise'
                    except (ValueError, TypeError):
                        pass

                category_str = row.get('category', '').lower().strip()

                # Map category string to enum
                category = None
                if category_str:
                    category_mapping = {
                        'feature request': FeedbackCategory.FEATURE_REQUEST,
                        'feature_request': FeedbackCategory.FEATURE_REQUEST,
                        'bug': FeedbackCategory.BUG,
                        'tech debt': FeedbackCategory.TECH_DEBT,
                        'tech_debt': FeedbackCategory.TECH_DEBT,
                        'improvement': FeedbackCategory.IMPROVEMENT,
                        'question': FeedbackCategory.QUESTION,
                        'praise': FeedbackCategory.PRAISE,
                        'complaint': FeedbackCategory.COMPLAINT,
                    }
                    category = category_mapping.get(category_str)

                # Store demographics/technographics in extra_data
                extra_data = {
                    'industry': row.get('industry', ''),
                    'company_size': row.get('company_size', ''),
                    'region': row.get('region', ''),
                    'job_role': row.get('job_role', ''),
                    'subscription_plan': row.get('subscription_plan', ''),
                    'mrr': row.get('mrr', ''),
                }
                # Clean empty values
                extra_data = {k: v for k, v in extra_data.items() if v}

                # Create feedback item
                feedback = Feedback(
                    tenant_id=tenant_id,
                    source=FeedbackSource.MANUAL_UPLOAD,
                    content=content,
                    title=title or None,
                    customer_name=account_name or None,
                    customer_segment=segment or None,
                    category=category,
                    extra_data=extra_data if extra_data else None,
                )

                feedback_items.append(feedback)

            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
                continue

        # Bulk insert
        if feedback_items:
            db.add_all(feedback_items)
            await db.commit()

            # Auto-generate themes and personas from the new feedback
            themes_generated = False
            personas_generated = False
            generation_warnings = []

            try:
                from app.api.v1.endpoints.themes import auto_generate_themes
                await auto_generate_themes(tenant_id, db)
                themes_generated = True
            except Exception as e:
                generation_warnings.append(f"Theme generation failed: {str(e)}")
                print(f"Warning: Failed to auto-generate themes: {e}")

            try:
                from app.api.v1.endpoints.personas import auto_generate_personas
                await auto_generate_personas(tenant_id, db)
                personas_generated = True
            except Exception as e:
                generation_warnings.append(f"Persona generation failed: {str(e)}")
                print(f"Warning: Failed to auto-generate personas: {e}")

        result = {
            "success": True,
            "message": f"Successfully imported {len(feedback_items)} feedback items",
            "total_rows": row_num - 1,  # Exclude header
            "imported": len(feedback_items),
            "errors": errors if errors else None,
            "themes_generated": themes_generated,
            "personas_generated": personas_generated,
        }

        if generation_warnings:
            result["generation_warnings"] = generation_warnings

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing CSV: {str(e)}")


@router.post("/upload-csv-async")
async def upload_feedback_csv_async(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Upload feedback from CSV file asynchronously - returns immediately with job_id

    This endpoint starts a background job for CSV processing and returns
    immediately. Use GET /api/v1/jobs/{job_id} to check status.

    Expected columns: title, content, account_name, segment, category
    Optional columns: customer_name, customer_email, source, date
    """
    import logging
    from app.models.job import JobType
    from app.services.background_task_service import BackgroundTaskService
    from app.core.config import settings

    logger = logging.getLogger(__name__)

    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    try:
        # Read file content
        contents = await file.read()
        csv_content = contents.decode('utf-8')

        # Create background job
        job = await BackgroundTaskService.create_job(
            tenant_id=tenant_id,
            user_id=None,
            job_type=JobType.FEEDBACK_CSV_UPLOAD,
            input_params={"filename": file.filename},
            db=db
        )

        logger.info(f"[Feedback API] Created async CSV upload job {job.job_uuid} for tenant {tenant_id}")

        # Choose task queue based on configuration
        if settings.USE_CELERY:
            # Production: Use Celery (durable, survives restarts)
            from app.workers.feedback_tasks import upload_feedback_csv_task
            upload_feedback_csv_task.delay(str(job.job_uuid), tenant_id, csv_content)
            logger.info(f"[Feedback API] Dispatched to Celery: {job.job_uuid}")
        else:
            # Development: Use asyncio (non-durable, simpler)
            from app.workers.feedback_worker import upload_feedback_csv_background
            BackgroundTaskService.run_in_background(
                upload_feedback_csv_background(str(job.job_uuid), tenant_id, csv_content)
            )
            logger.info(f"[Feedback API] Running with asyncio (dev mode): {job.job_uuid}")

        return {
            "success": True,
            "job_id": str(job.job_uuid),
            "message": "CSV upload started in background. Use GET /api/v1/jobs/{job_id} to check status.",
        }

    except Exception as e:
        logger.error(f"[Feedback API] Failed to start async CSV upload: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start CSV upload: {str(e)}"
        )


@router.post("/parse-document")
async def parse_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Parse unstructured document and extract multiple feedback items using AI.

    Supports: .txt, .doc, .docx, .pdf files
    Uses LLM to intelligently detect and separate individual feedback items.
    """
    import logging
    from app.services.llm_service import get_llm_service
    from app.schemas.feedback_bulk import ExtractedFeedbackItem, FeedbackExtractionResponse

    logger = logging.getLogger(__name__)

    # Validate file type
    allowed_extensions = ['.txt', '.doc', '.docx', '.pdf']
    file_ext = '.' + file.filename.split('.')[-1].lower() if '.' in file.filename else ''

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"File type not supported. Please upload: {', '.join(allowed_extensions)}"
        )

    try:
        # Read file content
        contents = await file.read()

        # Extract text based on file type
        if file_ext == '.txt':
            text_content = contents.decode('utf-8', errors='ignore')
        elif file_ext in ['.doc', '.docx']:
            # For .docx files
            try:
                import docx
                from io import BytesIO
                doc = docx.Document(BytesIO(contents))
                text_content = '\n\n'.join([paragraph.text for paragraph in doc.paragraphs if paragraph.text.strip()])
            except Exception as e:
                logger.warning(f"Failed to parse .docx file, treating as plain text: {e}")
                text_content = contents.decode('utf-8', errors='ignore')
        elif file_ext == '.pdf':
            # For PDF files
            try:
                import PyPDF2
                from io import BytesIO
                pdf_reader = PyPDF2.PdfReader(BytesIO(contents))
                text_content = '\n\n'.join([page.extract_text() for page in pdf_reader.pages if page.extract_text()])
            except Exception as e:
                logger.warning(f"Failed to parse PDF file: {e}")
                raise HTTPException(status_code=400, detail="Failed to extract text from PDF. Please ensure it's a text-based PDF.")

        if not text_content or len(text_content.strip()) < 10:
            raise HTTPException(status_code=400, detail="Document appears to be empty or too short")

        # Use LLM to parse and extract feedback items
        logger.info(f"[Feedback API] Parsing document with {len(text_content)} characters")

        llm = get_llm_service()

        prompt = f"""Analyze this document and extract individual customer feedback items.

Document content:
{text_content[:4000]}

Extract each distinct feedback item. Look for:
- Different customers or accounts mentioned
- Separate issues, feature requests, or complaints
- Different topics or themes
- Temporal markers (dates, "yesterday", "last week")

For each feedback item, extract:
- title: Brief summary (5-10 words)
- content: Full feedback text
- customer_name: Customer/account name if mentioned (null if not found)
- customer_segment: Guess segment based on context (Enterprise/Mid-Market/SMB, null if unclear)
- category: feature_request, bug, improvement, complaint, praise, or question (null if unclear)
- confidence: Your confidence in this extraction (0.0-1.0)

Respond with a JSON array of feedback items.
If the document contains only one feedback item, return an array with one item.
Maximum 20 items."""

        # Define response wrapper for instructor
        class FeedbackList(BaseModel):
            items: List[ExtractedFeedbackItem]

        # Use structured generation
        response = await llm.generate_structured(
            prompt=prompt,
            response_model=FeedbackList,
            system_prompt="You are an expert at parsing customer feedback documents and extracting structured data.",
        )

        feedback_items = response.items if hasattr(response, 'items') else []

        logger.info(f"[Feedback API] Extracted {len(feedback_items)} feedback items from document")

        return FeedbackExtractionResponse(
            success=True,
            message=f"Successfully extracted {len(feedback_items)} feedback items from document",
            items_extracted=len(feedback_items),
            feedback_items=feedback_items,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Feedback API] Document parsing failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse document: {str(e)}"
        )
