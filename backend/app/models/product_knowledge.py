"""
Product Knowledge Model
Stores product strategy documents that AI skills can reference
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey
from app.models.base import BaseModel


class ProductKnowledge(BaseModel):
    """
    Product knowledge documents (strategy, segments, competitive, etc.)
    These are referenced by AI skills to provide personalized context.
    """
    __tablename__ = 'product_knowledge'

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey('products.id', ondelete='CASCADE'), nullable=False, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True)

    # Knowledge documents (stored as markdown text)
    strategy_doc = Column(Text, nullable=True)
    customer_segments_doc = Column(Text, nullable=True)
    competitive_landscape_doc = Column(Text, nullable=True)
    value_proposition_doc = Column(Text, nullable=True)
    metrics_and_targets_doc = Column(Text, nullable=True)

    def __repr__(self):
        return f"<ProductKnowledge(product_id={self.product_id})>"

    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            'strategy_doc': self.strategy_doc or '',
            'customer_segments_doc': self.customer_segments_doc or '',
            'competitive_landscape_doc': self.competitive_landscape_doc or '',
            'value_proposition_doc': self.value_proposition_doc or '',
            'metrics_and_targets_doc': self.metrics_and_targets_doc or ''
        }
