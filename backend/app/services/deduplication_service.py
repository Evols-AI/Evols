"""
Deduplication Service
Handles content and entity deduplication across three levels
"""

import hashlib
from typing import List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from loguru import logger

from app.models.context import (
    ContextSource, ExtractedEntity, SourceGroup, EntityDuplicate
)


class DeduplicationService:
    """Service for detecting and managing duplicate content and entities"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ========================================
    # Phase 1: Content Hash Detection
    # ========================================

    def compute_content_hash(self, content: str) -> str:
        """
        Compute SHA-256 hash of content for duplicate detection

        Args:
            content: Text content to hash

        Returns:
            64-character hex string
        """
        # Normalize content (strip whitespace, lowercase) for better matching
        normalized = content.strip().lower()
        return hashlib.sha256(normalized.encode('utf-8')).hexdigest()

    async def find_duplicate_source(
        self,
        content_hash: str,
        tenant_id: int,
        exclude_id: Optional[int] = None
    ) -> Optional[ContextSource]:
        """
        Find existing source with same content hash

        Args:
            content_hash: SHA-256 hash to search for
            tenant_id: Tenant ID for scoping
            exclude_id: Optional source ID to exclude from search

        Returns:
            ContextSource if duplicate found, None otherwise
        """
        query = select(ContextSource).where(
            and_(
                ContextSource.tenant_id == tenant_id,
                ContextSource.content_hash == content_hash
            )
        )

        if exclude_id:
            query = query.where(ContextSource.id != exclude_id)

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def link_to_existing_source(
        self,
        new_source: ContextSource,
        existing_source: ContextSource
    ) -> None:
        """
        Link new source as duplicate of existing source

        Args:
            new_source: Newly uploaded source
            existing_source: Existing source with same content
        """
        new_source.duplicate_of_id = existing_source.id
        new_source.is_primary = False

        # Copy extracted entities from existing source
        if existing_source.entities_extracted_count > 0:
            # Get entities from existing source
            entity_query = select(ExtractedEntity).where(
                ExtractedEntity.source_id == existing_source.id
            )
            result = await self.db.execute(entity_query)
            existing_entities = result.scalars().all()

            # Create copies for new source
            for entity in existing_entities:
                new_entity = ExtractedEntity(
                    tenant_id=new_source.tenant_id,
                    product_id=new_source.product_id,
                    source_id=new_source.id,
                    entity_type=entity.entity_type,
                    name=entity.name,
                    description=entity.description,
                    confidence_score=entity.confidence_score,
                    category=entity.category,
                    attributes=entity.attributes,
                    context_snippet=entity.context_snippet,
                )
                self.db.add(new_entity)

            new_source.entities_extracted_count = len(existing_entities)

        await self.db.commit()
        logger.info(
            f"[Dedup] Linked source {new_source.id} as duplicate of {existing_source.id}"
        )

    # ========================================
    # Phase 1.5: Source Grouping
    # ========================================

    async def create_source_group(
        self,
        name: str,
        tenant_id: int,
        source_ids: List[int],
        event_date: Optional[str] = None,
        description: Optional[str] = None
    ) -> SourceGroup:
        """
        Create a source group for related sources (same meeting/event)

        Args:
            name: Group name (e.g., "Acme CEO Interview - March 2024")
            tenant_id: Tenant ID
            source_ids: List of source IDs to group
            event_date: Optional event date
            description: Optional description

        Returns:
            Created SourceGroup
        """
        # Create group
        group = SourceGroup(
            tenant_id=tenant_id,
            name=name,
            description=description,
            event_date=event_date,
            primary_source_id=source_ids[0] if source_ids else None
        )

        self.db.add(group)
        await self.db.commit()
        await self.db.refresh(group)

        # Link sources to group
        for source_id in source_ids:
            source = await self.db.get(ContextSource, source_id)
            if source and source.tenant_id == tenant_id:
                source.source_group_id = group.id
                source.is_primary = (source_id == source_ids[0])

        await self.db.commit()

        logger.info(
            f"[Dedup] Created source group {group.id} with {len(source_ids)} sources"
        )

        return group

    async def get_source_group_sources(
        self,
        group_id: int,
        tenant_id: int
    ) -> List[ContextSource]:
        """Get all sources in a group"""
        query = select(ContextSource).where(
            and_(
                ContextSource.source_group_id == group_id,
                ContextSource.tenant_id == tenant_id
            )
        ).order_by(ContextSource.is_primary.desc(), ContextSource.created_at)

        result = await self.db.execute(query)
        return result.scalars().all()

    # ========================================
    # Phase 2: Entity Semantic Deduplication
    # ========================================

    async def find_similar_entities(
        self,
        entity: ExtractedEntity,
        similarity_threshold: float = 0.90,
        limit: int = 5
    ) -> List[Tuple[ExtractedEntity, float]]:
        """
        Find entities similar to given entity using embeddings

        Args:
            entity: Entity to find duplicates for
            similarity_threshold: Minimum similarity score (0-1)
            limit: Maximum results to return

        Returns:
            List of (similar_entity, similarity_score) tuples
        """
        if not entity.embedding:
            return []

        # Use pgvector cosine distance
        # cosine_distance = 1 - cosine_similarity
        # So distance < (1 - threshold) means similarity > threshold
        max_distance = 1 - similarity_threshold

        query = (
            select(ExtractedEntity)
            .where(
                and_(
                    ExtractedEntity.tenant_id == entity.tenant_id,
                    ExtractedEntity.entity_type == entity.entity_type,
                    ExtractedEntity.id != entity.id,
                    ExtractedEntity.embedding.cosine_distance(entity.embedding) < max_distance
                )
            )
            .order_by(ExtractedEntity.embedding.cosine_distance(entity.embedding))
            .limit(limit)
        )

        result = await self.db.execute(query)
        similar_entities = result.scalars().all()

        # Calculate similarity scores (1 - distance)
        entities_with_scores = []
        for similar_entity in similar_entities:
            # Recalculate actual similarity
            distance = await self._calculate_cosine_distance(
                entity.embedding, similar_entity.embedding
            )
            similarity = 1 - distance
            entities_with_scores.append((similar_entity, similarity))

        return entities_with_scores

    async def _calculate_cosine_distance(self, embedding1, embedding2) -> float:
        """Calculate cosine distance between two embeddings"""
        # This is a placeholder - pgvector handles this in SQL
        # For manual calculation if needed:
        # import numpy as np
        # return 1 - np.dot(embedding1, embedding2) / (np.linalg.norm(embedding1) * np.linalg.norm(embedding2))
        return 0.1  # Placeholder

    async def mark_as_duplicate(
        self,
        primary_entity_id: int,
        duplicate_entity_id: int,
        tenant_id: int,
        similarity_score: float
    ) -> EntityDuplicate:
        """
        Mark entity as duplicate of another

        Args:
            primary_entity_id: Primary (kept) entity ID
            duplicate_entity_id: Duplicate entity ID
            tenant_id: Tenant ID
            similarity_score: Similarity score (0-1)

        Returns:
            Created EntityDuplicate record
        """
        # Check if already marked
        existing_query = select(EntityDuplicate).where(
            or_(
                and_(
                    EntityDuplicate.primary_entity_id == primary_entity_id,
                    EntityDuplicate.duplicate_entity_id == duplicate_entity_id
                ),
                and_(
                    EntityDuplicate.primary_entity_id == duplicate_entity_id,
                    EntityDuplicate.duplicate_entity_id == primary_entity_id
                )
            )
        )
        result = await self.db.execute(existing_query)
        if result.scalar_one_or_none():
            logger.warning(
                f"[Dedup] Entity duplicate already exists: {primary_entity_id} <-> {duplicate_entity_id}"
            )
            return result.scalar_one()

        # Create duplicate record
        duplicate_record = EntityDuplicate(
            tenant_id=tenant_id,
            primary_entity_id=primary_entity_id,
            duplicate_entity_id=duplicate_entity_id,
            similarity_score=similarity_score
        )

        self.db.add(duplicate_record)
        await self.db.commit()
        await self.db.refresh(duplicate_record)

        logger.info(
            f"[Dedup] Marked entity {duplicate_entity_id} as duplicate of {primary_entity_id} "
            f"(similarity: {similarity_score:.2f})"
        )

        return duplicate_record

    async def merge_entities(
        self,
        primary_entity_id: int,
        duplicate_entity_id: int,
        tenant_id: int
    ) -> ExtractedEntity:
        """
        Merge duplicate entity into primary entity

        Args:
            primary_entity_id: Entity to keep
            duplicate_entity_id: Entity to merge (will be marked as merged)
            tenant_id: Tenant ID

        Returns:
            Updated primary entity
        """
        # Get both entities
        primary = await self.db.get(ExtractedEntity, primary_entity_id)
        duplicate = await self.db.get(ExtractedEntity, duplicate_entity_id)

        if not primary or not duplicate:
            raise ValueError("Entity not found")

        if primary.tenant_id != tenant_id or duplicate.tenant_id != tenant_id:
            raise ValueError("Tenant mismatch")

        # Merge attributes (combine unique values)
        if duplicate.attributes:
            if not primary.attributes:
                primary.attributes = {}
            for key, value in duplicate.attributes.items():
                if key not in primary.attributes:
                    primary.attributes[key] = value

        # Keep higher confidence score
        if duplicate.confidence_score and (
            not primary.confidence_score or duplicate.confidence_score > primary.confidence_score
        ):
            primary.confidence_score = duplicate.confidence_score

        # Combine context snippets
        if duplicate.context_snippet and duplicate.context_snippet not in (primary.context_snippet or ''):
            primary.context_snippet = (
                f"{primary.context_snippet or ''}\n---\n{duplicate.context_snippet}"
            )[:200]  # Keep within limit

        # Mark duplicate as merged
        duplicate_record_query = select(EntityDuplicate).where(
            and_(
                EntityDuplicate.primary_entity_id == primary_entity_id,
                EntityDuplicate.duplicate_entity_id == duplicate_entity_id
            )
        )
        result = await self.db.execute(duplicate_record_query)
        duplicate_record = result.scalar_one_or_none()

        if duplicate_record:
            from datetime import datetime
            duplicate_record.merged_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(primary)

        logger.info(
            f"[Dedup] Merged entity {duplicate_entity_id} into {primary_entity_id}"
        )

        return primary

    # ========================================
    # Phase 3: Evidence Deduplication
    # ========================================

    async def get_unique_entities_for_evidence(
        self,
        entity_ids: List[int],
        tenant_id: int
    ) -> List[ExtractedEntity]:
        """
        Get unique entities for evidence building, filtering out duplicates

        Strategy:
        1. Group entities by source group (if grouped)
        2. For ungrouped sources, use content_hash
        3. Keep highest confidence entity from each group

        Args:
            entity_ids: List of entity IDs
            tenant_id: Tenant ID

        Returns:
            Deduplicated list of entities
        """
        # Get all entities with their source information
        query = (
            select(ExtractedEntity, ContextSource)
            .join(ContextSource, ExtractedEntity.source_id == ContextSource.id)
            .where(
                and_(
                    ExtractedEntity.id.in_(entity_ids),
                    ExtractedEntity.tenant_id == tenant_id
                )
            )
        )

        result = await self.db.execute(query)
        entities_with_sources = result.all()

        # Group by dedup key (source_group_id or content_hash or source_id)
        entity_groups = {}
        for entity, source in entities_with_sources:
            # Determine dedup key
            if source.source_group_id:
                dedup_key = f"group_{source.source_group_id}"
            elif source.content_hash:
                dedup_key = f"hash_{source.content_hash}"
            else:
                dedup_key = f"source_{source.id}"

            if dedup_key not in entity_groups:
                entity_groups[dedup_key] = []
            entity_groups[dedup_key].append(entity)

        # Keep highest confidence entity from each group
        unique_entities = []
        for group in entity_groups.values():
            best_entity = max(group, key=lambda e: e.confidence_score or 0)
            unique_entities.append(best_entity)

        logger.info(
            f"[Dedup] Deduplicated {len(entity_ids)} entities to {len(unique_entities)} unique"
        )

        return unique_entities

    async def get_deduplication_stats(self, tenant_id: int) -> dict:
        """Get deduplication statistics for tenant"""
        # Duplicate sources
        duplicate_sources_query = select(func.count(ContextSource.id)).where(
            and_(
                ContextSource.tenant_id == tenant_id,
                ContextSource.duplicate_of_id.isnot(None)
            )
        )
        result = await self.db.execute(duplicate_sources_query)
        duplicate_sources = result.scalar() or 0

        # Source groups
        groups_query = select(func.count(SourceGroup.id)).where(
            SourceGroup.tenant_id == tenant_id
        )
        result = await self.db.execute(groups_query)
        source_groups = result.scalar() or 0

        # Duplicate entities
        duplicate_entities_query = select(func.count(EntityDuplicate.id)).where(
            EntityDuplicate.tenant_id == tenant_id
        )
        result = await self.db.execute(duplicate_entities_query)
        duplicate_entities = result.scalar() or 0

        # Merged entities
        merged_entities_query = select(func.count(EntityDuplicate.id)).where(
            and_(
                EntityDuplicate.tenant_id == tenant_id,
                EntityDuplicate.merged_at.isnot(None)
            )
        )
        result = await self.db.execute(merged_entities_query)
        merged_entities = result.scalar() or 0

        return {
            'duplicate_sources': duplicate_sources,
            'source_groups': source_groups,
            'duplicate_entities': duplicate_entities,
            'merged_entities': merged_entities
        }
