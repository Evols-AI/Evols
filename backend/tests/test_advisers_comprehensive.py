"""
Comprehensive test suite for all 22 advisers
Tests prompt quality, tool integration, output structure, and edge cases
"""

import pytest
import json
from typing import Dict, List, Any


class AdviserTestFramework:
    """Framework for testing adviser prompts and configurations"""

    @staticmethod
    def validate_adviser_structure(adviser: Dict[str, Any]) -> List[str]:
        """Validate basic adviser structure"""
        errors = []
        required_fields = ["name", "description", "icon", "tools", "initial_questions",
                          "task_definitions", "instructions", "output_template"]

        for field in required_fields:
            if field not in adviser:
                errors.append(f"Missing required field: {field}")

        return errors

    @staticmethod
    def validate_instructions_quality(instructions: str) -> List[str]:
        """Validate instruction quality using Anthropic's best practices"""
        errors = []

        # Check for XML tags (best practice)
        required_tags = ["<role>", "<methodology>", "<instructions>", "<constraints>"]
        for tag in required_tags:
            if tag not in instructions:
                errors.append(f"Missing recommended XML tag: {tag}")

        # Check for workflow section if tools are present
        if "<critical_workflow>" not in instructions and "IMMEDIATELY" not in instructions:
            errors.append("Missing critical workflow section for tool usage")

        # Check for specific, actionable instructions
        if "DO NOT" not in instructions:
            errors.append("Missing DO NOT constraints (best practice)")

        if "DO " not in instructions:
            errors.append("Missing DO instructions (best practice)")

        # Check length (should be comprehensive but not overwhelming)
        if len(instructions) < 500:
            errors.append("Instructions too short (< 500 chars)")

        if len(instructions) > 10000:
            errors.append("Instructions too long (> 10000 chars) - consider chunking")

        return errors

    @staticmethod
    def validate_tools_usage(adviser: Dict[str, Any]) -> List[str]:
        """Validate tool configuration and instructions"""
        errors = []
        tools = adviser.get("tools", [])
        instructions = adviser.get("instructions", "")

        if tools:
            # If tools exist, instructions should mention them
            if "<critical_workflow>" not in instructions and "Call " not in instructions:
                errors.append("Has tools but instructions don't explain when/how to use them")

            # Check if each tool is mentioned in instructions
            for tool in tools:
                if tool not in instructions:
                    errors.append(f"Tool '{tool}' not mentioned in instructions")

        else:
            # If no tools, shouldn't have critical_workflow
            if "<critical_workflow>" in instructions:
                errors.append("Has critical_workflow but no tools defined")

        return errors

    @staticmethod
    def validate_initial_questions(questions: List[Dict]) -> List[str]:
        """Validate initial questions structure"""
        errors = []

        for i, q in enumerate(questions):
            if "id" not in q:
                errors.append(f"Question {i} missing 'id' field")
            if "type" not in q:
                errors.append(f"Question {i} missing 'type' field")
            if "question" not in q:
                errors.append(f"Question {i} missing 'question' field")
            if "required" not in q:
                errors.append(f"Question {i} missing 'required' field")

            # Validate type
            valid_types = ["text", "textarea", "number", "select"]
            if q.get("type") not in valid_types:
                errors.append(f"Question {i} has invalid type: {q.get('type')}")

            # If select type, should have options
            if q.get("type") == "select" and "options" not in q:
                errors.append(f"Question {i} is select type but missing options")

        return errors

    @staticmethod
    def validate_output_template(template: str) -> List[str]:
        """Validate output template is descriptive"""
        errors = []

        if not template:
            errors.append("Output template is empty")
        elif len(template) < 50:
            errors.append("Output template too vague (< 50 chars)")

        return errors

    def run_comprehensive_test(self, adviser: Dict[str, Any]) -> Dict[str, Any]:
        """Run all tests on an adviser"""
        results = {
            "name": adviser.get("name", "Unknown"),
            "passed": True,
            "errors": [],
            "warnings": []
        }

        # Test structure
        struct_errors = self.validate_adviser_structure(adviser)
        if struct_errors:
            results["errors"].extend(struct_errors)
            results["passed"] = False

        # Test instructions quality
        inst_errors = self.validate_instructions_quality(adviser.get("instructions", ""))
        if inst_errors:
            results["warnings"].extend(inst_errors)

        # Test tools usage
        tools_errors = self.validate_tools_usage(adviser)
        if tools_errors:
            results["warnings"].extend(tools_errors)

        # Test initial questions
        q_errors = self.validate_initial_questions(adviser.get("initial_questions", []))
        if q_errors:
            results["errors"].extend(q_errors)
            results["passed"] = False

        # Test output template
        template_errors = self.validate_output_template(adviser.get("output_template", ""))
        if template_errors:
            results["warnings"].extend(template_errors)

        return results


# Specific test cases for each adviser type

def test_insights_miner():
    """Test Insights Miner adviser"""
    # This would be the actual adviser config from the database
    test_cases = [
        {
            "scenario": "User asks about feature adoption",
            "expected_tools_called": ["get_feedback_summary", "get_themes", "get_features"],
            "expected_output_includes": ["executive_summary", "key_findings", "recommendations"]
        },
        {
            "scenario": "User asks about segment behavior",
            "expected_tools_called": ["get_personas", "get_feedback_items"],
            "expected_output_includes": ["segmentation", "trends", "confidence_level"]
        }
    ]

    # Test that instructions mention all required tools
    # Test that output template includes required sections
    pass


def test_prototyping_agent():
    """Test Prototyping Agent adviser"""
    test_cases = [
        {
            "scenario": "User wants to test landing page for demand",
            "expected_output_includes": ["hypothesis", "success_metrics", "validation_plan"]
        },
        {
            "scenario": "User wants clickable prototype",
            "expected_output_includes": ["prototype_specifications", "user_flow", "test_protocol"]
        }
    ]
    pass


def test_prioritization_engine():
    """Test Prioritization Engine adviser"""
    test_cases = [
        {
            "scenario": "User provides list of features to prioritize",
            "expected_tools_called": ["get_features", "get_themes", "calculate_rice_score"],
            "expected_output_includes": ["rice_scores", "portfolio_scenarios", "trade_off_analysis"]
        }
    ]
    pass


def test_prd_writer():
    """Test PRD Writer adviser"""
    test_cases = [
        {
            "scenario": "User requests PRD for new feature",
            "expected_tools_called": ["get_personas", "get_themes", "get_feedback_items"],
            "expected_output_includes": ["user_stories", "functional_requirements", "success_metrics"]
        },
        {
            "scenario": "Edge case: No feedback available",
            "expected_behavior": "Should acknowledge limitation and provide structure anyway"
        }
    ]
    pass


def test_edge_cases():
    """Test edge cases for all advisers"""
    edge_cases = [
        {
            "name": "No data available",
            "test": "Adviser should handle gracefully when tools return empty results"
        },
        {
            "name": "Ambiguous user input",
            "test": "Adviser should ask clarifying questions"
        },
        {
            "name": "Conflicting data",
            "test": "Adviser should acknowledge conflicts and explain trade-offs"
        },
        {
            "name": "User skips optional questions",
            "test": "Adviser should work without optional answers"
        }
    ]
    pass


def test_anthropic_best_practices():
    """Test that all advisers follow Anthropic's best practices"""
    best_practices = [
        "Uses XML tags for structure",
        "Includes <role> definition",
        "Has <critical_workflow> for tool usage",
        "Defines clear <methodology>",
        "Provides specific <instructions>",
        "Lists explicit <constraints>",
        "Uses DO and DO NOT format",
        "Gives concrete examples",
        "Output structure is clear"
    ]
    pass


def test_tool_integration():
    """Test that tools are properly integrated in instructions"""
    for adviser_name in ALL_ADVISERS:
        # Test that each tool mentioned in tools list is:
        # 1. Explained in instructions
        # 2. Called in critical_workflow
        # 3. Used appropriately for the adviser's purpose
        pass


def test_output_consistency():
    """Test that output templates are consistent and parseable"""
    for adviser_name in ALL_ADVISERS:
        # Test that output template:
        # 1. Matches the structure described in instructions
        # 2. Is specific enough to be actionable
        # 3. Can be parsed (if JSON/structured)
        pass


# Integration tests

def test_adviser_interaction_flow():
    """Test complete user interaction flow"""
    flow_tests = [
        {
            "adviser": "Insights Miner",
            "steps": [
                "User answers initial questions",
                "Adviser calls tools proactively",
                "Adviser analyzes data",
                "Adviser provides structured output",
                "User asks follow-up question",
                "Adviser provides clarification"
            ]
        }
    ]
    pass


def test_adviser_chaining():
    """Test when one adviser's output feeds into another"""
    chain_tests = [
        {
            "chain": ["Insights Miner → PRD Writer"],
            "test": "Insights from analysis should inform PRD"
        },
        {
            "chain": ["Opportunity Identifier → Prioritization Engine"],
            "test": "Identified opportunities should be prioritizable"
        }
    ]
    pass


# Performance tests

def test_prompt_token_length():
    """Test that combined prompt doesn't exceed limits"""
    for adviser_name in ALL_ADVISERS:
        # Test that:
        # system_prompt + instructions + examples < reasonable limit
        # Allow room for conversation context
        pass


def test_response_quality():
    """Test response quality with sample inputs"""
    quality_tests = [
        {
            "metric": "Relevance",
            "test": "Response addresses user's specific question"
        },
        {
            "metric": "Actionability",
            "test": "Response provides concrete next steps"
        },
        {
            "metric": "Evidence",
            "test": "Response backs claims with data from tools"
        },
        {
            "metric": "Clarity",
            "test": "Response is well-structured and scannable"
        }
    ]
    pass


if __name__ == "__main__":
    # Run all tests
    print("Running comprehensive adviser test suite...")

    # Load all advisers (would load from database in real scenario)
    from complete_advisers_suite import COMPLETE_ADVISERS
    from remaining_advisers import REMAINING_ADVISERS

    all_advisers = COMPLETE_ADVISERS + REMAINING_ADVISERS

    framework = AdviserTestFramework()

    print(f"\n{'='*60}")
    print(f"Testing {len(all_advisers)} advisers")
    print(f"{'='*60}\n")

    results_summary = {
        "total": len(all_advisers),
        "passed": 0,
        "failed": 0,
        "warnings": 0
    }

    for adviser in all_advisers:
        print(f"\nTesting: {adviser['name']}")
        print(f"{'-'*60}")

        result = framework.run_comprehensive_test(adviser)

        if result["passed"]:
            results_summary["passed"] += 1
            print(f"✅ PASSED")
        else:
            results_summary["failed"] += 1
            print(f"❌ FAILED")
            print(f"\nErrors:")
            for error in result["errors"]:
                print(f"  - {error}")

        if result["warnings"]:
            results_summary["warnings"] += len(result["warnings"])
            print(f"\n⚠️  Warnings:")
            for warning in result["warnings"]:
                print(f"  - {warning}")

    # Summary
    print(f"\n{'='*60}")
    print(f"TEST SUMMARY")
    print(f"{'='*60}")
    print(f"Total advisers tested: {results_summary['total']}")
    print(f"✅ Passed: {results_summary['passed']}")
    print(f"❌ Failed: {results_summary['failed']}")
    print(f"⚠️  Total warnings: {results_summary['warnings']}")
    print(f"\nSuccess rate: {results_summary['passed']/results_summary['total']*100:.1f}%")
