"""
Context Models
Unified context ingestion system for customer feedback, product docs, meetings, and more
"""

from sqlalchemy import Column, String, Text, Integer, ForeignKey, Float, Date, JSON, DateTime, Enum as SQLEnum, Boolean, LargeBinary
import sqlalchemy as sa
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

    # Data Retention & Privacy
    retention_policy = Column(String(50), nullable=True, default='30_days')  # delete_immediately, 30_days, 90_days, retain_encrypted
    content_deleted_at = Column(DateTime, nullable=True)  # When content was deleted
    deletion_scheduled_for = Column(DateTime, nullable=True)  # When scheduled for deletion
    content_summary = Column(Text, nullable=True)  # Summary after deletion (e.g., "47 responses, 2.3MB")

    # Encryption (for retain_encrypted policy)
    encrypted_content = Column(sa.LargeBinary, nullable=True)  # Encrypted content blob
    encryption_key_id = Column(String(100), nullable=True)  # Reference to encryption key
    is_encrypted = Column(sa.Boolean, default=False, nullable=False)

    # Access Tracking
    last_accessed_at = Column(DateTime, nullable=True)
    access_count = Column(Integer, default=0, nullable=False)

    # Deduplication
    content_hash = Column(String(64), nullable=True)  # SHA-256 hash of content
    source_group_id = Column(Integer, ForeignKey("source_groups.id"), nullable=True)
    duplicate_of_id = Column(Integer, ForeignKey("context_sources.id"), nullable=True)
    is_primary = Column(sa.Boolean, default=True, nullable=False)  # Primary source in group

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
    access_logs = relationship("ContentAccessLog", back_populates="context_source", cascade="all, delete-orphan")
    source_group = relationship("SourceGroup", foreign_keys=[source_group_id], back_populates="sources")
    duplicate_of = relationship("ContextSource", remote_side="ContextSource.id", foreign_keys=[duplicate_of_id])

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
    initiative_links = relationship("EntityInitiativeLink", back_populates="entity", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ExtractedEntity(id={self.id}, type='{self.entity_type}', name='{self.name}')>"


class ContentAccessLog(TenantScopedModel):
    """
    Audit log for accessing raw content from context sources
    Tracks who accessed what content and when for compliance
    """
    __tablename__ = "content_access_logs"

    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    context_source_id = Column(Integer, ForeignKey("context_sources.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Access details
    access_reason = Column(String(255), nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    accessed_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    # Relationships
    tenant = relationship("Tenant")
    context_source = relationship("ContextSource", back_populates="access_logs")
    user = relationship("User")

    def __repr__(self):
        return f"<ContentAccessLog(id={self.id}, source_id={self.context_source_id}, user_id={self.user_id})>"


class InitiativeEvidence(TenantScopedModel):
    """
    Pre-aggregated evidence supporting an initiative
    Built from extracted entities linked to the initiative
    """
    __tablename__ = "initiative_evidence"

    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    initiative_id = Column(Integer, ForeignKey("initiative.id"), nullable=False, index=True)

    # Aggregated metrics
    total_mentions = Column(Integer, default=0, nullable=False)
    total_arr_impacted = Column(sa.BigInteger, default=0, nullable=False)

    # Breakdown by segment
    customer_segments = Column(JSON, nullable=True)
    # {"Enterprise": 23, "Mid-Market": 24, "SMB": 10}

    # Top representative quotes
    representative_quotes = Column(JSON, nullable=True)
    # [
    #   {
    #     "text": "snippet...",
    #     "customer_name": "Acme Corp",
    #     "customer_segment": "Enterprise",
    #     "customer_arr": 150000,
    #     "speaker_role": "VP Engineering",
    #     "source_name": "Q1 Survey",
    #     "source_section": "Question 5",
    #     "date": "2024-03-15",
    #     "entity_id": 123
    #   }
    # ]

    # Source breakdown
    sources = Column(JSON, nullable=True)
    # [
    #   {"source_id": 123, "name": "Q1 Survey", "mention_count": 47, "source_type": "csv_survey"},
    #   {"source_id": 124, "name": "Support Tickets", "mention_count": 12, "source_type": "support_ticket"}
    # ]

    # Aggregate scores
    confidence_avg = Column(Float, nullable=True)
    sentiment_avg = Column(Float, nullable=True)

    # Tracking
    last_updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    tenant = relationship("Tenant")
    initiative = relationship("Initiative")

    def __repr__(self):
        return f"<InitiativeEvidence(id={self.id}, initiative_id={self.initiative_id}, mentions={self.total_mentions})>"


class EntityInitiativeLink(TenantScopedModel):
    """
    Many-to-many relationship between extracted entities and initiatives
    Tracks which entities support which initiatives with relevance scoring
    """
    __tablename__ = "entity_initiative_links"

    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    entity_id = Column(Integer, ForeignKey("extracted_entities.id"), nullable=False, index=True)
    initiative_id = Column(Integer, ForeignKey("initiative.id"), nullable=False, index=True)

    # Relevance score (0-1) - how strongly this entity supports this initiative
    relevance_score = Column(Float, nullable=True)

    # Relationships
    tenant = relationship("Tenant")
    entity = relationship("ExtractedEntity")
    initiative = relationship("Initiative")

    def __repr__(self):
        return f"<EntityInitiativeLink(entity_id={self.entity_id}, initiative_id={self.initiative_id}, score={self.relevance_score})>"


class SourceGroup(TenantScopedModel):
    """
    Group of context sources representing the same event/meeting
    Allows multiple PMs to upload notes from same meeting while preventing duplication
    """
    __tablename__ = "source_groups"

    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    event_date = Column(Date, nullable=True)
    primary_source_id = Column(Integer, ForeignKey("context_sources.id"), nullable=True)

    # Relationships
    tenant = relationship("Tenant")
    primary_source = relationship("ContextSource", foreign_keys=[primary_source_id])
    sources = relationship("ContextSource", foreign_keys="ContextSource.source_group_id", back_populates="source_group")

    def __repr__(self):
        return f"<SourceGroup(id={self.id}, name='{self.name}', sources={len(self.sources) if self.sources else 0})>"


class EntityDuplicate(TenantScopedModel):
    """
    Tracks duplicate entities detected via semantic similarity
    Allows merging or linking duplicate entities
    """
    __tablename__ = "entity_duplicates"

    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    primary_entity_id = Column(Integer, ForeignKey("extracted_entities.id"), nullable=False, index=True)
    duplicate_entity_id = Column(Integer, ForeignKey("extracted_entities.id"), nullable=False, index=True)
    similarity_score = Column(Float, nullable=True)
    merged_at = Column(DateTime, nullable=True)

    # Relationships
    tenant = relationship("Tenant")
    primary_entity = relationship("ExtractedEntity", foreign_keys=[primary_entity_id])
    duplicate_entity = relationship("ExtractedEntity", foreign_keys=[duplicate_entity_id])

    def __repr__(self):
        return f"<EntityDuplicate(primary={self.primary_entity_id}, duplicate={self.duplicate_entity_id}, similarity={self.similarity_score})>"
