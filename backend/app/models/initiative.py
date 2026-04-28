"""
Initiative Model
Product initiatives/features on the roadmap
"""

from sqlalchemy import Column, String, Text, Integer, ForeignKey, Float, Enum as SQLEnum, JSON
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from enum import Enum

from app.models.base import TenantScopedModel


class InitiativeStatus(str, Enum):
    IDEA = "idea"
    BACKLOG = "backlog"
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    LAUNCHED = "launched"
    PAUSED = "paused"
    CANCELLED = "cancelled"


class InitiativeEffort(str, Enum):
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    XLARGE = "xlarge"


class Initiative(TenantScopedModel):
    __tablename__ = "initiative"

    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(SQLEnum(InitiativeStatus), default=InitiativeStatus.IDEA, nullable=False, index=True)
    effort = Column(SQLEnum(InitiativeEffort), nullable=True)
    estimated_impact_score = Column(Float, nullable=True)
    target_segments = Column(ARRAY(String), nullable=True)
    expected_arr_impact = Column(Float, nullable=True)
    expected_retention_impact = Column(Float, nullable=True)
    expected_activation_impact = Column(Float, nullable=True)
    priority_score = Column(Float, nullable=True)
    external_id = Column(String(255), nullable=True)
    owner_email = Column(String(255), nullable=True)
    extra_data = Column(JSON, nullable=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="initiatives")
    decision_options = relationship("DecisionOption", back_populates="initiative")
    projects = relationship("Project", back_populates="initiative", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Initiative(id={self.id}, title='{self.title}', status='{self.status}')>"
