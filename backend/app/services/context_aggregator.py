"""
Context Aggregator Service
Aggregates all relevant context for intelligent agent decision-making.
Similar to how Cline reads the entire workspace.
"""

from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger

from app.models.user import User
from app.models.work_context import WorkContext
from app.models.product_knowledge import ProductKnowledge
from app.services.skill_loader_service import get_skill_loader
from app.core.security_utils import SecuritySanitizer


class ContextAggregator:
    """
    Aggregates all context needed for intelligent agent decisions.

    Like Cline's workspace awareness, this gives the agent:
    - All available skills
    - User's current work context
    - Product knowledge
    - Memory of past work
    """

    def __init__(self, db: AsyncSession, user: User, product_id: Optional[int] = None):
        self.db = db
        self.user = user
        self.product_id = product_id  # kept for backwards-compat, not used

    async def get_full_context(self) -> Dict[str, Any]:
        """
        Get all context for the agent to make intelligent decisions.

        Returns:
            {
                'skills_catalog': str,  # All available skills
                'work_context': dict,   # User's PM OS data
                'product_knowledge': dict,  # Strategy, metrics, etc.
                'memory': dict,  # Past work
                'user_profile': dict  # User info
            }
        """
        context = {}

        # 1. Load all available skills (like Cline knows all its capabilities)
        context['skills_catalog'] = await self._get_skills_catalog()

        # 2. Load user's work context (their PM OS)
        context['work_context'] = await self._get_work_context()

        # 3. Load product knowledge (tenant-scoped)
        context['product_knowledge'] = await self._get_product_knowledge()

        # 4. Load memory summary (not full detail to save tokens)
        context['memory_summary'] = await self._get_memory_summary()

        # 5. User profile
        context['user_profile'] = {
            'name': self.user.full_name,
            'email': self.user.email,
            'role': self.user.role
        }

        return context

    async def _get_skills_catalog(self) -> str:
        """
        Get lightweight skills catalog for decision-making.
        Only includes names and categories to minimize tokens (~500 vs ~5,300).
        Full skill details loaded only when skill is selected.
        """
        skill_loader = get_skill_loader()
        skills_by_category = skill_loader._skills_by_category or {}

        if not skills_by_category:
            # Force load if not cached
            skill_loader.load_all_skills()
            skills_by_category = skill_loader._skills_by_category

        catalog_lines = []
        catalog_lines.append("# Available Skills (Lightweight)")
        catalog_lines.append("")
        catalog_lines.append("You have access to specialized PM skills. When a user's request matches a skill, respond with the skill name.")
        catalog_lines.append("")

        # Count skills for overview
        total_skills = sum(len(skills) for skills in skills_by_category.values())
        catalog_lines.append(f"**{total_skills} expert skills across {len(skills_by_category)} categories:**")
        catalog_lines.append("")

        for category in sorted(skills_by_category.keys()):
            skills = skills_by_category[category]
            skill_names = [skill['name'] for skill in sorted(skills, key=lambda s: s['name'])]

            # Group skills in compact format
            catalog_lines.append(f"**{category.replace('-', ' ').title()}** ({len(skills)}): {', '.join(skill_names)}")

        catalog_lines.append("")
        catalog_lines.append("**Usage**: When user request matches a skill (e.g. '@competitive-battlecard', 'create PRD', 'analyze market'), return that skill name. Full instructions will be loaded automatically.")

        return "\n".join(catalog_lines)

    async def get_full_skill_details(self, skill_name: str) -> Dict[str, Any]:
        """
        Get full details for a specific skill (loaded on-demand).
        This replaces loading all skills upfront, saving ~4,800 tokens.
        Includes user customizations if they exist.
        """
        skill_loader = get_skill_loader()

        # Get base skill data
        skill_data = skill_loader.get_skill_by_name(skill_name)

        if not skill_data:
            return {
                'error': f'Skill "{skill_name}" not found',
                'available_skills': list(skill_loader.load_all_skills().keys())
            }

        # Get user customizations (when we implement the table)
        # TODO: Implement user_skill_customizations table and query
        base_instructions = skill_data.get('instructions', '')
        user_customizations = await self._get_user_skill_customizations(skill_name)

        # Merge base instructions with user customizations
        final_instructions = self._merge_instructions(base_instructions, user_customizations)

        return {
            'name': skill_data['name'],
            'description': skill_data.get('description', ''),
            'instructions': final_instructions,  # Now includes user customizations
            'category': skill_data.get('category', ''),
            'file_path': skill_data.get('file_path', ''),
            'full_content': skill_data.get('content', ''),
            'has_customizations': bool(user_customizations),
            'customizations': user_customizations
        }

    async def _get_user_skill_customizations(self, skill_name: str) -> Dict[str, Any]:
        """
        Get user's custom instructions/context for a specific skill.
        Returns empty dict if no customizations exist.
        """
        from app.models.user_skill_customization import UserSkillCustomization

        result = await self.db.execute(
            select(UserSkillCustomization)
            .where(UserSkillCustomization.user_id == self.user.id)
            .where(UserSkillCustomization.skill_name == skill_name)
            .where(UserSkillCustomization.is_active == True)
        )
        customization = result.scalar_one_or_none()

        if not customization:
            return {}

        return {
            'custom_context': customization.custom_context,
            'custom_instructions': customization.custom_instructions,
            'output_format_preferences': customization.output_format_preferences
        }

    def _merge_instructions(self, base_instructions: str, customizations: Dict[str, Any]) -> str:
        """
        Merge base skill instructions with user customizations.
        User customizations are sanitized to prevent prompt injection and XSS attacks.
        """
        if not customizations:
            return base_instructions

        # SECURITY: Sanitize all user customizations to prevent prompt injection
        sanitized_customizations = SecuritySanitizer.sanitize_skill_customization(customizations)

        merged = base_instructions

        # Add user context if provided (sanitized)
        if sanitized_customizations.get('custom_context'):
            merged += f"\n\n## User Context\n{sanitized_customizations['custom_context']}"

        # Add custom instructions if provided (sanitized)
        if sanitized_customizations.get('custom_instructions'):
            merged += f"\n\n## Additional Instructions\n{sanitized_customizations['custom_instructions']}"

        # Add output format preferences if provided (sanitized)
        if sanitized_customizations.get('output_format_preferences'):
            merged += f"\n\n## Output Format Requirements\n{sanitized_customizations['output_format_preferences']}"

        return merged

    async def _get_work_context(self) -> Dict[str, Any]:
        """
        Get user's work context (PM OS data).
        Their current projects, tasks, capacity, relationships.
        """
        result = await self.db.execute(
            select(WorkContext).where(WorkContext.user_id == self.user.id)
        )
        work_context = result.scalar_one_or_none()

        if not work_context:
            return {
                'exists': False,
                'summary': 'No work context set up yet. User may need onboarding.'
            }

        return {
            'exists': True,
            'role': work_context.title,
            'team': work_context.team,
            'team_size': work_context.team_size,
            'capacity': work_context.capacity_status.value if work_context.capacity_status else None,
            'manager': work_context.manager_name,
            'working_hours': work_context.working_hours
        }

    async def _get_product_knowledge(self) -> Dict[str, Any]:
        """Get team knowledge documents (strategy, segments, metrics, etc.)"""
        result = await self.db.execute(
            select(ProductKnowledge)
            .where(ProductKnowledge.tenant_id == self.user.tenant_id)
        )
        pk = result.scalar_one_or_none()

        if not pk:
            return {}

        # Return markdown docs (already formatted for context)
        knowledge = {}

        if pk.strategy_doc:
            knowledge['strategy'] = pk.strategy_doc

        if pk.customer_segments_doc:
            knowledge['customer_segments'] = pk.customer_segments_doc

        if pk.competitive_landscape_doc:
            knowledge['competitive'] = pk.competitive_landscape_doc

        if pk.value_proposition_doc:
            knowledge['value_proposition'] = pk.value_proposition_doc

        if pk.metrics_and_targets_doc:
            knowledge['metrics'] = pk.metrics_and_targets_doc

        return knowledge

    async def _get_memory_summary(self) -> Dict[str, Any]:
        """
        Get summary of past work and decisions.
        High-level only to save tokens.
        """
        # TODO: Implement when we have skill memory tables populated
        # For now return empty
        return {
            'past_skills_used': [],
            'recent_decisions': [],
            'note': 'Full memory integration coming soon'
        }

    def format_context_for_prompt(self, context: Dict[str, Any]) -> str:
        """
        Format aggregated context into a prompt section.
        This becomes part of the system prompt.
        """
        sections = []

        # User profile
        if context.get('user_profile'):
            up = context['user_profile']
            sections.append("# User Profile")
            sections.append(f"**Name**: {up.get('name', 'Unknown')}")
            sections.append(f"**Email**: {up.get('email', 'Unknown')}")
            sections.append(f"**System Role**: {up.get('role', 'USER')}")
            sections.append("")

        # Skills catalog
        sections.append(context.get('skills_catalog', ''))

        # Work context
        if context.get('work_context', {}).get('exists'):
            wc = context['work_context']
            sections.append("\n# Your Work Context\n")
            sections.append(f"**Role**: {wc.get('role', 'Unknown')}")
            sections.append(f"**Team Size**: {wc.get('team_size', 'Unknown')}")
            sections.append(f"**Capacity**: {wc.get('capacity', 'Unknown')}%")
            sections.append(f"**Current Focus**: {wc.get('current_focus', 'Not set')}")

            if wc.get('projects'):
                sections.append(f"\n**Projects**: {len(wc['projects'])} active projects")

            if wc.get('tasks'):
                sections.append(f"**Tasks**: {len(wc['tasks'])} pending tasks")

        # Product knowledge
        if context.get('product_knowledge'):
            pk = context['product_knowledge']
            sections.append("\n# Product Knowledge\n")

            if 'strategy' in pk:
                sections.append("## Strategy")
                sections.append(pk['strategy'][:500] + "..." if len(pk['strategy']) > 500 else pk['strategy'])

            if 'customer_segments' in pk:
                sections.append("\n## Customer Segments")
                sections.append(pk['customer_segments'][:500] + "..." if len(pk['customer_segments']) > 500 else pk['customer_segments'])

            if 'metrics' in pk:
                sections.append("\n## Metrics & Targets")
                sections.append(pk['metrics'][:500] + "..." if len(pk['metrics']) > 500 else pk['metrics'])

        return "\n".join(sections)
