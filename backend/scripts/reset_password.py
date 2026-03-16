"""
Reset user password
Quick script to reset password for testing
"""

import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.user import User
from app.core.config import settings
from app.core.security import get_password_hash


async def reset_password(email: str, new_password: str):
    """Reset password for a user"""

    # Create async engine
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Find user
        result = await session.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()

        if not user:
            print(f"❌ User not found: {email}")
            return

        # Update password
        user.hashed_password = get_password_hash(new_password)
        await session.commit()

        print(f"✅ Password reset successfully for: {email}")
        print(f"   Role: {user.role.value}")
        print(f"   Tenant ID: {user.tenant_id}")
        print(f"   New password: {new_password}")
        print(f"\nYou can now login with:")
        print(f"   Email: {email}")
        print(f"   Password: {new_password}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python reset_password.py <email> <new_password>")
        print("\nExample:")
        print("  python reset_password.py hello@acme.com password123")
        sys.exit(1)

    email = sys.argv[1]
    password = sys.argv[2]

    asyncio.run(reset_password(email, password))
