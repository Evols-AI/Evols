"""
Skill Models
AI Skills that help users with specific PM tasks
"""

from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, Text, Float, DateTime, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from enum import Enum
from datetime import datetime

from app.models.base import BaseModel


class SkillPhase(str, Enum):
    """Session phase"""
    INITIAL_GENERATION = "initial_generation"
    REFINEMENT = "refinement"
    COMPLETED = "completed"


class SkillType(str, Enum):
    """Skill type"""
    DEFAULT = "default"
    CUSTOM = "custom"


class ExperimentStatus(str, Enum):
    """Experiment status"""
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    EARLY_WINNER_DETECTED = "early_winner_detected"


class OptimizationStrategy(str, Enum):
    """Experiment optimization strategy"""
    FIXED_SPLIT = "fixed_split"
    ADAPTIVE_BANDIT = "adaptive_bandit"


class SentimentLabel(str, Enum):
    """Sentiment classification"""
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"
    FRUSTRATED = "frustrated"


# ===================================
# SKILLS (Product-level templates)
# ===================================

class Skill(BaseModel):
    """
    Product-level skill templates (immutable for tenants).
    Created by SUPER_ADMIN users.
    """
    __tablename__ = "skills"

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(50), nullable=True, default='💡')

    # Configuration
    tools = Column(JSON, nullable=False, default=list)  # List of tool IDs from registry
    initial_questions = Column(JSON, nullable=False, default=list)  # Questions to ask user
    task_definitions = Column(JSON, nullable=False, default=list)  # Execution plan
    instructions = Column(Text, nullable=False)  # System prompt
    output_template = Column(Text, nullable=True)  # How to format results

    is_active = Column(Boolean, nullable=False, default=True)

    # Relationships
    custom_skills = relationship("CustomSkill", back_populates="source_skill")

    def __repr__(self):
        return f"<Skill(id={self.id}, name='{self.name}')>"


# ===================================
# CUSTOM SKILLS (Tenant-level)
# ===================================

class CustomSkill(BaseModel):
    """
    Tenant-customized skills (cloned from defaults or created from scratch).
    Managed by TENANT_ADMIN users.
    """
    __tablename__ = "custom_skills"

    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    source_skill_id = Column(Integer, ForeignKey("skills.id", ondelete="SET NULL"), nullable=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(50), nullable=True, default='💡')

    # Configuration (same as Adviser)
    tools = Column(JSON, nullable=False, default=list)
    initial_questions = Column(JSON, nullable=False, default=list)
    task_definitions = Column(JSON, nullable=False, default=list)
    instructions = Column(Text, nullable=False)
    output_template = Column(Text, nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    tenant = relationship("Tenant")
    source_skill = relationship("Skill", back_populates="custom_skills")
    created_by = relationship("User")
    versions = relationship("CustomSkillVersion", back_populates="custom_skill", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<CustomSkill(id={self.id}, name='{self.name}', tenant_id={self.tenant_id})>"


# ===================================
# CUSTOM ADVISER VERSIONS
# ===================================

class CustomSkillVersion(BaseModel):
    """
    Version history for custom skills.
    Allows rollback to previous configurations.
    """
    __tablename__ = "custom_skill_versions"

    custom_skill_id = Column(Integer, ForeignKey("custom_skills.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)

    # Snapshot of config at this version
    tools = Column(JSON, nullable=False)
    initial_questions = Column(JSON, nullable=False)
    task_definitions = Column(JSON, nullable=False)
    instructions = Column(Text, nullable=False)
    output_template = Column(Text, nullable=True)

    change_description = Column(Text, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    custom_skill = relationship("CustomSkill", back_populates="versions")
    created_by = relationship("User")

    def __repr__(self):
        return f"<CustomSkillVersion(id={self.id}, version={self.version_number})>"


# ===================================
# ADVISER CONVERSATIONS (formerly ADVISER SESSIONS)
# ===================================

class SkillConversation(BaseModel):
    """
    User conversation with AI copilot.
    Can involve multiple advisers throughout the conversation.
    Note: Named AdviserConversation to avoid conflict with app.models.conversation.Conversation
    """
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True)  # UUID
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    # Deprecated fields (kept for backwards compatibility)
    skill_id = Column(Integer, nullable=True)  # DEPRECATED: use messages.skill_id instead
    skill_type = Column(SQLEnum(SkillType), nullable=True)  # DEPRECATED
    phase = Column(SQLEnum(SkillPhase), nullable=True)  # DEPRECATED

    session_name = Column(String(255), nullable=True)  # Auto-generated from first message

    # Session data
    context_data = Column(JSON, nullable=True)  # Any conversation context
    output_data = Column(JSON, nullable=True)  # Legacy field
    avg_sentiment = Column(Float, nullable=True)

    last_message_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="conversations")
    tenant = relationship("Tenant")
    messages = relationship("SkillMessage", back_populates="conversation", cascade="all, delete-orphan")
    evaluations = relationship("SkillSessionEvaluation", back_populates="session", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<SkillConversation(id={self.id}, user_id={self.user_id})>"

    # Backwards compatibility properties
    @property
    def adviser_id(self):
        return self.skill_id

    @adviser_id.setter
    def adviser_id(self, value):
        self.skill_id = value

    @property
    def adviser_type(self):
        return self.skill_type

    @adviser_type.setter
    def adviser_type(self, value):
        self.skill_type = value


# Backwards compatibility alias
AdviserConversation = SkillConversation


# ===================================
# ADVISER MESSAGES (formerly ADVISER MESSAGES)
# ===================================

class SkillMessage(BaseModel):
    """
    Individual message in an adviser conversation.
    Note: Named AdviserMessage to avoid conflict with app.models.conversation.Message
    """
    __tablename__ = "messages"

    conversation_id = Column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # 'user', 'assistant', 'system'
    content = Column(Text, nullable=False)

    # Which skill generated this message (for assistant messages only)
    skill_id = Column(Integer, nullable=True)
    skill_type = Column(String(20), nullable=True)  # 'default' or 'custom'

    tool_calls = Column(JSON, nullable=True)  # LLM tool calls made
    message_metadata = Column("metadata", JSON, nullable=True)  # Additional data (thinking, citations, etc.)
    sequence_number = Column(Integer, nullable=False)

    # Relationships
    conversation = relationship("SkillConversation", back_populates="messages")
    sentiment = relationship("SkillMessageSentiment", back_populates="message", uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<SkillMessage(id={self.id}, role='{self.role}', seq={self.sequence_number})>"

    # Backwards compatibility property
    @property
    def session_id(self):
        return self.conversation_id

    @session_id.setter
    def session_id(self, value):
        self.conversation_id = value

    @property
    def session(self):
        return self.conversation

    @session.setter
    def session(self, value):
        self.conversation = value


# ===================================
# SESSION EVALUATIONS
# ===================================

class SkillSessionEvaluation(BaseModel):
    """
    Explicit user feedback on adviser session.
    """
    __tablename__ = "skill_session_evaluations"

    # Override BaseModel column - this table only has created_at, not updated_at
    updated_at = None

    session_id = Column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    rating = Column(Integer, nullable=True)  # 1-5
    helpful = Column(Boolean, nullable=True)
    feedback_text = Column(Text, nullable=True)
    evaluation_type = Column(String(50), nullable=False, default="overall_experience")

    # Relationships
    session = relationship("SkillConversation", back_populates="evaluations")
    user = relationship("User")

    def __repr__(self):
        return f"<SkillSessionEvaluation(id={self.id}, rating={self.rating})>"


# ===================================
# MESSAGE SENTIMENT
# ===================================

class SkillMessageSentiment(BaseModel):
    """
    Sentiment analysis of user messages (implicit feedback).
    """
    __tablename__ = "skill_message_sentiment"

    # Override BaseModel columns - this table doesn't use created_at/updated_at
    created_at = None
    updated_at = None

    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)

    sentiment_score = Column(Float, nullable=False)  # -1.0 to 1.0
    sentiment_label = Column(SQLEnum(SentimentLabel), nullable=False)
    confidence = Column(Float, nullable=False)
    indicators = Column(JSON, nullable=True)

    analyzed_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    message = relationship("SkillMessage", back_populates="sentiment")
    session = relationship("SkillConversation")

    def __repr__(self):
        return f"<SkillMessageSentiment(id={self.id}, label='{self.sentiment_label}', score={self.sentiment_score})>"


# ===================================
# EXPERIMENTS
# ===================================

class SkillExperiment(BaseModel):
    """
    A/B testing experiment for advisers.
    """
    __tablename__ = "skill_experiments"

    skill_id = Column(Integer, nullable=False)
    skill_type = Column(SQLEnum(SkillType), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    hypothesis = Column(Text, nullable=True)
    status = Column(SQLEnum(ExperimentStatus), nullable=False, default=ExperimentStatus.DRAFT)

    # Strategy
    optimization_strategy = Column(SQLEnum(OptimizationStrategy), nullable=False, default=OptimizationStrategy.FIXED_SPLIT)
    bandit_algorithm = Column(String(50), nullable=True)  # 'thompson_sampling' or 'ucb'
    exploration_rate = Column(Float, nullable=True, default=0.1)

    # Timing
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)

    # Settings
    min_sample_size = Column(Integer, nullable=False, default=50)
    confidence_threshold = Column(Float, nullable=False, default=0.95)
    recommended_winner_id = Column(Integer, nullable=True)
    bandit_last_update = Column(DateTime, nullable=True)

    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    tenant = relationship("Tenant")
    created_by = relationship("User")
    variants = relationship("SkillExperimentVariant", back_populates="experiment", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<SkillExperiment(id={self.id}, name='{self.name}', status='{self.status}')>"


# ===================================
# EXPERIMENT VARIANTS
# ===================================

class SkillExperimentVariant(BaseModel):
    """
    A variant in an A/B test experiment.
    """
    __tablename__ = "skill_experiment_variants"

    # Override BaseModel column - this table only has created_at, not updated_at
    updated_at = None

    experiment_id = Column(Integer, ForeignKey("skill_experiments.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_label = Column(String(10), nullable=False)  # 'A', 'B', 'C'
    is_control = Column(Boolean, nullable=False, default=False)
    traffic_allocation = Column(Float, nullable=False)
    name = Column(String(255), nullable=False)
    config_overrides = Column(JSON, nullable=True)

    # Metrics
    sessions_count = Column(Integer, nullable=False, default=0)
    completed_sessions_count = Column(Integer, nullable=False, default=0)
    avg_rating = Column(Float, nullable=True)
    avg_sentiment_score = Column(Float, nullable=True)
    avg_refinement_messages = Column(Float, nullable=True)
    completion_rate = Column(Float, nullable=True)

    # Relationships
    experiment = relationship("SkillExperiment", back_populates="variants")
    bandit_state = relationship("SkillExperimentBanditState", back_populates="variant", uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<SkillExperimentVariant(id={self.id}, label='{self.variant_label}')>"


# ===================================
# SESSION VARIANTS
# ===================================

class SkillSessionVariant(BaseModel):
    """
    Tracks which experiment variant was used for each session.
    """
    __tablename__ = "skill_session_variants"

    # Override BaseModel columns - this table doesn't use created_at/updated_at
    created_at = None
    updated_at = None

    session_id = Column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    experiment_id = Column(Integer, ForeignKey("skill_experiments.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(Integer, ForeignKey("skill_experiment_variants.id", ondelete="CASCADE"), nullable=False)
    assigned_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    session = relationship("SkillConversation")
    experiment = relationship("SkillExperiment")
    variant = relationship("SkillExperimentVariant")

    def __repr__(self):
        return f"<SkillSessionVariant(session_id={self.session_id}, variant_id={self.variant_id})>"


# ===================================
# BANDIT STATE
# ===================================

class SkillExperimentBanditState(BaseModel):
    """
    Multi-armed bandit state for adaptive experiments.
    """
    __tablename__ = "skill_experiment_bandit_state"

    # Override BaseModel column - this table uses last_updated instead of updated_at
    updated_at = None

    experiment_id = Column(Integer, ForeignKey("skill_experiments.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("skill_experiment_variants.id", ondelete="CASCADE"), nullable=False)

    # Beta distribution parameters (for Thompson Sampling)
    alpha = Column(Float, nullable=False, default=1.0)
    beta = Column(Float, nullable=False, default=1.0)

    # Metrics
    pulls_count = Column(Integer, nullable=False, default=0)
    rewards_sum = Column(Float, nullable=False, default=0.0)
    avg_reward = Column(Float, nullable=True)
    current_allocation = Column(Float, nullable=False)

    last_updated = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    experiment = relationship("SkillExperiment")
    variant = relationship("SkillExperimentVariant", back_populates="bandit_state")

    def __repr__(self):
        return f"<SkillExperimentBanditState(variant_id={self.variant_id}, allocation={self.current_allocation})>"


# ===================================
# BANDIT ALLOCATION HISTORY
# ===================================

class SkillBanditAllocationHistory(BaseModel):
    """
    Historical record of bandit allocation changes.
    """
    __tablename__ = "skill_bandit_allocation_history"

    # Override BaseModel columns - this table doesn't use created_at/updated_at
    created_at = None
    updated_at = None

    experiment_id = Column(Integer, ForeignKey("skill_experiments.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    variant_allocations = Column(JSON, nullable=False)  # {"1": 0.5, "2": 0.3, "3": 0.2}
    reason = Column(String(50), nullable=True)

    # Relationships
    experiment = relationship("SkillExperiment")

    def __repr__(self):
        return f"<SkillBanditAllocationHistory(experiment_id={self.experiment_id}, timestamp={self.timestamp})>"
