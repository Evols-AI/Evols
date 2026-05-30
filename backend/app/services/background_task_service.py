"""
Background Task Service
Manages async execution of long-running jobs
"""

import asyncio
import logging
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.job import Job, JobStatus, JobType
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


class BackgroundTaskService:
    """Service for managing background task execution"""

    @staticmethod
    async def create_job(
        tenant_id: int,
        user_id: Optional[int],
        job_type: JobType,
        input_params: Optional[Dict[str, Any]],
        db: AsyncSession
    ) -> Job:
        """Create a new background job"""
        job = Job(
            tenant_id=tenant_id,
            user_id=user_id,
            job_type=job_type,
            status=JobStatus.PENDING,
            input_params=input_params,
            progress=0.0
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)

        logger.info(f"[BackgroundTask] Created job {job.job_uuid} (type={job_type.value})")
        return job

    @staticmethod
    async def get_job(job_uuid: str, db: AsyncSession) -> Optional[Job]:
        """Get job by UUID"""
        result = await db.execute(
            select(Job).where(Job.job_uuid == job_uuid)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def update_job_progress(
        job_uuid: str,
        progress: float,
        message: Optional[str] = None,
        current_step: Optional[str] = None
    ):
        """Update job progress (creates new session)"""
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Job).where(Job.job_uuid == job_uuid)
            )
            job = result.scalar_one_or_none()

            if job:
                job.update_progress(progress, message, current_step)
                await db.commit()
                logger.debug(f"[BackgroundTask] Job {job_uuid} progress: {progress:.1%}")

    @staticmethod
    async def mark_job_running(job_uuid: str):
        """Mark job as running"""
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Job).where(Job.job_uuid == job_uuid)
            )
            job = result.scalar_one_or_none()

            if job:
                job.status = JobStatus.RUNNING
                job.progress = 0.0
                await db.commit()
                logger.info(f"[BackgroundTask] Job {job_uuid} started")

    @staticmethod
    async def mark_job_completed(job_uuid: str, result_data: Optional[Dict[str, Any]] = None):
        """Mark job as completed"""
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Job).where(Job.job_uuid == job_uuid)
            )
            job = result.scalar_one_or_none()

            if job:
                job.mark_completed(result_data)
                await db.commit()
                logger.info(f"[BackgroundTask] Job {job_uuid} completed")
                await BackgroundTaskService._maybe_notify(job, db)

    @staticmethod
    async def mark_job_failed(job_uuid: str, error_message: str):
        """Mark job as failed"""
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Job).where(Job.job_uuid == job_uuid)
            )
            job = result.scalar_one_or_none()

            if job:
                job.mark_failed(error_message)
                await db.commit()
                logger.error(f"[BackgroundTask] Job {job_uuid} failed: {error_message}")
                await BackgroundTaskService._maybe_notify(job, db)

    @staticmethod
    async def _maybe_notify(job: Job, db: AsyncSession):
        """
        Send a best-effort 'job finished' email to the job's owner, if they
        opted in (User.preferences.notify_on_job_completion).

        Must never raise — a notification failure can't be allowed to affect
        job status. The synchronous SMTP send is offloaded to a thread so it
        doesn't block the event loop.
        """
        try:
            if not job.user_id:
                return

            # Imported here to avoid import cycles at module load.
            from app.models.user import User
            from app.services.email_service import EmailService
            from app.core.config import settings

            res = await db.execute(select(User).where(User.id == job.user_id))
            user = res.scalar_one_or_none()
            if not user or not user.email:
                return

            prefs = user.preferences or {}
            if not prefs.get("notify_on_job_completion"):
                return

            await asyncio.to_thread(
                EmailService.send_job_notification_email,
                user.email,
                job.job_type.value,
                job.status.value,
                job.message,
                job.result,
                settings.FRONTEND_URL,
            )
            logger.info(f"[BackgroundTask] Sent job-completion email for {job.job_uuid} to {user.email}")
        except Exception as e:
            # Notifications are best-effort; swallow everything.
            logger.warning(f"[BackgroundTask] Job notification email skipped for {job.job_uuid}: {e}")

    @staticmethod
    def run_in_background(coro):
        """Run a coroutine in the background without awaiting"""
        asyncio.create_task(coro)
        logger.debug(f"[BackgroundTask] Started background task")
