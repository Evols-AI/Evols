"""
Register Unified PM OS Skills
Discovers all SKILL.md files from unified-pm-os and registers them in Evols database
"""

import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path so we can import from app
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger

from app.core.database import AsyncSessionLocal
from app.models.skill import Skill
from app.services.unified_pm_os import SkillAdapter


async def register_all_skills():
    """
    Discover and register all SKILL.md files from unified-pm-os.

    Finds all 83 skills, creates or updates database records with:
    - file_path (relative path to SKILL.md)
    - category (extracted from folder structure)
    - source ('unified-pm-os')

    Skills are registered as "default" skills available to all tenants.
    """
    # Get unified-pm-os path from environment or use default
    unified_pm_os_path = os.getenv('UNIFIED_PM_OS_PATH', '../unified-pm-os')
    unified_pm_os_path = Path(unified_pm_os_path).resolve()

    if not unified_pm_os_path.exists():
        logger.error(f"unified-pm-os not found at: {unified_pm_os_path}")
        logger.error("Set UNIFIED_PM_OS_PATH environment variable or place unified-pm-os in parent directory")
        return

    logger.info(f"Using unified-pm-os at: {unified_pm_os_path}")

    # Initialize adapter
    try:
        adapter = SkillAdapter(str(unified_pm_os_path))
    except FileNotFoundError as e:
        logger.error(f"Failed to initialize SkillAdapter: {e}")
        return

    # Discover all SKILL.md files
    skill_files = adapter.discover_all_skills()
    logger.info(f"Discovered {len(skill_files)} SKILL.md files")

    if not skill_files:
        logger.warning("No SKILL.md files found. Check unified-pm-os/skills/ directory structure.")
        return

    # Register each skill
    created_count = 0
    updated_count = 0
    error_count = 0

    async with AsyncSessionLocal() as db:
        for skill_file in skill_files:
            try:
                # Load skill data from file
                skill_data = adapter.load_skill_from_file(skill_file)

                logger.info(f"Processing: {skill_data['name']} ({skill_file})")

                # Check if skill already exists by name
                result = await db.execute(
                    select(Skill).where(Skill.name == skill_data['name'])
                )
                existing = result.scalars().first()

                if existing:
                    # Update existing skill
                    existing.description = skill_data.get('description', existing.description)
                    existing.file_path = skill_file
                    existing.category = skill_data.get('category', 'unknown')
                    existing.source = 'unified-pm-os'
                    existing.tools = skill_data.get('tools', [])

                    logger.info(f"  → Updated existing skill: {skill_data['name']}")
                    updated_count += 1

                else:
                    # Create new skill entry
                    new_skill = Skill(
                        name=skill_data['name'],
                        description=skill_data.get('description', ''),
                        icon='⚡',  # Default icon - can be customized later
                        tools=skill_data.get('tools', []),
                        initial_questions=[],  # Framework skills don't use initial questions
                        task_definitions=[],   # Framework skills don't use task definitions
                        instructions=skill_data['instructions'],
                        output_template=skill_data.get('output_template'),
                        category=skill_data.get('category', 'unknown'),
                        source='unified-pm-os',
                        file_path=skill_file,
                        is_active=True
                    )
                    db.add(new_skill)

                    logger.info(f"  → Created new skill: {skill_data['name']}")
                    created_count += 1

                # Commit after each skill (so partial progress is saved if script fails)
                await db.commit()

            except Exception as e:
                logger.error(f"  ✗ Error processing {skill_file}: {e}")
                error_count += 1
                continue

    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("REGISTRATION COMPLETE")
    logger.info("=" * 60)
    logger.info(f"Total skills found:    {len(skill_files)}")
    logger.info(f"Created new:           {created_count}")
    logger.info(f"Updated existing:      {updated_count}")
    logger.info(f"Errors:                {error_count}")
    logger.info("=" * 60)

    if created_count + updated_count > 0:
        logger.info("\n✓ Skills are now available in Evols!")
        logger.info("  Visit /advisers to see all skills")
        logger.info("  Skills will load instructions from SKILL.md files")
        logger.info("  Make sure UNIFIED_PM_OS_PATH is set in .env")
    else:
        logger.warning("\n⚠ No skills were registered. Check for errors above.")


def main():
    """Entry point"""
    logger.info("=" * 60)
    logger.info("Unified PM OS Skill Registration")
    logger.info("=" * 60)
    logger.info("")

    try:
        asyncio.run(register_all_skills())
    except KeyboardInterrupt:
        logger.info("\nRegistration cancelled by user")
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
