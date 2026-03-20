"""
Skill Adapter
Loads skills from unified-pm-os SKILL.md files
"""

import os
import yaml
from pathlib import Path
from typing import Dict, Any, Optional
from loguru import logger


class SkillAdapter:
    """
    Adapter to load skills from unified-pm-os SKILL.md files.

    unified-pm-os/skills/
    ├── 01-discovery/
    │   ├── identify-assumptions/
    │   │   └── SKILL.md
    │   └── brainstorm-ideas/
    │       └── SKILL.md
    └── 02-strategy/
        └── business-model/
            └── SKILL.md
    """

    def __init__(self, unified_pm_os_path: str):
        """
        Args:
            unified_pm_os_path: Path to unified-pm-os root folder
        """
        self.base_path = Path(unified_pm_os_path) / "skills"

        if not self.base_path.exists():
            raise FileNotFoundError(f"Skills directory not found: {self.base_path}")

    def load_skill_from_file(self, file_path: str) -> Dict[str, Any]:
        """
        Load and parse a SKILL.md file.

        Args:
            file_path: Relative path from skills/ folder
                      e.g., "01-discovery/identify-assumptions/SKILL.md"

        Returns:
            Dictionary with skill configuration:
            {
                'name': 'identify-assumptions',
                'description': 'Identify risky assumptions using VUVF framework',
                'category': 'discovery',
                'tools': ['get_themes', 'get_personas', 'get_feedback_items'],
                'instructions': '# Instructions\n\nYou are an expert...'
            }

        Raises:
            FileNotFoundError: If SKILL.md file doesn't exist
            ValueError: If SKILL.md format is invalid
        """
        full_path = self.base_path / file_path

        if not full_path.exists():
            raise FileNotFoundError(f"Skill file not found: {full_path}")

        logger.info(f"Loading skill from: {full_path}")

        # Read file content
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Parse SKILL.md format
        # Expected format:
        # ---
        # name: identify-assumptions
        # description: "..."
        # tools: [get_themes, get_personas]
        # category: discovery
        # ---
        #
        # # Instructions
        # You are an expert...

        try:
            # Split by --- markers
            parts = content.split('---')

            if len(parts) < 3:
                raise ValueError(
                    f"Invalid SKILL.md format in {file_path}. "
                    "Expected YAML frontmatter between --- markers"
                )

            # Parse YAML frontmatter (part[1])
            frontmatter = yaml.safe_load(parts[1])

            if not frontmatter:
                raise ValueError(f"Empty frontmatter in {file_path}")

            # Extract instructions (everything after second ---)
            instructions = '---'.join(parts[2:]).strip()

            if not instructions:
                raise ValueError(f"Empty instructions in {file_path}")

            # Build skill config
            skill_config = {
                'name': frontmatter.get('name'),
                'description': frontmatter.get('description', ''),
                'category': self._extract_category_from_path(file_path),
                'tools': frontmatter.get('tools', []),
                'instructions': instructions,
                'output_template': frontmatter.get('output_template')
            }

            # Validate required fields
            if not skill_config['name']:
                raise ValueError(f"Missing 'name' in frontmatter of {file_path}")

            logger.info(f"Successfully loaded skill: {skill_config['name']}")

            return skill_config

        except yaml.YAMLError as e:
            raise ValueError(f"Failed to parse YAML frontmatter in {file_path}: {e}")
        except Exception as e:
            raise ValueError(f"Failed to load skill from {file_path}: {e}")

    def _extract_category_from_path(self, file_path: str) -> str:
        """
        Extract category from file path.

        Args:
            file_path: "01-discovery/identify-assumptions/SKILL.md"

        Returns:
            "discovery"
        """
        # Get first directory name
        parts = Path(file_path).parts
        if len(parts) > 0:
            # Extract category from folder name (e.g., "01-discovery" -> "discovery")
            folder_name = parts[0]
            if '-' in folder_name:
                return folder_name.split('-', 1)[1]
            return folder_name
        return 'unknown'

    def discover_all_skills(self) -> list:
        """
        Discover all SKILL.md files in unified-pm-os/skills/ directory.

        Returns:
            List of relative file paths
            ['01-discovery/identify-assumptions/SKILL.md', ...]
        """
        skill_files = []

        for skill_file in self.base_path.rglob("SKILL.md"):
            rel_path = skill_file.relative_to(self.base_path)
            skill_files.append(str(rel_path))

        logger.info(f"Discovered {len(skill_files)} SKILL.md files")

        return skill_files
