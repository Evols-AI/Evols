"""
Product RAG (Retrieval-Augmented Generation) Models
Stores product documentation, capabilities, and architectural information for RAG system
"""

from sqlalchemy import Column, String, Text, Integer, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.base import TenantScopedModel


class KnowledgeSource(TenantScopedModel):
    """
    Knowledge Source - Documentation, PDFs, GitHub repos, MCP servers
    """
    __tablename__ = "knowledge_sources"

    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    # Source details
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False, index=True)  # url, pdf, github, mcp
    description = Column(Text, nullable=True)

    # Source location
    url = Column(String(1000), nullable=True)  # For URL and GitHub
    file_path = Column(String(500), nullable=True)  # For uploaded PDFs
    mcp_endpoint = Column(String(500), nullable=True)  # For MCP servers
    github_repo = Column(String(255), nullable=True)  # For GitHub repos

    # Processing status
    status = Column(String(50), nullable=False, default='pending')  # pending, processing, completed, failed
    error_message = Column(Text, nullable=True)
    capabilities_extracted = Column(Integer, default=0)

    # Metadata
    extra_data = Column(JSON, nullable=True)
    last_synced_at = Column(DateTime, nullable=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="knowledge_sources")
    capabilities = relationship("Capability", back_populates="source", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<KnowledgeSource(id={self.id}, name='{self.name}', type='{self.type}')>"


class Capability(TenantScopedModel):
    """
    Product Capability - Extracted from knowledge sources
    Represents features, APIs, components, etc.
    """
    __tablename__ = "capabilities"

    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    source_id = Column(Integer, ForeignKey("knowledge_sources.id"), nullable=False, index=True)

    # Capability details
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=False)
    category = Column(String(100), nullable=True, index=True)  # api, feature, component, service

    # Technical details
    endpoints = Column(JSON, nullable=True)  # API endpoints if applicable
    dependencies = Column(JSON, nullable=True)  # List of capability names it depends on
    dependents = Column(JSON, nullable=True)  # List of capabilities that depend on this

    # Documentation references
    source_url = Column(String(1000), nullable=True)
    source_section = Column(String(500), nullable=True)

    # Metadata
    extra_data = Column(JSON, nullable=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="capabilities")
    source = relationship("KnowledgeSource", back_populates="capabilities")

    def __repr__(self):
        return f"<Capability(id={self.id}, name='{self.name}', category='{self.category}')>"
