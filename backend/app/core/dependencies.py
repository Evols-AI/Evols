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

    if user_id is None or tenant_id is None:
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
    """
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
