"""
Deprecate redundant skills
- bootstrap: Replaced by pm-setup which integrates with Evols tools
"""

import asyncio
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.skill import Skill


# Skills to deprecate and their replacements
SKILLS_TO_DEPRECATE = {
    'bootstrap': {
        'reason': 'Replaced by pm-setup which integrates with Evols work context tools',
        'replacement': 'pm-setup'
    }
}


async def deprecate_skills():
    """Mark redundant skills as inactive"""

    async with AsyncSessionLocal() as db:
        deprecated_count = 0

        print("Deprecating Redundant Skills")
        print("=" * 80)
        print()

        for skill_name, info in SKILLS_TO_DEPRECATE.items():
            result = await db.execute(
                select(Skill).where(Skill.name == skill_name)
            )
            skill = result.scalar_one_or_none()

            if not skill:
                print(f"⚠️  Skill '{skill_name}' not found - skipping")
                continue

            if not skill.is_active:
                print(f"ℹ️  Skill '{skill_name}' already deprecated - skipping")
                continue

            # Mark as inactive
            skill.is_active = False

            print(f"✓ Deprecating: {skill_name}")
            print(f"  Reason: {info['reason']}")
            print(f"  Replacement: {info['replacement']}")
            print()

            deprecated_count += 1

        if deprecated_count > 0:
            await db.commit()
            print("=" * 80)
            print(f"✓ Deprecated {deprecated_count} skill(s)")
            print("=" * 80)
        else:
            print("No skills needed deprecation")


async def verify_deprecation():
    """Verify the deprecation"""
    async with AsyncSessionLocal() as db:
        # Count active vs inactive skills
        result = await db.execute(
            select(Skill)
        )
        all_skills = result.scalars().all()

        active_skills = [s for s in all_skills if s.is_active]
        inactive_skills = [s for s in all_skills if not s.is_active]

        print()
        print("=" * 80)
        print("Verification")
        print("=" * 80)
        print(f"Total skills: {len(all_skills)}")
        print(f"Active: {len(active_skills)}")
        print(f"Deprecated: {len(inactive_skills)}")

        if inactive_skills:
            print()
            print("Deprecated skills:")
            for skill in inactive_skills:
                print(f"  - {skill.name}")


if __name__ == "__main__":
    try:
        asyncio.run(deprecate_skills())
        asyncio.run(verify_deprecation())
    except KeyboardInterrupt:
        print("\nCancelled by user")
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
