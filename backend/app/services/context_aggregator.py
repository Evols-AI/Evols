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
        self.product_id = product_id

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

        # 3. Load product knowledge
        if self.product_id:
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
        Get formatted catalog of all available skills.
        Agent uses this to decide which skill (if any) to invoke.
        """
        skill_loader = get_skill_loader()
        skills_by_category = skill_loader._skills_by_category or {}

        if not skills_by_category:
            # Force load if not cached
            skill_loader.load_all_skills()
            skills_by_category = skill_loader._skills_by_category

        catalog_lines = []
        catalog_lines.append("# Available Skills")
        catalog_lines.append("")
        catalog_lines.append("You have access to specialized skills. When a user's request matches a skill's purpose, load that skill's instructions and execute it.")
        catalog_lines.append("")

        for category in sorted(skills_by_category.keys()):
            skills = skills_by_category[category]
            catalog_lines.append(f"## {category.replace('-', ' ').title()}")

            for skill in sorted(skills, key=lambda s: s['name']):
                catalog_lines.append(f"- **{skill['name']}**: {skill.get('description', '')}")

            catalog_lines.append("")

        return "\n".join(catalog_lines)

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
            'role': work_context.role_title,
            'team_size': work_context.team_size,
            'capacity': work_context.capacity_percentage,
            'projects': work_context.current_projects or [],
            'key_relationships': work_context.key_relationships or [],
            'current_focus': work_context.current_focus,
            'tasks': work_context.tasks or []
        }

    async def _get_product_knowledge(self) -> Dict[str, Any]:
        """
        Get product knowledge for the current product.
        Strategy, segments, metrics, competitive landscape, value prop.
        """
        if not self.product_id:
            return {}

        # Load product knowledge documents
        result = await self.db.execute(
            select(ProductKnowledge)
            .where(ProductKnowledge.product_id == self.product_id)
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
