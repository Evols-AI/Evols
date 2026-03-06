"""
Persona Background Worker
Async execution of persona refresh operations
"""

import logging
from typing import Optional

from app.core.database import AsyncSessionLocal
from app.services.background_task_service import BackgroundTaskService

logger = logging.getLogger(__name__)


async def refresh_personas_background(
    job_uuid: str,
    tenant_id: int,
    segment_filter: Optional[str] = None
):
    """
    Background worker for persona refresh
    Runs async without blocking the API response
    """
    try:
        # Mark job as running
        await BackgroundTaskService.mark_job_running(job_uuid)

        # Create new session for this background task
        async with AsyncSessionLocal() as db:
            # Step 1: Load feedback and accounts
            await BackgroundTaskService.update_job_progress(
                job_uuid,
                progress=0.05,
                message="Loading feedback and account data...",
                current_step="Data loading"
            )

            # Import here to avoid circular imports
            from app.services.persona_refresh_service import PersonaRefreshService

            persona_service = PersonaRefreshService(db)

            # Step 2: Generate personas
            await BackgroundTaskService.update_job_progress(
                job_uuid,
                progress=0.1,
                message="Generating personas from feedback patterns...",
                current_step="Persona generation"
            )

            # Get count before generation
            from app.models.persona import Persona
            from sqlalchemy import select, func

            before_count_result = await db.execute(
                select(func.count(Persona.id)).where(Persona.tenant_id == tenant_id)
            )
            personas_before = before_count_result.scalar() or 0

            try:
                result = await persona_service.refresh_new_personas(tenant_id)

                # Get result statistics if available
                personas_created = result.get("personas_created", 0) if result else 0
                personas_updated = result.get("personas_updated", 0) if result else 0
                personas_failed = result.get("personas_failed", 0) if result else 0

                logger.info(
                    f"[PersonaWorker] Generation complete: {personas_created} created, "
                    f"{personas_updated} updated, {personas_failed} failed"
                )

                # Validation: Verify personas exist in database
                after_count_result = await db.execute(
                    select(func.count(Persona.id)).where(Persona.tenant_id == tenant_id)
                )
                personas_after = after_count_result.scalar() or 0

                logger.info(f"[PersonaWorker] Validation: {personas_after} personas in database (before: {personas_before})")

                # Build result data with statistics
                result_data = {
                    "success": True,
                    "message": "Personas refreshed successfully",
                    "personas_created": personas_created,
                    "personas_updated": personas_updated,
                    "personas_failed": personas_failed,
                    "personas_total": personas_after,
                }

                # Add warnings if there were failures
                warnings = []
                if personas_failed > 0:
                    warnings.append(f"{personas_failed} persona groups failed to generate")
                if personas_after == personas_before and personas_created > 0:
                    warnings.append("Persona count didn't increase despite creation attempts")

                if warnings:
                    result_data["warnings"] = warnings
                    result_data["message"] = "Persona refresh completed with warnings"

            except Exception as e:
                logger.error(f"[PersonaWorker] Persona generation failed: {e}", exc_info=True)
                result_data = {
                    "success": False,
                    "message": f"Persona generation failed: {str(e)}",
                    "personas_created": 0,
                    "personas_failed": -1,
                    "error": str(e)
                }

            # Mark as completed
            await BackgroundTaskService.mark_job_completed(job_uuid, result_data=result_data)

            logger.info(f"[PersonaWorker] Persona refresh completed for tenant {tenant_id}")

    except Exception as e:
        logger.error(f"[PersonaWorker] Persona refresh failed: {e}", exc_info=True)
        await BackgroundTaskService.mark_job_failed(
            job_uuid,
            error_message=str(e)
        )
