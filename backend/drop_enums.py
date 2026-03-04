"""
Script to drop existing project enum types
Run this before running the migration
"""
import asyncio
from app.core.database import AsyncSessionLocal

async def drop_enums():
    async with AsyncSessionLocal() as session:
        await session.execute("DROP TYPE IF EXISTS projecteffort CASCADE")
        await session.execute("DROP TYPE IF EXISTS projectstatus CASCADE")
        await session.commit()
        print("✅ Dropped existing enum types successfully")

if __name__ == "__main__":
    asyncio.run(drop_enums())
