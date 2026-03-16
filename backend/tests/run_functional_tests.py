"""
Functional test runner for advisers
Tests advisers with real LLM API calls and mock data
"""

import asyncio
import sys
import os
import json
from typing import Dict, List, Any, Optional
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.core.config import settings
from app.models.adviser import Adviser
from app.models.tenant import Tenant
from app.core.security import decrypt_llm_config
from app.services.llm_service import get_llm_service

from tests.mock_data_fixtures import TEST_SCENARIOS, MockToolResponses


class AdviserFunctionalTestRunner:
    """Runs functional tests on advisers with real LLM calls"""

    def __init__(self):
        self.test_results = []
        self.llm_service = None
        self.db = None

    async def setup(self):
        """Set up database and LLM service"""
        # Create async engine
        db_url = settings.DATABASE_URL
        if db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

        engine = create_async_engine(db_url, echo=False)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        self.db = async_session()

        # Get LLM service (strict BYOK - requires tenant config in database)
        # Find first tenant with LLM config
        result = await self.db.execute(
            select(Tenant).where(Tenant.llm_config.isnot(None)).limit(1)
        )
        tenant = result.scalar_one_or_none()

        if tenant and tenant.llm_config:
            config = decrypt_llm_config(tenant.llm_config)
            self.llm_service = get_llm_service(tenant_config=config)
            print(f"✅ Using tenant '{tenant.name}' LLM config: {config.get('provider')}")
        else:
            print("❌ No tenant with LLM configuration found in database")
            print("\nTo run tests with strict BYOK policy:")
            print("  1. Start the backend server")
            print("  2. Log in to the app at http://localhost:3000")
            print("  3. Go to Settings → LLM Settings")
            print("  4. Configure your LLM provider and credentials")
            print("  5. Run tests again")
            print("\nNote: Tests will use the first tenant that has LLM config set")
            return False

        return True

    async def load_adviser(self, name: str) -> Optional[Adviser]:
        """Load adviser from database"""
        result = await self.db.execute(
            select(Adviser).where(Adviser.name == name)
        )
        return result.scalar_one_or_none()

    def format_initial_questions(self, adviser: Adviser, user_input: Dict) -> str:
        """Format initial questions and answers"""
        formatted = "Initial Questions and Answers:\n\n"
        for question in adviser.initial_questions:
            q_id = question.get("id")
            q_text = question.get("question")
            answer = user_input.get(q_id, "Not provided")
            formatted += f"Q: {q_text}\nA: {answer}\n\n"
        return formatted

    def simulate_tool_calls(self, mock_tools: Dict) -> str:
        """Simulate tool call results"""
        formatted = "Tool Results (automatically gathered):\n\n"
        for tool_name, result in mock_tools.items():
            formatted += f"=== {tool_name} ===\n"
            formatted += json.dumps(result, indent=2)
            formatted += "\n\n"
        return formatted

    async def test_adviser(self, adviser_name: str, scenario: Dict) -> Dict:
        """Test a single adviser with a scenario"""
        print(f"\n{'='*80}")
        print(f"Testing: {adviser_name}")
        print(f"{'='*80}")

        result = {
            "adviser": adviser_name,
            "scenario": scenario.get("user_input"),
            "timestamp": datetime.now().isoformat(),
            "success": False,
            "errors": [],
            "warnings": [],
            "response": None,
            "quality_score": 0,
            "quality_checks": {}
        }

        try:
            # Load adviser
            adviser = await self.load_adviser(adviser_name)
            if not adviser:
                result["errors"].append(f"Adviser '{adviser_name}' not found in database")
                return result

            print(f"✅ Loaded adviser: {adviser.name}")

            # Build prompt
            system_prompt = adviser.instructions

            # User message with questions and tool results
            user_message = self.format_initial_questions(adviser, scenario["user_input"])
            user_message += "\n" + self.simulate_tool_calls(scenario["mock_tools"])
            user_message += "\nPlease analyze the data and provide your recommendations."

            print(f"\n📝 Sending prompt to LLM...")
            print(f"System prompt length: {len(system_prompt)} chars")
            print(f"User message length: {len(user_message)} chars")

            # Call LLM
            response = await self.llm_service.generate(
                prompt=user_message,
                system_prompt=system_prompt,
                max_tokens=4096,
                temperature=0.7
            )

            if not response or not response.content:
                result["errors"].append("Empty response from LLM")
                return result

            result["response"] = response.content
            result["success"] = True

            print(f"✅ Received response: {len(response.content)} chars")

            # Validate response
            quality_checks = self.assess_response_quality(
                adviser,
                response.content,
                scenario
            )
            result["quality_checks"] = quality_checks
            result["quality_score"] = sum(quality_checks.values()) / len(quality_checks) * 100

            print(f"\n📊 Quality Score: {result['quality_score']:.1f}%")
            for check, passed in quality_checks.items():
                status = "✅" if passed else "❌"
                print(f"  {status} {check}")

        except Exception as e:
            result["errors"].append(f"Test execution error: {str(e)}")
            print(f"❌ Error: {e}")

        return result

    def assess_response_quality(self, adviser: Adviser, response: str, scenario: Dict) -> Dict[str, bool]:
        """Assess quality of response"""
        checks = {}

        # Check 1: Response is not empty
        checks["has_content"] = len(response.strip()) > 100

        # Check 2: Response doesn't ask for data that tools provided
        tool_asks = [
            "what feedback",
            "can you provide",
            "what data",
            "what personas",
            "what themes"
        ]
        checks["no_data_requests"] = not any(ask in response.lower() for ask in tool_asks)

        # Check 3: Response uses specific numbers from data
        has_numbers = any(char.isdigit() for char in response)
        checks["uses_data"] = has_numbers

        # Check 4: Response has structure (multiple paragraphs or sections)
        checks["well_structured"] = response.count('\n\n') >= 2 or response.count('#') >= 2

        # Check 5: Response mentions personas from data
        checks["mentions_personas"] = any(
            persona["name"].lower() in response.lower()
            for persona in MockToolResponses.get_personas()["personas"]
        )

        # Check 6: Response mentions themes from data
        checks["mentions_themes"] = any(
            theme["name"].lower() in response.lower()
            for theme in MockToolResponses.get_themes()["themes"]
        )

        # Check 7: Response provides recommendations
        rec_keywords = ["recommend", "suggest", "should", "next step", "action"]
        checks["provides_recommendations"] = any(kw in response.lower() for kw in rec_keywords)

        # Check 8: Response shows confidence/caveats
        confidence_keywords = ["confidence", "likely", "assuming", "limitation", "caveat"]
        checks["shows_confidence"] = any(kw in response.lower() for kw in confidence_keywords)

        return checks

    async def run_test_suite(self, adviser_names: Optional[List[str]] = None):
        """Run tests for specified advisers"""
        if adviser_names is None:
            adviser_names = ["Insights Miner", "Prioritization Engine", "PRD Writer"]

        print(f"\n{'='*80}")
        print(f"ADVISER FUNCTIONAL TEST SUITE")
        print(f"{'='*80}")
        print(f"Testing {len(adviser_names)} advisers with real LLM calls")
        print(f"Using mock data fixtures")
        print(f"Timestamp: {datetime.now().isoformat()}")

        # Set up
        setup_ok = await self.setup()
        if not setup_ok:
            print("\n❌ Setup failed. Cannot run tests.")
            return

        # Run tests
        results = []
        for adviser_name in adviser_names:
            # Map adviser name to scenario
            scenario_key = adviser_name.lower().replace(" ", "_")
            if scenario_key not in TEST_SCENARIOS:
                print(f"\n⚠️  No test scenario for {adviser_name}, skipping...")
                continue

            scenario = TEST_SCENARIOS[scenario_key]
            result = await self.test_adviser(adviser_name, scenario)
            results.append(result)

            # Wait a bit between tests to avoid rate limiting
            await asyncio.sleep(2)

        # Generate report
        await self.generate_report(results)

        # Cleanup
        await self.db.close()

    async def generate_report(self, results: List[Dict]):
        """Generate test report"""
        print(f"\n{'='*80}")
        print(f"TEST REPORT")
        print(f"{'='*80}")

        total_tests = len(results)
        successful_tests = sum(1 for r in results if r["success"])
        failed_tests = total_tests - successful_tests

        avg_quality = sum(r["quality_score"] for r in results if r["success"]) / max(successful_tests, 1)

        print(f"\nSummary:")
        print(f"  Total tests: {total_tests}")
        print(f"  ✅ Successful: {successful_tests}")
        print(f"  ❌ Failed: {failed_tests}")
        print(f"  📊 Average quality score: {avg_quality:.1f}%")

        print(f"\nDetailed Results:")
        for result in results:
            print(f"\n{'-'*80}")
            print(f"Adviser: {result['adviser']}")
            print(f"Status: {'✅ Success' if result['success'] else '❌ Failed'}")

            if result["errors"]:
                print(f"Errors:")
                for error in result["errors"]:
                    print(f"  - {error}")

            if result["success"]:
                print(f"Quality Score: {result['quality_score']:.1f}%")
                print(f"Quality Checks:")
                for check, passed in result["quality_checks"].items():
                    status = "✅" if passed else "❌"
                    print(f"  {status} {check}")

                if result["response"]:
                    print(f"\nResponse Preview:")
                    preview = result["response"][:500]
                    print(f"  {preview}...")

        # Save detailed report
        report_file = f"tests/functional_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(results, f, indent=2)

        print(f"\n✅ Detailed report saved to: {report_file}")


async def main():
    """Main entry point"""
    # Parse command line arguments
    if len(sys.argv) > 1:
        # Test specific advisers
        adviser_names = sys.argv[1:]
        print(f"Testing specific advisers: {', '.join(adviser_names)}")
    else:
        # Test default advisers
        adviser_names = ["Insights Miner", "Prioritization Engine", "PRD Writer"]
        print(f"Testing default advisers. To test specific advisers:")
        print(f"  python tests/run_functional_tests.py 'Insights Miner' 'PRD Writer'")

    runner = AdviserFunctionalTestRunner()
    await runner.run_test_suite(adviser_names)


if __name__ == "__main__":
    asyncio.run(main())
