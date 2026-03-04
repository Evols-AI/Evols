"""
Database Cleanup Script
Safely removes all feedback, themes, personas, and decisions
"""
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete

from app.models.feedback import Feedback
from app.models.theme import Theme
from app.models.persona import Persona
from app.models.decision import Decision
from app.models.initiative import Initiative, theme_initiative
from app.models.project import Project

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/productos")

# Convert to async URL if needed
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

# Create async engine
engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def cleanup_database():
    """Remove all feedback, themes, initiatives, projects, personas, and decisions"""
    async with AsyncSessionLocal() as session:
        try:
            print("\n🧹 Starting database cleanup...\n")

            # Count records before deletion
            feedback_count = (await session.execute(select(Feedback))).scalars().all()
            theme_count = (await session.execute(select(Theme))).scalars().all()
            persona_count = (await session.execute(select(Persona))).scalars().all()
            decision_count = (await session.execute(select(Decision))).scalars().all()
            initiative_count = (await session.execute(select(Initiative))).scalars().all()
            project_count = (await session.execute(select(Project))).scalars().all()

            print(f"📊 Current records:")
            print(f"   - Feedback: {len(feedback_count)}")
            print(f"   - Themes: {len(theme_count)}")
            print(f"   - Initiatives: {len(initiative_count)}")
            print(f"   - Projects: {len(project_count)}")
            print(f"   - Personas: {len(persona_count)}")
            print(f"   - Decisions: {len(decision_count)}")
            print()

            # Delete in order (respecting foreign key constraints)
            # Delete decisions first (may reference other tables)
            await session.execute(delete(Decision))
            print("✅ Deleted all decisions")

            # Delete projects (has foreign key to initiatives)
            await session.execute(delete(Project))
            print("✅ Deleted all projects")

            # Delete theme_initiative associations (foreign keys to both theme and initiative)
            await session.execute(delete(theme_initiative))
            print("✅ Deleted all theme-initiative associations")

            # Delete initiatives
            await session.execute(delete(Initiative))
            print("✅ Deleted all initiatives")

            # Delete feedback (has foreign key to themes via theme_id)
            await session.execute(delete(Feedback))
            print("✅ Deleted all feedback")

            # Delete themes (now safe, no foreign key references)
            await session.execute(delete(Theme))
            print("✅ Deleted all themes")

            # Delete personas
            await session.execute(delete(Persona))
            print("✅ Deleted all personas")

            # Commit all deletions
            await session.commit()

            print("\n✨ Database cleanup completed successfully!\n")

        except Exception as e:
            print(f"\n❌ Error during cleanup: {e}")
            await session.rollback()
            raise


async def main():
    """Main entry point"""
    print("\n" + "="*60)
    print("  DATABASE CLEANUP SCRIPT")
    print("="*60)

    response = input("\n⚠️  This will DELETE ALL feedback, themes, initiatives, projects, personas, and decisions.\n   Are you sure? Type 'yes' to continue: ")

    if response.lower() != 'yes':
        print("\n❌ Cleanup cancelled.")
        return

    await cleanup_database()

    print("="*60 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
