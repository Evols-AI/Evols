"""
Project Schemas
Pydantic models for project API requests and responses
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
from app.models.project import ProjectEffort, ProjectStatus


class ProjectBase(BaseModel):
    """Base project schema"""
    title: str = Field(..., min_length=1, max_length=255, description="Project title")
    description: Optional[str] = Field(None, description="Project description")
    effort: ProjectEffort = Field(..., description="Effort estimate: small/medium/large/xlarge")
    is_boulder: bool = Field(False, description="True for boulders (large work), False for pebbles (quick wins)")


class ProjectCreate(ProjectBase):
    """Project creation schema"""
    initiative_id: int = Field(..., description="Parent initiative ID")
    status: ProjectStatus = Field(default=ProjectStatus.BACKLOG, description="Project status")
    acceptance_criteria: Optional[List[str]] = Field(None, description="Success criteria")


class ProjectUpdate(BaseModel):
    """Project update schema"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    effort: Optional[ProjectEffort] = None
    is_boulder: Optional[bool] = None
    acceptance_criteria: Optional[List[str]] = None


class ProjectResponse(ProjectBase):
    """Project response schema with RICE scores"""
    id: int
    tenant_id: int
    product_id: Optional[int] = None
    initiative_id: int
    status: ProjectStatus

    # RICE components
    reach: Optional[int] = Field(None, description="Total accounts affected")
    persona_weight: Optional[float] = Field(None, description="Weighted persona relevance (0-1)")
    confidence: Optional[float] = Field(None, description="Average theme confidence (0-1)")
    effort_score: Optional[int] = Field(None, description="Effort multiplier: 1/2/4/8")
    priority_score: Optional[float] = Field(None, description="RICE priority score")

    # Metadata
    acceptance_criteria: Optional[List[str]] = None
    matched_persona_ids: Optional[List[int]] = Field(None, description="IDs of matched personas")
    overlapping_capability_ids: Optional[List[int]] = Field(None, description="IDs of overlapping capabilities")

    # Timestamps
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectGenerateRequest(BaseModel):
    """Request to generate projects for initiatives"""
    initiative_ids: Optional[List[int]] = Field(
        None,
        description="Initiative IDs to generate projects for. If None, generates for all initiatives."
    )


class ProjectGenerateResponse(BaseModel):
    """Response from project generation"""
    success: bool
    message: str
    projects_created: int
    initiatives_processed: int
