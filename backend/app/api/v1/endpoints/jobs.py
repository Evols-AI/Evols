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
