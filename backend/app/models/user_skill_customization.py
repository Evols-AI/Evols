"""
User Skill Customization Model
Allows users to customize skill instructions and context
"""

from sqlalchemy import Column, String, Text, Boolean, Integer, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.base import BaseModel


class UserSkillCustomization(BaseModel):
    """
    User customizations for skills - overlays on top of base skill instructions
    """

    __tablename__ = "user_skill_customizations"

    # Foreign keys
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)

    # Skill identification
    skill_name = Column(String(100), nullable=False, index=True)

    # Customization content
    custom_instructions = Column(Text, nullable=True)
    custom_context = Column(Text, nullable=True)
    output_format_preferences = Column(Text, nullable=True)

    # Additional metadata that could be JSON
    customization_metadata = Column(JSON, nullable=True, default=dict)
    # Example: {
    #   "company_context": "fintech",
    #   "role_focus": "enterprise_b2b",
    #   "preferred_frameworks": ["RICE", "OKRs"]
    # }

    # Status
    is_active = Column(Boolean, default=True, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="skill_customizations")
    tenant = relationship("Tenant")

    # Constraints
    __table_args__ = (
        # One customization per user per skill
        {"schema": None}
    )

    def __repr__(self):
        return f"<UserSkillCustomization(id={self.id}, user_id={self.user_id}, skill='{self.skill_name}')>"

    @property
    def has_custom_instructions(self) -> bool:
        """Check if user has custom instructions"""
        return bool(self.custom_instructions)

    @property
    def has_custom_context(self) -> bool:
        """Check if user has custom context"""
        return bool(self.custom_context)

    @property
    def has_format_preferences(self) -> bool:
        """Check if user has output format preferences"""
        return bool(self.output_format_preferences)

    def to_dict(self) -> dict:
        """Convert to dictionary for easy serialization"""
        return {
            'id': self.id,
            'skill_name': self.skill_name,
            'custom_instructions': self.custom_instructions,
            'custom_context': self.custom_context,
            'output_format_preferences': self.output_format_preferences,
            'customization_metadata': self.customization_metadata,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }