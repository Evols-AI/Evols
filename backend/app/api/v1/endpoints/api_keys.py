"""
API Key Management Endpoints
Long-lived keys for Evols Claude Code plugin authentication
"""

import secrets
from typing import List, Optional
from datetime import datetime

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_tenant_id
from app.models.user import User
from app.models.api_key import ApiKey

router = APIRouter()

# Key format: evols_ + 32 hex chars
KEY_PREFIX_CHARS = "evols_"
KEY_RANDOM_BYTES = 16  # 32 hex chars


def _generate_key() -> str:
    return KEY_PREFIX_CHARS + secrets.token_hex(KEY_RANDOM_BYTES)


def _hash_key(key: str) -> str:
    return bcrypt.hashpw(key.encode(), bcrypt.gensalt()).decode()


def _verify_key(key: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(key.encode(), hashed.encode())
    except Exception:
        return False


# ===================================
# SCHEMAS
# ===================================

class CreateApiKeyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Human-readable name, e.g. 'Work MacBook'")
    expires_at: Optional[datetime] = Field(None, description="Optional expiry — omit for no expiry (recommended for plugins)")


class ApiKeyResponse(BaseModel):
    id: int
    name: str
    key_prefix: str
    last_used_at: Optional[str]
    expires_at: Optional[str]
    created_at: str
    is_active: bool


class CreateApiKeyResponse(ApiKeyResponse):
    key: str  # Full key — shown ONCE


# ===================================
# ENDPOINTS
# ===================================

@router.post("", response_model=CreateApiKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    request: CreateApiKeyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Generate a new long-lived API key.
    The full key is returned ONCE — store it securely in ~/.evols/config.json.
    """
    key = _generate_key()
    prefix = key[:8]  # "evols_a1"
    key_hash = _hash_key(key)

    api_key = ApiKey(
        tenant_id=tenant_id,
        user_id=current_user.id,
        name=request.name,
        key_prefix=prefix,
        key_hash=key_hash,
        expires_at=request.expires_at,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    return CreateApiKeyResponse(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        key=key,  # plaintext — only time it's exposed
        last_used_at=None,
        expires_at=api_key.expires_at.isoformat() if api_key.expires_at else None,
        created_at=api_key.created_at.isoformat(),
        is_active=api_key.is_active,
    )


@router.get("", response_model=List[ApiKeyResponse])
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    List all API keys for the current user (prefix only, never full key).
    """
    result = await db.execute(
        select(ApiKey).where(
            and_(
                ApiKey.user_id == current_user.id,
                ApiKey.tenant_id == tenant_id,
            )
        ).order_by(ApiKey.created_at.desc())
    )
    keys = result.scalars().all()

    return [
        ApiKeyResponse(
            id=k.id,
            name=k.name,
            key_prefix=k.key_prefix,
            last_used_at=k.last_used_at.isoformat() if k.last_used_at else None,
            expires_at=k.expires_at.isoformat() if k.expires_at else None,
            created_at=k.created_at.isoformat(),
            is_active=k.is_active,
        )
        for k in keys
    ]


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """
    Revoke (delete) an API key. Requests using this key will immediately fail.
    """
    result = await db.execute(
        select(ApiKey).where(
            and_(
                ApiKey.id == key_id,
                ApiKey.user_id == current_user.id,
                ApiKey.tenant_id == tenant_id,
            )
        )
    )
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")

    await db.delete(api_key)
    await db.commit()
