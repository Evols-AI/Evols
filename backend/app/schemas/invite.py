"""
Tenant Invite Schemas
"""

from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime


class InviteCreate(BaseModel):
    """Create invite request"""

    email: EmailStr
    role: str = Field(default="USER", pattern="^(USER|TENANT_ADMIN)$")
    message: Optional[str] = Field(None, max_length=500)


class InviteResponse(BaseModel):
    """Invite response"""

    id: int
    tenant_id: int
    email: str
    role: str
    invited_by: Optional[int]
    is_accepted: bool
    accepted_at: Optional[datetime]
    expires_at: datetime
    message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class InviteAccept(BaseModel):
    """Accept invite request"""

    token: str = Field(..., min_length=1)
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=1, max_length=255)


class InviteListResponse(BaseModel):
    """List of pending invites"""

    invites: list[InviteResponse]
    total: int
