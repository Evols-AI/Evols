"""
Initiative Model
Product initiatives/features on the roadmap
"""

from sqlalchemy import Column, String, Text, Integer, ForeignKey, Float, Table, Enum as SQLEnum, JSON
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from enum import Enum

from app.models.base import TenantScopedModel
from app.core.database import Base

# Association table for many-to-many relationship between themes and initiatives
theme_initiative = Table(
    "theme_initiative",
    Base.metadata,
    Column("theme_id", Integer, ForeignKey("theme.id"), primary_key=True),
    Column("initiative_id", Integer, ForeignKey("initiative.id"), primary_key=True),
)


class InitiativeStatus(str, Enum):
    """Initiative status"""

    IDEA = "idea"
    BACKLOG = "backlog"
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    LAUNCHED = "launched"
    PAUSED = "paused"
    CANCELLED = "cancelled"


class InitiativeEffort(str, Enum):
    """Effort estimate"""

    SMALL = "small"  # < 2 weeks
    MEDIUM = "medium"  # 2-6 weeks
    LARGE = "large"  # 6-12 weeks
    XLARGE = "xlarge"  # > 12 weeks


class Initiative(TenantScopedModel):
    """
    Product initiative/feature/epic
    """

    __tablename__ = "initiative"

    # Tenant association
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    # Basic Information
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Status
    status = Column(SQLEnum(InitiativeStatus), default=InitiativeStatus.IDEA, nullable=False, index=True)

    # Estimation
    effort = Column(SQLEnum(InitiativeEffort), nullable=True)
    estimated_impact_score = Column(Float, nullable=True)  # 0 to 1

    # Targeting
    target_segments = Column(ARRAY(String), nullable=True)  # Which segments does this serve?

    # Expected Outcomes
    expected_arr_impact = Column(Float, nullable=True)  # Expected ARR impact
    expected_retention_impact = Column(Float, nullable=True)  # Expected retention lift
    expected_activation_impact = Column(Float, nullable=True)  # Expected activation lift

    # Priority
    priority_score = Column(Float, nullable=True)  # Overall priority score (0-100)

    # Metadata
    external_id = Column(String(255), nullable=True)  # ID from Productboard, Jira, etc.
    owner_email = Column(String(255), nullable=True)
    extra_data = Column(JSON, nullable=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="initiatives")
    themes = relationship("Theme", secondary=theme_initiative, back_populates="initiatives")
    decision_options = relationship("DecisionOption", back_populates="initiative")
    projects = relationship("Project", back_populates="initiative", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Initiative(id={self.id}, title='{self.title}', status='{self.status}')>"
