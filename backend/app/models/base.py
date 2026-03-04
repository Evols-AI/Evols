"""
Base Model with common fields and utilities
"""

from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.ext.declarative import declared_attr
from app.core.database import Base


class BaseModel(Base):
    """Abstract base model with common fields"""

    __abstract__ = True

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    @declared_attr
    def __tablename__(cls) -> str:
        """Generate table name from class name"""
        return cls.__name__.lower()

    def to_dict(self):
        """Convert model to dictionary"""
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class TenantScopedModel(BaseModel):
    """Base model for tenant-scoped resources"""

    __abstract__ = True

    tenant_id = Column(Integer, nullable=False, index=True)
