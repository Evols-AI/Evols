"""
Theme Background Worker
Async execution of theme refresh operations
"""

import logging
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import attributes

from app.core.database import AsyncSessionLocal
from app.models.tenant import Tenant
from app.models.theme import Theme
from app.services.background_task_service import BackgroundTaskService
from app.api.v1.endpoints.themes import auto_generate_themes, auto_generate_initiatives

logger = logging.getLogger(__name__)


async def refresh_themes_background(job_uuid: str, tenant_id: int):
    """
    Background worker for theme refresh
    Runs async without blocking the API response
    """
    try:
        # Mark job as running
        await BackgroundTaskService.mark_job_running(job_uuid)

        # Create new session for this background task
        async with AsyncSessionLocal() as db:
            # Step 1: Get last refresh timestamp
            await BackgroundTaskService.update_job_progress(
                job_uuid,
                progress=0.05,
                message="Checking last refresh timestamp...",
                current_step="Loading tenant settings"
            )

            result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
            tenant = result.scalar_one_or_none()

            last_refresh_timestamp = None
            if tenant and tenant.settings:
                last_refresh_str = tenant.settings.get('theme_last_refresh_date')
                if last_refresh_str:
                    try:
                        last_refresh_timestamp = datetime.fromisoformat(
                            last_refresh_str.replace('Z', '+00:00')
                        ).replace(tzinfo=None)
                        logger.info(f"[ThemeWorker] Using incremental refresh from {last_refresh_timestamp}")
                    except Exception as e:
                        logger.warning(f"[ThemeWorker] Could not parse last refresh timestamp: {e}")

            # Step 2: Generate themes
            await BackgroundTaskService.update_job_progress(
                job_uuid,
                progress=0.1,
                message="Generating themes from feedback...",
                current_step="Theme generation"
            )

            theme_result = await auto_generate_themes(tenant_id, db, last_refresh_timestamp)

            # Check results
            themes_up_to_date = theme_result.get("status") == "up_to_date"

            if theme_result.get("status") == "no_data":
                await BackgroundTaskService.mark_job_completed(
                    job_uuid,
                    result_data={
                        "status": "no_data",
                        "message": theme_result.get("message", "Not enough feedback data")
                    }
                )
                return

            # Continue even if themes are up-to-date to regenerate initiatives with latest AI improvements

            # Step 3: Always regenerate initiatives (even if themes are up-to-date)
            # This ensures improvements to initiative generation logic are applied
            await BackgroundTaskService.update_job_progress(
                job_uuid,
                progress=0.6,
                message="Regenerating initiatives with latest context...",
                current_step="Initiative generation"
            )

            # Count existing themes and initiatives
            from app.models.initiative import Initiative
            theme_count_result = await db.execute(select(Theme).where(Theme.tenant_id == tenant_id))
            themes = theme_count_result.scalars().all()

            result = await db.execute(select(Initiative).where(Initiative.tenant_id == tenant_id))
            existing_initiatives = result.scalars().all()

            logger.info(
                f"[ThemeWorker] Regenerating initiatives for {len(themes)} themes "
                f"(replacing {len(existing_initiatives)} existing initiatives)"
            )

            # Always generate initiatives with latest AI improvements and context
            try:
                initiative_result = await auto_generate_initiatives(tenant_id, db)
                initiatives_created = initiative_result.get("initiatives_created", 0) if initiative_result else 0
                initiatives_failed = initiative_result.get("initiatives_failed", 0) if initiative_result else 0

                logger.info(f"[ThemeWorker] Initiative generation: {initiatives_created} created, {initiatives_failed} failed")

                if initiatives_failed > 0:
                    logger.warning(f"[ThemeWorker] {initiatives_failed} initiatives failed to generate")

                # Validation: Verify initiatives were actually created in database
                result_after = await db.execute(select(Initiative).where(Initiative.tenant_id == tenant_id))
                final_initiatives = result_after.scalars().all()

                if len(final_initiatives) == 0 and len(themes) > 0:
                    logger.error(
                        f"[ThemeWorker] VALIDATION FAILED: No initiatives in database despite {len(themes)} themes. "
                        f"All initiative generation may have failed."
                    )
                    initiatives_failed = len(themes)
                else:
                    logger.info(f"[ThemeWorker] Validation: {len(final_initiatives)} initiatives confirmed in database")

            except Exception as e:
                logger.error(f"[ThemeWorker] Initiative generation failed: {e}", exc_info=True)
                # Don't fail the whole refresh, but track the error
                initiative_result = {"initiatives_created": 0, "initiatives_failed": len(themes), "error": str(e)}
                initiatives_created = 0
                initiatives_failed = len(themes)

            # Step 4: Generate projects
            await BackgroundTaskService.update_job_progress(
                job_uuid,
                progress=0.8,
                message="Generating projects from initiatives...",
                current_step="Project generation"
            )

            try:
                from app.services.project_service import ProjectService
                from app.services.priority_service import PriorityService

                project_service = ProjectService()
                priority_service = PriorityService()

                # Generate projects
                project_result = await project_service.generate_projects_for_initiatives(
                    tenant_id=tenant_id,
                    db=db,
                )

                # Calculate priorities
                await BackgroundTaskService.update_job_progress(
                    job_uuid,
                    progress=0.95,
                    message="Calculating project priorities...",
                    current_step="Priority calculation"
                )

                await priority_service.calculate_priorities_for_tenant(tenant_id, db)

                logger.info(
                    f"[ThemeWorker] Generated {project_result['projects_created']} projects "
                    f"for {project_result['initiatives_processed']} initiatives"
                )

                # Validation: Verify projects were created if initiatives exist
                from app.models.project import Project
                project_count_result = await db.execute(select(Project).where(Project.tenant_id == tenant_id))
                final_projects = project_count_result.scalars().all()

                final_initiatives_result = await db.execute(select(Initiative).where(Initiative.tenant_id == tenant_id))
                final_initiatives_count = len(final_initiatives_result.scalars().all())

                if len(final_projects) == 0 and final_initiatives_count > 0:
                    logger.warning(
                        f"[ThemeWorker] VALIDATION WARNING: No projects in database despite {final_initiatives_count} initiatives. "
                        f"Project generation may have failed."
                    )
                else:
                    logger.info(f"[ThemeWorker] Validation: {len(final_projects)} projects confirmed in database")

            except Exception as e:
                logger.error(f"[ThemeWorker] Project generation failed: {e}", exc_info=True)
                # Don't fail the whole refresh if project generation fails
                project_result = {"projects_created": 0, "initiatives_processed": 0}

            # Step 5: Update last refresh timestamp (only if themes were actually updated)
            if tenant and not themes_up_to_date:
                settings = tenant.settings or {}
                settings['theme_last_refresh_date'] = datetime.utcnow().isoformat() + 'Z'
                tenant.settings = settings
                attributes.flag_modified(tenant, 'settings')
                await db.commit()

            # Build result summary with error tracking
            if themes_up_to_date:
                message = "Themes are up to date. Initiatives and projects regenerated with latest AI improvements."
            else:
                message = "Themes, initiatives, and projects refreshed successfully"

            result_data = {
                "status": "refreshed",
                "message": message,
                "themes_created": theme_result.get("themes_created", 0),
                "themes_updated": theme_result.get("themes_updated", 0),
                "feedback_processed": theme_result.get("feedback_processed", 0),
                "initiatives_created": initiatives_created,
                "initiatives_failed": initiatives_failed,
                "projects_created": project_result.get("projects_created", 0),
                "initiatives_processed": project_result.get("initiatives_processed", 0),
            }

            # Add warnings if there were failures
            warnings = []
            if initiatives_failed > 0:
                warnings.append(f"{initiatives_failed} initiatives failed to generate")
            if project_result.get("projects_created", 0) == 0 and initiatives_created > 0:
                warnings.append("No projects were generated despite having initiatives")

            if warnings:
                result_data["warnings"] = warnings
                result_data["message"] = "Refresh completed with warnings"

            # Mark as completed
            await BackgroundTaskService.mark_job_completed(job_uuid, result_data=result_data)

            logger.info(f"[ThemeWorker] Theme refresh completed for tenant {tenant_id}")

    except Exception as e:
        logger.error(f"[ThemeWorker] Theme refresh failed: {e}", exc_info=True)
        await BackgroundTaskService.mark_job_failed(
            job_uuid,
            error_message=str(e)
        )
