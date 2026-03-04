"""
Tenant Schemas
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class TenantBase(BaseModel):
    """Base tenant schema"""

    name: str = Field(..., min_length=1, max_length=255)
    domain: Optional[str] = None


class TenantCreate(TenantBase):
    """Tenant creation schema"""

    slug: str = Field(..., min_length=3, max_length=100)


class TenantUpdate(BaseModel):
    """Tenant update schema"""

    name: Optional[str] = None
    domain: Optional[str] = None
    llm_config: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None


class TenantResponse(TenantBase):
    """Tenant response schema"""

    id: int
    slug: str
    is_active: bool
    is_trial: bool
    plan_type: str
    max_users: int
    max_storage_gb: int
    settings: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TenantLLMConfig(BaseModel):
    """LLM Configuration for tenant (BYOK)"""

    provider: str = Field(..., description="openai, azure_openai, anthropic")
    api_key: str
    endpoint: Optional[str] = None
    model: str = "gpt-4-turbo-preview"
    embedding_model: str = "text-embedding-3-small"
    temperature: float = Field(default=0.0, ge=0.0, le=2.0)
