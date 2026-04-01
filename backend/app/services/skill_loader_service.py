"""
Skill Loader Service
Loads all skills from SKILL.md files at runtime with caching
"""

import os
from pathlib import Path
from typing import Dict, List, Optional, Any
from loguru import logger
from functools import lru_cache

from app.core.config import settings
from app.services.unified_pm_os import SkillAdapter


class SkillLoaderService:
    """
    Service to load and cache skills from SKILL.md files.
    Provides a single source of truth for framework skills.
    """

    _instance = None
    _skills_cache: Dict[str, Dict[str, Any]] = None
    _skills_by_category: Dict[str, List[Dict[str, Any]]] = None

    def __new__(cls):
        """Singleton pattern to ensure one instance across the app"""
        if cls._instance is None:
            cls._instance = super(SkillLoaderService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        """Initialize the service (only once due to singleton)"""
        if self._initialized:
            return

        # Path to bundled unified-pm-os resources
        backend_dir = Path(__file__).parent.parent.parent
        self.unified_pm_os_path = settings.UNIFIED_PM_OS_PATH or str(backend_dir / 'resources' / 'unified-pm-os')

        self._initialized = True
        logger.info(f"SkillLoaderService initialized with path: {self.unified_pm_os_path}")

    def load_all_skills(self, force_reload: bool = False) -> Dict[str, Dict[str, Any]]:
        """
        Load all skills from SKILL.md files.
        Returns a dictionary keyed by skill name.

        Args:
            force_reload: If True, bypass cache and reload from files

        Returns:
            Dict[skill_name, skill_data]
        """
        if self._skills_cache is not None and not force_reload:
            return self._skills_cache

        logger.info("Loading all skills from SKILL.md files...")

        try:
            adapter = SkillAdapter(self.unified_pm_os_path)
            skill_files = adapter.discover_all_skills()

            skills = {}
            skills_by_category = {}

            for skill_file in skill_files:
                try:
                    skill_data = adapter.load_skill_from_file(skill_file)
                    skill_name = skill_data['name']

                    # Add to main skills dict
                    skills[skill_name] = skill_data

                    # Add to category index
                    category = skill_data.get('category', 'unknown')
                    if category not in skills_by_category:
                        skills_by_category[category] = []
                    skills_by_category[category].append(skill_data)

                except Exception as e:
                    logger.error(f"Failed to load skill from {skill_file}: {e}")
                    continue

            # Cache the results
            self._skills_cache = skills
            self._skills_by_category = skills_by_category

            logger.info(f"Loaded {len(skills)} skills from {len(skills_by_category)} categories")
            return skills

        except Exception as e:
            logger.error(f"Failed to load skills: {e}")
            return {}

    def get_skill_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Get a skill by its name"""
        if self._skills_cache is None:
            self.load_all_skills()

        # Try exact match first
        if name in self._skills_cache:
            return self._skills_cache[name]

        # Try case-insensitive match
        name_lower = name.lower()
        for skill_name, skill_data in self._skills_cache.items():
            if skill_name.lower() == name_lower:
                return skill_data

        # Try partial match (fuzzy)
        for skill_name, skill_data in self._skills_cache.items():
            if name_lower in skill_name.lower() or skill_name.lower() in name_lower:
                return skill_data

        return None

    def get_skills_by_category(self, category: str) -> List[Dict[str, Any]]:
        """Get all skills in a category"""
        if self._skills_by_category is None:
            self.load_all_skills()

        return self._skills_by_category.get(category, [])

    def get_all_categories(self) -> List[str]:
        """Get list of all categories"""
        if self._skills_by_category is None:
            self.load_all_skills()

        return list(self._skills_by_category.keys())

    def get_all_skills(self) -> List[Dict[str, Any]]:
        """Get list of all skills"""
        if self._skills_cache is None:
            self.load_all_skills()

        return list(self._skills_cache.values())

    def search_skills(self, query: str) -> List[Dict[str, Any]]:
        """
        Search skills by name or description.
        Returns skills matching the query.
        """
        if self._skills_cache is None:
            self.load_all_skills()

        query_lower = query.lower()
        results = []

        for skill in self._skills_cache.values():
            # Search in name and description
            if (query_lower in skill['name'].lower() or
                query_lower in skill.get('description', '').lower()):
                results.append(skill)

        return results

    def get_skill_catalog(self) -> str:
        """
        Get formatted catalog of all skills for AI routing.
        Returns a formatted string listing all skills.
        """
        if self._skills_by_category is None:
            self.load_all_skills()

        catalog_lines = []

        for category in sorted(self._skills_by_category.keys()):
            skills = self._skills_by_category[category]
            catalog_lines.append(f"\n## {category.replace('-', ' ').title()}")

            for skill in sorted(skills, key=lambda s: s['name']):
                catalog_lines.append(
                    f"- **{skill['name']}**: {skill.get('description', '')}"
                )

        return "\n".join(catalog_lines)

    def reload_skills(self):
        """Force reload all skills from files"""
        logger.info("Force reloading all skills...")
        self._skills_cache = None
        self._skills_by_category = None
        return self.load_all_skills(force_reload=True)


# Global singleton instance
_skill_loader = None

def get_skill_loader() -> SkillLoaderService:
    """Get the global SkillLoaderService instance"""
    global _skill_loader
    if _skill_loader is None:
        _skill_loader = SkillLoaderService()
        # Pre-load skills at startup
        _skill_loader.load_all_skills()
    return _skill_loader
