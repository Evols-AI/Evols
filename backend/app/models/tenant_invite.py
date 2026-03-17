"""
Tenant Invite Model
Invite-based tenant access system
"""

from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta

from app.models.base import BaseModel


class TenantInvite(BaseModel):
    """
    Tenant invitation for secure user onboarding
    """

    __tablename__ = "tenant_invites"

    # Tenant association
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    # Invite details
    email = Column(String(255), nullable=False, index=True)
    token = Column(String(255), unique=True, nullable=False, index=True)  # Unique invite token

    # Role to assign when accepted
    role = Column(String(50), nullable=False, default="USER")  # USER or TENANT_ADMIN

    # Invited by
    invited_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Status
    is_accepted = Column(Boolean, default=False, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=False)  # Invites expire after 7 days

    # Optional message from inviter
    message = Column(String(500), nullable=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="invites")
    inviter = relationship("User", foreign_keys=[invited_by])

    def __repr__(self):
        return f"<TenantInvite(id={self.id}, email='{self.email}', tenant_id={self.tenant_id}, accepted={self.is_accepted})>"

    @property
    def is_expired(self) -> bool:
        """Check if invite is expired"""
        return datetime.utcnow() > self.expires_at

    @property
    def is_valid(self) -> bool:
        """Check if invite is valid (not expired and not accepted)"""
        return not self.is_accepted and not self.is_expired
