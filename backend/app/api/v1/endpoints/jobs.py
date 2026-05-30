"""
Background Jobs Endpoints
Check status of async operations
"""

import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.core.dependencies import get_current_tenant_id
from app.models.job import Job, JobStatus, JobType
from app.services.background_task_service import BackgroundTaskService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{job_uuid}")
async def get_job_status(
    job_uuid: str,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Get the status of a background job
    """
    result = await db.execute(
        select(Job).where(
            and_(
                Job.job_uuid == job_uuid,
                Job.tenant_id == tenant_id
            )
        )
    )
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return job.to_progress_dict()


@router.get("/")
async def list_jobs(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
    job_type: JobType = Query(None, description="Filter by job type"),
    status: JobStatus = Query(None, description="Filter by status"),
    limit: int = Query(20, ge=1, le=100),
):
    """
    List recent jobs for tenant
    """
    query = select(Job).where(Job.tenant_id == tenant_id)

    if job_type:
        query = query.where(Job.job_type == job_type)
    if status:
        query = query.where(Job.status == status)

    query = query.order_by(Job.created_at.desc()).limit(limit)

    result = await db.execute(query)
    jobs = result.scalars().all()

    return [job.to_progress_dict() for job in jobs]


@router.delete("/{job_uuid}")
async def cancel_job(
    job_uuid: str,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Cancel a pending or running job (soft cancel - marks as cancelled)
    Note: Job may continue running but will be marked as cancelled
    """
    result = await db.execute(
        select(Job).where(
            and_(
                Job.job_uuid == job_uuid,
                Job.tenant_id == tenant_id
            )
        )
    )
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel job with status: {job.status.value}"
        )

    job.status = JobStatus.CANCELLED
    await db.commit()

    logger.info(f"[Jobs API] Cancelled job {job_uuid}")

    return {"success": True, "message": "Job cancelled"}


@router.post("/{job_uuid}/retry")
async def retry_job(
    job_uuid: str,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Retry a failed or cancelled job.

    Creates a NEW job that copies the original's input parameters, links back to
    the original via job_metadata.retry_of (and the original gets retried_by),
    and dispatches it through the same path as the original. The original job is
    left untouched so the history of both attempts is preserved.
    """
    # Imported here to avoid a circular import at module load.
    from app.workers.dispatch import dispatch_job, is_retryable

    result = await db.execute(
        select(Job).where(
            and_(
                Job.job_uuid == job_uuid,
                Job.tenant_id == tenant_id
            )
        )
    )
    original = result.scalar_one_or_none()

    if not original:
        raise HTTPException(status_code=404, detail="Job not found")

    if original.status not in [JobStatus.FAILED, JobStatus.CANCELLED]:
        raise HTTPException(
            status_code=400,
            detail=f"Only failed or cancelled jobs can be retried (current status: {original.status.value})"
        )

    if not is_retryable(original.job_type):
        raise HTTPException(
            status_code=400,
            detail=f"Retry is not supported for {original.job_type.value} jobs yet"
        )

    # Create the replacement job, copying the original inputs.
    new_job = await BackgroundTaskService.create_job(
        tenant_id=tenant_id,
        user_id=original.user_id,
        job_type=original.job_type,
        input_params=original.input_params,
        db=db,
    )

    # Link the two attempts in both directions (reassign dicts so SQLAlchemy
    # flags the JSON columns dirty).
    new_job.job_metadata = {"retry_of": str(original.job_uuid)}
    original.job_metadata = {**(original.job_metadata or {}), "retried_by": str(new_job.job_uuid)}
    await db.commit()
    await db.refresh(new_job)

    # Dispatch through the same registry the original used.
    dispatch_job(original.job_type, str(new_job.job_uuid), tenant_id, original.input_params)

    logger.info(f"[Jobs API] Retried job {job_uuid} → new job {new_job.job_uuid}")

    return {
        "success": True,
        "job_id": str(new_job.job_uuid),
        "retry_of": str(original.job_uuid),
        "message": f"Retry started for {original.job_type.value}",
    }
