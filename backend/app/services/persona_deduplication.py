"""
Persona deduplication service using semantic similarity.
"""
import logging
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.persona import Persona
from app.services.embedding_service import EmbeddingService, cosine_similarity

logger = logging.getLogger(__name__)


class PersonaDeduplicationService:
    """Detect duplicate personas using embedding similarity"""

    SIMILARITY_THRESHOLD = 0.70  # Lowered from 0.85 for better duplicate detection

    def __init__(self, db: AsyncSession, tenant_config: Optional[Dict[str, Any]] = None):
        self.db = db
        self.embedding_service = EmbeddingService()

    async def find_duplicates(
        self,
        candidate_persona: Dict[str, Any],
        tenant_id: int
    ) -> List[Tuple[Persona, float]]:
        """
        Find existing personas similar to candidate.

        Args:
            candidate_persona: Dict with name, description, segment, persona_summary
            tenant_id: Tenant ID

        Returns:
            List of (persona, similarity_score) tuples above threshold
        """
        # Create embedding for candidate
        candidate_text = self._create_persona_text(candidate_persona)
        logger.info(f"Candidate text: {candidate_text[:100]}...")

        try:
            candidate_embedding = await self.embedding_service.embed_text(candidate_text)
            logger.info(f"Candidate embedding shape: {len(candidate_embedding)}")
        except Exception as e:
            logger.warning(f"Failed to get embedding for candidate persona: {e}")
            return []

        # Get all existing personas for tenant (any status)
        result = await self.db.execute(
            select(Persona).where(Persona.tenant_id == tenant_id)
        )
        existing_personas = result.scalars().all()
        logger.info(f"Checking against {len(existing_personas)} existing personas")

        duplicates = []
        candidate_name = candidate_persona.get('name', '').lower().strip()
        candidate_segment = candidate_persona.get('segment', '').lower().strip()
        print(f"[DEDUP] Checking candidate: '{candidate_name}' | segment: '{candidate_segment}'")

        for existing in existing_personas:
            # Quick exact match check first (name + segment)
            existing_name = existing.name.lower().strip() if existing.name else ''
            existing_segment = existing.segment.lower().strip() if existing.segment else ''

            if candidate_name == existing_name and candidate_segment == existing_segment:
                # Exact match on name + segment - definitely a duplicate
                print(f"[DEDUP] ✓ EXACT MATCH: '{existing.name}' ({existing.status})")
                logger.info(f"✓ Found exact name+segment match: {existing.name} ({existing.status})")
                duplicates.append((existing, 1.0))  # Perfect similarity score
                continue

            # No exact match - do semantic similarity check
            existing_text = self._create_persona_text({
                'name': existing.name,
                'description': existing.description or '',
                'segment': existing.segment or '',
                'persona_summary': existing.persona_summary or ''
            })

            try:
                existing_embedding = await self.embedding_service.embed_text(existing_text)

                similarity = cosine_similarity(
                    candidate_embedding,
                    existing_embedding
                )

                logger.info(f"Similarity with '{existing.name}' ({existing.status}): {similarity:.4f}")

                if similarity >= self.SIMILARITY_THRESHOLD:
                    duplicates.append((existing, similarity))
                    logger.info(f"✓ Found semantic duplicate: {existing.name} ({similarity:.2%} similar)")
            except Exception as e:
                logger.warning(f"Failed to compare with persona {existing.id}: {e}")
                continue

        # Sort by similarity descending
        duplicates.sort(key=lambda x: x[1], reverse=True)
        return duplicates

    def _create_persona_text(self, persona_dict: Dict[str, Any]) -> str:
        """Create searchable text from persona attributes"""
        parts = [
            persona_dict.get('name', ''),
            persona_dict.get('segment', ''),
            persona_dict.get('description', ''),
            persona_dict.get('persona_summary', '')
        ]
        return ' '.join(filter(None, parts))
