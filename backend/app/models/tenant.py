"""
Tenant Model
Multi-tenancy support for organizations
"""

from sqlalchemy import Column, String, Boolean, JSON, Integer
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class Tenant(BaseModel):
    """
    Tenant/Organization model
    Each customer organization is a separate tenant
    """

    __tablename__ = "tenants"

    # Basic Information
    name = Column(String(255), nullable=False, index=True)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    domain = Column(String(255), nullable=True)  # Optional company domain

    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    is_trial = Column(Boolean, default=True, nullable=False)

    # Subscription & Limits
    plan_type = Column(String(50), default="free")  # free, team, business, enterprise
    max_users = Column(Integer, default=5)
    max_storage_gb = Column(Integer, default=10)

    # LLM Configuration (BYOK - Bring Your Own Keys)
    llm_config = Column(JSON, nullable=True)  # {provider, api_key, model, etc.}
    # Example: {
    #   "provider": "azure_openai",
    #   "api_key": "encrypted_key",
    #   "endpoint": "https://...",
    #   "model": "gpt-4",
    #   "embedding_model": "text-embedding-ada-002"
    # }

    # Settings & Preferences
    settings = Column(JSON, nullable=True, default=dict)
    # Example: {
    #   "theme": "light",
    #   "timezone": "UTC",
    #   "default_confidence_threshold": 0.7,
    #   "persona_refresh_enabled": false,
    #   "persona_refresh_interval_days": 7,
    #   "persona_last_refresh_date": "2025-02-27T10:00:00"
    # }

    # Relationships
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    feedback_items = relationship("Feedback", back_populates="tenant", cascade="all, delete-orphan")
    themes = relationship("Theme", back_populates="tenant", cascade="all, delete-orphan")
    initiatives = relationship("Initiative", back_populates="tenant", cascade="all, delete-orphan")
    accounts = relationship("Account", back_populates="tenant", cascade="all, delete-orphan")
    personas = relationship("Persona", back_populates="tenant", cascade="all, delete-orphan")
    decisions = relationship("Decision", back_populates="tenant", cascade="all, delete-orphan")
    knowledge_sources = relationship("KnowledgeSource", back_populates="tenant", cascade="all, delete-orphan")
    capabilities = relationship("Capability", back_populates="tenant", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="tenant", cascade="all, delete-orphan")
    prompts = relationship("Prompt", back_populates="tenant", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Tenant(id={self.id}, name='{self.name}', slug='{self.slug}')>"
