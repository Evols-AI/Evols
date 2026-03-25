"""
Quick seed script to populate skills table in production
Run this with: python seed_skills_simple.py
"""

import asyncio
import os
import json
import sys
sys.path.insert(0, '/app')

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.skill import Skill

# Use environment DATABASE_URL or fallback
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://evols_user:your_password@localhost:5432/evols")

# Convert to asyncpg
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)


ESSENTIAL_SKILLS = [
    {
        "name": "PM Setup",
        "description": "Initial setup conversation to capture your PM context - role, team, and active projects",
        "icon": "⚡",
        "tools": [],
        "initial_questions": [],
        "task_definitions": ["Capture PM role and experience", "Document team structure", "Record active projects"],
        "instructions": """You are a friendly PM onboarding assistant. Have a natural conversation to learn about the user's context:
1. Ask about their PM role and experience level
2. Learn about their team (engineers, designers, etc.)
3. Understand their current active projects
4. Store this information for future reference

Be conversational and friendly. This is their first interaction with the system.""",
        "output_template": "",
        "category": "os-infrastructure",
        "source": "database",
        "is_active": True
    },
    {
        "name": "Competitive Analysis",
        "description": "Analyze competitors, market positioning, and differentiation strategies",
        "icon": "🎯",
        "tools": ["get_themes", "get_personas", "get_features"],
        "initial_questions": [],
        "task_definitions": ["Analyze competitive landscape", "Identify differentiation opportunities", "Recommend positioning strategy"],
        "instructions": """You are a competitive intelligence analyst. Help PMs understand their competitive position and identify opportunities for differentiation.""",
        "output_template": "",
        "category": "strategy",
        "source": "database",
        "is_active": True
    },
    {
        "name": "Prioritize Features",
        "description": "Help prioritize features using RICE scoring and customer feedback",
        "icon": "📊",
        "tools": ["get_themes", "get_features", "calculate_rice_score"],
        "initial_questions": [],
        "task_definitions": ["Review feature requests", "Calculate RICE scores", "Recommend prioritization"],
        "instructions": """You are a product prioritization expert. Help PMs make data-driven decisions about feature prioritization using RICE methodology and customer feedback.""",
        "output_template": "",
        "category": "execution",
        "source": "database",
        "is_active": True
    },
    {
        "name": "Create PRD",
        "description": "Generate a comprehensive Product Requirements Document",
        "icon": "📝",
        "tools": ["get_themes", "get_personas", "get_features"],
        "initial_questions": [],
        "task_definitions": ["Document requirements", "Define success metrics", "Create technical specs"],
        "instructions": """You are an expert PM who writes clear, comprehensive PRDs. Help structure and write product requirements documents.""",
        "output_template": "",
        "category": "execution",
        "source": "database",
        "is_active": True
    },
    {
        "name": "Roadmap Planner",
        "description": "Create strategic product roadmaps based on feedback and business goals",
        "icon": "🗺️",
        "tools": ["get_themes", "get_personas", "get_features", "get_feedback_summary"],
        "initial_questions": [],
        "task_definitions": ["Analyze customer feedback themes", "Review personas and priorities", "Generate roadmap options", "Provide rationale for each option"],
        "instructions": """You are a strategic product management advisor. Help PMs create roadmaps that balance customer needs, business objectives, and technical constraints.""",
        "output_template": "",
        "category": "strategy",
        "source": "database",
        "is_active": True
    }
]


async def seed_skills():
    """Seed essential skills into the database"""

    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Check existing skills
        result = await session.execute(select(Skill))
        existing_skills = result.scalars().all()
        print(f"Found {len(existing_skills)} existing skills")

        # Insert skills
        for skill_data in ESSENTIAL_SKILLS:
            # Check if skill already exists
            result = await session.execute(
                select(Skill).where(Skill.name == skill_data["name"])
            )
            existing = result.scalar_one_or_none()

            if existing:
                print(f"✓ Skill already exists: {skill_data['name']}")
                continue

            # Create new skill using ORM
            skill = Skill(
                name=skill_data["name"],
                description=skill_data["description"],
                icon=skill_data["icon"],
                tools=skill_data["tools"],
                initial_questions=skill_data["initial_questions"],
                task_definitions=skill_data["task_definitions"],
                instructions=skill_data["instructions"],
                output_template=skill_data["output_template"],
                category=skill_data["category"],
                source=skill_data["source"],
                is_active=skill_data["is_active"]
            )
            session.add(skill)
            print(f"✓ Created skill: {skill_data['name']}")

        await session.commit()

        # Verify
        result = await session.execute(select(Skill))
        final_skills = result.scalars().all()
        print(f"\n✅ Success! Database now has {len(final_skills)} skills")


if __name__ == "__main__":
    asyncio.run(seed_skills())
