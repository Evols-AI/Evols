"""
Background job scheduler for periodic tasks.
"""
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


class SchedulerService:
    """Manages scheduled background jobs"""

    def __init__(self):
        self.scheduler = AsyncIOScheduler()

    def start(self):
        """Start the scheduler"""
        self.scheduler.start()
        logger.info("Scheduler started")

        # Check for knowledge source refresh jobs every hour
        self.scheduler.add_job(
            self.check_knowledge_refresh_jobs,
            IntervalTrigger(hours=1),
            id='check_knowledge_refresh',
            name='Check Knowledge Source Refresh Jobs',
            replace_existing=True
        )

        # Run content cleanup job every 6 hours
        self.scheduler.add_job(
            self.run_content_cleanup,
            IntervalTrigger(hours=6),
            id='content_cleanup',
            name='Content Cleanup Job',
            replace_existing=True
        )

    def shutdown(self):
        """Shutdown the scheduler"""
        self.scheduler.shutdown()
        logger.info("Scheduler stopped")

    async def check_knowledge_refresh_jobs(self):
        """Check all tenants and refresh knowledge sources if needed"""
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(Tenant))
                tenants = result.scalars().all()

                for tenant in tenants:
                    await self._check_tenant_knowledge_refresh(db, tenant)
        except Exception as e:
            logger.error(f"Error in check_knowledge_refresh_jobs: {e}")

    async def _check_tenant_knowledge_refresh(self, db: AsyncSession, tenant: Tenant):
        """Check if a tenant needs knowledge source refresh"""
        settings = tenant.settings or {}

        if not settings.get('knowledge_refresh_enabled', False):
            return

        interval_days = settings.get('knowledge_refresh_interval_days', 7)
        last_refresh = settings.get('knowledge_last_refresh_date')

        # Check if refresh is due
        if last_refresh:
            try:
                # Strip 'Z' suffix if present for compatibility
                last_refresh_str = last_refresh.rstrip('Z')
                last_refresh_dt = datetime.fromisoformat(last_refresh_str)
                next_refresh = last_refresh_dt + timedelta(days=interval_days)

                if datetime.utcnow() < next_refresh:
                    return  # Not due yet
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid knowledge_last_refresh_date for tenant {tenant.id}: {e}")

        # Execute refresh
        logger.info(f"Running knowledge source refresh for tenant {tenant.id}")
        await self._refresh_knowledge_sources_for_tenant(db, tenant)

    async def _refresh_knowledge_sources_for_tenant(self, db: AsyncSession, tenant: Tenant):
        """Refresh all knowledge sources for a tenant"""
        try:
            from app.models.knowledge_base import KnowledgeSource
            from app.services.knowledge_extraction import KnowledgeExtractionService

            # Get all knowledge sources for this tenant
            result = await db.execute(
                select(KnowledgeSource).where(KnowledgeSource.tenant_id == tenant.id)
            )
            sources = result.scalars().all()

            if not sources:
                logger.info(f"No knowledge sources found for tenant {tenant.id}")
                return

            # Refresh each source
            extraction_service = KnowledgeExtractionService(db)
            refreshed_count = 0

            for source in sources:
                try:
                    logger.info(f"Refreshing knowledge source {source.id}: {source.name}")

                    # Delete existing capabilities for this source
                    from app.models.knowledge_base import Capability
                    await db.execute(
                        Capability.__table__.delete().where(Capability.source_id == source.id)
                    )

                    # Re-extract capabilities
                    count = await extraction_service.process_source(source)

                    logger.info(f"Refreshed source {source.id}: extracted {count} capabilities")
                    refreshed_count += 1

                except Exception as e:
                    logger.error(f"Failed to refresh source {source.id}: {e}")
                    continue

            # Update last refresh timestamp
            settings = tenant.settings or {}
            settings['knowledge_last_refresh_date'] = datetime.utcnow().isoformat() + 'Z'
            tenant.settings = settings

            # Mark as modified for SQLAlchemy to detect JSON change
            from sqlalchemy.orm import attributes
            attributes.flag_modified(tenant, 'settings')

            await db.commit()

            logger.info(
                f"Completed knowledge source refresh for tenant {tenant.id}: "
                f"{refreshed_count}/{len(sources)} sources refreshed"
            )
        except Exception as e:
            logger.error(f"Failed to refresh knowledge sources for tenant {tenant.id}: {e}")
            await db.rollback()

    async def run_content_cleanup(self):
        """Run content cleanup job to process scheduled content deletions"""
        try:
            from app.jobs.content_cleanup_job import run_content_cleanup_job

            result = await run_content_cleanup_job()
            logger.info(f"Content cleanup job completed: {result}")

        except Exception as e:
            logger.error(f"Error in content cleanup job: {e}")


# Global scheduler instance
scheduler_service = SchedulerService()
