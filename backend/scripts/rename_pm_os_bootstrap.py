"""
Rename pm-os-bootstrap to pm-setup
"""

import asyncio
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.skill import Skill


async def rename_skill():
    """Rename pm-os-bootstrap to pm-setup"""

    old_name = "pm-os-bootstrap"
    new_name = "pm-setup"

    async with AsyncSessionLocal() as db:
        # Check if old skill exists
        result = await db.execute(
            select(Skill).where(Skill.name == old_name)
        )
        skill = result.scalar_one_or_none()

        if not skill:
            print(f"❌ Skill '{old_name}' not found")
            return

        # Check if new name already exists
        result = await db.execute(
            select(Skill).where(Skill.name == new_name)
        )
        existing = result.scalar_one_or_none()

        if existing:
            print(f"❌ Skill '{new_name}' already exists")
            return

        print(f"Renaming Skill")
        print("=" * 60)
        print(f"Old name: {old_name}")
        print(f"New name: {new_name}")
        print()
        print(f"Description: {skill.description}")
        print(f"Tools: {skill.tools}")
        print()

        # Rename
        skill.name = new_name

        await db.commit()

        print("=" * 60)
        print(f"✅ Successfully renamed '{old_name}' to '{new_name}'")
        print("=" * 60)


if __name__ == "__main__":
    try:
        asyncio.run(rename_skill())
    except KeyboardInterrupt:
        print("\nCancelled by user")
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
