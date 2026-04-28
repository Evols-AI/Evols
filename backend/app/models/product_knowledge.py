"""
Team Knowledge Model
Stores team strategy documents that AI skills can reference
"""

from sqlalchemy import Column, Integer, Text, ForeignKey, UniqueConstraint
from app.models.base import BaseModel


class ProductKnowledge(BaseModel):
    """
    Team knowledge documents (strategy, segments, competitive, etc.)
    One record per tenant. Referenced by AI skills for personalized context.
    """
    __tablename__ = 'product_knowledge'

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, unique=True, index=True)

    # Knowledge documents (stored as markdown text)
    strategy_doc = Column(Text, nullable=True)
    customer_segments_doc = Column(Text, nullable=True)
    competitive_landscape_doc = Column(Text, nullable=True)
    value_proposition_doc = Column(Text, nullable=True)
    metrics_and_targets_doc = Column(Text, nullable=True)

    def __repr__(self):
        return f"<ProductKnowledge(tenant_id={self.tenant_id})>"

    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            'strategy_doc': self.strategy_doc or '',
            'customer_segments_doc': self.customer_segments_doc or '',
            'competitive_landscape_doc': self.competitive_landscape_doc or '',
            'value_proposition_doc': self.value_proposition_doc or '',
            'metrics_and_targets_doc': self.metrics_and_targets_doc or ''
        }
