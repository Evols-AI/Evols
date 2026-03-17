"""
User-Tenant Association Model
Supports multi-tenant user membership
"""

from sqlalchemy import Column, Integer, ForeignKey, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class UserTenant(BaseModel):
    """
    Association between users and tenants
    Allows users to belong to multiple tenants (e.g., consultants)
    """

    __tablename__ = "user_tenants"

    # User association
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Tenant association
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    # Role within this tenant
    role = Column(String(50), nullable=False, default="USER")  # USER or TENANT_ADMIN

    # Status
    is_active = Column(Boolean, default=True, nullable=False)

    # Track when user joined this tenant
    joined_at = Column(DateTime, nullable=False, server_default="now()")

    # Relationships
    user = relationship("User", back_populates="tenant_memberships")
    tenant = relationship("Tenant", back_populates="user_memberships")

    def __repr__(self):
        return f"<UserTenant(user_id={self.user_id}, tenant_id={self.tenant_id}, role='{self.role}')>"
