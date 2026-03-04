"""
Theme Celery Tasks
Durable background tasks for theme refresh
"""

import asyncio
from celery import Task
from loguru import logger

from app.core.celery_app import celery_app
from app.workers.theme_worker import refresh_themes_background


class AsyncTask(Task):
    """Base task that runs async coroutines"""

    def __call__(self, *args, **kwargs):
        """Run async function in event loop"""
        return asyncio.run(self.run_async(*args, **kwargs))

    async def run_async(self, *args, **kwargs):
        """Override this in subclasses"""
        raise NotImplementedError


@celery_app.task(
    bind=True,
    base=AsyncTask,
    name="theme.refresh",
    max_retries=3,
    default_retry_delay=300,  # 5 minutes
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=3600,  # 1 hour max
)
async def refresh_themes_task(self, job_uuid: str, tenant_id: int):
    """
    Celery task for theme refresh
    Durable - survives server restarts
    Auto-retries on failure
    """
    logger.info(
        f"[Celery:ThemeTask] Starting theme refresh: "
        f"job_uuid={job_uuid}, tenant_id={tenant_id}"
    )

    try:
        # Call the existing worker function
        await refresh_themes_background(job_uuid, tenant_id)

        logger.info(
            f"[Celery:ThemeTask] Completed theme refresh: job_uuid={job_uuid}"
        )

        return {
            "success": True,
            "job_uuid": job_uuid,
            "tenant_id": tenant_id,
        }

    except Exception as e:
        logger.error(
            f"[Celery:ThemeTask] Failed theme refresh: "
            f"job_uuid={job_uuid}, error={e}",
            exc_info=True
        )

        # Celery will auto-retry based on configuration
        raise
