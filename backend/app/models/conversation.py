"""
Conversation Models
User conversations and chat history with personas
"""

from sqlalchemy import Column, String, Text, Integer, ForeignKey, JSON, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from enum import Enum

from app.models.base import TenantScopedModel


class ConversationType(str, Enum):
    """Type of conversation"""

    PERSONA_CHAT = "persona_chat"  # Chat with persona digital twin
    DECISION_WORKBENCH = "decision_workbench"  # Working on a decision
    GENERAL = "general"  # General chat


class MessageRole(str, Enum):
    """Message role"""

    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    PERSONA = "persona"  # From a persona digital twin


class Conversation(TenantScopedModel):
    """
    User conversation/session
    """

    __tablename__ = "conversation"

    # Tenant association
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    # User association
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Type
    conversation_type = Column(SQLEnum(ConversationType), default=ConversationType.GENERAL, nullable=False)

    # Metadata
    title = Column(String(255), nullable=True)  # Auto-generated or user-set
    summary = Column(Text, nullable=True)  # AI-generated summary

    # Context
    related_persona_ids = Column(JSON, nullable=True)  # If chatting with personas
    related_decision_id = Column(Integer, ForeignKey("decision.id"), nullable=True)

    # Status
    is_archived = Column(Boolean, default=False)

    # Metadata
    extra_data = Column(JSON, nullable=True)

    # Relationships
    tenant = relationship("Tenant")
    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Conversation(id={self.id}, type='{self.conversation_type}', user_id={self.user_id})>"


class Message(TenantScopedModel):
    """
    Individual message within a conversation
    """

    __tablename__ = "message"

    # Tenant association
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    # Conversation association
    conversation_id = Column(Integer, ForeignKey("conversation.id"), nullable=False, index=True)

    # Message content
    role = Column(SQLEnum(MessageRole), nullable=False)
    content = Column(Text, nullable=False)

    # Context
    persona_id = Column(Integer, ForeignKey("persona.id"), nullable=True)  # If from a persona
    citations = Column(JSON, nullable=True)  # References to feedback, themes, etc.
    # Example: [
    #   {"type": "feedback", "id": 123, "text": "quote"},
    #   {"type": "theme", "id": 45, "title": "theme name"}
    # ]

    # Metadata
    extra_data = Column(JSON, nullable=True)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")

    def __repr__(self):
        return f"<Message(id={self.id}, role='{self.role}', conversation_id={self.conversation_id})>"
