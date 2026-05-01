#!/usr/bin/env python3
"""
Regenerate embeddings for knowledge entries with null/inconsistent embeddings.

Usage:
    python regenerate_embeddings.py --tenant-id 13
    python regenerate_embeddings.py --all  # All tenants
"""

import argparse
import asyncio

from app.core.database import AsyncSessionLocal
from app.models.team_knowledge import KnowledgeEntry
from app.services.embedding_service import get_embedding_service
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def regenerate_embeddings_for_tenant(tenant_id: int):
    """Regenerate embeddings for all entries in a tenant."""
    async with AsyncSessionLocal() as db:
        # Get tenant's LLM config
        from app.models.tenant import Tenant

        result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()

        if not tenant:
            print(f"❌ Tenant {tenant_id} not found")
            return

        print(f"🔍 Processing tenant: {tenant.name} (ID: {tenant_id})")

        # Get embedding service for this tenant
        embedding_service = get_embedding_service(tenant.llm_config)
        embedding_dim = embedding_service.get_embedding_dimension()
        print(f"📏 Current embedding dimension: {embedding_dim}")

        # Get all knowledge entries for this tenant
        result = await db.execute(
            select(KnowledgeEntry).where(KnowledgeEntry.tenant_id == tenant_id)
        )
        entries = result.scalars().all()

        print(f"📝 Found {len(entries)} knowledge entries")

        updated = 0
        skipped = 0

        for entry in entries:
            # Check if embedding needs regeneration
            needs_update = False

            if entry.embedding is None or entry.embedding == "null":
                needs_update = True
                reason = "null embedding"
            elif isinstance(entry.embedding, list):
                if len(entry.embedding) != embedding_dim:
                    needs_update = True
                    reason = (
                        f"wrong dimension ({len(entry.embedding)} vs {embedding_dim})"
                    )
                else:
                    skipped += 1
                    continue
            else:
                needs_update = True
                reason = "invalid format"

            if needs_update:
                try:
                    # Generate new embedding
                    text = f"{entry.title}\n\n{entry.content}"
                    new_embedding = await embedding_service.embed_text(text)

                    entry.embedding = new_embedding
                    updated += 1
                    print(
                        f"  ✓ Updated entry #{entry.id}: {entry.title[:50]} ({reason})"
                    )
                except Exception as e:
                    print(f"  ❌ Failed to update entry #{entry.id}: {e}")

        # Commit all changes
        await db.commit()

        print(f"\n✅ Summary:")
        print(f"   Updated: {updated}")
        print(f"   Skipped (already correct): {skipped}")
        print(f"   Total: {len(entries)}")


async def regenerate_all_tenants():
    """Regenerate embeddings for all tenants."""
    async with AsyncSessionLocal() as db:
        from app.models.tenant import Tenant

        result = await db.execute(select(Tenant))
        tenants = result.scalars().all()

        print(f"🌍 Found {len(tenants)} tenants\n")

        for tenant in tenants:
            await regenerate_embeddings_for_tenant(tenant.id)
            print()


async def main():
    parser = argparse.ArgumentParser(
        description="Regenerate knowledge entry embeddings"
    )
    parser.add_argument("--tenant-id", type=int, help="Specific tenant ID to process")
    parser.add_argument("--all", action="store_true", help="Process all tenants")

    args = parser.parse_args()

    if args.all:
        await regenerate_all_tenants()
    elif args.tenant_id:
        await regenerate_embeddings_for_tenant(args.tenant_id)
    else:
        parser.print_help()
        print("\n❌ Please specify either --tenant-id or --all")
        return


if __name__ == "__main__":
    asyncio.run(main())
