"""
Skill Adapter
Loads skills from SKILL.md files in resources/skills/
"""

import yaml
from pathlib import Path
from typing import Any, Dict, List
from loguru import logger

VALID_ROLES = {'pm', 'engineer', 'sales', 'marketing', 'designer', 'founder', 'all'}


class SkillAdapter:
    """
    Loads skills from SKILL.md files.

    resources/skills/
    ├── 01-discovery/
    │   ├── identify-assumptions/
    │   │   └── SKILL.md
    │   └── brainstorm-ideas/
    │       └── SKILL.md
    └── 02-strategy/
        └── business-model/
            └── SKILL.md
    """

    def __init__(self, skills_path: str):
        """
        Args:
            skills_path: Path to the skills root folder (contains category subdirs)
        """
        self.base_path = Path(skills_path)

        if not self.base_path.exists():
            raise FileNotFoundError(f"Skills directory not found: {self.base_path}")

    def load_skill_from_file(self, file_path: str) -> Dict[str, Any]:
        """
        Load and parse a SKILL.md file.

        Args:
            file_path: Relative path from skills/ folder
                      e.g., "01-discovery/identify-assumptions/SKILL.md"

        Returns:
            Dictionary with skill configuration including a 'roles' list.

        Raises:
            FileNotFoundError: If SKILL.md file doesn't exist
            ValueError: If SKILL.md format is invalid
        """
        full_path = self.base_path / file_path

        if not full_path.exists():
            raise FileNotFoundError(f"Skill file not found: {full_path}")

        logger.info(f"Loading skill from: {full_path}")

        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()

        try:
            parts = content.split('---')

            if len(parts) < 3:
                raise ValueError(
                    f"Invalid SKILL.md format in {file_path}. "
                    "Expected YAML frontmatter between --- markers"
                )

            frontmatter = yaml.safe_load(parts[1])

            if not frontmatter:
                raise ValueError(f"Empty frontmatter in {file_path}")

            instructions = '---'.join(parts[2:]).strip()

            if not instructions:
                raise ValueError(f"Empty instructions in {file_path}")

            roles = self._parse_roles(frontmatter.get('roles'), file_path)

            skill_config = {
                'name': frontmatter.get('name'),
                'description': frontmatter.get('description', ''),
                'category': self._extract_category_from_path(file_path),
                'tools': frontmatter.get('tools', []),
                'roles': roles,
                'instructions': instructions,
                'output_template': frontmatter.get('output_template'),
            }

            if not skill_config['name']:
                raise ValueError(f"Missing 'name' in frontmatter of {file_path}")

            logger.info(f"Successfully loaded skill: {skill_config['name']} (roles: {roles})")

            return skill_config

        except yaml.YAMLError as e:
            raise ValueError(f"Failed to parse YAML frontmatter in {file_path}: {e}")
        except Exception as e:
            raise ValueError(f"Failed to load skill from {file_path}: {e}")

    def _parse_roles(self, raw: Any, file_path: str) -> List[str]:
        """
        Parse and validate the roles field from frontmatter.

        Accepts:
            roles: [pm, engineer]
            roles: pm
            roles: all          → expands to every valid role except 'all'
            (absent)            → defaults to ['pm']
        """
        if raw is None:
            return ['pm']

        if isinstance(raw, str):
            raw = [r.strip() for r in raw.split(',')]

        if not isinstance(raw, list):
            logger.warning(f"Unexpected roles type in {file_path}: {type(raw)}, defaulting to ['pm']")
            return ['pm']

        roles = [str(r).strip().lower() for r in raw]

        if 'all' in roles:
            return sorted(VALID_ROLES - {'all'})

        invalid = [r for r in roles if r not in VALID_ROLES]
        if invalid:
            logger.warning(f"Unknown roles {invalid} in {file_path}, ignoring")
            roles = [r for r in roles if r in VALID_ROLES]

        return roles if roles else ['pm']

    def _extract_category_from_path(self, file_path: str) -> str:
        """
        Extract category from file path.
        "01-discovery/identify-assumptions/SKILL.md" → "discovery"
        """
        parts = Path(file_path).parts
        if parts:
            folder_name = parts[0]
            if '-' in folder_name:
                return folder_name.split('-', 1)[1]
            return folder_name
        return 'unknown'

    def discover_all_skills(self) -> List[str]:
        """
        Discover all SKILL.md files under the skills directory.

        Returns:
            List of relative file paths
            ['01-discovery/identify-assumptions/SKILL.md', ...]
        """
        skill_files = [
            str(f.relative_to(self.base_path))
            for f in self.base_path.rglob("SKILL.md")
        ]
        logger.info(f"Discovered {len(skill_files)} SKILL.md files")
        return skill_files
