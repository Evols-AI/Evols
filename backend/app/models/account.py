"""
Account Model
Customer accounts/companies from CRM
"""

from sqlalchemy import Column, String, Integer, ForeignKey, Float, Boolean, JSON, Date
from sqlalchemy.orm import relationship

from app.models.base import TenantScopedModel


class Account(TenantScopedModel):
    """
    Customer account/company from CRM
    """

    __tablename__ = "account"

    # Tenant association
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    # Basic Information
    name = Column(String(255), nullable=False, index=True)
    external_id = Column(String(255), nullable=True)  # CRM ID (Salesforce, HubSpot, etc.)

    # Segmentation
    segment = Column(String(100), nullable=True, index=True)  # SMB, Mid-Market, Enterprise
    industry = Column(String(100), nullable=True)
    company_size = Column(String(50), nullable=True)  # e.g., "50-200 employees"

    # Financial
    arr = Column(Float, nullable=True)  # Annual Recurring Revenue
    mrr = Column(Float, nullable=True)  # Monthly Recurring Revenue
    lifetime_value = Column(Float, nullable=True)

    # Status
    is_active = Column(Boolean, default=True)
    churn_risk_score = Column(Float, nullable=True)  # 0 to 1
    health_score = Column(Float, nullable=True)  # 0 to 100

    # Dates
    signup_date = Column(Date, nullable=True)
    first_purchase_date = Column(Date, nullable=True)
    last_interaction_date = Column(Date, nullable=True)

    # Contact
    primary_contact_name = Column(String(255), nullable=True)
    primary_contact_email = Column(String(255), nullable=True)
    primary_contact_role = Column(String(100), nullable=True)

    # Additional Data
    extra_data = Column(JSON, nullable=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="accounts")
    feedback_items = relationship("Feedback", back_populates="account")
    context_sources = relationship("ContextSource", back_populates="account")

    def __repr__(self):
        return f"<Account(id={self.id}, name='{self.name}', segment='{self.segment}', arr={self.arr})>"
