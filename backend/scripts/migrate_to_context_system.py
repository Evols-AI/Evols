"""
Data Migration Script: Migrate existing Feedback and KnowledgeSource to Context System
Usage: python scripts/migrate_to_context_system.py
"""

import sys
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

# Add parent directory to path for imports
sys.path.insert(0, '/Users/akshay/Desktop/workspace/evols/backend')

from app.core.config import settings
from app.models.feedback import Feedback
from app.models.knowledge_base import KnowledgeSource
from app.models.context import ContextSource, ContextSourceType, ContextProcessingStatus


async def migrate_feedback_to_context(session: AsyncSession):
    """Migrate feedback items to context sources"""
    print("\n📋 Migrating feedback items to context sources...")

    # Get all feedback
    result = await session.execute(select(Feedback))
    feedback_items = result.scalars().all()

    migrated = 0
    skipped = 0

    for feedback in feedback_items:
        # Check if already migrated (by checking if context source with same source_id exists)
        existing = await session.execute(
            select(ContextSource).where(
                ContextSource.source_id == str(feedback.id),
                ContextSource.source_type == ContextSourceType.INTERCOM  # Use intercom as default for feedback
            )
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        # Map feedback source to context source type
        source_type_map = {
            'intercom': ContextSourceType.INTERCOM,
            'zendesk': ContextSourceType.ZENDESK,
            'productboard': ContextSourceType.PRODUCTBOARD,
            'manual_upload': ContextSourceType.MANUAL_UPLOAD,
            'api': ContextSourceType.API,
        }

        context_source = ContextSource(
            tenant_id=feedback.tenant_id,
            product_id=feedback.product_id,
            source_type=source_type_map.get(feedback.source.value, ContextSourceType.MANUAL_UPLOAD),
            name=feedback.title or f"Feedback from {feedback.customer_name or 'Unknown'}",
            description=f"Migrated from feedback system. Category: {feedback.category.value if feedback.category else 'N/A'}",
            source_id=str(feedback.id),
            source_url=feedback.source_url,
            content=feedback.content,
            raw_content=feedback.raw_content,
            account_id=feedback.account_id,
            customer_name=feedback.customer_name,
            customer_email=feedback.customer_email,
            customer_segment=feedback.customer_segment,
            source_date=feedback.feedback_date,
            status=ContextProcessingStatus.COMPLETED,  # Mark as completed since already processed
            embedding=feedback.embedding,
            sentiment_score=feedback.sentiment_score,
            urgency_score=feedback.urgency_score,
            impact_score=feedback.impact_score,
            theme_id=feedback.theme_id,
            theme_confidence=feedback.theme_confidence,
            tags=feedback.tags,
            extra_data={
                'original_feedback_id': feedback.id,
                'category': feedback.category.value if feedback.category else None,
                'auto_category': feedback.auto_category.value if feedback.auto_category else None,
                'manual_category': feedback.manual_category.value if feedback.manual_category else None,
            }
        )

        session.add(context_source)
        migrated += 1

        if migrated % 100 == 0:
            await session.commit()
            print(f"   Migrated {migrated} feedback items...")

    await session.commit()
    print(f"✅ Migrated {migrated} feedback items, skipped {skipped} (already migrated)")


async def migrate_knowledge_sources_to_context(session: AsyncSession):
    """Migrate knowledge sources to context sources"""
    print("\n📚 Migrating knowledge sources to context sources...")

    # Get all knowledge sources
    result = await session.execute(select(KnowledgeSource))
    knowledge_sources = result.scalars().all()

    migrated = 0
    skipped = 0

    for ks in knowledge_sources:
        # Check if already migrated
        existing = await session.execute(
            select(ContextSource).where(
                ContextSource.source_id == str(ks.id),
                ContextSource.source_type.in_([
                    ContextSourceType.WEB_PAGE,
                    ContextSourceType.DOCUMENT_PDF,
                    ContextSourceType.GITHUB_REPO,
                    ContextSourceType.MCP_SERVER
                ])
            )
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        # Map knowledge source type to context source type
        source_type_map = {
            'url': ContextSourceType.WEB_PAGE,
            'pdf': ContextSourceType.DOCUMENT_PDF,
            'github': ContextSourceType.GITHUB_REPO,
            'mcp': ContextSourceType.MCP_SERVER,
        }

        # Map status
        status_map = {
            'pending': ContextProcessingStatus.PENDING,
            'processing': ContextProcessingStatus.PROCESSING,
            'completed': ContextProcessingStatus.COMPLETED,
            'failed': ContextProcessingStatus.FAILED,
        }

        context_source = ContextSource(
            tenant_id=ks.tenant_id,
            product_id=ks.product_id,
            source_type=source_type_map.get(ks.type, ContextSourceType.WEB_PAGE),
            name=ks.name,
            description=ks.description or f"Migrated from knowledge source system. Type: {ks.type}",
            source_id=str(ks.id),
            source_url=ks.url,
            file_path=ks.file_path,
            mcp_endpoint=ks.mcp_endpoint,
            github_repo=ks.github_repo,
            last_synced_at=ks.last_synced_at,
            status=status_map.get(ks.status, ContextProcessingStatus.PENDING),
            error_message=ks.error_message,
            entities_extracted_count=ks.capabilities_extracted,
            extra_data={
                'original_knowledge_source_id': ks.id,
                'type': ks.type,
                **(ks.extra_data or {})
            }
        )

        session.add(context_source)
        migrated += 1

        if migrated % 100 == 0:
            await session.commit()
            print(f"   Migrated {migrated} knowledge sources...")

    await session.commit()
    print(f"✅ Migrated {migrated} knowledge sources, skipped {skipped} (already migrated)")


async def main():
    print("=" * 60)
    print("Context System Data Migration")
    print("=" * 60)
    print("\nThis script will migrate existing:")
    print("  - Feedback items → Context sources (feedback type)")
    print("  - Knowledge sources → Context sources (docs type)")
    print("\nNote: Original tables will NOT be deleted or modified.")
    print("=" * 60)

    # Confirm
    response = input("\nProceed with migration? (yes/no): ")
    if response.lower() != 'yes':
        print("Migration cancelled.")
        return

    # Create async engine
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
    )

    # Create async session
    AsyncSessionLocal = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with AsyncSessionLocal() as session:
        try:
            # Migrate feedback
            await migrate_feedback_to_context(session)

            # Migrate knowledge sources
            await migrate_knowledge_sources_to_context(session)

            print("\n" + "=" * 60)
            print("✅ Migration completed successfully!")
            print("=" * 60)
            print("\nYou can now:")
            print("  1. Test the new Context page at /context")
            print("  2. Verify data migrated correctly")
            print("  3. Consider deprecating old /feedback and /knowledge-base pages")
            print("=" * 60)

        except Exception as e:
            print(f"\n❌ Error during migration: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
