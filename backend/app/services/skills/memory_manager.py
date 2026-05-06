"""
Memory Manager
Manages skill execution history for retrospective analysis and context building
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Dict, Any, List, Optional
from loguru import logger

from app.models.skill_memory import SkillMemory


class MemoryManager:
    """
    Manages skill execution memory (tenant-scoped).
    Allows AI to reference past work and build context over time.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def save_skill_output(
        self,
        tenant_id: int,
        skill_name: str,
        skill_category: str,
        input_data: Dict[str, Any],
        output_data: Dict[str, Any],
        summary: Optional[str] = None,
        product_id: int = None,  # kept for backwards-compat, ignored
    ) -> SkillMemory:
        """Save a skill execution to memory."""
        if not summary:
            if isinstance(output_data, dict) and 'content' in output_data:
                content = output_data['content']
                summary = content[:200] if isinstance(content, str) else str(content)[:200]
            else:
                summary = str(output_data)[:200]

        memory = SkillMemory(
            tenant_id=tenant_id,
            skill_name=skill_name,
            skill_category=skill_category,
            input_data=input_data,
            output_data=output_data,
            summary=summary
        )

        self.db.add(memory)
        await self.db.commit()
        await self.db.refresh(memory)

        logger.info(f"Saved skill memory: {skill_name} for tenant {tenant_id}")

        return memory

    async def get_recent_skill_outputs(
        self,
        tenant_id: int,
        limit: int = 10,
        category: Optional[str] = None,
        product_id: int = None,  # kept for backwards-compat, ignored
    ) -> List[Dict[str, Any]]:
        """Get recent skill executions for a tenant."""
        query = select(SkillMemory).where(SkillMemory.tenant_id == tenant_id)

        if category:
            query = query.where(SkillMemory.skill_category == category)

        query = query.order_by(desc(SkillMemory.created_at)).limit(limit)

        result = await self.db.execute(query)
        memories = result.scalars().all()

        return [
            {
                'id': m.id,
                'skill_name': m.skill_name,
                'skill_category': m.skill_category,
                'summary': m.summary,
                'created_at': m.created_at,
                'input_summary': self._summarize_input(m.input_data),
            }
            for m in memories
        ]

    async def get_skill_memory_by_id(self, memory_id: int) -> Optional[Dict[str, Any]]:
        """Get full details of a specific skill memory."""
        result = await self.db.execute(
            select(SkillMemory).where(SkillMemory.id == memory_id)
        )
        memory = result.scalars().first()

        if not memory:
            return None

        return memory.to_dict()

    async def get_memory_stats(self, tenant_id: int) -> Dict[str, Any]:
        """Get statistics about skill usage for a tenant."""
        result = await self.db.execute(
            select(SkillMemory).where(SkillMemory.tenant_id == tenant_id)
        )
        all_memories = result.scalars().all()

        if not all_memories:
            return {
                'total_executions': 0,
                'category_breakdown': {},
                'most_used_skills': [],
                'recent_activity': []
            }

        category_counts = {}
        for memory in all_memories:
            cat = memory.skill_category or 'unknown'
            category_counts[cat] = category_counts.get(cat, 0) + 1

        skill_counts = {}
        for memory in all_memories:
            skill_counts[memory.skill_name] = skill_counts.get(memory.skill_name, 0) + 1

        most_used = sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)[:10]

        return {
            'total_executions': len(all_memories),
            'category_breakdown': category_counts,
            'most_used_skills': [
                {'skill_name': name, 'count': count}
                for name, count in most_used
            ],
            'recent_activity': [
                {
                    'skill_name': m.skill_name,
                    'summary': m.summary,
                    'created_at': m.created_at
                }
                for m in sorted(all_memories, key=lambda x: x.created_at, reverse=True)[:5]
            ]
        }

    async def search_memory(
        self,
        tenant_id: int,
        search_term: str,
        limit: int = 20,
        product_id: int = None,  # kept for backwards-compat, ignored
    ) -> List[Dict[str, Any]]:
        """Search skill memory by keyword."""
        from sqlalchemy import or_, func as sqlfunc

        query = select(SkillMemory).where(
            SkillMemory.tenant_id == tenant_id,
            or_(
                sqlfunc.lower(SkillMemory.summary).contains(search_term.lower()),
                sqlfunc.lower(SkillMemory.skill_name).contains(search_term.lower())
            )
        ).order_by(desc(SkillMemory.created_at)).limit(limit)

        result = await self.db.execute(query)
        memories = result.scalars().all()

        return [
            {
                'id': m.id,
                'skill_name': m.skill_name,
                'skill_category': m.skill_category,
                'summary': m.summary,
                'created_at': m.created_at
            }
            for m in memories
        ]

    def _summarize_input(self, input_data: Dict[str, Any]) -> str:
        """Helper to create a brief input summary"""
        if isinstance(input_data, dict):
            if 'message' in input_data:
                msg = input_data['message']
                return msg[:100] if isinstance(msg, str) else str(msg)[:100]
            return str(input_data)[:100]
        return str(input_data)[:100]

    async def delete_tenant_memory(self, tenant_id: int):
        """Delete all skill memory for a tenant."""
        from sqlalchemy import delete
        await self.db.execute(
            delete(SkillMemory).where(SkillMemory.tenant_id == tenant_id)
        )
        await self.db.commit()
        logger.info(f"Deleted skill memory for tenant {tenant_id}")
