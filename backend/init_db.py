"""
Initialize database tables
Run this script to create all tables in the database
"""

import asyncio
from app.core.database import engine, Base
from app.models import (
    Tenant,
    User,
    Feedback,
    Theme,
    Initiative,
    Account,
    Persona,
    Decision,
    DecisionOption,
    Conversation,
    Message,
)


async def init_db():
    """Create all database tables"""
    print("Creating database tables...")

    async with engine.begin() as conn:
        # Drop all tables (optional - comment out if you want to keep existing data)
        # await conn.run_sync(Base.metadata.drop_all)

        # Create all tables
        await conn.run_sync(Base.metadata.create_all)

    print("✅ Database tables created successfully!")
    print("\nCreated tables:")
    for table_name in Base.metadata.tables.keys():
        print(f"  - {table_name}")


if __name__ == "__main__":
    asyncio.run(init_db())
