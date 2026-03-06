"""
Theme Schemas
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class ThemeBase(BaseModel):
    """Base theme schema"""

    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class ThemeCreate(ThemeBase):
    """Theme creation schema"""

    pass


class ThemeUpdate(BaseModel):
    """Theme update schema"""

    title: Optional[str] = None
    description: Optional[str] = None
    urgency_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    impact_score: Optional[float] = Field(None, ge=0.0, le=1.0)


class ThemeResponse(ThemeBase):
    """Theme response schema"""

    id: int
    tenant_id: int
    product_id: Optional[int] = None
    summary: Optional[str] = None
    primary_category: Optional[str] = None
    feedback_count: int
    account_count: int
    total_arr: float
    urgency_score: Optional[float] = None
    impact_score: Optional[float] = None
    confidence_score: Optional[float] = None
    trend: Optional[str] = None
    trend_percentage: Optional[float] = None
    affected_segments: Optional[List[str]] = None
    key_quotes: Optional[List[Dict[str, Any]]] = None
    suggested_solutions: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ThemeFilter(BaseModel):
    """Theme filtering parameters"""

    min_arr: Optional[float] = Field(None, ge=0.0)
    min_feedback_count: Optional[int] = Field(None, ge=1)
    segment: Optional[str] = None
    category: Optional[str] = None
    min_urgency: Optional[float] = Field(None, ge=0.0, le=1.0)


class ThemeClusterRequest(BaseModel):
    """Request to trigger theme clustering"""

    feedback_ids: Optional[List[int]] = None  # If None, cluster all unassigned
    min_cluster_size: int = Field(default=3, ge=2)
    max_clusters: Optional[int] = Field(None, ge=1)
