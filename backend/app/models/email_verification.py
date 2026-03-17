"""
Email Verification Model
Stores pending email verifications for new signups
"""

from sqlalchemy import Column, String, Integer, Boolean, DateTime, JSON
from datetime import datetime, timedelta

from app.models.base import BaseModel


class EmailVerification(BaseModel):
    """
    Email verification for new user signups
    Stores registration data until email is verified
    """

    __tablename__ = "email_verifications"

    # Email being verified
    email = Column(String(255), nullable=False, index=True)

    # Verification token
    token = Column(String(255), unique=True, nullable=False, index=True)

    # Registration data (stored as JSON until verified)
    registration_data = Column(JSON, nullable=False)
    # Example: {
    #   "full_name": "John Doe",
    #   "hashed_password": "...",
    #   "invite_token": "..." (optional),
    #   "tenant_name": "Acme" (for new tenant creation),
    #   "tenant_domain": "acme.com",
    #   "tenant_slug": "acme-com"
    # }

    # Status
    is_verified = Column(Boolean, default=False, nullable=False)
    verified_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=False)

    # After verification, link to created user
    user_id = Column(Integer, nullable=True)

    def __repr__(self):
        return f"<EmailVerification(id={self.id}, email='{self.email}', verified={self.is_verified})>"

    @property
    def is_expired(self) -> bool:
        """Check if verification is expired"""
        return datetime.utcnow() > self.expires_at

    @property
    def is_valid(self) -> bool:
        """Check if verification is valid (not expired and not verified)"""
        return not self.is_verified and not self.is_expired
