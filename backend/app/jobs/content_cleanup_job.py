"""
Content Cleanup Scheduled Job
Processes scheduled content deletions based on retention policies
"""

from datetime import datetime
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_context
from app.services.retention_service import RetentionPolicyService


async def run_content_cleanup_job():
    """
    Run content cleanup job

    This job:
    1. Finds sources scheduled for deletion
    2. Deletes content while preserving metadata and summaries
    3. Logs operations for audit

    Runs every 6 hours via cron
    """
    logger.info("[ContentCleanupJob] Starting content cleanup job")

    try:
        async with get_db_context() as db:
            retention_service = RetentionPolicyService(db)

            # Process scheduled deletions
            deleted_count = await retention_service.process_scheduled_deletions(batch_size=100)

            logger.info(f"[ContentCleanupJob] Completed: deleted content from {deleted_count} sources")

            return {
                'status': 'success',
                'deleted_count': deleted_count,
                'timestamp': datetime.utcnow().isoformat()
            }

    except Exception as e:
        logger.error(f"[ContentCleanupJob] Job failed: {e}")
        return {
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }


if __name__ == "__main__":
    # Allow running manually for testing
    import asyncio
    asyncio.run(run_content_cleanup_job())
