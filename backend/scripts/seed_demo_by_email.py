"""
Script to manually seed demo product for a user's tenant by email
Usage: python scripts/seed_demo_by_email.py <user_email>
"""

import sys
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

# Add parent directory to path for imports
sys.path.insert(0, '/Users/akshay/Desktop/workspace/evols/backend')

from app.core.config import settings
from app.services.demo_seed_service import seed_demo_product
from app.models.user import User
from app.models.product import Product


async def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/seed_demo_by_email.py <user_email>")
        print("\nExample: python scripts/seed_demo_by_email.py your@email.com")
        sys.exit(1)

    user_email = sys.argv[1]

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
            # Find user by email
            result = await session.execute(
                select(User).where(User.email == user_email)
            )
            user = result.scalar_one_or_none()

            if not user:
                print(f"❌ User not found with email: {user_email}")
                sys.exit(1)

            if not user.tenant_id:
                print(f"❌ User {user_email} has no tenant (might be SUPER_ADMIN)")
                sys.exit(1)

            # Check if demo product already exists
            result = await session.execute(
                select(Product).where(
                    Product.tenant_id == user.tenant_id,
                    Product.is_demo == True
                )
            )
            existing_demo = result.scalar_one_or_none()

            if existing_demo:
                print(f"ℹ️  Demo product already exists for tenant {user.tenant_id}")
                print(f"   Product ID: {existing_demo.id}")
                print(f"   Product Name: {existing_demo.name}")
                print(f"\n   To delete and recreate, run:")
                print(f"   psql <database> -c \"DELETE FROM products WHERE id = {existing_demo.id};\"")
                sys.exit(0)

            print(f"Found user: {user.full_name} ({user.email})")
            print(f"Tenant ID: {user.tenant_id}")
            print(f"\nSeeding demo product...")

            product = await seed_demo_product(session, user.tenant_id)

            print(f"\n✅ Demo product created successfully!")
            print(f"   Product ID: {product.id}")
            print(f"   Product Name: {product.name}")
            print(f"   Includes:")
            print(f"     - 6 feedback items")
            print(f"     - 3 themes")
            print(f"     - 3 personas")
            print(f"     - 4 initiatives")
            print(f"     - 4 projects")
            print(f"     - 2 knowledge sources")
            print(f"     - 5 capabilities")
            print(f"\n   Refresh your browser to see the demo product!")

        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
