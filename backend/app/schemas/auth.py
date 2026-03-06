"""
Authentication Schemas
"""

from pydantic import BaseModel, EmailStr, Field


class UserLogin(BaseModel):
    """Login request"""

    email: EmailStr
    password: str = Field(..., min_length=8)


class UserRegister(BaseModel):
    """Registration request"""

    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=1, max_length=255)
    tenant_slug: str | None = Field(None, min_length=3, max_length=100)  # Create or join tenant (optional for SUPER_ADMIN)
    is_super_admin: bool = False  # Set to true to create SUPER_ADMIN (requires special auth)


class Token(BaseModel):
    """JWT token response"""

    access_token: str
    token_type: str = "bearer"
    user_id: int
    tenant_id: int | None  # None for SUPER_ADMIN
    role: str
    email: str
    full_name: str | None


class TokenData(BaseModel):
    """Token payload data"""

    user_id: int
    email: str
    tenant_id: int | None  # None for SUPER_ADMIN
    role: str
