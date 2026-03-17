"""
User Model
User accounts with role-based access control
"""

from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from enum import Enum

from app.models.base import BaseModel


class UserRole(str, Enum):
    """User role types"""

    SUPER_ADMIN = "SUPER_ADMIN"  # Platform admin - can manage all tenants and cross-tenant operations
    PRODUCT_ADMIN = "PRODUCT_ADMIN"  # Super admin - can manage all tenants (deprecated, use SUPER_ADMIN)
    TENANT_ADMIN = "TENANT_ADMIN"  # Tenant admin - can manage users in their org
    USER = "USER"  # Regular user - can use features within their tenant


class User(BaseModel):
    """
    User model with multi-tenant support and RBAC
    """

    __tablename__ = "users"

    # Tenant association (nullable for SUPER_ADMIN)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)

    # Authentication
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)

    # Profile
    full_name = Column(String(255), nullable=True)
    avatar_url = Column(String(512), nullable=True)
    job_title = Column(String(255), nullable=True)

    # Role & Permissions
    role = Column(SQLEnum(UserRole), default=UserRole.USER, nullable=False)

    # Preferences
    preferences = Column(JSON, nullable=True, default=dict)
    # Example: {
    #   "theme": "dark",
    #   "notifications_enabled": true,
    #   "default_segment_filter": ["enterprise"],
    #   "favorite_personas": [1, 3, 5]
    # }

    # Security
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(255), nullable=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="users")  # Legacy single-tenant relationship
    tenant_memberships = relationship("UserTenant", back_populates="user", cascade="all, delete-orphan")
    conversations = relationship("SkillConversation", back_populates="user", cascade="all, delete-orphan")
    decisions = relationship("Decision", back_populates="created_by_user", foreign_keys="Decision.created_by")

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"

    @property
    def is_admin(self) -> bool:
        """Check if user is an admin (any admin role)"""
        return self.role in [UserRole.SUPER_ADMIN, UserRole.PRODUCT_ADMIN, UserRole.TENANT_ADMIN]

    @property
    def is_super_admin(self) -> bool:
        """Check if user is a super admin (platform admin)"""
        return self.role in [UserRole.SUPER_ADMIN, UserRole.PRODUCT_ADMIN]

    @property
    def is_tenant_admin(self) -> bool:
        """Check if user is a tenant admin"""
        return self.role == UserRole.TENANT_ADMIN

    @property
    def is_product_admin(self) -> bool:
        """Check if user is a product admin (deprecated, use is_super_admin)"""
        return self.role == UserRole.PRODUCT_ADMIN
