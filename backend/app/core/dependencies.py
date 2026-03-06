"""
API Dependencies
Common dependencies for FastAPI endpoints
"""

from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token, decrypt_llm_config
from app.core.database import get_db
from app.models.user import User
from app.models.tenant import Tenant
from sqlalchemy import select

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Get current authenticated user from JWT token

    Extracts user information from the Authorization header
    and validates it against the database.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Decode token
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise credentials_exception

    user_id: Optional[int] = payload.get("user_id")
    tenant_id: Optional[int] = payload.get("tenant_id")

    # User ID is required, but tenant_id can be None for SUPER_ADMIN
    if user_id is None:
        raise credentials_exception

    # Get user from database
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )

    return user


async def get_current_tenant_id(
    current_user: User = Depends(get_current_user),
) -> int:
    """
    Get tenant_id from the current authenticated user

    This is a convenience dependency for endpoints that only need
    the tenant_id and not the full user object.

    Note: This will raise an error for SUPER_ADMIN users who don't have a tenant.
    Use get_current_user_tenant_id for admin operations that need to handle both cases.
    """
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This operation requires a tenant context. SUPER_ADMIN users must specify a tenant_id parameter."
        )
    return current_user.tenant_id


async def get_current_user_tenant_id(
    current_user: User = Depends(get_current_user),
) -> Optional[int]:
    """
    Get tenant_id from the current authenticated user (can be None for SUPER_ADMIN)

    This is used for admin operations where SUPER_ADMIN might not have a tenant.
    For regular endpoints, use get_current_tenant_id which enforces tenant requirement.
    """
    return current_user.tenant_id


async def get_target_tenant_id(
    tenant_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
) -> int:
    """
    Get target tenant ID for admin operations

    For SUPER_ADMIN: Uses provided tenant_id parameter (required)
    For other users: Uses their own tenant_id (ignores parameter)

    This allows SUPER_ADMIN to perform cross-tenant operations while
    ensuring regular users and TENANT_ADMIN can only access their own tenant.

    Args:
        tenant_id: Optional tenant ID for SUPER_ADMIN operations
        current_user: Current authenticated user

    Returns:
        Target tenant ID to use for the operation

    Raises:
        HTTPException: If SUPER_ADMIN doesn't provide tenant_id or regular user lacks tenant
    """
    if current_user.is_super_admin:
        if tenant_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SUPER_ADMIN must specify tenant_id parameter for this operation"
            )
        return tenant_id
    else:
        if current_user.tenant_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User does not have a tenant context"
            )
        return current_user.tenant_id


async def get_tenant_llm_config(
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
) -> Optional[Dict[str, Any]]:
    """
    Get decrypted LLM configuration for the current tenant

    Returns:
        Decrypted LLM configuration dict, or None if not configured

    Used by LLM service to get tenant-specific API keys and settings.
    Falls back to None if tenant doesn't have custom config (will use env vars).
    """
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant or not tenant.llm_config:
        return None

    # Decrypt and return config
    return decrypt_llm_config(tenant.llm_config)
