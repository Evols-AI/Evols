"""
Project Background Worker
Async execution of project generation operations
"""

import logging
from typing import Optional, List

from app.core.database import AsyncSessionLocal
from app.services.background_task_service import BackgroundTaskService
from app.services.project_service import ProjectService
from app.services.priority_service import PriorityService

logger = logging.getLogger(__name__)


async def generate_projects_background(
    job_uuid: str,
    tenant_id: int,
    initiative_ids: Optional[List[int]] = None
):
    """
    Background worker for project generation
    Runs async without blocking the API response
    """
    try:
        # Mark job as running
        await BackgroundTaskService.mark_job_running(job_uuid)

        # Create new session for this background task
        async with AsyncSessionLocal() as db:
            # Initialize services
            project_service = ProjectService()
            priority_service = PriorityService()

            # Step 1: Generate projects
            await BackgroundTaskService.update_job_progress(
                job_uuid,
                progress=0.1,
                message="Generating projects from initiatives...",
                current_step="Project generation"
            )

            result = await project_service.generate_projects_for_initiatives(
                tenant_id=tenant_id,
                db=db,
                initiative_ids=initiative_ids,
            )

            logger.info(
                f"[ProjectWorker] Generated {result['projects_created']} projects "
                f"for {result['initiatives_processed']} initiatives"
            )

            # Step 2: Calculate priority scores
            await BackgroundTaskService.update_job_progress(
                job_uuid,
                progress=0.7,
                message="Calculating RICE priority scores...",
                current_step="Priority calculation"
            )

            await priority_service.calculate_priorities_for_tenant(tenant_id, db)

            # Mark as completed
            await BackgroundTaskService.mark_job_completed(
                job_uuid,
                result_data={
                    "success": True,
                    "message": (
                        f"Generated {result['projects_created']} projects "
                        f"for {result['initiatives_processed']} initiatives"
                    ),
                    "projects_created": result['projects_created'],
                    "initiatives_processed": result['initiatives_processed'],
                }
            )

            logger.info(f"[ProjectWorker] Project generation completed for tenant {tenant_id}")

    except Exception as e:
        logger.error(f"[ProjectWorker] Project generation failed: {e}", exc_info=True)
        await BackgroundTaskService.mark_job_failed(
            job_uuid,
            error_message=str(e)
        )
