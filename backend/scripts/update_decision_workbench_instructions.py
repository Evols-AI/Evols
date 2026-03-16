"""
Update Decision Workbench instructions to fix hallucination issue
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.core.config import settings
from app.models.adviser import Adviser
from add_decision_workbench import DECISION_WORKBENCH_ADVISER


async def update_instructions():
    """Update Decision Workbench instructions"""

    # Create async engine
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Find Decision Workbench
        result = await session.execute(
            select(Adviser).where(Adviser.name == "Decision Workbench")
        )
        adviser = result.scalar_one_or_none()

        if not adviser:
            print("❌ Decision Workbench not found!")
            return

        # Update instructions
        adviser.instructions = DECISION_WORKBENCH_ADVISER["instructions"]

        await session.commit()

        print("✅ Successfully updated Decision Workbench instructions!")
        print("\n📝 Key changes:")
        print("  - Added CRITICAL ERROR HANDLING section")
        print("  - Removed all fake persona examples")
        print("  - Added explicit: 'NEVER make up fake personas'")
        print("  - Instructions now require reporting errors honestly")


if __name__ == "__main__":
    asyncio.run(update_instructions())
