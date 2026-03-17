"""
Adviser Tool Registry - DEPRECATED
This file is kept for backward compatibility.
All tool functionality has been moved to skill_tools.py.
Import from app.services.skill_tools instead.
"""

# Import all from skill_tools module for backward compatibility
from app.services.skill_tools import (
    ToolParameter,
    SkillTool as AdviserTool,
    ToolRegistry,
    tool_registry,
)

__all__ = ['tool_registry', 'ToolRegistry', 'AdviserTool', 'ToolParameter']
