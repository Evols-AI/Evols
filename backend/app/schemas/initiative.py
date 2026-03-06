"""
Initiative Schemas
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from app.models.initiative import InitiativeStatus, InitiativeEffort


class InitiativeBase(BaseModel):
    """Base initiative schema"""

    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    target_segments: Optional[List[str]] = None


class InitiativeCreate(InitiativeBase):
    """Initiative creation schema"""

    status: InitiativeStatus = InitiativeStatus.IDEA
    effort: Optional[InitiativeEffort] = None
    theme_ids: Optional[List[int]] = None  # Link to themes


class InitiativeUpdate(BaseModel):
    """Initiative update schema"""

    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[InitiativeStatus] = None
    effort: Optional[InitiativeEffort] = None
    target_segments: Optional[List[str]] = None
    estimated_impact_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    expected_arr_impact: Optional[float] = None
    expected_retention_impact: Optional[float] = Field(None, ge=0.0, le=1.0)
    expected_activation_impact: Optional[float] = Field(None, ge=0.0, le=1.0)
    priority_score: Optional[float] = Field(None, ge=0.0, le=100.0)


class ThemeSummary(BaseModel):
    """Lightweight theme summary for initiative response"""
    id: int
    title: str
    summary: Optional[str] = None
    feedback_count: int = 0
    account_count: int = 0
    urgency_score: Optional[float] = None
    impact_score: Optional[float] = None

    class Config:
        from_attributes = True


class InitiativeResponse(InitiativeBase):
    """Initiative response schema"""

    id: int
    tenant_id: int
    product_id: Optional[int] = None
    status: InitiativeStatus
    effort: Optional[InitiativeEffort] = None
    estimated_impact_score: Optional[float] = None
    expected_arr_impact: Optional[float] = None
    expected_retention_impact: Optional[float] = None
    expected_activation_impact: Optional[float] = None
    priority_score: Optional[float] = None
    owner_email: Optional[str] = None
    themes: List[ThemeSummary] = []  # Linked themes
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InitiativeFilter(BaseModel):
    """Initiative filtering parameters"""

    status: Optional[InitiativeStatus] = None
    effort: Optional[InitiativeEffort] = None
    segment: Optional[str] = None
    min_priority: Optional[float] = Field(None, ge=0.0, le=100.0)
