"""
Project Endpoints
Project generation, listing, and prioritization
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
import logging

from app.core.database import get_db
from app.core.dependencies import get_current_tenant_id
from app.models.project import Project, ProjectStatus, ProjectEffort
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectGenerateRequest,
    ProjectGenerateResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    initiative_id: Optional[int] = Query(None, description="Filter by initiative ID"),
    status: Optional[ProjectStatus] = Query(None, description="Filter by status"),
    effort: Optional[ProjectEffort] = Query(None, description="Filter by effort level"),
    min_priority: Optional[float] = Query(None, description="Minimum priority score"),
    skip: int = Query(0, ge=0, description="Skip N results"),
    limit: int = Query(100, ge=1, le=1000, description="Limit results"),
):
    """
    List projects with optional filters.
    Results are sorted by priority_score descending (highest priority first).
    """
    query = select(Project).where(Project.tenant_id == tenant_id)

    # Apply filters
    if initiative_id is not None:
        query = query.where(Project.initiative_id == initiative_id)
    if status is not None:
        query = query.where(Project.status == status)
    if effort is not None:
        query = query.where(Project.effort == effort)
    if min_priority is not None:
        query = query.where(Project.priority_score >= min_priority)

    # Sort by priority descending, then by created_at descending
    query = query.order_by(
        Project.priority_score.desc().nulls_last(),
        Project.created_at.desc()
    ).offset(skip).limit(limit)

    result = await db.execute(query)
    projects = result.scalars().all()

    return projects


@router.post("/generate", response_model=ProjectGenerateResponse)
async def generate_projects(
    request: ProjectGenerateRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Auto-generate projects for initiatives using LLM.

    Process:
    1. Generates 3-8 projects per initiative (mix of boulders & pebbles)
    2. Checks against capability graph to avoid duplicates
    3. Matches to persona pain points and priorities
    4. Calculates RICE priority scores

    This is an async operation that may take several seconds per initiative.
    """
    try:
        # Import services here to avoid circular imports
        from app.services.project_service import ProjectService
        from app.services.priority_service import PriorityService

        logger.info(f"[Projects API] Starting project generation for tenant {tenant_id}")

        # Initialize services
        project_service = ProjectService()
        priority_service = PriorityService()

        # Generate projects
        result = await project_service.generate_projects_for_initiatives(
            tenant_id=tenant_id,
            db=db,
            initiative_ids=request.initiative_ids,
        )

        logger.info(
            f"[Projects API] Generated {result['projects_created']} projects "
            f"for {result['initiatives_processed']} initiatives"
        )

        # Calculate priority scores for all generated projects
        logger.info(f"[Projects API] Calculating RICE priority scores")
        await priority_service.calculate_priorities_for_tenant(tenant_id, db)

        return ProjectGenerateResponse(
            success=True,
            message=(
                f"Generated {result['projects_created']} projects "
                f"for {result['initiatives_processed']} initiatives"
            ),
            projects_created=result['projects_created'],
            initiatives_processed=result['initiatives_processed'],
        )

    except Exception as e:
        logger.error(f"[Projects API] Project generation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Project generation failed: {str(e)}"
        )


@router.post("/generate-async")
async def generate_projects_async(
    request: ProjectGenerateRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Auto-generate projects asynchronously - returns immediately with job_id

    This endpoint starts a background job for project generation and returns
    immediately. Use GET /api/v1/jobs/{job_id} to check status.

    Suitable for generating many projects across multiple initiatives.
    """
    from app.models.job import JobType
    from app.services.background_task_service import BackgroundTaskService
    from app.core.config import settings

    try:
        logger.info(f"[Projects API] Starting async project generation for tenant {tenant_id}")

        # Create background job
        job = await BackgroundTaskService.create_job(
            tenant_id=tenant_id,
            user_id=None,
            job_type=JobType.PROJECT_GENERATION,
            input_params={"initiative_ids": request.initiative_ids},
            db=db
        )

        logger.info(f"[Projects API] Created async generation job {job.job_uuid}")

        # Choose task queue based on configuration
        if settings.USE_CELERY:
            # Production: Use Celery (durable, survives restarts)
            from app.workers.project_tasks import generate_projects_task
            generate_projects_task.delay(
                str(job.job_uuid),
                tenant_id,
                request.initiative_ids
            )
            logger.info(f"[Projects API] Dispatched to Celery: {job.job_uuid}")
        else:
            # Development: Use asyncio (non-durable, simpler)
            from app.workers.project_worker import generate_projects_background
            BackgroundTaskService.run_in_background(
                generate_projects_background(
                    str(job.job_uuid),
                    tenant_id,
                    request.initiative_ids
                )
            )
            logger.info(f"[Projects API] Running with asyncio (dev mode): {job.job_uuid}")

        return {
            "success": True,
            "job_id": str(job.job_uuid),
            "message": "Project generation started in background. Use GET /api/v1/jobs/{job_id} to check status.",
        }

    except Exception as e:
        logger.error(f"[Projects API] Failed to start async generation: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start project generation: {str(e)}"
        )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Get a specific project by ID"""
    result = await db.execute(
        select(Project).where(
            and_(
                Project.id == project_id,
                Project.tenant_id == tenant_id
            )
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    updates: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Update a project's fields"""
    result = await db.execute(
        select(Project).where(
            and_(
                Project.id == project_id,
                Project.tenant_id == tenant_id
            )
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Update fields
    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)

    # If effort changed, may need to recalculate is_boulder
    if 'effort' in update_data and 'is_boulder' not in update_data:
        project.is_boulder = project.effort in [ProjectEffort.LARGE, ProjectEffort.XLARGE]

    await db.commit()
    await db.refresh(project)

    logger.info(f"[Projects API] Updated project {project_id}: {update_data}")

    return project


@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Delete a project"""
    result = await db.execute(
        select(Project).where(
            and_(
                Project.id == project_id,
                Project.tenant_id == tenant_id
            )
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.delete(project)
    await db.commit()

    logger.info(f"[Projects API] Deleted project {project_id}")

    return {"success": True, "message": "Project deleted successfully"}


@router.post("/recalculate-priorities")
async def recalculate_priorities(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Recalculate RICE priority scores for all projects.

    This is useful after:
    - Personas are updated
    - Themes are refreshed
    - You want to ensure all scores are current
    """
    try:
        from app.services.priority_service import PriorityService

        logger.info(f"[Projects API] Recalculating priorities for tenant {tenant_id}")

        priority_service = PriorityService()
        updated_count = await priority_service.calculate_priorities_for_tenant(tenant_id, db)

        logger.info(f"[Projects API] Recalculated priorities for {updated_count} projects")

        return {
            "success": True,
            "message": f"Recalculated priorities for {updated_count} projects"
        }

    except Exception as e:
        logger.error(f"[Projects API] Priority recalculation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Priority recalculation failed: {str(e)}"
        )


@router.get("/debug/generation-context")
async def debug_generation_context(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Debug endpoint to check what context is available for project generation
    """
    from app.models.initiative import Initiative
    from app.models.theme import Theme
    from app.models.persona import Persona
    from app.models.knowledge_base import Capability
    from sqlalchemy.orm import selectinload

    # Count initiatives and check theme linkage
    result = await db.execute(
        select(Initiative)
        .where(Initiative.tenant_id == tenant_id)
        .options(selectinload(Initiative.themes))
    )
    initiatives = result.scalars().all()

    # Count themes
    result = await db.execute(select(Theme).where(Theme.tenant_id == tenant_id))
    themes = result.scalars().all()

    # Count personas
    result = await db.execute(
        select(Persona).where(
            Persona.tenant_id == tenant_id,
            Persona.status == 'advisor'
        )
    )
    personas = result.scalars().all()

    # Count capabilities
    result = await db.execute(select(Capability).where(Capability.tenant_id == tenant_id))
    capabilities = result.scalars().all()

    # Count projects
    result = await db.execute(select(Project).where(Project.tenant_id == tenant_id))
    projects = result.scalars().all()

    # Build initiative details
    initiative_details = []
    for init in initiatives[:10]:  # Show first 10
        initiative_details.append({
            "id": init.id,
            "title": init.title,
            "status": init.status.value if init.status else None,
            "theme_count": len(init.themes),
            "theme_titles": [t.title for t in init.themes[:3]]
        })

    # Check LLM configuration
    try:
        from app.services.llm_service import get_llm_service
        llm = get_llm_service()
        llm_configured = hasattr(llm, 'client') and llm.client is not None
    except:
        llm_configured = False

    return {
        "tenant_id": tenant_id,
        "counts": {
            "initiatives": len(initiatives),
            "themes": len(themes),
            "personas": len(personas),
            "capabilities": len(capabilities),
            "projects": len(projects)
        },
        "initiatives_sample": initiative_details,
        "llm_configured": llm_configured,
        "diagnosis": {
            "can_generate_projects": (
                len(initiatives) > 0 and
                llm_configured
            ),
            "issues": [
                "No initiatives found" if len(initiatives) == 0 else None,
                "LLM not configured (check API keys in settings)" if not llm_configured else None,
                "No themes linked to initiatives" if len(initiatives) > 0 and all(len(i.themes) == 0 for i in initiatives) else None,
                "No feedback/themes exist yet" if len(themes) == 0 else None
            ]
        }
    }
