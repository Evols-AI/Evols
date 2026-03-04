"""
User Preference Model
Tracks user preferences for human-in-the-loop learning
"""

from sqlalchemy import Column, String, Text, Integer, ForeignKey, JSON
from sqlalchemy.orm import relationship
from enum import Enum

from app.models.base import TenantScopedModel


class UserPreference(TenantScopedModel):
    """
    User preferences and feedback for improving AI recommendations
    Tracks thumbs up/down, edits, and overrides
    """

    __tablename__ = "user_preference"

    # User and tenant association
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    # Preference details
    preference_type = Column(String(50), nullable=False, index=True)  # thumbs_up, thumbs_down, edit, override
    context = Column(String(100), nullable=False, index=True)  # theme_label, option_generation, narrative_section, etc.

    # Content
    original_content = Column(Text, nullable=True)
    preferred_content = Column(Text, nullable=True)

    # Metadata
    pref_metadata = Column(JSON, nullable=True)  # Additional context

    # Relationships (no back_populates — Tenant/User models don't define the reverse)
    user = relationship("User")
    tenant = relationship("Tenant")

    def __repr__(self):
        return f"<UserPreference(id={self.id}, type='{self.preference_type}', context='{self.context}')>"
