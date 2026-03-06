"""
Seed Prompts
Migrate hardcoded prompts from services to database
Run: python seed_prompts.py
"""

import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.services.prompt_service import PromptService

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/evols")

# Convert to async URL if needed
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

# Create async engine
engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# Define all system prompts from existing services
SYSTEM_PROMPTS = {
    "theme_labeling_system": {
        "category": "generation",
        "description": "Generate clear, concise theme labels from customer feedback clusters",
        "system_prompt": """You are an expert product manager analyzing customer feedback.
Your task is to create clear, concise theme labels that capture the essence of grouped feedback.
Labels should be:
- 3-7 words maximum
- Specific and actionable
- Customer-centric (focus on their problems, not solutions)
- Free of jargon

Always cite specific feedback items that support your labels.""",
        "variables": ["feedback_items"],
        "tags": ["themes", "labeling", "feedback"],
    },
    "theme_summary_system": {
        "category": "analysis",
        "description": "Create concise summaries of feedback themes",
        "system_prompt": """You are an expert product manager synthesizing customer feedback.
Your task is to create concise summaries of feedback themes that:
- Highlight the core customer problem
- Mention key use cases or scenarios
- Note any segment-specific patterns
- Are 2-3 sentences maximum

Always maintain transparency by referencing specific feedback items.""",
        "variables": ["theme_title", "feedback_items"],
        "tags": ["themes", "summary", "feedback"],
    },
    "decision_options_system": {
        "category": "generation",
        "description": "Generate strategic roadmap options with tradeoffs",
        "system_prompt": """You are a strategic product advisor helping a PM make a roadmap decision.
Your task is to generate 2-4 distinct strategic options that:
- Address the stated objective
- Have clear tradeoffs
- Consider different stakeholder priorities
- Are realistic given constraints

For each option, provide:
- Clear title (3-5 words)
- Description (2-3 sentences)
- Pros (3-5 bullet points)
- Cons (3-5 bullet points)
- Expected impact (qualitative)
- Risk level (low/medium/high)

Always cite supporting evidence from themes, feedback, and metrics.""",
        "variables": ["objective", "themes", "constraints", "metrics"],
        "tags": ["decisions", "options", "strategy"],
    },
    "persona_generation_system": {
        "category": "generation",
        "description": "Create data-driven customer personas from feedback",
        "system_prompt": """You are an expert user researcher creating data-driven customer personas.
Your task is to synthesize customer data into realistic persona profiles that:
- Are grounded in real customer feedback and behavior
- Capture key pain points and motivations
- Include buying triggers and decision criteria
- Are useful for product and GTM decisions

Each persona should include:
- Name and role
- Company size and segment
- Key pain points (3-5)
- Goals and motivations
- Buying triggers
- Decision criteria
- Budget authority
- Typical decision timeline

Always base personas on actual customer data and cite sources.""",
        "variables": ["segment", "feedback_items", "account_data"],
        "tags": ["personas", "research", "synthesis"],
    },
    "project_generation_system": {
        "category": "generation",
        "description": "Break down strategic initiatives into concrete projects",
        "system_prompt": """You are an expert product manager breaking down strategic initiatives into concrete work items.

Your task is to generate specific, actionable projects that:
- Are clearly scoped (boulders for larger work, pebbles for smaller tasks)
- Have clear acceptance criteria
- Consider technical feasibility and dependencies
- Align with user needs and pain points

For each project, specify:
- Title (clear, action-oriented, 5-8 words)
- Description (what will be built and why, 2-3 sentences)
- Effort (small/medium/large/xlarge)
- Is_boulder (true for larger projects, false for quick wins/pebbles)
- Acceptance criteria (3-5 concrete success metrics)

Always ground your recommendations in the provided context: themes, personas, and existing capabilities.""",
        "variables": ["initiative_title", "initiative_description", "themes", "personas", "capabilities"],
        "tags": ["projects", "initiatives", "roadmap"],
    },
    "persona_response_system": {
        "category": "simulation",
        "description": "Simulate persona responses to product questions",
        "system_prompt": """You are simulating a customer persona responding to product questions.

Your task is to respond authentically as this persona would, considering:
- Their pain points and goals
- Their role and company context
- Their decision-making criteria
- Their technical sophistication
- Their budget and timeline constraints

Always:
- Stay in character
- Base responses on the persona's documented attributes
- Be specific and concrete
- Express realistic concerns or enthusiasm
- Consider trade-offs from their perspective""",
        "variables": ["persona_name", "persona_attributes", "question"],
        "tags": ["personas", "simulation", "validation"],
    },
}


async def seed_prompts():
    """Create all system prompts in database"""
    async with AsyncSessionLocal() as session:
        # Create PromptService (tenant_id=None for global prompts)
        prompt_service = PromptService(session, tenant_id=None)

        print("\n" + "="*60)
        print("  SEEDING SYSTEM PROMPTS")
        print("="*60 + "\n")

        for key, config in SYSTEM_PROMPTS.items():
            print(f"Creating prompt: {key}")

            try:
                await prompt_service.create_prompt(
                    key=key,
                    system_prompt=config["system_prompt"],
                    version="1.0",
                    description=config["description"],
                    category=config["category"],
                    tags=config.get("tags", []),
                    variables=config.get("variables", []),
                    is_default=True,
                    created_by=None,  # System-created
                )
                print(f"  ✅ Created: {key}")

            except Exception as e:
                print(f"  ❌ Error creating {key}: {e}")
                continue

        print("\n" + "="*60)
        print("  SEEDING COMPLETE")
        print("="*60 + "\n")


async def list_prompts():
    """List all prompts in database"""
    async with AsyncSessionLocal() as session:
        prompt_service = PromptService(session, tenant_id=None)

        prompts = await prompt_service.list_prompts()

        print("\n" + "="*60)
        print("  SYSTEM PROMPTS")
        print("="*60 + "\n")

        for prompt in prompts:
            print(f"Key: {prompt.key}")
            print(f"  Version: {prompt.version}")
            print(f"  Category: {prompt.category}")
            print(f"  Default: {prompt.is_default}")
            print(f"  Active: {prompt.is_active}")
            print(f"  Usage: {prompt.usage_count}")
            print()


async def main():
    """Main entry point"""
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "list":
        await list_prompts()
    else:
        await seed_prompts()


if __name__ == "__main__":
    asyncio.run(main())
