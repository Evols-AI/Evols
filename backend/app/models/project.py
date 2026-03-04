"""
Project Model
Concrete work items (boulders & pebbles) under initiatives
"""

from sqlalchemy import Column, String, Text, Integer, ForeignKey, Float, Boolean, Enum as SQLEnum, JSON, ARRAY
from sqlalchemy.orm import relationship
from enum import Enum

from app.models.base import TenantScopedModel


class ProjectEffort(str, Enum):
    """Project effort/size"""
    SMALL = "small"      # Pebble: 1-3 days
    MEDIUM = "medium"    # Small boulder: 1-2 weeks
    LARGE = "large"      # Boulder: 2-4 weeks
    XLARGE = "xlarge"    # Big boulder: 4+ weeks


class ProjectStatus(str, Enum):
    """Project status"""
    BACKLOG = "backlog"
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Project(TenantScopedModel):
    """
    Project/Work Item - concrete implementation task
    Auto-generated from initiatives using LLM

    Priority calculated using RICE formula:
    Priority = (Reach × PersonaWeight × Confidence) / Effort

    Where:
    - Reach = theme.account_count (how many customers affected)
    - PersonaWeight = weighted avg of (revenue_contribution × usage_frequency) for matching personas
    - Confidence = theme.confidence_score (0-1)
    - Effort = {small: 1, medium: 2, large: 4, xlarge: 8}
    """

    __tablename__ = "project"

    # Tenant association
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    # Parent initiative
    initiative_id = Column(Integer, ForeignKey("initiative.id"), nullable=False, index=True)

    # Basic Information
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Type & Effort
    effort = Column(SQLEnum(ProjectEffort), nullable=False, index=True)
    is_boulder = Column(Boolean, default=False)  # boulder (large/xlarge) vs pebble (small/medium)

    # Status
    status = Column(SQLEnum(ProjectStatus), default=ProjectStatus.BACKLOG, nullable=False, index=True)

    # RICE Components
    reach = Column(Integer, nullable=True, comment="Total accounts affected (from linked themes)")
    persona_weight = Column(Float, nullable=True, comment="Weighted avg of persona relevance (0-1)")
    confidence = Column(Float, nullable=True, comment="Average theme confidence (0-1)")
    effort_score = Column(Integer, nullable=True, comment="Effort multiplier: small=1, medium=2, large=4, xlarge=8")
    priority_score = Column(Float, nullable=True, index=True, comment="RICE priority: (R × PW × C) / E")

    # Acceptance Criteria (AI-generated)
    acceptance_criteria = Column(JSON, nullable=True, comment="Array of success criteria strings")

    # Matched personas (for persona_weight calculation)
    matched_persona_ids = Column(ARRAY(Integer), nullable=True, comment="IDs of personas matched via embeddings")

    # Matched capabilities (to avoid duplicates)
    overlapping_capability_ids = Column(ARRAY(Integer), nullable=True, comment="IDs of capabilities this might duplicate")

    # Metadata
    extra_data = Column(JSON, nullable=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="projects")
    initiative = relationship("Initiative", back_populates="projects")

    def __repr__(self):
        return f"<Project(id={self.id}, title='{self.title}', effort='{self.effort.value}', priority={self.priority_score})>"
