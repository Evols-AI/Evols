"""
Persona Model
Digital twin personas for product validation
"""

from sqlalchemy import Column, String, Text, Integer, ForeignKey, Float, JSON
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship

from app.models.base import TenantScopedModel


class Persona(TenantScopedModel):
    """
    Digital Twin Persona
    Auto-generated from customer data for validation and trade-off decisions
    """

    __tablename__ = "persona"

    # Tenant association
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    # Product association (nullable for backward compatibility)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True, index=True)

    # Basic Information
    name = Column(String(255), nullable=False)  # e.g., "Mid-Market SaaS CFO"
    description = Column(Text, nullable=True)

    # Segmentation
    segment = Column(String(100), nullable=True, index=True)
    company_size_range = Column(String(50), nullable=True)  # e.g., "50-200 employees"
    industry = Column(String(100), nullable=True)

    # Profile (AI-generated from feedback and customer data)
    persona_summary = Column(Text, nullable=False)
    # Example: "CFO at mid-market SaaS company. Values automation and compliance.
    #          Budget authority $20K-100K. Decision speed 2-3 months."

    key_pain_points = Column(JSON, nullable=True)
    # Example: ["Manual reporting", "Spreadsheet hell", "SOC2 compliance"]

    buying_triggers = Column(JSON, nullable=True)
    # Example: ["SOC2 requirement", "Revenue > $10M", "Series B funding"]

    feature_priorities = Column(JSON, nullable=True)
    # Example: ["compliance", "automation", "integrations"]

    # Budget & Decision-Making
    budget_authority_min = Column(Float, nullable=True)
    budget_authority_max = Column(Float, nullable=True)
    typical_decision_time_days = Column(Integer, nullable=True)

    # Data Sources (what this persona is based on)
    based_on_feedback_count = Column(Integer, default=0)
    based_on_interview_count = Column(Integer, default=0)
    based_on_deal_count = Column(Integer, default=0)
    based_on_account_ids = Column(ARRAY(Integer), nullable=True)  # Which accounts contributed

    # Quality Metrics
    confidence_score = Column(Float, nullable=True)  # 0 to 1 - How confident is this persona?
    data_freshness_days = Column(Integer, nullable=True)  # How old is the data?

    # Metadata
    extra_data = Column(JSON, nullable=True)

    # Lifecycle Status
    status = Column(
        String(20),
        nullable=False,
        default='new',
        index=True,
        comment="Persona lifecycle status: new, advisor, dismissed"
    )

    # Relationships
    tenant = relationship("Tenant", back_populates="personas")
    product = relationship("Product", back_populates="personas")

    def __repr__(self):
        return f"<Persona(id={self.id}, name='{self.name}', segment='{self.segment}')>"
