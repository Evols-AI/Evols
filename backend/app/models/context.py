"""
Context Models
Unified context ingestion system for customer feedback, product docs, meetings, and more
"""

from sqlalchemy import Column, String, Text, Integer, ForeignKey, Float, Date, JSON, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY
from pgvector.sqlalchemy import Vector
from enum import Enum
from datetime import datetime

from app.models.base import TenantScopedModel


class ContextSourceType(str, Enum):
    """Type of context source"""

    # Structured data
    CSV_SURVEY = "csv_survey"
    USAGE_DATA = "usage_data"
    NPS_CSAT = "nps_csat"
    ANALYTICS_EXPORT = "analytics_export"

    # Unstructured data
    MEETING_TRANSCRIPT = "meeting_transcript"
    EMAIL = "email"
    SLACK_CONVERSATION = "slack_conversation"
    DOCUMENT_PDF = "document_pdf"
    DOCUMENT_WORD = "document_word"
    DOCUMENT_NOTION = "document_notion"
    WEB_PAGE = "web_page"

    # Support & feedback
    SUPPORT_TICKET = "support_ticket"
    INTERCOM = "intercom"
    ZENDESK = "zendesk"
    PRODUCTBOARD = "productboard"

    # External research
    COMPETITOR_RESEARCH = "competitor_research"
    MARKET_RESEARCH = "market_research"

    # Real-time integrations
    SLACK_INTEGRATION = "slack_integration"
    GOOGLE_MEET = "google_meet"
    CONFLUENCE = "confluence"
    GMAIL_API = "gmail_api"

    # Code & technical
    GITHUB_REPO = "github_repo"
    API_DOCS = "api_docs"
    MCP_SERVER = "mcp_server"

    # Manual/Other
    MANUAL_UPLOAD = "manual_upload"
    API = "api"


class ContextProcessingStatus(str, Enum):
    """Processing status for context sources"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIALLY_COMPLETED = "partially_completed"


class EntityType(str, Enum):
    """Types of entities that can be extracted from context"""
    PERSONA = "persona"
    PAIN_POINT = "pain_point"
    USE_CASE = "use_case"
    FEATURE_REQUEST = "feature_request"
    PRODUCT_CAPABILITY = "product_capability"
    STAKEHOLDER = "stakeholder"
    COMPETITOR = "competitor"
    TECHNICAL_REQUIREMENT = "technical_requirement"
    BUSINESS_GOAL = "business_goal"
    METRIC = "metric"
    QUOTE = "quote"


class ContextSource(TenantScopedModel):
    """
    Unified context source - replaces both Feedback and KnowledgeSource
    Stores any type of structured or unstructured data for context extraction
    """
    __tablename__ = "context_sources"

    # Tenant & Product association
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True, index=True)

    # Source Information
    source_type = Column(SQLEnum(ContextSourceType), nullable=False, index=True)
    name = Column(String(500), nullable=False)  # User-defined or auto-generated name
    description = Column(Text, nullable=True)

    # External identifiers
    source_id = Column(String(255), nullable=True)  # External ID from source system
    source_url = Column(String(1000), nullable=True)  # Link to original source

    # Content
    title = Column(String(500), nullable=True)
    content = Column(Text, nullable=True)  # Main text content
    raw_content = Column(Text, nullable=True)  # Original unprocessed content
    file_path = Column(String(500), nullable=True)  # For uploaded files

    # Source-specific fields
    mcp_endpoint = Column(String(500), nullable=True)  # For MCP servers
    github_repo = Column(String(255), nullable=True)  # For GitHub repos
    api_config = Column(JSON, nullable=True)  # For API integrations

    # Customer/Account Association (for feedback-type sources)
    account_id = Column(Integer, ForeignKey("account.id"), nullable=True, index=True)
    customer_name = Column(String(255), nullable=True)
    customer_email = Column(String(255), nullable=True)
    customer_segment = Column(String(100), nullable=True, index=True)

    # Temporal
    source_date = Column(Date, nullable=True, index=True)  # Date of original content
    last_synced_at = Column(DateTime, nullable=True)  # For integrations

    # Processing Status
    status = Column(SQLEnum(ContextProcessingStatus), nullable=False, default=ContextProcessingStatus.PENDING, index=True)
    error_message = Column(Text, nullable=True)
    entities_extracted_count = Column(Integer, default=0)

    # AI Analysis
    embedding = Column(Vector(1536), nullable=True)  # Text embedding for similarity
    sentiment_score = Column(Float, nullable=True)  # -1 to 1 (for feedback sources)
    urgency_score = Column(Float, nullable=True)  # 0 to 1
    impact_score = Column(Float, nullable=True)  # 0 to 1

    # Theme Assignment (for feedback sources)
    theme_id = Column(Integer, ForeignKey("theme.id"), nullable=True, index=True)
    theme_confidence = Column(Float, nullable=True)

    # Metadata
    tags = Column(ARRAY(String), nullable=True)  # Custom tags
    extra_data = Column(JSON, nullable=True)  # Source-specific metadata

    # Relationships
    tenant = relationship("Tenant", back_populates="context_sources")
    product = relationship("Product", back_populates="context_sources")
    account = relationship("Account", back_populates="context_sources")
    theme = relationship("Theme", back_populates="context_sources")
    extracted_entities = relationship("ExtractedEntity", back_populates="source", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ContextSource(id={self.id}, type='{self.source_type}', name='{self.name}')>"


class ExtractedEntity(TenantScopedModel):
    """
    Entities extracted from context sources
    Represents personas, pain points, capabilities, competitors, etc.
    """
    __tablename__ = "extracted_entities"

    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True, index=True)
    source_id = Column(Integer, ForeignKey("context_sources.id"), nullable=False, index=True)

    # Entity details
    entity_type = Column(SQLEnum(EntityType), nullable=False, index=True)
    name = Column(String(500), nullable=False, index=True)
    description = Column(Text, nullable=False)

    # Context
    context_snippet = Column(Text, nullable=True)  # Original text where entity was found
    confidence_score = Column(Float, nullable=True)  # 0 to 1

    # Categorization
    category = Column(String(100), nullable=True, index=True)
    subcategory = Column(String(100), nullable=True)

    # Relationships (for linking entities)
    related_persona_id = Column(Integer, ForeignKey("persona.id"), nullable=True, index=True)
    related_capability_id = Column(Integer, ForeignKey("capabilities.id"), nullable=True, index=True)

    # Rich metadata
    attributes = Column(JSON, nullable=True)
    # For personas: {"job_title": "PM", "company_size": "50-200", "pain_points": [...]}
    # For capabilities: {"endpoints": [...], "dependencies": [...]}
    # For competitors: {"strengths": [...], "weaknesses": [...]}
    # For quotes: {"speaker": "John Doe", "role": "CEO"}

    # Source reference
    source_url = Column(String(1000), nullable=True)
    source_section = Column(String(500), nullable=True)

    # Embedding for similarity search
    embedding = Column(Vector(1536), nullable=True)

    # Metadata
    extra_data = Column(JSON, nullable=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="extracted_entities")
    product = relationship("Product", back_populates="extracted_entities")
    source = relationship("ContextSource", back_populates="extracted_entities")
    related_persona = relationship("Persona")
    related_capability = relationship("Capability")

    def __repr__(self):
        return f"<ExtractedEntity(id={self.id}, type='{self.entity_type}', name='{self.name}')>"
