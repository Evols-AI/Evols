"""
Product Model
Represents a product within a tenant for multi-product support
"""

from sqlalchemy import Column, String, Text, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.base import TenantScopedModel


class Product(TenantScopedModel):
    """Product model for multi-product support within a tenant"""

    __tablename__ = "products"

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_demo = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships to tenant-scoped data
    feedback_items = relationship(
        "Feedback",
        back_populates="product",
        cascade="all, delete-orphan"
    )
    themes = relationship(
        "Theme",
        back_populates="product",
        cascade="all, delete-orphan"
    )
    initiatives = relationship(
        "Initiative",
        back_populates="product",
        cascade="all, delete-orphan"
    )
    projects = relationship(
        "Project",
        back_populates="product",
        cascade="all, delete-orphan"
    )
    personas = relationship(
        "Persona",
        back_populates="product",
        cascade="all, delete-orphan"
    )
    capabilities = relationship(
        "Capability",
        back_populates="product",
        cascade="all, delete-orphan"
    )
    knowledge_sources = relationship(
        "KnowledgeSource",
        back_populates="product",
        cascade="all, delete-orphan"
    )
    context_sources = relationship(
        "ContextSource",
        back_populates="product",
        cascade="all, delete-orphan"
    )
    extracted_entities = relationship(
        "ExtractedEntity",
        back_populates="product",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Product(id={self.id}, name='{self.name}', tenant_id={self.tenant_id}, is_demo={self.is_demo})>"
