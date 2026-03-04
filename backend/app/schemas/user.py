"""
User Schemas
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from app.models.user import UserRole


class UserBase(BaseModel):
    """Base user schema"""

    email: EmailStr
    full_name: Optional[str] = None
    job_title: Optional[str] = None


class UserCreate(UserBase):
    """User creation schema"""

    password: str = Field(..., min_length=8)
    role: UserRole = UserRole.USER


class UserUpdate(BaseModel):
    """User update schema"""

    full_name: Optional[str] = None
    job_title: Optional[str] = None
    avatar_url: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None


class UserResponse(UserBase):
    """User response schema"""

    id: int
    tenant_id: int
    role: UserRole
    is_active: bool
    is_verified: bool
    avatar_url: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
