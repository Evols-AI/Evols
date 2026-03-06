"""
Feedback Background Worker
Async execution of CSV upload and processing
"""

import logging
import csv
import io
from typing import Optional

from app.core.database import AsyncSessionLocal
from app.services.background_task_service import BackgroundTaskService
from app.models.feedback import Feedback, FeedbackCategory, FeedbackSource

logger = logging.getLogger(__name__)


async def upload_feedback_csv_background(
    job_uuid: str,
    tenant_id: int,
    csv_content: str
):
    """
    Background worker for CSV upload and processing
    Runs async without blocking the API response
    """
    try:
        # Mark job as running
        await BackgroundTaskService.mark_job_running(job_uuid)

        # Create new session for this background task
        async with AsyncSessionLocal() as db:
            # Step 1: Parse CSV
            await BackgroundTaskService.update_job_progress(
                job_uuid,
                progress=0.1,
                message="Parsing CSV file...",
                current_step="CSV parsing"
            )

            csv_reader = csv.DictReader(io.StringIO(csv_content))
            feedback_items = []
            errors = []

            # Step 2: Process rows
            row_count = 0
            for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 (1 is header)
                row_count = row_num - 1

                # Update progress periodically
                if row_num % 50 == 0:
                    progress = 0.1 + (0.4 * (row_num / max(row_count, 1)))
                    await BackgroundTaskService.update_job_progress(
                        job_uuid,
                        progress=min(progress, 0.5),
                        message=f"Processing row {row_num}...",
                        current_step="Processing rows"
                    )

                try:
                    # Map CSV columns to feedback fields
                    content = row.get('content', '').strip()

                    if not content:
                        errors.append(f"Row {row_num}: Missing required field 'content'")
                        continue

                    title = row.get('title', '').strip()
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

            # Step 3: Bulk insert
            await BackgroundTaskService.update_job_progress(
                job_uuid,
                progress=0.6,
                message=f"Saving {len(feedback_items)} feedback items...",
                current_step="Database insert"
            )

            if feedback_items:
                db.add_all(feedback_items)
                await db.commit()

                logger.info(
                    f"[FeedbackWorker] Saved {len(feedback_items)} feedback items "
                    f"for tenant {tenant_id}"
                )

                # Step 4: Auto-generate themes
                await BackgroundTaskService.update_job_progress(
                    job_uuid,
                    progress=0.7,
                    message="Generating themes from feedback...",
                    current_step="Theme generation"
                )

                themes_generated = False
                initiatives_generated = False
                projects_generated = False
                personas_generated = False
                generation_warnings = []

                try:
                    from app.api.v1.endpoints.themes import auto_generate_themes, auto_generate_initiatives
                    from app.services.project_service import ProjectService
                    from app.services.priority_service import PriorityService

                    # Generate themes
                    await auto_generate_themes(tenant_id, db)
                    themes_generated = True
                    logger.info(f"[FeedbackWorker] Themes generated successfully")

                    # Generate initiatives from themes
                    await BackgroundTaskService.update_job_progress(
                        job_uuid,
                        progress=0.75,
                        message="Generating initiatives from themes...",
                        current_step="Initiative generation"
                    )

                    initiative_result = await auto_generate_initiatives(tenant_id, db)
                    initiatives_generated = True
                    initiatives_created = initiative_result.get("initiatives_created", 0) if initiative_result else 0
                    logger.info(f"[FeedbackWorker] Initiatives generated: {initiatives_created} created")

                    # Generate projects from initiatives
                    if initiatives_created > 0:
                        await BackgroundTaskService.update_job_progress(
                            job_uuid,
                            progress=0.80,
                            message="Generating projects from initiatives...",
                            current_step="Project generation"
                        )

                        project_service = ProjectService()
                        priority_service = PriorityService()

                        project_result = await project_service.generate_projects_for_initiatives(
                            tenant_id=tenant_id,
                            db=db,
                        )
                        projects_generated = True
                        projects_created = project_result.get("projects_created", 0)
                        logger.info(f"[FeedbackWorker] Projects generated: {projects_created} created")

                        # Calculate priorities
                        await priority_service.calculate_priorities_for_tenant(tenant_id, db)
                        logger.info(f"[FeedbackWorker] Project priorities calculated")

                except Exception as e:
                    error_msg = f"Theme/Initiative/Project generation failed: {str(e)}"
                    generation_warnings.append(error_msg)
                    logger.error(f"[FeedbackWorker] {error_msg}", exc_info=True)

                # Step 5: Auto-generate personas
                await BackgroundTaskService.update_job_progress(
                    job_uuid,
                    progress=0.85,
                    message="Generating personas from feedback...",
                    current_step="Persona generation"
                )

                try:
                    from app.api.v1.endpoints.personas import auto_generate_personas
                    await auto_generate_personas(tenant_id, db)
                    personas_generated = True
                except Exception as e:
                    generation_warnings.append(f"Persona generation failed: {str(e)}")
                    logger.warning(f"Failed to auto-generate personas: {e}")

            # Mark as completed
            result_message = f"Successfully imported {len(feedback_items)} feedback items"
            if errors:
                result_message += f" ({len(errors)} errors)"

            await BackgroundTaskService.mark_job_completed(
                job_uuid,
                result_data={
                    "success": True,
                    "message": result_message,
                    "total_rows": row_count,
                    "imported": len(feedback_items),
                    "errors": errors if errors else None,
                    "themes_generated": themes_generated,
                    "initiatives_generated": initiatives_generated,
                    "projects_generated": projects_generated,
                    "personas_generated": personas_generated,
                    "generation_warnings": generation_warnings if generation_warnings else None,
                }
            )

            logger.info(f"[FeedbackWorker] CSV upload completed for tenant {tenant_id}")

    except Exception as e:
        logger.error(f"[FeedbackWorker] CSV upload failed: {e}", exc_info=True)
        await BackgroundTaskService.mark_job_failed(
            job_uuid,
            error_message=str(e)
        )
