"""
Team Knowledge Graph Models
Shared team intelligence — entries (nodes), edges (relationships), quota events
"""

from sqlalchemy import Column, String, Integer, ForeignKey, Text, JSON, Float, DateTime, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
from enum import Enum
from datetime import datetime

from app.models.base import BaseModel


class EntryRole(str, Enum):
    PM = "pm"
    ENGINEER = "engineer"
    DESIGNER = "designer"
    QA = "qa"
    OTHER = "other"


class SessionType(str, Enum):
    RESEARCH = "research"
    PLANNING = "planning"
    CODE = "code"
    ANALYSIS = "analysis"
    REVIEW = "review"
    OTHER = "other"


class EntryType(str, Enum):
    INSIGHT = "insight"           # Key finding or observation
    DECISION = "decision"         # A decision that was made
    ARTIFACT = "artifact"         # Document, spec, PRD produced
    RESEARCH_FINDING = "research_finding"  # From user/market research
    PATTERN = "pattern"           # Recurring pattern observed
    CONTEXT = "context"           # General context/background


class EdgeType(str, Enum):
    SEMANTIC = "semantic"         # Similarity-based (auto-created)
    EXPLICIT = "explicit"         # Manually linked
    TEMPORAL = "temporal"         # Same time period / sprint


class QuotaEventType(str, Enum):
    SESSION_END = "session_end"
    RATE_LIMIT_HIT = "rate_limit_hit"
    QUOTA_EXPIRED = "quota_expired"


class KnowledgeEntry(BaseModel):
    """
    A node in the team knowledge graph.
    Represents a compiled piece of team knowledge from an AI session.
    """
    __tablename__ = "knowledge_entries"

    tenant_id = Column(Integer, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    # Classification
    role = Column(SQLEnum(EntryRole, values_callable=lambda x: [e.value for e in x]), nullable=False, default=EntryRole.OTHER)
    session_type = Column(SQLEnum(SessionType, values_callable=lambda x: [e.value for e in x]), nullable=False, default=SessionType.OTHER)
    entry_type = Column(SQLEnum(EntryType, values_callable=lambda x: [e.value for e in x]), nullable=False, default=EntryType.INSIGHT)

    # Content
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)          # Pre-compiled knowledge text
    tags = Column(JSON, nullable=True)              # ["onboarding", "retention", "smb"]
    product_area = Column(String(255), nullable=True)  # e.g. "onboarding", "billing"
    source_session_id = Column(String(64), nullable=True, index=True)  # UUID of originating session

    # Semantic search
    embedding = Column(JSON, nullable=True)         # List[float] — 1024-dim Titan v2
    token_count = Column(Integer, nullable=True)    # Token cost of this entry when injected

    # Product attribution
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    source = Column(String(50), nullable=False, default="claude-code")  # claude-code, cline, manual, etc.
    parent_entry_id = Column(Integer, ForeignKey("knowledge_entries.id", ondelete="SET NULL"), nullable=True)

    # Usage tracking
    retrieval_count = Column(Integer, nullable=False, default=0)
    last_retrieved_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User")
    product = relationship("Product", foreign_keys=[product_id])
    outgoing_edges = relationship("KnowledgeEdge", foreign_keys="KnowledgeEdge.source_entry_id", cascade="all, delete-orphan")
    incoming_edges = relationship("KnowledgeEdge", foreign_keys="KnowledgeEdge.target_entry_id", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<KnowledgeEntry(id={self.id}, title='{self.title}', role='{self.role}')>"


class KnowledgeEdge(BaseModel):
    """
    An edge between two knowledge entries.
    Auto-created when new entries are semantically similar to existing ones.
    """
    __tablename__ = "knowledge_edges"

    tenant_id = Column(Integer, nullable=False, index=True)
    source_entry_id = Column(Integer, ForeignKey("knowledge_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    target_entry_id = Column(Integer, ForeignKey("knowledge_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    edge_type = Column(SQLEnum(EdgeType, values_callable=lambda x: [e.value for e in x]), nullable=False, default=EdgeType.SEMANTIC)
    weight = Column(Float, nullable=True)           # Similarity score 0–1 for SEMANTIC edges

    source_entry = relationship("KnowledgeEntry", foreign_keys=[source_entry_id])
    target_entry = relationship("KnowledgeEntry", foreign_keys=[target_entry_id])

    def __repr__(self):
        return f"<KnowledgeEdge(src={self.source_entry_id}, tgt={self.target_entry_id}, type='{self.edge_type}', w={self.weight})>"


class QuotaEvent(BaseModel):
    """
    Token usage event per AI session.
    Enables team-level token savings tracking.
    """
    __tablename__ = "quota_events"

    tenant_id = Column(Integer, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    session_id = Column(String(64), nullable=False, index=True)
    event_type = Column(SQLEnum(QuotaEventType, values_callable=lambda x: [e.value for e in x]), nullable=False)

    # Token counts
    tokens_used = Column(Integer, nullable=False, default=0)       # Total tokens consumed this session
    tokens_retrieved = Column(Integer, nullable=False, default=0)  # Tokens of pre-compiled context injected
    tokens_saved_estimate = Column(Integer, nullable=False, default=0)  # retrieved * (compression_ratio - 1)

    # Context
    tool_name = Column(String(50), nullable=True, default="claude-code")   # claude-code, cursor, copilot
    plan_type = Column(String(20), nullable=True)                          # pro, max, team, enterprise
    session_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    cwd = Column(String(500), nullable=True)                               # Working directory hint

    user = relationship("User")

    def __repr__(self):
        return f"<QuotaEvent(session={self.session_id}, used={self.tokens_used}, saved={self.tokens_saved_estimate})>"
