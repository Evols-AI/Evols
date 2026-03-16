"""
Evidence Aggregation Service
Builds initiative evidence from extracted entities
"""

from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from collections import defaultdict
from loguru import logger

from app.models.context import (
    ExtractedEntity, ContextSource, InitiativeEvidence,
    EntityInitiativeLink
)


class EvidenceService:
    """Service for aggregating evidence for initiatives"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def build_initiative_evidence(
        self,
        initiative_id: int,
        tenant_id: int,
        entity_ids: Optional[List[int]] = None
    ) -> InitiativeEvidence:
        """
        Build or update evidence for an initiative from linked entities

        Args:
            initiative_id: Initiative to build evidence for
            tenant_id: Tenant ID
            entity_ids: Optional list of entity IDs to link (if provided, will create links)

        Returns:
            InitiativeEvidence record
        """
        # If entity_ids provided, create links first
        if entity_ids:
            await self._link_entities_to_initiative(initiative_id, tenant_id, entity_ids)

        # Get all entities linked to this initiative
        query = (
            select(ExtractedEntity, EntityInitiativeLink.relevance_score)
            .join(EntityInitiativeLink, ExtractedEntity.id == EntityInitiativeLink.entity_id)
            .where(
                and_(
                    EntityInitiativeLink.initiative_id == initiative_id,
                    EntityInitiativeLink.tenant_id == tenant_id
                )
            )
        )

        result = await self.db.execute(query)
        entities_with_scores = result.all()

        if not entities_with_scores:
            # No entities linked yet, return empty evidence
            evidence = await self._get_or_create_evidence(initiative_id, tenant_id)
            return evidence

        entities = [row[0] for row in entities_with_scores]

        # Aggregate metrics
        total_mentions = len(entities)

        # Aggregate by customer segment
        segments = defaultdict(int)
        for entity in entities:
            segment = entity.attributes.get('customer_segment', 'Unknown')
            segments[segment] += 1

        # Calculate total ARR impact
        total_arr = 0
        for entity in entities:
            arr_value = entity.attributes.get('arr_value', 0)
            if isinstance(arr_value, (int, float)):
                total_arr += arr_value

        # Get representative quotes (top 10 by confidence)
        quotes = []
        sorted_entities = sorted(entities, key=lambda e: e.confidence_score or 0, reverse=True)
        for entity in sorted_entities[:10]:
            if entity.context_snippet:
                quote_data = {
                    'text': entity.context_snippet,
                    'entity_id': entity.id,
                    'entity_type': entity.entity_type.value,
                    'confidence': entity.confidence_score
                }

                # Add customer metadata if available
                if 'customer_name' in entity.attributes:
                    quote_data['customer_name'] = entity.attributes['customer_name']
                if 'customer_segment' in entity.attributes:
                    quote_data['customer_segment'] = entity.attributes['customer_segment']
                if 'arr_value' in entity.attributes:
                    quote_data['customer_arr'] = entity.attributes['arr_value']
                if 'speaker_role' in entity.attributes:
                    quote_data['speaker_role'] = entity.attributes['speaker_role']
                if 'source_name' in entity.attributes:
                    quote_data['source_name'] = entity.attributes['source_name']
                if 'source_date' in entity.attributes:
                    quote_data['date'] = entity.attributes['source_date']

                quotes.append(quote_data)

        # Aggregate by source
        source_counts = defaultdict(lambda: {'count': 0, 'source_type': None, 'name': None})
        for entity in entities:
            source_id = entity.source_id
            source_counts[source_id]['count'] += 1
            if 'source_name' in entity.attributes:
                source_counts[source_id]['name'] = entity.attributes['source_name']
            if 'source_type' in entity.attributes:
                source_counts[source_id]['source_type'] = entity.attributes['source_type']

        sources = [
            {
                'source_id': source_id,
                'mention_count': data['count'],
                'name': data['name'],
                'source_type': data['source_type']
            }
            for source_id, data in source_counts.items()
        ]

        # Calculate average scores
        confidence_scores = [e.confidence_score for e in entities if e.confidence_score is not None]
        confidence_avg = sum(confidence_scores) / len(confidence_scores) if confidence_scores else None

        # Sentiment from attributes
        sentiments = []
        for entity in entities:
            sentiment_str = entity.attributes.get('sentiment')
            if sentiment_str == 'positive':
                sentiments.append(1.0)
            elif sentiment_str == 'negative':
                sentiments.append(-1.0)
            elif sentiment_str == 'neutral':
                sentiments.append(0.0)

        sentiment_avg = sum(sentiments) / len(sentiments) if sentiments else None

        # Create or update evidence
        evidence = await self._get_or_create_evidence(initiative_id, tenant_id)

        evidence.total_mentions = total_mentions
        evidence.total_arr_impacted = int(total_arr)
        evidence.customer_segments = dict(segments)
        evidence.representative_quotes = quotes
        evidence.sources = sources
        evidence.confidence_avg = confidence_avg
        evidence.sentiment_avg = sentiment_avg

        await self.db.commit()
        await self.db.refresh(evidence)

        logger.info(
            f"[EvidenceService] Built evidence for initiative {initiative_id}: "
            f"{total_mentions} mentions, ${total_arr} ARR, {len(quotes)} quotes"
        )

        return evidence

    async def _link_entities_to_initiative(
        self,
        initiative_id: int,
        tenant_id: int,
        entity_ids: List[int]
    ) -> None:
        """
        Link entities to an initiative

        Args:
            initiative_id: Initiative ID
            tenant_id: Tenant ID
            entity_ids: List of entity IDs to link
        """
        for entity_id in entity_ids:
            # Check if link already exists
            existing_query = select(EntityInitiativeLink).where(
                and_(
                    EntityInitiativeLink.entity_id == entity_id,
                    EntityInitiativeLink.initiative_id == initiative_id
                )
            )
            result = await self.db.execute(existing_query)
            existing = result.scalar_one_or_none()

            if not existing:
                # Create new link
                link = EntityInitiativeLink(
                    tenant_id=tenant_id,
                    entity_id=entity_id,
                    initiative_id=initiative_id,
                    relevance_score=1.0  # Default relevance
                )
                self.db.add(link)

        await self.db.commit()

    async def _get_or_create_evidence(
        self,
        initiative_id: int,
        tenant_id: int
    ) -> InitiativeEvidence:
        """Get existing evidence or create new"""
        query = select(InitiativeEvidence).where(
            and_(
                InitiativeEvidence.initiative_id == initiative_id,
                InitiativeEvidence.tenant_id == tenant_id
            )
        )
        result = await self.db.execute(query)
        evidence = result.scalar_one_or_none()

        if not evidence:
            evidence = InitiativeEvidence(
                tenant_id=tenant_id,
                initiative_id=initiative_id,
                total_mentions=0,
                total_arr_impacted=0
            )
            self.db.add(evidence)
            await self.db.commit()
            await self.db.refresh(evidence)

        return evidence

    async def get_initiative_evidence(
        self,
        initiative_id: int,
        tenant_id: int
    ) -> Optional[InitiativeEvidence]:
        """
        Get evidence for an initiative

        Args:
            initiative_id: Initiative ID
            tenant_id: Tenant ID

        Returns:
            InitiativeEvidence or None
        """
        query = select(InitiativeEvidence).where(
            and_(
                InitiativeEvidence.initiative_id == initiative_id,
                InitiativeEvidence.tenant_id == tenant_id
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_supporting_entities(
        self,
        initiative_id: int,
        tenant_id: int,
        limit: int = 50
    ) -> List[ExtractedEntity]:
        """
        Get entities supporting an initiative

        Args:
            initiative_id: Initiative ID
            tenant_id: Tenant ID
            limit: Maximum entities to return

        Returns:
            List of ExtractedEntity objects
        """
        query = (
            select(ExtractedEntity)
            .join(EntityInitiativeLink, ExtractedEntity.id == EntityInitiativeLink.entity_id)
            .where(
                and_(
                    EntityInitiativeLink.initiative_id == initiative_id,
                    EntityInitiativeLink.tenant_id == tenant_id
                )
            )
            .order_by(EntityInitiativeLink.relevance_score.desc())
            .limit(limit)
        )

        result = await self.db.execute(query)
        return result.scalars().all()
