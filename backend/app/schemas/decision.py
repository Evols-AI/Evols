"""
Decision Schemas
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from app.models.decision import DecisionStatus


class DecisionOptionBase(BaseModel):
    """Base decision option schema"""

    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    pros: Optional[List[str]] = None
    cons: Optional[List[str]] = None
    risks: Optional[List[str]] = None


class DecisionOptionCreate(DecisionOptionBase):
    """Decision option creation schema"""

    initiative_id: Optional[int] = None
    related_initiative_ids: Optional[List[int]] = None
    estimated_arr_impact: Optional[float] = None
    estimated_effort: Optional[str] = None
    affected_segments: Optional[List[str]] = None


class DecisionOptionResponse(DecisionOptionBase):
    """Decision option response schema"""

    id: int
    decision_id: int
    initiative_id: Optional[int] = None
    estimated_arr_impact: Optional[float] = None
    estimated_effort: Optional[str] = None
    affected_segments: Optional[List[str]] = None
    confidence_score: Optional[float] = None
    persona_votes: Optional[Dict[str, Any]] = None
    is_recommended: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DecisionBase(BaseModel):
    """Base decision schema"""

    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    objective: Optional[str] = None


class DecisionCreate(DecisionBase):
    """Decision creation schema"""

    target_segments: Optional[List[str]] = None
    time_horizon: Optional[str] = None
    constraints: Optional[List[str]] = None
    options: Optional[List[DecisionOptionCreate]] = None


class DecisionUpdate(BaseModel):
    """Decision update schema"""

    title: Optional[str] = None
    description: Optional[str] = None
    objective: Optional[str] = None
    status: Optional[DecisionStatus] = None
    recommended_option_id: Optional[int] = None
    outcome_notes: Optional[str] = None


class DecisionResponse(DecisionBase):
    """Decision response schema"""

    id: int
    tenant_id: int
    status: DecisionStatus
    target_segments: Optional[List[str]] = None
    time_horizon: Optional[str] = None
    problem_statement: Optional[str] = None
    key_insights: Optional[List[str]] = None
    constraints: Optional[List[str]] = None
    recommended_option_id: Optional[int] = None
    related_theme_ids: Optional[List[int]] = None
    estimated_arr_impact: Optional[float] = None
    affected_accounts_count: Optional[int] = None
    executive_summary: Optional[str] = None
    created_by: int
    created_at: datetime
    updated_at: datetime
    options: List[DecisionOptionResponse] = []

    class Config:
        from_attributes = True


class DecisionGenerateRequest(BaseModel):
    """Request to generate a decision brief"""

    title: str
    objective: str
    target_segments: Optional[List[str]] = None
    time_horizon: Optional[str] = None
    candidate_initiative_ids: Optional[List[int]] = None
    constraints: Optional[List[str]] = None


class DecisionBriefResponse(BaseModel):
    """Generated decision brief"""

    decision_id: int
    title: str
    markdown_content: str  # Full markdown brief
    executive_summary: str
    problem_statement: str
    options: List[DecisionOptionResponse]
    key_insights: List[str]
    citations: List[Dict[str, Any]]  # References to themes, feedback, accounts
    generated_at: datetime
