"""
Service for refreshing personas with new VoC data.
"""
import logging
from sqlalchemy import and_, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.persona import Persona

logger = logging.getLogger(__name__)


class PersonaRefreshService:
    """Refresh personas with latest VoC data"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def refresh_new_personas(self, tenant_id: int):
        """
        Refresh only 'new' personas. Active and Inactive personas are protected.

        Steps:
        1. Delete all personas with status='new'
        2. Regenerate personas from feedback
        3. New personas get status='new' automatically
        4. Duplicate detection prevents recreating Active/Inactive personas
        """
        # Delete all 'new' personas
        delete_stmt = delete(Persona).where(
            and_(
                Persona.tenant_id == tenant_id,
                Persona.status == 'new'
            )
        )
        result = await self.db.execute(delete_stmt)
        deleted_count = result.rowcount
        await self.db.commit()

        logger.info(f"Deleted {deleted_count} 'new' personas for tenant {tenant_id}")

        # Regenerate personas using existing generation logic
        # Import here to avoid circular dependency
        from app.api.v1.endpoints.personas import auto_generate_personas

        result = await auto_generate_personas(tenant_id=tenant_id, db=self.db)

        logger.info(f"Regenerated personas for tenant {tenant_id}")

        return result
