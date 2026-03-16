"""
Update existing Decision Workbench Adviser
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.core.config import settings
from app.models.adviser import Adviser

# Import the updated config
from scripts.add_decision_workbench import DECISION_WORKBENCH_ADVISER


async def update_decision_workbench():
    """Update existing Decision Workbench adviser"""

    # Create async engine
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    engine = create_async_engine(db_url, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Find existing Decision Workbench
        result = await session.execute(
            select(Adviser).where(Adviser.name == "Decision Workbench")
        )
        existing = result.scalar_one_or_none()

        if not existing:
            print("❌ Decision Workbench adviser not found. Run add_decision_workbench.py first.")
            return

        # Update fields
        existing.description = DECISION_WORKBENCH_ADVISER["description"]
        existing.instructions = DECISION_WORKBENCH_ADVISER["instructions"]
        existing.tools = DECISION_WORKBENCH_ADVISER["tools"]
        existing.task_definitions = DECISION_WORKBENCH_ADVISER["task_definitions"]
        existing.output_template = DECISION_WORKBENCH_ADVISER["output_template"]

        await session.commit()

        print("✅ Successfully updated Decision Workbench adviser!")
        print("\nUpdated fields:")
        print("- Description")
        print("- Instructions (with persona twin language and formatting)")
        print("- Tools")
        print("- Task definitions")
        print("- Output template")


if __name__ == "__main__":
    asyncio.run(update_decision_workbench())
