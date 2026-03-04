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
    tenant_slug: str = Field(..., min_length=3, max_length=100)  # Create or join tenant


class Token(BaseModel):
    """JWT token response"""

    access_token: str
    token_type: str = "bearer"
    user_id: int
    tenant_id: int
    role: str
    email: str
    full_name: str


class TokenData(BaseModel):
    """Token payload data"""

    user_id: int
    email: str
    tenant_id: int
    role: str
