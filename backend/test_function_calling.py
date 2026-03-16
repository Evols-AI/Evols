"""
Test function calling directly
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.core.config import settings
from app.models.tenant import Tenant
from app.models.adviser import Adviser
from app.services.llm_service import get_llm_service
from app.core.security import decrypt_llm_config
from loguru import logger


async def test_function_calling():
    # Setup database
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    engine = create_async_engine(db_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Get tenant and adviser
        result = await db.execute(select(Tenant).limit(1))
        tenant = result.scalar_one_or_none()

        result = await db.execute(
            select(Adviser).where(Adviser.name == "Decision Workbench")
        )
        adviser = result.scalar_one_or_none()

        if not tenant or not adviser:
            print("Error: Tenant or Decision Workbench not found!")
            return

        print(f"Testing with tenant: {tenant.name}")
        print(f"Adviser tools: {adviser.tools}")

        # Get LLM service
        decrypted_config = decrypt_llm_config(tenant.llm_config)
        llm_service = get_llm_service(tenant_config=decrypted_config)

        print(f"\nLLM Provider: {llm_service.provider}")
        print(f"LLM Model: {llm_service.config.model}")

        # Build simple tool schema
        tool_schema = [{
            "type": "function",
            "function": {
                "name": "simulate_persona_votes",
                "description": "Ask AI-powered persona twins to vote on options",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "question": {
                            "type": "string",
                            "description": "The decision question"
                        },
                        "options": {
                            "type": "array",
                            "description": "List of options",
                            "items": {"type": "object"}
                        }
                    },
                    "required": ["question", "options"]
                }
            }
        }]

        # Test messages
        messages = [
            {"role": "system", "content": "You are a decision adviser. When user asks for persona votes, you MUST use the simulate_persona_votes tool."},
            {"role": "user", "content": "I need to decide between Option A (quick win) and Option B (big bet). Ask my persona twins what they think."}
        ]

        print("\n" + "="*60)
        print("TEST: Calling LLM with function calling enabled")
        print("="*60)

        try:
            response = await llm_service.generate(
                messages=messages,
                max_tokens=2000,
                temperature=0.7,
                tools=tool_schema
            )

            print(f"\n✓ Response received")
            print(f"  Content: {response.content[:200]}...")
            print(f"  Has tool_calls: {response.tool_calls is not None}")
            if response.tool_calls:
                print(f"  Tool calls: {len(response.tool_calls)}")
                for tc in response.tool_calls:
                    print(f"    - {tc.function['name']}")
            else:
                print(f"  ✗ NO TOOL CALLS - LLM chose to respond directly!")
                print(f"  Full response: {response.content}")
            print(f"  Finish reason: {response.finish_reason}")

        except Exception as e:
            print(f"\n✗ Error: {e}")
            import traceback
            traceback.print_exc()


async def test_full_agent_loop():
    """Test the full function calling agent loop"""
    from app.services.copilot_function_calling import handle_function_calling

    # Setup database
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    engine = create_async_engine(db_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Get tenant and adviser
        result = await db.execute(select(Tenant).limit(1))
        tenant = result.scalar_one_or_none()

        result = await db.execute(
            select(Adviser).where(Adviser.name == "Decision Workbench")
        )
        adviser = result.scalar_one_or_none()

        # Get LLM service
        decrypted_config = decrypt_llm_config(tenant.llm_config)
        llm_service = get_llm_service(tenant_config=decrypted_config)

        print("\n" + "="*60)
        print("TEST: Full agent loop with function calling")
        print("="*60)

        adviser_config = {
            'id': adviser.id,
            'name': adviser.name,
            'tools': adviser.tools,
            'instructions': adviser.instructions[:200] + "..."
        }

        try:
            final_response, tool_calls = await handle_function_calling(
                user_message="I need help deciding between building AI summaries (big bet) vs improving onboarding (quick win). Ask my persona twins what they prefer.",
                conversation_history=[],
                system_prompt="You are a Decision Workbench adviser. When asked for persona input, you MUST use the simulate_persona_votes tool.",
                adviser_config=adviser_config,
                llm_service=llm_service,
                tenant_id=tenant.id,
                db=db
            )

            print(f"\n✓ Agent loop completed")
            print(f"  Tool calls made: {len(tool_calls) if tool_calls else 0}")
            if tool_calls:
                for tc in tool_calls:
                    print(f"    - Tool: {tc['tool']}")
                    print(f"      Keys: {list(tc.keys())}")
                    result_key = 'result' if 'result' in tc else 'error'
                    print(f"      {result_key.title()}: {str(tc.get(result_key, 'N/A'))[:200]}...")
            print(f"\n  Final response preview:")
            print(f"  {final_response[:500]}...")

        except Exception as e:
            print(f"\n✗ Error in agent loop: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    print("Test 1: Direct LLM function calling")
    print("="*60)
    asyncio.run(test_function_calling())

    print("\n\nTest 2: Full agent loop")
    print("="*60)
    asyncio.run(test_full_agent_loop())
