"""
Admin Endpoints
Cross-tenant management for SUPER_ADMIN users
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.permissions import require_super_admin
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.services.demo_seed_service import seed_demo_product

router = APIRouter()


# Schemas
class TenantCreate(BaseModel):
    name: str
    slug: str
    domain: str | None = None
    plan_type: str = "free"
    max_users: int = 5
    max_storage_gb: int = 10


class TenantUpdate(BaseModel):
    name: str | None = None
    domain: str | None = None
    is_active: bool | None = None
    is_trial: bool | None = None
    plan_type: str | None = None
    max_users: int | None = None
    max_storage_gb: int | None = None


class TenantResponse(BaseModel):
    id: int
    name: str
    slug: str
    domain: str | None
    is_active: bool
    is_trial: bool
    plan_type: str
    max_users: int
    max_storage_gb: int
    user_count: int = 0
    created_at: str

    class Config:
        from_attributes = True


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    role: UserRole = UserRole.USER


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str | None
    role: str
    is_active: bool
    is_verified: bool
    tenant_id: int | None

    class Config:
        from_attributes = True


# Tenant Management Endpoints
@router.get("/tenants", response_model=List[TenantResponse])
async def list_all_tenants(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all tenants (SUPER_ADMIN only)

    Returns all tenants in the system with user counts.
    """
    require_super_admin(current_user)

    # Get tenants with user counts
    query = (
        select(
            Tenant,
            func.count(User.id).label("user_count")
        )
        .outerjoin(User, User.tenant_id == Tenant.id)
        .group_by(Tenant.id)
        .order_by(Tenant.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(query)
    rows = result.all()

    tenants = []
    for tenant, user_count in rows:
        tenant_dict = {
            "id": tenant.id,
            "name": tenant.name,
            "slug": tenant.slug,
            "domain": tenant.domain,
            "is_active": tenant.is_active,
            "is_trial": tenant.is_trial,
            "plan_type": tenant.plan_type,
            "max_users": tenant.max_users,
            "max_storage_gb": tenant.max_storage_gb,
            "user_count": user_count,
            "created_at": tenant.created_at.isoformat(),
        }
        tenants.append(TenantResponse(**tenant_dict))

    return tenants


@router.post("/tenants", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    tenant_data: TenantCreate,
    seed_demo: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new tenant (SUPER_ADMIN only)

    Args:
        tenant_data: Tenant creation data
        seed_demo: Whether to seed demo product with sample data (default: True)
    """
    require_super_admin(current_user)

    # Check if slug already exists
    result = await db.execute(
        select(Tenant).where(Tenant.slug == tenant_data.slug)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tenant with slug '{tenant_data.slug}' already exists"
        )

    # Create tenant
    new_tenant = Tenant(**tenant_data.model_dump())
    db.add(new_tenant)
    await db.flush()

    # Seed demo product if requested
    if seed_demo:
        try:
            await seed_demo_product(db, new_tenant.id)
        except Exception as e:
            # Log but don't fail
            print(f"Warning: Failed to seed demo product for tenant {new_tenant.id}: {e}")

    await db.commit()
    await db.refresh(new_tenant)

    return TenantResponse(
        id=new_tenant.id,
        name=new_tenant.name,
        slug=new_tenant.slug,
        domain=new_tenant.domain,
        is_active=new_tenant.is_active,
        is_trial=new_tenant.is_trial,
        plan_type=new_tenant.plan_type,
        max_users=new_tenant.max_users,
        max_storage_gb=new_tenant.max_storage_gb,
        user_count=0,
        created_at=new_tenant.created_at.isoformat(),
    )


@router.get("/tenants/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get tenant details (SUPER_ADMIN only)
    """
    require_super_admin(current_user)

    # Get tenant with user count
    query = (
        select(
            Tenant,
            func.count(User.id).label("user_count")
        )
        .outerjoin(User, User.tenant_id == Tenant.id)
        .where(Tenant.id == tenant_id)
        .group_by(Tenant.id)
    )

    result = await db.execute(query)
    row = result.one_or_none()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )

    tenant, user_count = row
    return TenantResponse(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        domain=tenant.domain,
        is_active=tenant.is_active,
        is_trial=tenant.is_trial,
        plan_type=tenant.plan_type,
        max_users=tenant.max_users,
        max_storage_gb=tenant.max_storage_gb,
        user_count=user_count,
        created_at=tenant.created_at.isoformat(),
    )


@router.put("/tenants/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: int,
    tenant_data: TenantUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update tenant (SUPER_ADMIN only)
    """
    require_super_admin(current_user)

    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )

    # Update fields
    update_data = tenant_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tenant, field, value)

    await db.commit()
    await db.refresh(tenant)

    # Get user count
    count_result = await db.execute(
        select(func.count(User.id)).where(User.tenant_id == tenant_id)
    )
    user_count = count_result.scalar() or 0

    return TenantResponse(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        domain=tenant.domain,
        is_active=tenant.is_active,
        is_trial=tenant.is_trial,
        plan_type=tenant.plan_type,
        max_users=tenant.max_users,
        max_storage_gb=tenant.max_storage_gb,
        user_count=user_count,
        created_at=tenant.created_at.isoformat(),
    )


@router.delete("/tenants/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant(
    tenant_id: int,
    force: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete tenant (SUPER_ADMIN only)

    Args:
        tenant_id: ID of tenant to delete
        force: If True, deletes tenant even if it has users. If False, only deletes empty tenants.

    Warning: This will cascade delete all tenant data (users, feedback, themes, etc.)
    """
    require_super_admin(current_user)

    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )

    # Check if tenant has users
    if not force:
        count_result = await db.execute(
            select(func.count(User.id)).where(User.tenant_id == tenant_id)
        )
        user_count = count_result.scalar() or 0

        if user_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tenant has {user_count} users. Use force=true to delete anyway."
            )

    await db.delete(tenant)
    await db.commit()


# User Management (Cross-Tenant)
@router.post("/tenants/{tenant_id}/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user_in_tenant(
    tenant_id: int,
    user_data: AdminUserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a user in any tenant (SUPER_ADMIN only)

    This allows SUPER_ADMIN to create users (including TENANT_ADMIN) in any tenant.
    """
    require_super_admin(current_user)

    # Verify tenant exists
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )

    # Check if email already exists
    result = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Check max_users quota
    count_result = await db.execute(
        select(func.count(User.id)).where(User.tenant_id == tenant_id)
    )
    current_user_count = count_result.scalar() or 0

    # Enforce max_users limit
    if current_user_count >= tenant.max_users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User limit reached. Current: {current_user_count}/{tenant.max_users}. Please upgrade your plan to add more users."
        )

    # Create user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        tenant_id=tenant_id,
        role=user_data.role,
        is_active=True,
        is_verified=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role.value,
        is_active=new_user.is_active,
        is_verified=new_user.is_verified,
        tenant_id=new_user.tenant_id,
    )


@router.get("/tenants/{tenant_id}/users", response_model=List[UserResponse])
async def list_tenant_users(
    tenant_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all users in a tenant (SUPER_ADMIN only)
    """
    require_super_admin(current_user)

    result = await db.execute(
        select(User)
        .where(User.tenant_id == tenant_id)
        .order_by(User.created_at.desc())
    )
    users = result.scalars().all()

    return [
        UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role.value,
            is_active=user.is_active,
            is_verified=user.is_verified,
            tenant_id=user.tenant_id,
        )
        for user in users
    ]
