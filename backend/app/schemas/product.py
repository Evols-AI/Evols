"""
Product Schemas
Request and response models for product management
"""

from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


class ProductBase(BaseModel):
    """Base product schema"""

    name: str = Field(..., min_length=1, max_length=255, description="Product name")
    description: Optional[str] = Field(None, description="Product description")


class ProductCreate(ProductBase):
    """Product creation schema"""

    is_demo: bool = Field(default=False, description="Whether this is a demo product")


class ProductUpdate(BaseModel):
    """Product update schema - allows partial updates"""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    """Product response schema"""

    id: int
    tenant_id: int
    is_demo: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
