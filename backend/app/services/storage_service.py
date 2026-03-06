"""
Storage Service
Handles file storage quota enforcement and tracking
"""

from fastapi import HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.tenant import Tenant


async def check_storage_quota(
    db: AsyncSession,
    tenant_id: int,
    file_size_bytes: int,
) -> None:
    """
    Check if uploading a file would exceed tenant's storage quota.

    Args:
        db: Database session
        tenant_id: Tenant ID
        file_size_bytes: Size of file to upload in bytes

    Raises:
        HTTPException: If storage limit would be exceeded
    """
    # Get tenant
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Convert max_storage from GB to bytes
    max_storage_bytes = tenant.max_storage_gb * 1024 * 1024 * 1024

    # Get current storage usage (from tenant field)
    current_storage_bytes = getattr(tenant, 'current_storage_bytes', 0) or 0

    # Check if upload would exceed limit
    total_after_upload = current_storage_bytes + file_size_bytes

    if total_after_upload > max_storage_bytes:
        current_gb = current_storage_bytes / (1024 * 1024 * 1024)
        max_gb = tenant.max_storage_gb
        file_mb = file_size_bytes / (1024 * 1024)

        raise HTTPException(
            status_code=403,
            detail=f"Storage limit would be exceeded. Current: {current_gb:.2f}/{max_gb} GB. File size: {file_mb:.2f} MB. Please upgrade your plan for more storage."
        )


async def update_storage_usage(
    db: AsyncSession,
    tenant_id: int,
    bytes_delta: int,
) -> None:
    """
    Update tenant's current storage usage.

    Args:
        db: Database session
        tenant_id: Tenant ID
        bytes_delta: Change in storage (positive for upload, negative for delete)
    """
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        return

    # Update storage tracking
    current = getattr(tenant, 'current_storage_bytes', 0) or 0
    new_storage = max(0, current + bytes_delta)  # Don't go below 0

    # Note: This requires migration to add current_storage_bytes field to Tenant model
    # For now, we'll track in settings JSON as a temporary solution
    if not tenant.settings:
        tenant.settings = {}

    tenant.settings['current_storage_bytes'] = new_storage

    await db.commit()


async def get_file_size(file: UploadFile) -> int:
    """
    Get size of uploaded file in bytes.

    Args:
        file: FastAPI UploadFile object

    Returns:
        File size in bytes
    """
    # Seek to end to get size
    await file.seek(0, 2)  # Seek to end
    file_size = await file.tell()
    await file.seek(0)  # Reset to beginning for reading

    return file_size
