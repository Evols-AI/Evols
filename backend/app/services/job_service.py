"""
Job Service
Manages background job tracking for long-running AI operations.
Provides transparency on what's happening and when.
"""

import uuid
from typing import Optional, Dict, Any, Callable, Awaitable
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger

from app.models.job import Job, JobStatus, JobType


ProgressCallback = Callable[[float, str], Awaitable[None]]


class JobService:
    """
    Creates, tracks, and updates background jobs.
    Used throughout the AI pipeline so the UI always knows what's happening.
    """

    def __init__(self, db: AsyncSession, tenant_id: int, user_id: Optional[int] = None):
        self.db = db
        self.tenant_id = tenant_id
        self.user_id = user_id

    # ------------------------------------------------------------------ #
    # Create
    # ------------------------------------------------------------------ #

    async def create_job(
        self,
        job_type: JobType,
        input_params: Optional[Dict[str, Any]] = None,
        total_steps: Optional[int] = None,
    ) -> Job:
        """Create and persist a new job record."""
        job = Job(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            job_type=job_type,
            status=JobStatus.PENDING,
            progress=0.0,
            total_steps=total_steps,
            input_params=input_params or {},
        )
        self.db.add(job)
        await self.db.commit()
        await self.db.refresh(job)
        logger.info(f"Created job {job.job_uuid} type={job_type.value}")
        return job

    # ------------------------------------------------------------------ #
    # Progress updates
    # ------------------------------------------------------------------ #

    async def update_progress(
        self,
        job: Job,
        progress: float,
        message: str,
        current_step: Optional[str] = None,
    ) -> Job:
        """Persist a progress update so the frontend can poll it."""
        job.status = JobStatus.RUNNING
        job.progress = min(max(progress, 0.0), 0.99)   # never auto-complete here
        job.message = message
        if current_step:
            job.current_step = current_step
        await self.db.commit()
        return job

    async def complete_job(
        self,
        job: Job,
        result: Optional[Dict[str, Any]] = None,
        message: str = "Completed successfully",
    ) -> Job:
        """Mark job as completed."""
        job.status = JobStatus.COMPLETED
        job.progress = 1.0
        job.message = message
        if result:
            job.result = result
        await self.db.commit()
        logger.info(f"Job {job.job_uuid} completed")
        return job

    async def fail_job(self, job: Job, error: str) -> Job:
        """Mark job as failed with an error message."""
        job.status = JobStatus.FAILED
        job.error = error
        job.message = f"Failed: {error[:200]}"
        await self.db.commit()
        logger.error(f"Job {job.job_uuid} failed: {error}")
        return job

    # ------------------------------------------------------------------ #
    # Query
    # ------------------------------------------------------------------ #

    async def get_job(self, job_uuid: str) -> Optional[Job]:
        """Fetch a job by its UUID."""
        result = await self.db.execute(
            select(Job).where(
                Job.job_uuid == uuid.UUID(job_uuid),
                Job.tenant_id == self.tenant_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_jobs(
        self,
        job_type: Optional[JobType] = None,
        status: Optional[JobStatus] = None,
        limit: int = 20,
    ) -> list[Job]:
        """List recent jobs for this tenant."""
        query = select(Job).where(Job.tenant_id == self.tenant_id)
        if job_type:
            query = query.where(Job.job_type == job_type)
        if status:
            query = query.where(Job.status == status)
        query = query.order_by(Job.created_at.desc()).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    # ------------------------------------------------------------------ #
    # Convenience: progress callback factory
    # ------------------------------------------------------------------ #

    def make_progress_callback(self, job: Job) -> ProgressCallback:
        """
        Return an async callback suitable for passing into AI service methods.

        Usage::
            cb = job_service.make_progress_callback(job)
            await theme_service.generate_themes(items, progress_callback=cb)
        """
        async def _callback(progress: float, message: str):
            await self.update_progress(job, progress, message)

        return _callback


async def run_job_with_tracking(
    job_service: "JobService",
    job_type: JobType,
    coro_factory: Callable[["ProgressCallback"], Awaitable[Any]],
    input_params: Optional[Dict[str, Any]] = None,
    total_steps: Optional[int] = None,
) -> tuple[Job, Any]:
    """
    Convenience wrapper: creates a job, runs a coroutine with progress tracking,
    and marks it complete/failed automatically.

    Args:
        job_service: JobService instance
        job_type: Type of job
        coro_factory: Async function that receives a progress_callback and returns a result
        input_params: Input parameters to store on the job
        total_steps: Optional total step count

    Returns:
        (Job, result)  where result is whatever coro_factory returns

    Example::
        job, themes = await run_job_with_tracking(
            job_service,
            JobType.THEME_GENERATION,
            lambda cb: theme_service.generate_themes(items, progress_callback=cb),
        )
    """
    job = await job_service.create_job(job_type, input_params, total_steps)
    callback = job_service.make_progress_callback(job)

    try:
        result = await coro_factory(callback)
        await job_service.complete_job(job, message="Done")
        return job, result
    except Exception as e:
        await job_service.fail_job(job, str(e))
        raise
