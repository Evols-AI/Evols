"""
Script to manually seed demo product for an existing tenant
Usage: python scripts/seed_demo_for_tenant.py <tenant_id>
"""

import sys
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add parent directory to path for imports
sys.path.insert(0, '/Users/akshay/Desktop/workspace/evols/backend')

from app.core.config import settings
from app.services.demo_seed_service import seed_demo_product


async def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/seed_demo_for_tenant.py <tenant_id>")
        print("\nTo find your tenant_id:")
        print("  1. Log into the app")
        print("  2. Check browser console or network tab for your tenant_id")
        print("  3. Or query the database: SELECT id, slug, name FROM tenants;")
        sys.exit(1)

    tenant_id = int(sys.argv[1])

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
            print(f"Seeding demo product for tenant {tenant_id}...")
            product = await seed_demo_product(session, tenant_id)
            print(f"✅ Demo product created successfully!")
            print(f"   Product ID: {product.id}")
            print(f"   Product Name: {product.name}")
            print(f"   Includes: 6 feedback items, 3 themes, 3 personas, 4 initiatives, 4 projects, 2 knowledge sources, 5 capabilities")
        except Exception as e:
            print(f"❌ Error seeding demo product: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
