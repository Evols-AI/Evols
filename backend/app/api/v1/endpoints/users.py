"""
User Management Endpoints
Allow TENANT_ADMIN to manage users within their tenant
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_tenant_id
from app.core.permissions import require_tenant_admin, require_same_tenant
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.tenant import Tenant

router = APIRouter()


# Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    job_title: str | None = None
    role: UserRole = UserRole.USER


class UserUpdate(BaseModel):
    full_name: str | None = None
    job_title: str | None = None
    is_active: bool | None = None
    role: UserRole | None = None


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str | None
    job_title: str | None
    role: str
    is_active: bool
    is_verified: bool
    tenant_id: int | None
    created_at: str

    class Config:
        from_attributes = True


# User Management Endpoints
@router.get("/", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    List all users in the current tenant

    TENANT_ADMIN can view all users in their tenant.
    Regular users can only see themselves.
    """
    # Regular users can only see themselves
    if current_user.role == UserRole.USER:
        return [
            UserResponse(
                id=current_user.id,
                email=current_user.email,
                full_name=current_user.full_name,
                job_title=current_user.job_title,
                role=current_user.role.value,
                is_active=current_user.is_active,
                is_verified=current_user.is_verified,
                tenant_id=current_user.tenant_id,
                created_at=current_user.created_at.isoformat(),
            )
        ]

    # Admins can see all users in their tenant
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
            job_title=user.job_title,
            role=user.role.value,
            is_active=user.is_active,
            is_verified=user.is_verified,
            tenant_id=user.tenant_id,
            created_at=user.created_at.isoformat(),
        )
        for user in users
    ]


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Create a new user in the current tenant (TENANT_ADMIN or SUPER_ADMIN only)

    TENANT_ADMIN can create USER and TENANT_ADMIN roles.
    Cannot create SUPER_ADMIN or PRODUCT_ADMIN.
    """
    require_tenant_admin(current_user)

    # Prevent creating super admins
    if user_data.role in [UserRole.SUPER_ADMIN, UserRole.PRODUCT_ADMIN]:
        if not current_user.is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only SUPER_ADMIN can create SUPER_ADMIN or PRODUCT_ADMIN users"
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
    from sqlalchemy import func
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = tenant_result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )

    # Count current users
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
        job_title=user_data.job_title,
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
        job_title=new_user.job_title,
        role=new_user.role.value,
        is_active=new_user.is_active,
        is_verified=new_user.is_verified,
        tenant_id=new_user.tenant_id,
        created_at=new_user.created_at.isoformat(),
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get user details

    Users can view their own profile.
    TENANT_ADMIN can view any user in their tenant.
    SUPER_ADMIN can view any user.
    """
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check permissions
    if current_user.id != user_id:  # Not viewing own profile
        if not current_user.is_super_admin:
            # Must be admin in same tenant
            require_same_tenant(current_user, user.tenant_id)
            require_tenant_admin(current_user)

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        job_title=user.job_title,
        role=user.role.value,
        is_active=user.is_active,
        is_verified=user.is_verified,
        tenant_id=user.tenant_id,
        created_at=user.created_at.isoformat(),
    )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update user (TENANT_ADMIN or SUPER_ADMIN only, or own profile)

    Users can update their own profile (limited fields).
    TENANT_ADMIN can update users in their tenant.
    SUPER_ADMIN can update any user.
    """
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check permissions
    is_own_profile = current_user.id == user_id

    if not is_own_profile:
        # Updating someone else - need admin privileges
        if not current_user.is_super_admin:
            require_same_tenant(current_user, user.tenant_id)
            require_tenant_admin(current_user)

        # Prevent TENANT_ADMIN from modifying SUPER_ADMIN
        if user.is_super_admin and not current_user.is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only SUPER_ADMIN can modify SUPER_ADMIN users"
            )
    else:
        # Updating own profile - limit what can be changed
        if user_data.role is not None or user_data.is_active is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot change your own role or active status"
            )

    # Update fields
    update_data = user_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        job_title=user.job_title,
        role=user.role.value,
        is_active=user.is_active,
        is_verified=user.is_verified,
        tenant_id=user.tenant_id,
        created_at=user.created_at.isoformat(),
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete user (TENANT_ADMIN or SUPER_ADMIN only)

    TENANT_ADMIN can delete users in their tenant (except SUPER_ADMIN).
    SUPER_ADMIN can delete any user.
    Users cannot delete themselves.
    """
    require_tenant_admin(current_user)

    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account"
        )

    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check permissions
    if not current_user.is_super_admin:
        require_same_tenant(current_user, user.tenant_id)

        # Prevent TENANT_ADMIN from deleting SUPER_ADMIN
        if user.is_super_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only SUPER_ADMIN can delete SUPER_ADMIN users"
            )

    await db.delete(user)
    await db.commit()
