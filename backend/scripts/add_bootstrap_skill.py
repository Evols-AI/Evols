"""
Add PM OS Bootstrap Skill
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.skill import Skill

BOOTSTRAP_SKILL = {
    "name": "pm-setup",
    "icon": "🚀",
    "category": "execution",
    "description": "Set up your personal PM operating system by capturing your role, team, projects, and stakeholders",
    "tools": [
        "update_role_info",
        "update_capacity",
        "add_or_update_project",
        "add_or_update_relationship",
        "add_task",
        "get_work_context_summary"
    ],
    "instructions": """You are a PM OS bootstrap specialist. Your role is to help PMs set up their personal operating system by capturing their context through conversation.

GOAL: Learn about the user's work context and populate it using the work context tools.

YOUR APPROACH:
Ask questions conversationally, one at a time. Don't interrogate - have a natural conversation.

INFORMATION TO GATHER:

1. **Role & Position**
   - What's your title?
   - What team are you on? What does your team do?
   - Who's your manager? (name and title)
   - How big is your team? What's the composition?

2. **Active Projects**
   - What are you working on right now?
   - For each project:
     * What's the status? (green/yellow/red)
     * What's your role? (owner/contributor/advisor)
     * What's the next milestone?
     * Who are the key stakeholders?

3. **Key Relationships**
   - Besides your manager, who are the most important people you work with?
   - For each person:
     * What's their role?
     * What's your relationship? (peer/stakeholder/direct_report)
     * What do they care about?
     * How do they prefer to communicate?

4. **Working Model**
   - What are your typical working hours?
   - How do you prefer to communicate? (Slack/email/meetings)
   - What's your biggest time sink right now?
   - What time do you want to protect?

5. **Capacity**
   - How are you feeling about your current workload?
     * Sustainable - comfortable
     * Stretched - working hard but manageable
     * Overloaded - too much on plate
     * Unsustainable - burning out
   - What's driving that?

IMPORTANT TOOLS TO USE:
As you learn information, IMMEDIATELY use the work context tools to save it:
- `update_role_info` - When you learn about title, team, manager
- `add_or_update_project` - For each project mentioned
- `add_or_update_relationship` - For each stakeholder
- `update_working_model` - For working preferences
- `update_capacity` - For capacity assessment

CONVERSATION FLOW:

Start: "Let's get your PM OS set up! I'll ask a few questions to understand your context. First, what's your role?"

After each answer:
1. Use the appropriate tool to save the information
2. Acknowledge what you learned
3. Ask the next question naturally

Example:
User: "I'm a Senior PM on the Growth team"
You: [Call update_role_info with title="Senior PM", team="Growth"]
     "Got it - Senior PM on Growth. What does your Growth team focus on?"

KEEP IT CONVERSATIONAL:
- Don't ask for everything at once
- Follow natural conversation flow
- Ask follow-up questions when interesting
- It's okay if they don't know something
- You can always capture more later

COMPLETION:
When you've gathered the basics (role, 1-2 projects, 2-3 relationships, capacity):
- Summarize what you learned
- Explain they can always update this in conversations
- Offer to help with something specific (prep for meeting, plan week, etc.)

Remember: This is an ongoing system. You don't need everything on day 1. Get enough to be useful, then build from there."""
}

async def add_bootstrap_skill():
    """Add or update bootstrap skill"""
    async with AsyncSessionLocal() as db:
        # Check if skill already exists
        result = await db.execute(
            select(Skill).filter(Skill.name == BOOTSTRAP_SKILL["name"])
        )
        existing = result.scalar_one_or_none()

        if existing:
            print(f"✅ Skill '{BOOTSTRAP_SKILL['name']}' already exists")
            # Update it
            existing.icon = BOOTSTRAP_SKILL["icon"]
            existing.category = BOOTSTRAP_SKILL["category"]
            existing.description = BOOTSTRAP_SKILL["description"]
            existing.instructions = BOOTSTRAP_SKILL["instructions"]
            existing.tools = BOOTSTRAP_SKILL["tools"]
            existing.is_active = True
            await db.commit()
            print(f"   Updated existing skill")
        else:
            # Create new skill
            skill = Skill(
                name=BOOTSTRAP_SKILL["name"],
                icon=BOOTSTRAP_SKILL["icon"],
                category=BOOTSTRAP_SKILL["category"],
                description=BOOTSTRAP_SKILL["description"],
                instructions=BOOTSTRAP_SKILL["instructions"],
                is_active=True
            )
            db.add(skill)
            await db.commit()
            print(f"✅ Added bootstrap skill: {BOOTSTRAP_SKILL['name']}")

if __name__ == "__main__":
    print("🚀 Adding PM OS Bootstrap Skill")
    print("=" * 50)
    asyncio.run(add_bootstrap_skill())
    print("\n✅ Done!")
