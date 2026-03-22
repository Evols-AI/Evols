"""
Standardize all skill icons to use the generic flash icon (⚡)
"""

import asyncio
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, update
from app.core.database import AsyncSessionLocal
from app.models.skill import Skill


async def standardize_icons():
    """Update all skills to use the generic flash icon"""

    standard_icon = "⚡"

    async with AsyncSessionLocal() as db:
        # Get all skills that don't have the standard icon
        result = await db.execute(
            select(Skill).where(Skill.icon != standard_icon)
        )
        skills_to_update = result.scalars().all()

        if not skills_to_update:
            print("✓ All skills already use the standard icon (⚡)")
            return

        print(f"Found {len(skills_to_update)} skills with custom icons:")
        print("=" * 60)

        for skill in skills_to_update:
            print(f"  {skill.icon} → {standard_icon}  {skill.name}")

        print()
        print("Updating icons...")

        # Update all skills to use standard icon
        await db.execute(
            update(Skill)
            .where(Skill.icon != standard_icon)
            .values(icon=standard_icon)
        )

        await db.commit()

        print()
        print("=" * 60)
        print(f"✓ Updated {len(skills_to_update)} skills to use standard icon (⚡)")
        print("=" * 60)


if __name__ == "__main__":
    print("Standardizing Skill Icons")
    print("=" * 60)
    print()

    try:
        asyncio.run(standardize_icons())
    except KeyboardInterrupt:
        print("\nCancelled by user")
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
