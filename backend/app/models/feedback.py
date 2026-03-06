"""
Feedback Model
Customer feedback from various sources
"""

from sqlalchemy import Column, String, Text, Integer, ForeignKey, Float, Date, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY
from pgvector.sqlalchemy import Vector
from enum import Enum

from app.models.base import TenantScopedModel


class FeedbackCategory(str, Enum):
    """Feedback categorization"""

    FEATURE_REQUEST = "feature_request"
    BUG = "bug"
    TECH_DEBT = "tech_debt"
    IMPROVEMENT = "improvement"
    QUESTION = "question"
    PRAISE = "praise"
    COMPLAINT = "complaint"
    GARBAGE = "garbage"  # Noise/irrelevant


class FeedbackSource(str, Enum):
    """Where feedback came from"""

    INTERCOM = "intercom"
    ZENDESK = "zendesk"
    PRODUCTBOARD = "productboard"
    SALESFORCE = "salesforce"
    GONG = "gong"
    MANUAL_UPLOAD = "manual_upload"
    API = "api"


class Feedback(TenantScopedModel):
    """
    Customer feedback/ticket/feature request
    """

    __tablename__ = "feedback"

    # Tenant association (from TenantScopedModel)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    # Product association (nullable for backward compatibility)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True, index=True)

    # Source Information
    source = Column(SQLEnum(FeedbackSource), nullable=False, index=True)
    source_id = Column(String(255), nullable=True)  # External ID from source system
    source_url = Column(String(512), nullable=True)  # Link to original feedback

    # Content
    title = Column(String(500), nullable=True)
    content = Column(Text, nullable=False)
    raw_content = Column(Text, nullable=True)  # Original unprocessed content

    # Categorization
    category = Column(SQLEnum(FeedbackCategory), nullable=True, index=True)
    auto_category = Column(SQLEnum(FeedbackCategory), nullable=True)  # AI-generated
    manual_category = Column(SQLEnum(FeedbackCategory), nullable=True)  # User override

    # Customer/Account Association
    account_id = Column(Integer, ForeignKey("account.id"), nullable=True, index=True)
    customer_name = Column(String(255), nullable=True)
    customer_email = Column(String(255), nullable=True)
    customer_segment = Column(String(100), nullable=True, index=True)

    # Temporal
    feedback_date = Column(Date, nullable=True, index=True)

    # AI Analysis
    embedding = Column(Vector(1536), nullable=True)  # Text embedding for clustering
    sentiment_score = Column(Float, nullable=True)  # -1 to 1
    urgency_score = Column(Float, nullable=True)  # 0 to 1
    impact_score = Column(Float, nullable=True)  # 0 to 1

    # Theme Assignment
    theme_id = Column(Integer, ForeignKey("theme.id"), nullable=True, index=True)
    theme_confidence = Column(Float, nullable=True)  # How confident the assignment is

    # Metadata
    tags = Column(ARRAY(String), nullable=True)  # Custom tags
    extra_data = Column(JSON, nullable=True)  # Additional data from source

    # Relationships
    tenant = relationship("Tenant", back_populates="feedback_items")
    product = relationship("Product", back_populates="feedback_items")
    account = relationship("Account", back_populates="feedback_items")
    theme = relationship("Theme", back_populates="feedback_items")

    def __repr__(self):
        return f"<Feedback(id={self.id}, category='{self.category}', account_id={self.account_id})>"
