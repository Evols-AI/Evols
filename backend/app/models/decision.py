"""
Decision Models
Decision briefs and options for product decisions
"""

from sqlalchemy import Column, String, Text, Integer, ForeignKey, Float, JSON, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from enum import Enum

from app.models.base import TenantScopedModel


class DecisionStatus(str, Enum):
    """Decision status"""

    DRAFT = "draft"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    IMPLEMENTED = "implemented"
    PAUSED = "paused"
    CANCELLED = "cancelled"


class Decision(TenantScopedModel):
    """
    Product Decision with evidence-backed options
    """

    __tablename__ = "decision"

    # Tenant association
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    # Basic Information
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Context
    objective = Column(Text, nullable=True)  # What are we trying to achieve?
    target_segments = Column(JSON, nullable=True)  # Which segments are we optimizing for?
    time_horizon = Column(String(50), nullable=True)  # Q3 2026, H2 2026, etc.

    # Status
    status = Column(SQLEnum(DecisionStatus), default=DecisionStatus.DRAFT, nullable=False, index=True)

    # Analysis
    problem_statement = Column(Text, nullable=True)
    key_insights = Column(JSON, nullable=True)  # List of insights
    constraints = Column(JSON, nullable=True)  # List of constraints

    # Options (related DecisionOption objects)
    recommended_option_id = Column(Integer, nullable=True)  # Which option is recommended

    # Evidence & Citations
    related_theme_ids = Column(JSON, nullable=True)  # List of theme IDs
    related_feedback_ids = Column(JSON, nullable=True)  # List of feedback IDs
    related_account_ids = Column(JSON, nullable=True)  # List of account IDs

    # Impact Estimates
    estimated_arr_impact = Column(Float, nullable=True)
    estimated_retention_impact = Column(Float, nullable=True)
    affected_accounts_count = Column(Integer, nullable=True)

    # Generated Content
    decision_brief_markdown = Column(Text, nullable=True)  # Full markdown brief
    executive_summary = Column(Text, nullable=True)

    # Outcome Tracking (post-launch)
    actual_arr_impact = Column(Float, nullable=True)
    actual_retention_impact = Column(Float, nullable=True)
    outcome_notes = Column(Text, nullable=True)

    # Ownership
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Metadata
    extra_data = Column(JSON, nullable=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="decisions")
    created_by_user = relationship("User", back_populates="decisions", foreign_keys=[created_by])
    options = relationship("DecisionOption", back_populates="decision", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Decision(id={self.id}, title='{self.title}', status='{self.status}')>"


class DecisionOption(TenantScopedModel):
    """
    Individual option within a decision
    """

    __tablename__ = "decision_option"

    # Tenant association
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    # Decision association
    decision_id = Column(Integer, ForeignKey("decision.id"), nullable=False, index=True)

    # Basic Information
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Analysis
    pros = Column(JSON, nullable=True)  # List of pros
    cons = Column(JSON, nullable=True)  # List of cons
    risks = Column(JSON, nullable=True)  # List of risks

    # Initiatives
    initiative_id = Column(Integer, ForeignKey("initiative.id"), nullable=True)
    related_initiative_ids = Column(JSON, nullable=True)  # Additional initiatives

    # Impact
    estimated_arr_impact = Column(Float, nullable=True)
    estimated_effort = Column(String(50), nullable=True)
    affected_segments = Column(JSON, nullable=True)

    # Scoring
    confidence_score = Column(Float, nullable=True)  # 0 to 1

    # Persona Voting (if used)
    persona_votes = Column(JSON, nullable=True)
    # Example: {
    #   "persona_1": {"vote": "yes", "confidence": 0.8, "reasoning": "..."},
    #   "persona_2": {"vote": "no", "confidence": 0.6, "reasoning": "..."}
    # }

    # Metadata
    is_recommended = Column(Boolean, default=False)
    extra_data = Column(JSON, nullable=True)

    # Relationships
    decision = relationship("Decision", back_populates="options")
    initiative = relationship("Initiative", back_populates="decision_options")

    def __repr__(self):
        return f"<DecisionOption(id={self.id}, title='{self.title}', decision_id={self.decision_id})>"
