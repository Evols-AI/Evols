"""
Persona Endpoints
Digital twin persona management and simulation
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.core.dependencies import get_current_tenant_id, get_tenant_llm_config
from app.models.persona import Persona
from app.models.feedback import Feedback
from app.models.context import ContextSource, ExtractedEntity, ContextProcessingStatus, EntityType
from app.schemas.persona import (
    PersonaCreate,
    PersonaUpdate,
    PersonaResponse,
    PersonaGenerateRequest,
    PersonaSimulateRequest,
    PersonaSimulateResponse,
    PersonaVoteRequest,
    PersonaVoteResponse,
    PersonaStatusUpdate,
    PersonaMergeRequest,
)

router = APIRouter()


@router.post("/", response_model=PersonaResponse, status_code=201)
async def create_persona(
    persona_data: PersonaCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Create a persona manually"""
    persona_dict = persona_data.model_dump()

    # If promoted from extracted entity, set feedback count based on source
    if persona_dict.get('extra_data', {}).get('promoted_from_entity_id'):
        entity_id = persona_dict['extra_data']['promoted_from_entity_id']

        # Query the extracted entity to get its source
        from app.models import ExtractedEntity
        entity_result = await db.execute(
            select(ExtractedEntity).where(ExtractedEntity.id == entity_id)
        )
        entity = entity_result.scalar_one_or_none()

        # Set feedback count to 1 (the source document) if not already set
        if entity and persona_dict.get('based_on_feedback_count', 0) == 0:
            persona_dict['based_on_feedback_count'] = 1

    persona = Persona(
        **persona_dict,
        tenant_id=tenant_id,
    )
    db.add(persona)
    await db.commit()
    await db.refresh(persona)
    return persona


@router.get("/", response_model=List[PersonaResponse])
async def list_personas(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    product_ids: str = Query(None, description="Comma-separated product IDs to filter by"),
    status_filter: str = Query(None, description="Comma-separated: new,active,inactive"),
    segment: str = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    """List personas with optional status filtering"""
    query = select(Persona).where(Persona.tenant_id == tenant_id)

    # Filter by product_ids if provided
    if product_ids:
        ids = [int(id.strip()) for id in product_ids.split(',') if id.strip()]
        if ids:
            query = query.where(Persona.product_id.in_(ids))

    # Filter by status
    if status_filter:
        statuses = [s.strip() for s in status_filter.split(',')]
        query = query.where(Persona.status.in_(statuses))

    if segment:
        query = query.where(Persona.segment == segment)

    query = query.offset(skip).limit(limit).order_by(Persona.updated_at.desc())

    result = await db.execute(query)
    personas = result.scalars().all()
    return personas


@router.get("/segments/list", response_model=List[str])
async def list_segments(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Get unique segments from personas"""
    result = await db.execute(
        select(Persona.segment)
        .where(Persona.tenant_id == tenant_id)
        .where(Persona.segment.isnot(None))
        .distinct()
    )
    segments = [seg for seg in result.scalars().all() if seg]
    return sorted(segments)


@router.get("/{persona_id}", response_model=PersonaResponse)
async def get_persona(
    persona_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Get a specific persona"""
    result = await db.execute(
        select(Persona).where(
            and_(Persona.id == persona_id, Persona.tenant_id == tenant_id)
        )
    )
    persona = result.scalar_one_or_none()

    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    return persona


async def auto_generate_personas(tenant_id: int, db: AsyncSession, last_refresh_timestamp=None):
    """
    Automatically generate/update personas from feedback data
    Creates personas based on demographics and technographics (segment + industry/role)
    Includes duplicate detection using semantic similarity (85% threshold)

    Args:
        tenant_id: The tenant ID
        db: Database session
        last_refresh_timestamp: Optional datetime - if provided, only process feedback created after this time

    Returns:
        dict with 'status' and 'message' keys
    """
    from sqlalchemy import func
    from collections import Counter
    from app.services.persona_deduplication import PersonaDeduplicationService
    import logging
    from datetime import datetime

    logger = logging.getLogger(__name__)

    # Build queries for both legacy feedback and new context sources
    feedback_query = select(Feedback).where(Feedback.tenant_id == tenant_id)
    feedback_count_query = select(func.count(Feedback.id)).where(Feedback.tenant_id == tenant_id)

    context_query = select(ContextSource).where(
        ContextSource.tenant_id == tenant_id,
        ContextSource.status == ContextProcessingStatus.COMPLETED
    )
    context_count_query = select(func.count(ContextSource.id)).where(
        ContextSource.tenant_id == tenant_id,
        ContextSource.status == ContextProcessingStatus.COMPLETED
    )

    # If incremental refresh, only get data created after last refresh
    if last_refresh_timestamp:
        feedback_query = feedback_query.where(Feedback.created_at > last_refresh_timestamp)
        feedback_count_query = feedback_count_query.where(Feedback.created_at > last_refresh_timestamp)
        context_query = context_query.where(ContextSource.created_at > last_refresh_timestamp)
        context_count_query = context_count_query.where(ContextSource.created_at > last_refresh_timestamp)
        logger.info(f"[Persona Generation] Incremental refresh: processing data after {last_refresh_timestamp}")

    # First check if there's any data to process
    feedback_result = await db.execute(feedback_count_query)
    feedback_count = feedback_result.scalar()

    context_result = await db.execute(context_count_query)
    context_count = context_result.scalar()

    total_count = feedback_count + context_count

    if total_count == 0:
        if last_refresh_timestamp:
            logger.info(f"[Persona Generation] No new data since last refresh for tenant {tenant_id}")
            return {"status": "up_to_date", "message": "No new data to process", "personas_created": 0, "personas_failed": 0}
        else:
            logger.warning(f"[Persona Generation] No data found for tenant {tenant_id}")
            return {"status": "no_data", "message": "No data available", "personas_created": 0, "personas_failed": 0}

    # Check how many have segments
    segmented_feedback_count_query = feedback_count_query.where(
        Feedback.customer_segment.isnot(None)
    ).where(
        Feedback.customer_segment != ''
    )
    segmented_context_count_query = context_count_query.where(
        ContextSource.customer_segment.isnot(None)
    ).where(
        ContextSource.customer_segment != ''
    )

    segmented_feedback_result = await db.execute(segmented_feedback_count_query)
    segmented_feedback_count = segmented_feedback_result.scalar()

    segmented_context_result = await db.execute(segmented_context_count_query)
    segmented_context_count = segmented_context_result.scalar()

    segmented_count = segmented_feedback_count + segmented_context_count

    logger.info(f"[Persona Generation] Tenant {tenant_id}: {segmented_count}/{total_count} items have segments")

    if segmented_count == 0:
        logger.warning(f"[Persona Generation] No data with customer_segment field populated. Personas require segment data.")
        if last_refresh_timestamp:
            return {"status": "up_to_date", "message": "No new data with segments", "personas_created": 0, "personas_failed": 0}
        return {"status": "no_data", "message": "No data with segments available", "personas_created": 0, "personas_failed": 0}

    # Get all feedback with demographics (use filtered query)
    segmented_feedback_query = feedback_query.where(
        Feedback.customer_segment.isnot(None)
    ).where(
        Feedback.customer_segment != ''
    )
    result = await db.execute(segmented_feedback_query)
    all_feedback = result.scalars().all()

    # Group feedback by segment and top industry/job_role
    persona_groups = {}

    for feedback in all_feedback:
        segment = feedback.customer_segment
        extra_data = feedback.extra_data or {}

        industry = extra_data.get('industry', '').strip()
        job_role = extra_data.get('job_role', '').strip()

        # Create persona key: segment_industry or segment_jobrole
        # Prioritize industry, fall back to job role category
        if industry:
            key = f"{segment}_{industry}"
            persona_type = industry
        elif job_role:
            # Categorize job roles
            role_category = _categorize_job_role(job_role)
            key = f"{segment}_{role_category}"
            persona_type = role_category
        else:
            # Fall back to segment only
            key = segment
            persona_type = None

        if key not in persona_groups:
            persona_groups[key] = {
                'segment': segment,
                'type': persona_type,
                'feedback': [],
                'customers': set()
            }

        persona_groups[key]['feedback'].append(feedback)
        if feedback.customer_name:
            persona_groups[key]['customers'].add(feedback.customer_name)

    logger.info(f"[Persona Generation] Found {len(persona_groups)} unique persona groups")

    # Initialize deduplication service for semantic similarity checking
    dedup_service = PersonaDeduplicationService(db, tenant_config=None)

    # Track personas created in this run to avoid creating duplicates within the same batch
    created_in_this_run = []
    personas_updated = 0
    personas_failed = 0

    # Create or update personas
    for key, group in persona_groups.items():
        try:
            segment = group['segment']
            persona_type = group['type']
            feedback_count = len(group['feedback'])
            customer_count = len(group['customers'])

            # Skip if too few feedbacks (noise)
            if feedback_count < 3:
                continue

            # Generate persona name and description
            if persona_type:
                persona_name = f"{segment} {persona_type}"
                description = f"{persona_type} professionals at {segment} companies"
            else:
                persona_name = f"{segment} Customer"
                description = f"Customers at {segment} companies"

            # Aggregate demographics and product metrics from feedback
            industries = Counter()
            job_roles = Counter()
            regions = Counter()
            plans = Counter()
            revenue_values = []
            usage_patterns = []

            for fb in group['feedback']:
                extra = fb.extra_data or {}
                if extra.get('industry'):
                    industries[extra['industry']] += 1
                if extra.get('job_role'):
                    job_roles[extra['job_role']] += 1
                if extra.get('region'):
                    regions[extra['region']] += 1
                if extra.get('subscription_plan'):
                    plans[extra['subscription_plan']] += 1

                # Extract revenue/ARR data for revenue contribution calculation
                # Safely convert to float in case it's stored as string
                arr_value = extra.get('arr')
                if arr_value is not None:
                    try:
                        revenue_values.append(float(arr_value))
                    except (ValueError, TypeError):
                        pass  # Skip invalid values
                else:
                    # Try alternate fields
                    revenue_value = extra.get('revenue') or extra.get('account_value')
                    if revenue_value is not None:
                        try:
                            revenue_values.append(float(revenue_value))
                        except (ValueError, TypeError):
                            pass

                # Extract usage frequency data
                usage_freq = extra.get('usage_frequency')
                if usage_freq and isinstance(usage_freq, str) and usage_freq in ['Daily', 'Weekly', 'Monthly']:
                    usage_patterns.append(usage_freq)
                elif extra.get('login_frequency'):
                    usage_patterns.append(extra['login_frequency'])
                elif extra.get('daily_active'):
                    usage_patterns.append('Daily')
                elif extra.get('weekly_active'):
                    usage_patterns.append('Weekly')

            # Calculate revenue contribution (average ARR per customer)
            revenue_contribution = None
            if revenue_values:
                avg_revenue = sum(revenue_values) / len(revenue_values)
                revenue_contribution = round(avg_revenue, 2)

            # Calculate usage frequency (most common pattern)
            usage_frequency = None
            if usage_patterns:
                usage_counter = Counter(usage_patterns)
                usage_frequency = usage_counter.most_common(1)[0][0]

            # Create rich persona summary
            summary_parts = [f"Based on {feedback_count} feedback items from {customer_count} customers."]
            if industries:
                top_industries = [ind for ind, _ in industries.most_common(3)]
                summary_parts.append(f"Primary industries: {', '.join(top_industries)}.")
            if job_roles:
                top_roles = [role for role, _ in job_roles.most_common(3)]
                summary_parts.append(f"Common roles: {', '.join(top_roles)}.")
            if regions:
                top_regions = [reg for reg, _ in regions.most_common(2)]
                summary_parts.append(f"Regions: {', '.join(top_regions)}.")

            persona_summary = " ".join(summary_parts)

            # First, check against personas created in this run (exact name + segment match)
            duplicate_in_batch = any(
                p['name'].lower() == persona_name.lower() and p['segment'].lower() == segment.lower()
                for p in created_in_this_run
            )

            if duplicate_in_batch:
                logger.debug(f"[Persona Generation] Skipping '{persona_name}' - duplicate within this batch")
                continue

            # Check for semantic duplicates using embedding similarity (70% threshold)
            candidate = {
                'name': persona_name,
                'description': description,
                'segment': segment,
                'persona_summary': persona_summary
            }

            duplicates = await dedup_service.find_duplicates(candidate, tenant_id)

            if duplicates:
                # Found similar existing persona - UPDATE it with new feedback data
                existing_persona, similarity = duplicates[0]
                logger.debug(
                    f"[Persona Generation] Updating '{existing_persona.name}' with new feedback "
                    f"(matched '{persona_name}' at {similarity:.2%} similarity)"
                )

                # Update existing persona with new feedback data
                old_feedback_count = existing_persona.based_on_feedback_count or 0
                new_total_feedback = old_feedback_count + feedback_count

                # Update feedback count
                existing_persona.based_on_feedback_count = new_total_feedback

                # Recalculate confidence score with more data
                existing_persona.confidence_score = min(0.5 + (new_total_feedback / 50), 0.95)

                # Append to persona summary with new data info
                new_summary_addition = f" Updated with {feedback_count} new feedback items."
                if existing_persona.persona_summary:
                    existing_persona.persona_summary = existing_persona.persona_summary + new_summary_addition
                else:
                    existing_persona.persona_summary = persona_summary

                # Update extra_data with new revenue and usage metrics
                existing_extra = existing_persona.extra_data or {}
                if revenue_contribution is not None:
                    # Average with existing revenue if available
                    old_revenue = existing_extra.get('revenue_contribution')
                    if old_revenue:
                        # Weight by feedback counts
                        existing_extra['revenue_contribution'] = round(
                            (old_revenue * old_feedback_count + revenue_contribution * feedback_count) / new_total_feedback,
                            2
                        )
                    else:
                        existing_extra['revenue_contribution'] = revenue_contribution

                if usage_frequency is not None:
                    # Keep the new usage frequency (most recent pattern)
                    existing_extra['usage_frequency'] = usage_frequency

                existing_persona.extra_data = existing_extra

                # Update timestamp will happen automatically via BaseModel
                logger.debug(f"[Persona Generation] Updated persona '{existing_persona.name}': {old_feedback_count} -> {new_total_feedback} feedback items")
                personas_updated += 1

                continue

            # Check if this is the first batch of personas for this tenant
            existing_personas_result = await db.execute(
                select(func.count(Persona.id)).where(Persona.tenant_id == tenant_id)
            )
            existing_count = existing_personas_result.scalar() or 0

            # First batch: 'active', subsequent batches: 'new' (inactive until reviewed)
            initial_status = 'active' if existing_count == 0 else 'new'

            # Create new persona with appropriate status
            persona = Persona(
                tenant_id=tenant_id,
                name=persona_name,
                segment=segment,
                industry=industries.most_common(1)[0][0] if industries else None,
                description=description,
                persona_summary=persona_summary,
                based_on_feedback_count=feedback_count,
                confidence_score=min(0.5 + (feedback_count / 50), 0.95),
                key_pain_points=[],
                feature_priorities=[],
                status=initial_status,  # First batch: 'active', subsequent: 'new'
                extra_data={
                    'revenue_contribution': revenue_contribution,
                    'usage_frequency': usage_frequency,
                }
            )
            db.add(persona)

            # Track this persona to avoid creating duplicates within the same batch
            created_in_this_run.append({
                'name': persona_name,
                'segment': segment
            })

            logger.debug(f"[Persona Generation] Created new persona: '{persona_name}'")

        except Exception as e:
            logger.error(f"[Persona Generation] Failed to create persona for group '{key}': {e}", exc_info=True)
            personas_failed += 1
            continue

    await db.commit()

    personas_created = len(created_in_this_run)
    logger.info(
        f"[Persona Generation] Completed: {personas_created} created, {personas_updated} updated, "
        f"{personas_failed} failed out of {len(persona_groups)} groups"
    )

    return {
        "status": "success",
        "message": f"Generated {personas_created} new personas from {segmented_count} feedback items",
        "personas_created": personas_created,
        "personas_updated": personas_updated,
        "personas_failed": personas_failed,
        "feedback_processed": segmented_count,
        "groups_processed": len(persona_groups)
    }


def _categorize_job_role(job_role: str) -> str:
    """Categorize job roles into broader groups"""
    role_lower = job_role.lower()

    if any(x in role_lower for x in ['cto', 'cio', 'vp', 'director', 'head', 'chief']):
        return 'Leadership'
    elif any(x in role_lower for x in ['engineer', 'developer', 'architect', 'technical']):
        return 'Engineering'
    elif any(x in role_lower for x in ['manager', 'lead', 'coordinator']):
        return 'Management'
    elif any(x in role_lower for x in ['operations', 'ops', 'admin']):
        return 'Operations'
    elif any(x in role_lower for x in ['founder', 'owner', 'ceo']):
        return 'Executive'
    else:
        return 'Professional'


@router.post("/generate")
async def generate_personas(
    request: PersonaGenerateRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Auto-generate personas from customer data (incremental refresh supported)
    Clusters customers by segment and synthesizes persona profiles.
    Only processes new feedback since last refresh to optimize performance.
    """
    try:
        from datetime import datetime
        from app.models.tenant import Tenant
        from sqlalchemy.orm import attributes

        # Get tenant settings to check last refresh timestamp
        result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()

        last_refresh_timestamp = None
        if tenant and tenant.settings:
            last_refresh_str = tenant.settings.get('persona_last_refresh_date')
            if last_refresh_str:
                try:
                    # Parse ISO format timestamp
                    last_refresh_timestamp = datetime.fromisoformat(last_refresh_str.replace('Z', '+00:00'))
                    print(f"[Persona Endpoint] Using incremental refresh from {last_refresh_timestamp}")
                except Exception as e:
                    print(f"[Persona Endpoint] Could not parse last refresh timestamp: {e}")

        # Generate personas with incremental refresh
        generation_result = await auto_generate_personas(tenant_id, db, last_refresh_timestamp)

        # Check if there was new data to process
        if generation_result.get("status") == "up_to_date":
            return {
                "success": True,
                "status": "up_to_date",
                "message": "Personas are already up to date. No new feedback to process.",
            }

        if generation_result.get("status") == "no_data":
            return {
                "success": False,
                "status": "no_data",
                "message": generation_result.get("message", "No feedback data available"),
            }

        # Update last refresh timestamp in tenant settings
        if tenant:
            settings = tenant.settings or {}
            settings['persona_last_refresh_date'] = datetime.utcnow().isoformat() + 'Z'
            tenant.settings = settings
            attributes.flag_modified(tenant, 'settings')
            await db.commit()

        return {
            "success": True,
            "status": "generated",
            "message": generation_result.get("message", "Personas generated successfully"),
            "personas_created": generation_result.get("personas_created", 0),
            "feedback_processed": generation_result.get("feedback_processed", 0),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Persona generation failed: {str(e)}")


@router.post("/refresh")
async def refresh_personas(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Refresh personas by deleting 'new' ones and regenerating from latest feedback.
    Active and Inactive personas are protected and never touched.
    """
    try:
        from app.services.persona_refresh_service import PersonaRefreshService
        from datetime import datetime
        from app.models.tenant import Tenant
        from sqlalchemy.orm import attributes

        # Use the PersonaRefreshService to properly refresh
        refresh_service = PersonaRefreshService(db)
        await refresh_service.refresh_new_personas(tenant_id)

        # Update last refresh timestamp in tenant settings
        result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()

        if tenant:
            settings = tenant.settings or {}
            settings['persona_last_refresh_date'] = datetime.utcnow().isoformat() + 'Z'
            tenant.settings = settings
            attributes.flag_modified(tenant, 'settings')
            await db.commit()

        return {
            "success": True,
            "message": "Personas refreshed successfully. New personas regenerated, Active/Inactive personas protected.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Persona refresh failed: {str(e)}")


@router.post("/refresh-async")
async def refresh_personas_async(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Refresh personas asynchronously - returns immediately with job_id

    This endpoint starts a background job for persona refresh and returns
    immediately. Use GET /api/v1/jobs/{job_id} to check status.

    Suitable for large datasets that may take time to process.
    """
    import logging
    from app.models.job import JobType
    from app.services.background_task_service import BackgroundTaskService
    from app.core.config import settings

    logger = logging.getLogger(__name__)

    try:
        # Create background job
        job = await BackgroundTaskService.create_job(
            tenant_id=tenant_id,
            user_id=None,
            job_type=JobType.PERSONA_GENERATION,
            input_params={},
            db=db
        )

        logger.info(f"[Personas API] Created async refresh job {job.job_uuid} for tenant {tenant_id}")

        # Choose task queue based on configuration
        if settings.USE_CELERY:
            # Production: Use Celery (durable, survives restarts)
            from app.workers.persona_tasks import refresh_personas_task
            refresh_personas_task.delay(str(job.job_uuid), tenant_id)
            logger.info(f"[Personas API] Dispatched to Celery: {job.job_uuid}")
        else:
            # Development: Use asyncio (non-durable, simpler)
            from app.workers.persona_worker import refresh_personas_background
            BackgroundTaskService.run_in_background(
                refresh_personas_background(str(job.job_uuid), tenant_id)
            )
            logger.info(f"[Personas API] Running with asyncio (dev mode): {job.job_uuid}")

        return {
            "success": True,
            "job_id": str(job.job_uuid),
            "message": "Persona refresh started in background. Use GET /api/v1/jobs/{job_id} to check status.",
        }

    except Exception as e:
        logger.error(f"[Personas API] Failed to start async refresh: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start persona refresh: {str(e)}"
        )


@router.post("/simulate", response_model=PersonaSimulateResponse)
async def simulate_persona_response(
    request: PersonaSimulateRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    tenant_config = Depends(get_tenant_llm_config),
):
    """
    Simulate a persona's response to a question
    Uses LLM with persona context and historical data (Digital Twin)
    """
    from app.services.persona_twin import PersonaTwinService
    import logging
    import os

    logger = logging.getLogger(__name__)

    # Check if LLM configuration is available
    if not tenant_config:
        logger.error("No LLM configuration available for persona simulation")
        raise HTTPException(
            status_code=400,
            detail="LLM configuration required. Please configure your API keys in Settings > LLM Settings before using persona simulation."
        )

    # Get persona
    result = await db.execute(
        select(Persona).where(
            and_(
                Persona.id == request.persona_id,
                Persona.tenant_id == tenant_id
            )
        )
    )
    persona = result.scalar_one_or_none()

    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    # Create persona twin service with tenant config
    persona_twin_service = PersonaTwinService(tenant_config=tenant_config)

    # Use digital twin service to generate response
    response = await persona_twin_service.ask_persona(
        persona=persona,
        question=request.question,
        db=db,
    )

    return PersonaSimulateResponse(**response)


@router.post("/vote", response_model=PersonaVoteResponse)
async def personas_vote(
    request: PersonaVoteRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    tenant_config = Depends(get_tenant_llm_config),
):
    """
    Have multiple personas vote on decision options (Digital Twin Voting)
    Returns votes with reasoning and confidence scores
    """
    from app.services.persona_twin import PersonaTwinService
    from collections import Counter
    import logging

    logger = logging.getLogger(__name__)
    logger.info(f"=== VOTING ENDPOINT CALLED ===")
    logger.info(f"Tenant ID: {tenant_id}")
    logger.info(f"Question: {request.question}")
    logger.info(f"Options: {request.options}")
    logger.info(f"Requested persona IDs: {request.persona_ids}")
    logger.info(f"Tenant LLM Config: {'Configured' if tenant_config else 'Using environment defaults'}")

    # Check if LLM configuration is available
    if not tenant_config:
        logger.error("No LLM configuration available: tenant config is None")
        raise HTTPException(
            status_code=400,
            detail="LLM configuration required. Please configure your API keys in Settings > LLM Settings before using persona voting."
        )

    # Get personas to vote (all personas if not specified)
    if request.persona_ids:
        query = select(Persona).where(
            and_(
                Persona.tenant_id == tenant_id,
                Persona.id.in_(request.persona_ids)
            )
        )
    else:
        query = select(Persona).where(Persona.tenant_id == tenant_id)

    result = await db.execute(query)
    personas = result.scalars().all()

    logger.info(f"Found {len(personas)} personas to vote")
    for p in personas[:5]:  # Log first 5
        logger.info(f"  - {p.name} (ID: {p.id}, Segment: {p.segment})")

    if not personas:
        raise HTTPException(status_code=404, detail="No personas found")

    # Create persona twin service with tenant config
    persona_twin_service = PersonaTwinService(tenant_config=tenant_config)

    # Parallelize voting: run all persona votes concurrently
    async def vote_for_persona(persona, index):
        """Helper to get vote result for a single persona"""
        logger.info(f"Calling vote_on_options for persona {index+1}/{len(personas)}: {persona.name}")
        try:
            vote = await persona_twin_service.vote_on_options(
                persona=persona,
                question=request.question,
                options=request.options,
                db=db,
            )
            logger.info(f"Vote result for {persona.name}: choice={vote.get('choice')}")
            return vote
        except Exception as e:
            logger.warning(f"Persona voting failed for {persona.name}: {e}")
            return None

    # Execute all votes in parallel using asyncio.gather()
    import asyncio
    vote_results = await asyncio.gather(*[vote_for_persona(p, i) for i, p in enumerate(personas)])

    # Filter out None results (failed votes)
    votes = [v for v in vote_results if v is not None]

    # Aggregate results
    choice_counts = Counter()
    total_confidence = 0.0

    logger.info(f"=== AGGREGATING VOTES ===")
    for vote in votes:
        logger.info(f"Vote: {vote.get('persona_name')} -> choice={vote.get('choice')}, confidence={vote.get('confidence')}")
        if vote.get('choice'):
            choice_counts[vote['choice']] += 1
            total_confidence += vote.get('confidence', 0.0)

    logger.info(f"Choice counts: {dict(choice_counts)}")
    logger.info(f"Total votes with valid choice: {sum(choice_counts.values())}/{len(votes)}")

    # Determine recommendation (just the option ID as a string)
    recommendation = None
    if choice_counts:
        most_popular = choice_counts.most_common(1)[0]
        recommendation = most_popular[0]  # Just the option ID (e.g., "A", "B")
        vote_count = most_popular[1]
        percentage = (vote_count / len(personas)) * 100

    # Generate summary
    summary = f"{len(personas)} personas voted. "
    if recommendation:
        vote_count = choice_counts[recommendation]
        percentage = (vote_count / len(personas)) * 100
        summary += f"Majority ({vote_count}/{len(personas)}, {percentage:.1f}%) chose Option {recommendation}."
    else:
        summary += "No clear consensus reached."

    logger.info(f"=== VOTING COMPLETE: {summary} ===")

    return PersonaVoteResponse(
        question=request.question,
        votes=votes,
        summary=summary,
        recommendation=recommendation,
    )


@router.patch("/{persona_id}", response_model=PersonaResponse)
async def update_persona(
    persona_id: int,
    persona_update: PersonaUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Update a persona"""
    result = await db.execute(
        select(Persona).where(
            and_(Persona.id == persona_id, Persona.tenant_id == tenant_id)
        )
    )
    persona = result.scalar_one_or_none()

    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    # Update fields
    for field, value in persona_update.model_dump(exclude_unset=True).items():
        setattr(persona, field, value)

    # If this was a 'new' persona, mark it as 'active' since user has reviewed/edited it
    if persona.status == 'new':
        persona.status = 'active'

    await db.commit()
    await db.refresh(persona)
    return persona


@router.delete("/{persona_id}")
async def delete_persona(
    persona_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Delete a persona"""
    result = await db.execute(
        select(Persona).where(
            and_(Persona.id == persona_id, Persona.tenant_id == tenant_id)
        )
    )
    persona = result.scalar_one_or_none()

    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    await db.delete(persona)
    await db.commit()

    return {"success": True, "message": f"Persona '{persona.name}' deleted successfully"}


@router.patch("/{persona_id}/status", response_model=PersonaResponse)
async def update_persona_status(
    persona_id: int,
    status_update: PersonaStatusUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Update persona status (can only set to 'active' or 'inactive').
    Status 'new' is auto-assigned and cannot be manually set.
    """
    result = await db.execute(
        select(Persona).where(
            and_(Persona.id == persona_id, Persona.tenant_id == tenant_id)
        )
    )
    persona = result.scalar_one_or_none()

    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    persona.status = status_update.status.value
    await db.commit()
    await db.refresh(persona)

    return persona


@router.post("/merge", response_model=PersonaResponse)
async def merge_personas(
    merge_request: PersonaMergeRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Merge multiple personas into one.

    Strategy:
    - Keep primary persona's name, segment, status
    - Merge pain points and priorities (deduplicate)
    - Expand budget range (min of mins, max of maxs)
    - Average decision time and confidence
    - Sum feedback counts
    - Concatenate descriptions
    - Delete secondary personas
    """
    if merge_request.primary_persona_id not in merge_request.persona_ids:
        raise HTTPException(
            status_code=400,
            detail="primary_persona_id must be in persona_ids list"
        )

    # Fetch all personas
    result = await db.execute(
        select(Persona).where(
            Persona.id.in_(merge_request.persona_ids),
            Persona.tenant_id == tenant_id
        )
    )
    personas = result.scalars().all()

    if len(personas) != len(merge_request.persona_ids):
        raise HTTPException(status_code=404, detail="One or more personas not found")

    # Find primary persona
    primary = next((p for p in personas if p.id == merge_request.primary_persona_id), None)
    if not primary:
        raise HTTPException(status_code=404, detail="Primary persona not found")

    secondaries = [p for p in personas if p.id != merge_request.primary_persona_id]

    # Merge pain points (deduplicate)
    all_pain_points = list(primary.key_pain_points or [])
    for p in secondaries:
        all_pain_points.extend(p.key_pain_points or [])
    primary.key_pain_points = list(set(all_pain_points))

    # Merge priorities (deduplicate)
    all_priorities = list(primary.feature_priorities or [])
    for p in secondaries:
        all_priorities.extend(p.feature_priorities or [])
    primary.feature_priorities = list(set(all_priorities))

    # Merge revenue contribution (weighted average by feedback count)
    revenue_contributions = []
    for p in personas:
        if p.extra_data and p.extra_data.get('revenue_contribution'):
            feedback_weight = p.based_on_feedback_count or 1
            revenue_contributions.append((p.extra_data['revenue_contribution'], feedback_weight))

    if revenue_contributions:
        total_weight = sum(weight for _, weight in revenue_contributions)
        weighted_avg = sum(rev * weight for rev, weight in revenue_contributions) / total_weight
        primary_extra = primary.extra_data or {}
        primary_extra['revenue_contribution'] = round(weighted_avg, 2)
        primary.extra_data = primary_extra

    # Merge usage frequency (keep most common pattern)
    usage_frequencies = []
    for p in personas:
        if p.extra_data and p.extra_data.get('usage_frequency'):
            usage_frequencies.append(p.extra_data['usage_frequency'])

    if usage_frequencies:
        from collections import Counter
        most_common_usage = Counter(usage_frequencies).most_common(1)[0][0]
        primary_extra = primary.extra_data or {}
        primary_extra['usage_frequency'] = most_common_usage
        primary.extra_data = primary_extra

    # Average confidence
    confidences = [p.confidence_score for p in personas if p.confidence_score]
    if confidences:
        primary.confidence_score = sum(confidences) / len(confidences)

    # Sum feedback counts
    primary.based_on_feedback_count = sum(p.based_on_feedback_count or 0 for p in personas)
    primary.based_on_interview_count = sum(p.based_on_interview_count or 0 for p in personas)
    primary.based_on_deal_count = sum(p.based_on_deal_count or 0 for p in personas)

    # Concatenate descriptions
    descriptions = [p.description for p in personas if p.description]
    primary.description = " | ".join(descriptions)

    # Concatenate summaries
    summaries = [p.persona_summary for p in personas if p.persona_summary]
    primary.persona_summary = " | ".join(summaries)

    # Update timestamp to reflect the merge
    from datetime import datetime
    primary.updated_at = datetime.utcnow()

    # If this was a 'new' persona, mark it as 'active' since user has reviewed/merged it
    if primary.status == 'new':
        primary.status = 'active'

    # Delete secondary personas
    for secondary in secondaries:
        await db.delete(secondary)

    await db.commit()
    await db.refresh(primary)

    return primary


@router.get("/{persona_id}/knowledge")
async def get_persona_knowledge(
    persona_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Get persona's knowledge base and insights"""
    from app.services.persona_twin import persona_twin_service

    result = await db.execute(
        select(Persona).where(
            and_(Persona.id == persona_id, Persona.tenant_id == tenant_id)
        )
    )
    persona = result.scalar_one_or_none()

    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    # Get knowledge base
    knowledge = await persona_twin_service.get_persona_knowledge(persona, db, limit=50)

    # Format response
    return {
        "persona_id": persona.id,
        "persona_name": persona.name,
        "segment": persona.segment,
        "industry": persona.industry,
        "feedback_count": knowledge['feedback_count'],
        "categories": knowledge['categories'],
        "top_pain_points": knowledge['top_pain_points'],
        "confidence_score": persona.confidence_score,
        "recent_feedback": [
            {
                "id": fb.id,
                "content": fb.content,
                "category": fb.category.value if fb.category else None,
                "created_at": fb.created_at,
            }
            for fb in knowledge['feedback_items'][:10]
        ],
    }
