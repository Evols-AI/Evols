"""
Knowledge Manager
CRUD operations for product knowledge documents
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any, Optional
from loguru import logger

from app.models.product_knowledge import ProductKnowledge


class KnowledgeManager:
    """
    Manages product knowledge documents (strategy, segments, competitive, etc.)
    These documents provide context to AI skills for personalized recommendations.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_product_knowledge(self, product_id: int) -> Optional[Dict[str, Any]]:
        """
        Get all knowledge documents for a product.

        Args:
            product_id: Product ID

        Returns:
            Dictionary with all knowledge docs, or None if not found
            {
                'strategy_doc': '...',
                'customer_segments_doc': '...',
                'competitive_landscape_doc': '...',
                'value_proposition_doc': '...',
                'metrics_and_targets_doc': '...'
            }
        """
        result = await self.db.execute(
            select(ProductKnowledge).where(ProductKnowledge.product_id == product_id)
        )
        knowledge = result.scalars().first()

        if not knowledge:
            logger.debug(f"No knowledge found for product {product_id}")
            return None

        return knowledge.to_dict()

    async def update_knowledge_doc(
        self,
        product_id: int,
        tenant_id: int,
        doc_type: str,
        content: str
    ) -> ProductKnowledge:
        """
        Update a specific knowledge document.

        Args:
            product_id: Product ID
            tenant_id: Tenant ID (for multi-tenancy)
            doc_type: Type of document ('strategy', 'customer_segments',
                     'competitive_landscape', 'value_proposition', 'metrics_and_targets')
            content: Markdown content of the document

        Returns:
            Updated ProductKnowledge object

        Raises:
            ValueError: If doc_type is invalid
        """
        # Validate doc_type
        valid_types = [
            'strategy',
            'customer_segments',
            'competitive_landscape',
            'value_proposition',
            'metrics_and_targets'
        ]

        if doc_type not in valid_types:
            raise ValueError(f"Invalid doc_type: {doc_type}. Must be one of {valid_types}")

        # Get or create knowledge record
        result = await self.db.execute(
            select(ProductKnowledge).where(ProductKnowledge.product_id == product_id)
        )
        knowledge = result.scalars().first()

        if not knowledge:
            # Create new record
            knowledge = ProductKnowledge(
                product_id=product_id,
                tenant_id=tenant_id
            )
            self.db.add(knowledge)
            logger.info(f"Created new knowledge record for product {product_id}")

        # Update specific document
        doc_field = f"{doc_type}_doc"
        setattr(knowledge, doc_field, content)

        await self.db.commit()
        await self.db.refresh(knowledge)

        logger.info(f"Updated {doc_type} for product {product_id}")

        return knowledge

    async def get_knowledge_summary(self, product_id: int) -> Dict[str, Any]:
        """
        Get a summary of what knowledge is available for a product.

        Args:
            product_id: Product ID

        Returns:
            {
                'has_strategy': True/False,
                'has_customer_segments': True/False,
                'has_competitive_landscape': True/False,
                'has_value_proposition': True/False,
                'has_metrics_and_targets': True/False,
                'completeness_percentage': 0-100
            }
        """
        knowledge = await self.get_product_knowledge(product_id)

        if not knowledge:
            return {
                'has_strategy': False,
                'has_customer_segments': False,
                'has_competitive_landscape': False,
                'has_value_proposition': False,
                'has_metrics_and_targets': False,
                'completeness_percentage': 0
            }

        # Check which docs are filled
        has_docs = {
            'has_strategy': bool(knowledge.get('strategy_doc', '').strip()),
            'has_customer_segments': bool(knowledge.get('customer_segments_doc', '').strip()),
            'has_competitive_landscape': bool(knowledge.get('competitive_landscape_doc', '').strip()),
            'has_value_proposition': bool(knowledge.get('value_proposition_doc', '').strip()),
            'has_metrics_and_targets': bool(knowledge.get('metrics_and_targets_doc', '').strip())
        }

        # Calculate completeness
        filled_count = sum(has_docs.values())
        total_count = len(has_docs)
        completeness = int((filled_count / total_count) * 100)

        return {
            **has_docs,
            'completeness_percentage': completeness
        }

    async def delete_product_knowledge(self, product_id: int):
        """
        Delete all knowledge for a product.

        Args:
            product_id: Product ID
        """
        result = await self.db.execute(
            select(ProductKnowledge).where(ProductKnowledge.product_id == product_id)
        )
        knowledge = result.scalars().first()

        if knowledge:
            await self.db.delete(knowledge)
            await self.db.commit()
            logger.info(f"Deleted knowledge for product {product_id}")
