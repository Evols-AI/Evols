"""
Persona Schemas
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime
from enum import Enum


class PersonaStatus(str, Enum):
    """Persona lifecycle status"""
    NEW = "new"
    ACTIVE = "active"
    INACTIVE = "inactive"


class PersonaBase(BaseModel):
    """Base persona schema"""

    name: str = Field(..., min_length=1, max_length=255)
    segment: Optional[str] = None
    description: Optional[str] = None


class PersonaCreate(PersonaBase):
    """Persona creation schema - manually or generated"""

    persona_summary: str
    product_id: Optional[int] = None
    key_pain_points: Optional[List[str]] = None
    buying_triggers: Optional[List[str]] = None
    feature_priorities: Optional[List[str]] = None
    budget_authority_min: Optional[float] = None
    budget_authority_max: Optional[float] = None
    confidence_score: Optional[float] = None
    status: Optional[PersonaStatus] = PersonaStatus.NEW
    extra_data: Optional[Dict[str, Any]] = None


class PersonaUpdate(BaseModel):
    """Persona update schema - allows editing persona details"""

    name: Optional[str] = None
    segment: Optional[str] = None
    description: Optional[str] = None
    persona_summary: Optional[str] = None
    key_pain_points: Optional[List[str]] = None
    buying_triggers: Optional[List[str]] = None
    feature_priorities: Optional[List[str]] = None


class PersonaStatusUpdate(BaseModel):
    """Persona status update schema"""

    status: PersonaStatus

    @validator('status')
    def validate_status(cls, v):
        if v == PersonaStatus.NEW:
            raise ValueError("Cannot manually set status to 'new'. Status 'new' is only auto-assigned.")
        return v


class PersonaResponse(PersonaBase):
    """Persona response schema"""

    id: int
    tenant_id: int
    product_id: Optional[int] = None
    persona_summary: str
    company_size_range: Optional[str] = None
    industry: Optional[str] = None
    key_pain_points: Optional[List[str]] = None
    buying_triggers: Optional[List[str]] = None
    feature_priorities: Optional[List[str]] = None
    budget_authority_min: Optional[float] = None
    budget_authority_max: Optional[float] = None
    typical_decision_time_days: Optional[int] = None
    based_on_feedback_count: int
    based_on_interview_count: int
    based_on_deal_count: int
    confidence_score: Optional[float] = None
    data_freshness_days: Optional[int] = None
    status: PersonaStatus
    extra_data: Optional[Dict[str, Any]] = None  # Includes revenue_contribution, usage_frequency
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PersonaGenerateRequest(BaseModel):
    """Request to auto-generate personas from data"""

    segment: Optional[str] = None  # Generate for specific segment
    min_feedback_count: int = Field(default=10, ge=5)
    max_personas: int = Field(default=5, ge=1, le=20)


class PersonaSimulateRequest(BaseModel):
    """Request to simulate persona response"""

    persona_id: int
    question: str = Field(..., min_length=1)
    context: Optional[Dict[str, Any]] = None  # Additional context


class PersonaSimulateResponse(BaseModel):
    """Persona simulation response"""

    persona_id: int
    persona_name: str
    question: str
    response: str
    reasoning: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    citations: List[Dict[str, Any]]  # References to feedback, themes
    timestamp: datetime


class PersonaVoteRequest(BaseModel):
    """Request for personas to vote on options"""

    persona_ids: List[int]
    question: str
    options: List[Dict[str, Any]]  # List of options with title, description
    # Example: [{"id": "A", "title": "Enterprise features", "description": "..."}]


class PersonaVote(BaseModel):
    """Single persona vote"""

    persona_id: int
    persona_name: str
    segment: Optional[str] = None
    choice: Optional[str] = None  # Changed from selected_option_id to match service response
    reasoning: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    citations: Optional[List[Dict[str, Any]]] = None


class PersonaVoteResponse(BaseModel):
    """Response from persona voting"""

    question: str
    votes: List[PersonaVote]
    summary: str  # AI-generated summary of voting results
    recommendation: Optional[str] = None  # Which option is recommended


class PersonaMergeRequest(BaseModel):
    """Request to merge multiple personas into one"""

    persona_ids: List[int] = Field(..., min_length=2, description="IDs of personas to merge")
    primary_persona_id: int = Field(..., description="Primary persona to keep")
