"""
Knowledge Manager
CRUD operations for team knowledge documents (tenant-scoped)
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any, Optional
from loguru import logger

from app.models.product_knowledge import ProductKnowledge


class KnowledgeManager:
    """
    Manages team knowledge documents (strategy, segments, competitive, etc.)
    These documents provide context to AI skills for personalized recommendations.
    One record per tenant.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_product_knowledge(self, tenant_id: int) -> Optional[Dict[str, Any]]:
        """Get all knowledge documents for a tenant."""
        result = await self.db.execute(
            select(ProductKnowledge).where(ProductKnowledge.tenant_id == tenant_id)
        )
        knowledge = result.scalars().first()

        if not knowledge:
            logger.debug(f"No knowledge found for tenant {tenant_id}")
            return None

        return knowledge.to_dict()

    async def update_knowledge_doc(
        self,
        tenant_id: int,
        doc_type: str,
        content: str,
        product_id: int = None,  # kept for backwards-compat, ignored
    ) -> ProductKnowledge:
        """Update a specific knowledge document for a tenant."""
        valid_types = [
            'strategy',
            'customer_segments',
            'competitive_landscape',
            'value_proposition',
            'metrics_and_targets'
        ]

        if doc_type not in valid_types:
            raise ValueError(f"Invalid doc_type: {doc_type}. Must be one of {valid_types}")

        result = await self.db.execute(
            select(ProductKnowledge).where(ProductKnowledge.tenant_id == tenant_id)
        )
        knowledge = result.scalars().first()

        if not knowledge:
            knowledge = ProductKnowledge(tenant_id=tenant_id)
            self.db.add(knowledge)
            logger.info(f"Created new knowledge record for tenant {tenant_id}")

        doc_field = f"{doc_type}_doc"
        setattr(knowledge, doc_field, content)

        await self.db.commit()
        await self.db.refresh(knowledge)

        logger.info(f"Updated {doc_type} for tenant {tenant_id}")

        return knowledge

    async def get_knowledge_summary(self, tenant_id: int) -> Dict[str, Any]:
        """Get a summary of what knowledge is available for a tenant."""
        knowledge = await self.get_product_knowledge(tenant_id)

        if not knowledge:
            return {
                'has_strategy': False,
                'has_customer_segments': False,
                'has_competitive_landscape': False,
                'has_value_proposition': False,
                'has_metrics_and_targets': False,
                'completeness_percentage': 0
            }

        has_docs = {
            'has_strategy': bool(knowledge.get('strategy_doc', '').strip()),
            'has_customer_segments': bool(knowledge.get('customer_segments_doc', '').strip()),
            'has_competitive_landscape': bool(knowledge.get('competitive_landscape_doc', '').strip()),
            'has_value_proposition': bool(knowledge.get('value_proposition_doc', '').strip()),
            'has_metrics_and_targets': bool(knowledge.get('metrics_and_targets_doc', '').strip())
        }

        filled_count = sum(has_docs.values())
        total_count = len(has_docs)
        completeness = int((filled_count / total_count) * 100)

        return {
            **has_docs,
            'completeness_percentage': completeness
        }

    async def delete_product_knowledge(self, tenant_id: int):
        """Delete all knowledge for a tenant."""
        result = await self.db.execute(
            select(ProductKnowledge).where(ProductKnowledge.tenant_id == tenant_id)
        )
        knowledge = result.scalars().first()

        if knowledge:
            await self.db.delete(knowledge)
            await self.db.commit()
            logger.info(f"Deleted knowledge for tenant {tenant_id}")
