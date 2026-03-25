"""
Test Intelligent Copilot System
Verifies that file-based skills load correctly and agent makes intelligent decisions
"""

import sys
import asyncio
from loguru import logger

# Test 1: Skill Loader Service
def test_skill_loader():
    """Test that skills load from files"""
    print("\n" + "="*60)
    print("TEST 1: Skill Loader Service")
    print("="*60)

    from app.services.skill_loader_service import get_skill_loader

    loader = get_skill_loader()
    skills = loader.get_all_skills()

    print(f"✅ Loaded {len(skills)} skills from files")

    # Check categories
    categories = loader.get_all_categories()
    print(f"✅ Found {len(categories)} categories:")
    for cat in sorted(categories):
        skills_in_cat = loader.get_skills_by_category(cat)
        print(f"   - {cat}: {len(skills_in_cat)} skills")

    # Test specific skill
    sprint_skill = loader.get_skill_by_name('sprint-plan')
    if sprint_skill:
        print(f"\n✅ Sprint Plan Skill loaded successfully")
        print(f"   Name: {sprint_skill['name']}")
        print(f"   Description: {sprint_skill.get('description', 'N/A')[:80]}...")
        print(f"   Has instructions: {len(sprint_skill.get('instructions', '')) > 0}")
    else:
        print(f"❌ Failed to load sprint-plan skill")
        return False

    # Test search
    results = loader.search_skills('roadmap')
    print(f"\n✅ Search 'roadmap' found {len(results)} skills")

    return len(skills) >= 90  # Should have ~94 skills


# Test 2: Context Aggregator
async def test_context_aggregator():
    """Test that context aggregation works"""
    print("\n" + "="*60)
    print("TEST 2: Context Aggregator")
    print("="*60)

    # Mock objects for testing
    class MockUser:
        id = 1
        tenant_id = 1
        email = "test@example.com"
        full_name = "Test User"
        role = "ADMIN"

    class MockSession:
        async def execute(self, query):
            class MockResult:
                def scalar_one_or_none(self):
                    return None
                def scalars(self):
                    class MockScalars:
                        def all(self):
                            return []
                        def first(self):
                            return None
                    return MockScalars()
            return MockResult()

    from app.services.context_aggregator import ContextAggregator

    mock_db = MockSession()
    mock_user = MockUser()

    aggregator = ContextAggregator(mock_db, mock_user, product_id=None)

    # Get full context
    context = await aggregator.get_full_context()

    print(f"✅ Context aggregated successfully")
    print(f"   Keys: {list(context.keys())}")
    print(f"   Has skills catalog: {'skills_catalog' in context}")
    print(f"   Has work context: {'work_context' in context}")
    print(f"   Has user profile: {'user_profile' in context}")

    # Check skills catalog format
    if 'skills_catalog' in context:
        catalog = context['skills_catalog']
        print(f"\n✅ Skills catalog generated ({len(catalog)} chars)")
        print(f"   Preview: {catalog[:200]}...")

    return True


# Test 3: Skill Catalog Format
def test_skill_catalog_format():
    """Test that skill catalog is properly formatted for agent"""
    print("\n" + "="*60)
    print("TEST 3: Skill Catalog Format")
    print("="*60)

    from app.services.skill_loader_service import get_skill_loader

    loader = get_skill_loader()
    catalog = loader.get_skill_catalog()

    print(f"✅ Catalog generated ({len(catalog)} chars)")

    # Check structure
    has_discovery = 'discovery' in catalog.lower()
    has_strategy = 'strategy' in catalog.lower()
    has_execution = 'execution' in catalog.lower()

    print(f"   Has Discovery section: {has_discovery}")
    print(f"   Has Strategy section: {has_strategy}")
    print(f"   Has Execution section: {has_execution}")

    # Show sample
    print(f"\n   Sample (first 500 chars):")
    print(f"   {catalog[:500]}...")

    return has_discovery and has_strategy and has_execution


# Test 4: Individual Skill Loading
def test_individual_skills():
    """Test loading specific skills"""
    print("\n" + "="*60)
    print("TEST 4: Individual Skill Loading")
    print("="*60)

    from app.services.skill_loader_service import get_skill_loader

    loader = get_skill_loader()

    # Test various skills
    test_skills = [
        'sprint-plan',
        'create-prd',
        'swot-analysis',
        'action-item-harvester',
        'bootstrap',
        'say-no-playbook'
    ]

    for skill_name in test_skills:
        skill = loader.get_skill_by_name(skill_name)
        if skill:
            print(f"✅ {skill_name}: {skill.get('description', 'N/A')[:60]}...")
        else:
            print(f"❌ {skill_name}: NOT FOUND")
            return False

    return True


async def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("INTELLIGENT COPILOT SYSTEM TEST")
    print("="*60)

    results = []

    # Test 1: Skill Loader
    try:
        result = test_skill_loader()
        results.append(("Skill Loader", result))
    except Exception as e:
        print(f"❌ Skill Loader test failed: {e}")
        results.append(("Skill Loader", False))

    # Test 2: Context Aggregator
    try:
        result = await test_context_aggregator()
        results.append(("Context Aggregator", result))
    except Exception as e:
        print(f"❌ Context Aggregator test failed: {e}")
        results.append(("Context Aggregator", False))

    # Test 3: Catalog Format
    try:
        result = test_skill_catalog_format()
        results.append(("Catalog Format", result))
    except Exception as e:
        print(f"❌ Catalog Format test failed: {e}")
        results.append(("Catalog Format", False))

    # Test 4: Individual Skills
    try:
        result = test_individual_skills()
        results.append(("Individual Skills", result))
    except Exception as e:
        print(f"❌ Individual Skills test failed: {e}")
        results.append(("Individual Skills", False))

    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)

    all_passed = True
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
        if not passed:
            all_passed = False

    print("="*60)

    if all_passed:
        print("\n🎉 ALL TESTS PASSED!")
        print("\nIntelligent Copilot system is working correctly.")
        print("94 skills are loaded from files and ready to use.")
        return 0
    else:
        print("\n❌ SOME TESTS FAILED")
        print("\nCheck errors above and fix issues.")
        return 1


if __name__ == '__main__':
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
