"""
PM deduplication service using semantic similarity for work context entities.
"""
import logging
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.work_context import ActiveProject, Task, KeyRelationship
from app.services.embedding_service import EmbeddingService, cosine_similarity

logger = logging.getLogger(__name__)


class PMDeduplicationService:
    """Detect duplicate PM entities using embedding similarity"""

    # Different thresholds for different entity types
    PROJECT_SIMILARITY_THRESHOLD = 0.72  # Lowered to catch cases like "SSO Integration" vs "Enterprise SSO Integration"
    TASK_SIMILARITY_THRESHOLD = 0.75     # Lowered to catch duplicate tasks with similar descriptions
    RELATIONSHIP_SIMILARITY_THRESHOLD = 0.75

    def __init__(self, db: AsyncSession, tenant_config: Optional[Dict[str, Any]] = None):
        self.db = db
        self.embedding_service = EmbeddingService()

    async def find_duplicate_projects(
        self,
        candidate_project: Dict[str, Any],
        user_id: int
    ) -> List[Tuple[ActiveProject, float]]:
        """
        Find existing projects similar to candidate.

        Args:
            candidate_project: Dict with name, status, role, notes
            user_id: User ID

        Returns:
            List of (project, similarity_score) tuples above threshold
        """
        candidate_text = self._create_project_text(candidate_project)
        logger.info(f"[PM-DEDUP] Checking project candidate: '{candidate_project.get('name', '')}'")

        try:
            candidate_embedding = await self.embedding_service.embed_text(candidate_text)
        except Exception as e:
            logger.warning(f"Failed to get embedding for candidate project: {e}")
            return []

        # Get all existing projects for user
        result = await self.db.execute(
            select(ActiveProject).where(ActiveProject.user_id == user_id)
        )
        existing_projects = result.scalars().all()
        logger.info(f"[PM-DEDUP] Checking against {len(existing_projects)} existing projects")

        duplicates = []
        candidate_name = candidate_project.get('name', '').lower().strip()

        for existing in existing_projects:
            # Quick exact match check first
            existing_name = existing.name.lower().strip() if existing.name else ''

            if candidate_name == existing_name:
                # Exact match - definitely a duplicate
                logger.info(f"[PM-DEDUP] ✓ Found exact project match: '{existing.name}' ({existing.status.value})")
                duplicates.append((existing, 1.0))  # Perfect similarity score
                continue

            # No exact match - do semantic similarity check
            existing_text = self._create_project_text({
                'name': existing.name,
                'status': existing.status.value if existing.status else '',
                'role': existing.role.value if existing.role else '',
                'notes': existing.notes or ''
            })

            try:
                existing_embedding = await self.embedding_service.embed_text(existing_text)
                similarity = cosine_similarity(candidate_embedding, existing_embedding)

                logger.info(f"[PM-DEDUP] Similarity with '{existing.name}' ({existing.status.value}): {similarity:.4f}")

                if similarity >= self.PROJECT_SIMILARITY_THRESHOLD:
                    duplicates.append((existing, similarity))
                    logger.info(f"[PM-DEDUP] ✓ Found semantic project duplicate: {existing.name} ({similarity:.2%} similar)")
            except Exception as e:
                logger.warning(f"Failed to compare with project {existing.id}: {e}")
                continue

        # Sort by similarity descending
        duplicates.sort(key=lambda x: x[1], reverse=True)
        return duplicates

    async def find_duplicate_tasks(
        self,
        candidate_task: Dict[str, Any],
        user_id: int
    ) -> List[Tuple[Task, float]]:
        """
        Find existing tasks similar to candidate.

        Args:
            candidate_task: Dict with title, priority, description
            user_id: User ID

        Returns:
            List of (task, similarity_score) tuples above threshold
        """
        candidate_text = self._create_task_text(candidate_task)
        logger.info(f"[PM-DEDUP] Checking task candidate: '{candidate_task.get('title', '')}'")

        try:
            candidate_embedding = await self.embedding_service.embed_text(candidate_text)
        except Exception as e:
            logger.warning(f"Failed to get embedding for candidate task: {e}")
            return []

        # Get all existing active tasks for user (exclude completed)
        from app.models.work_context import TaskStatus
        result = await self.db.execute(
            select(Task).where(
                Task.user_id == user_id,
                Task.status != TaskStatus.COMPLETED
            )
        )
        existing_tasks = result.scalars().all()
        logger.info(f"[PM-DEDUP] Checking against {len(existing_tasks)} existing active tasks")

        duplicates = []
        candidate_title = candidate_task.get('title', '').lower().strip()

        for existing in existing_tasks:
            # Quick exact match check first
            existing_title = existing.title.lower().strip() if existing.title else ''

            if candidate_title == existing_title:
                # Exact match - definitely a duplicate
                logger.info(f"[PM-DEDUP] ✓ Found exact task match: '{existing.title}' ({existing.status.value})")
                duplicates.append((existing, 1.0))  # Perfect similarity score
                continue

            # No exact match - do semantic similarity check
            existing_text = self._create_task_text({
                'title': existing.title,
                'priority': existing.priority.value if existing.priority else '',
                'description': existing.description or ''
            })

            try:
                existing_embedding = await self.embedding_service.embed_text(existing_text)
                similarity = cosine_similarity(candidate_embedding, existing_embedding)

                logger.info(f"[PM-DEDUP] Similarity with '{existing.title}' ({existing.status.value}): {similarity:.4f}")

                if similarity >= self.TASK_SIMILARITY_THRESHOLD:
                    duplicates.append((existing, similarity))
                    logger.info(f"[PM-DEDUP] ✓ Found semantic task duplicate: {existing.title} ({similarity:.2%} similar)")
            except Exception as e:
                logger.warning(f"Failed to compare with task {existing.id}: {e}")
                continue

        # Sort by similarity descending
        duplicates.sort(key=lambda x: x[1], reverse=True)
        return duplicates

    async def find_duplicate_relationships(
        self,
        candidate_relationship: Dict[str, Any],
        user_id: int
    ) -> List[Tuple[KeyRelationship, float]]:
        """
        Find existing relationships similar to candidate.

        Args:
            candidate_relationship: Dict with name, role, relationship_type, current_dynamic
            user_id: User ID

        Returns:
            List of (relationship, similarity_score) tuples above threshold
        """
        candidate_text = self._create_relationship_text(candidate_relationship)
        logger.info(f"[PM-DEDUP] Checking relationship candidate: '{candidate_relationship.get('name', '')}'")

        try:
            candidate_embedding = await self.embedding_service.embed_text(candidate_text)
        except Exception as e:
            logger.warning(f"Failed to get embedding for candidate relationship: {e}")
            return []

        # Get all existing relationships for user
        result = await self.db.execute(
            select(KeyRelationship).where(KeyRelationship.user_id == user_id)
        )
        existing_relationships = result.scalars().all()
        logger.info(f"[PM-DEDUP] Checking against {len(existing_relationships)} existing relationships")

        duplicates = []
        candidate_name = candidate_relationship.get('name', '').lower().strip()

        for existing in existing_relationships:
            # Quick exact match check first
            existing_name = existing.name.lower().strip() if existing.name else ''

            if candidate_name == existing_name:
                # Exact match - definitely a duplicate
                logger.info(f"[PM-DEDUP] ✓ Found exact relationship match: '{existing.name}' ({existing.relationship_type})")
                duplicates.append((existing, 1.0))  # Perfect similarity score
                continue

            # No exact match - do semantic similarity check
            existing_text = self._create_relationship_text({
                'name': existing.name,
                'role': existing.role or '',
                'relationship_type': existing.relationship_type or '',
                'current_dynamic': existing.current_dynamic or ''
            })

            try:
                existing_embedding = await self.embedding_service.embed_text(existing_text)
                similarity = cosine_similarity(candidate_embedding, existing_embedding)

                logger.info(f"[PM-DEDUP] Similarity with '{existing.name}' ({existing.relationship_type}): {similarity:.4f}")

                if similarity >= self.RELATIONSHIP_SIMILARITY_THRESHOLD:
                    duplicates.append((existing, similarity))
                    logger.info(f"[PM-DEDUP] ✓ Found semantic relationship duplicate: {existing.name} ({similarity:.2%} similar)")
            except Exception as e:
                logger.warning(f"Failed to compare with relationship {existing.id}: {e}")
                continue

        # Sort by similarity descending
        duplicates.sort(key=lambda x: x[1], reverse=True)
        return duplicates

    def _create_project_text(self, project_dict: Dict[str, Any]) -> str:
        """Create searchable text from project attributes"""
        parts = [
            project_dict.get('name', ''),
            project_dict.get('status', ''),
            project_dict.get('role', ''),
            project_dict.get('notes', '')
        ]
        return ' '.join(filter(None, parts))

    def _create_task_text(self, task_dict: Dict[str, Any]) -> str:
        """Create searchable text from task attributes"""
        parts = [
            task_dict.get('title', ''),
            task_dict.get('priority', ''),
            task_dict.get('description', '')
        ]
        return ' '.join(filter(None, parts))

    def _create_relationship_text(self, relationship_dict: Dict[str, Any]) -> str:
        """Create searchable text from relationship attributes"""
        parts = [
            relationship_dict.get('name', ''),
            relationship_dict.get('role', ''),
            relationship_dict.get('relationship_type', ''),
            relationship_dict.get('current_dynamic', '')
        ]
        return ' '.join(filter(None, parts))