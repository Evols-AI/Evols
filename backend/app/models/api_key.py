"""
API Key Model
Long-lived API keys for plugin/CLI authentication (no expiry required)
"""

from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.base import BaseModel


class ApiKey(BaseModel):
    """
    Long-lived API key for authenticating the Evols Claude Code plugin.

    The full key is returned ONCE at creation and never stored.
    Only the bcrypt hash is persisted. The first 8 chars (prefix) are
    stored in plaintext so keys can be identified in the UI.

    Key format: evols_<32 random hex chars>
    Example:    evols_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
    """

    __tablename__ = "api_keys"

    tenant_id = Column(Integer, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    key_prefix = Column(String(8), nullable=False, index=True)  # first 8 chars, for display
    key_hash = Column(String(255), nullable=False)               # bcrypt hash of full key

    last_used_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)                 # None = never expires
    is_active = Column(Boolean, default=True, nullable=False)

    user = relationship("User", backref="api_keys")

    def __repr__(self):
        return f"<ApiKey(id={self.id}, prefix='{self.key_prefix}...', user_id={self.user_id})>"

    @property
    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at

    @property
    def is_valid(self) -> bool:
        return self.is_active and not self.is_expired
