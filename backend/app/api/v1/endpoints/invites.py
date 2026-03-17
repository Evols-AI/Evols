"""
Tenant Invite Endpoints
Invite management for tenant access
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
import secrets

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.permissions import require_tenant_admin
from app.models.user import User
from app.models.tenant import Tenant
from app.models.tenant_invite import TenantInvite
from app.models.user_tenant import UserTenant
from app.schemas.invite import InviteCreate, InviteResponse, InviteListResponse
from app.services.email_service import EmailService

router = APIRouter()


@router.post("/", response_model=InviteResponse, status_code=status.HTTP_201_CREATED)
async def create_invite(
    invite_data: InviteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new tenant invite (TENANT_ADMIN only)
    """
    require_tenant_admin(current_user)

    # Check if user with this email already exists in this tenant
    result = await db.execute(
        select(User).where(User.email == invite_data.email.lower())
    )
    existing_user = result.scalar_one_or_none()

    if existing_user:
        # Check if they're already a member
        result = await db.execute(
            select(UserTenant).where(
                UserTenant.user_id == existing_user.id,
                UserTenant.tenant_id == current_user.tenant_id
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a member of this tenant"
            )

    # Check if there's already a pending invite for this email
    result = await db.execute(
        select(TenantInvite).where(
            TenantInvite.email == invite_data.email.lower(),
            TenantInvite.tenant_id == current_user.tenant_id,
            TenantInvite.is_accepted == False
        )
    )
    existing_invite = result.scalar_one_or_none()

    if existing_invite and existing_invite.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A pending invite already exists for this email"
        )

    # Get tenant name
    result = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = result.scalar_one()

    # Create invite
    invite = TenantInvite(
        tenant_id=current_user.tenant_id,
        email=invite_data.email.lower(),
        token=secrets.token_urlsafe(32),
        role=invite_data.role,
        invited_by=current_user.id,
        message=invite_data.message,
        expires_at=datetime.utcnow() + timedelta(days=7),
        is_accepted=False,
    )

    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    # Send invite email
    try:
        EmailService.send_invite_email(
            to_email=invite.email,
            tenant_name=tenant.name,
            inviter_name=current_user.full_name or current_user.email,
            invite_token=invite.token,
            role=invite.role,
            message=invite.message
        )
    except Exception as e:
        # Log error but don't fail invite creation
        print(f"Warning: Failed to send invite email: {e}")

    return invite


@router.get("/", response_model=InviteListResponse)
async def list_invites(
    pending_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List tenant invites (TENANT_ADMIN only)
    """
    require_tenant_admin(current_user)

    query = select(TenantInvite).where(TenantInvite.tenant_id == current_user.tenant_id)

    if pending_only:
        query = query.where(TenantInvite.is_accepted == False)

    query = query.order_by(TenantInvite.created_at.desc())

    result = await db.execute(query)
    invites = result.scalars().all()

    return InviteListResponse(
        invites=invites,
        total=len(invites)
    )


@router.delete("/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invite(
    invite_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete/revoke an invite (TENANT_ADMIN only)
    """
    require_tenant_admin(current_user)

    result = await db.execute(
        select(TenantInvite).where(
            TenantInvite.id == invite_id,
            TenantInvite.tenant_id == current_user.tenant_id
        )
    )
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found"
        )

    if invite.is_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete an accepted invite"
        )

    await db.delete(invite)
    await db.commit()


@router.post("/{invite_id}/resend", response_model=InviteResponse)
async def resend_invite(
    invite_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Resend an invite (extends expiration and generates new token)
    """
    require_tenant_admin(current_user)

    result = await db.execute(
        select(TenantInvite).where(
            TenantInvite.id == invite_id,
            TenantInvite.tenant_id == current_user.tenant_id
        )
    )
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found"
        )

    if invite.is_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot resend an accepted invite"
        )

    # Get tenant name
    result = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = result.scalar_one()

    # Generate new token and extend expiration
    invite.token = secrets.token_urlsafe(32)
    invite.expires_at = datetime.utcnow() + timedelta(days=7)

    await db.commit()
    await db.refresh(invite)

    # Resend invite email
    try:
        EmailService.send_invite_email(
            to_email=invite.email,
            tenant_name=tenant.name,
            inviter_name=current_user.full_name or current_user.email,
            invite_token=invite.token,
            role=invite.role,
            message=invite.message
        )
    except Exception as e:
        # Log error but don't fail resend
        print(f"Warning: Failed to resend invite email: {e}")

    return invite
