"""
Functional tests for advisers
Tests actual usage scenarios to ensure prompts work as expected
"""

import asyncio
from typing import Dict, List, Any


class AdviserFunctionalTests:
    """Functional test suite for adviser prompts"""

    def __init__(self):
        self.test_results = []

    def test_insights_miner(self):
        """Test Insights Miner with sample scenarios"""
        test_cases = [
            {
                "name": "Feature adoption analysis",
                "user_input": {
                    "analysis_goal": "Feature adoption",
                    "time_period": "Last 30 days",
                    "specific_question": "Why did adoption of the new search feature drop by 15% last month?"
                },
                "expected_tools_called": [
                    "get_feedback_summary",
                    "get_themes",
                    "get_personas",
                    "get_features",
                    "get_feedback_items"
                ],
                "expected_output_structure": {
                    "has_executive_summary": True,
                    "has_key_findings": True,
                    "has_detailed_analysis": True,
                    "has_recommendations": True,
                    "includes_confidence_levels": True,
                    "mentions_specific_numbers": True
                },
                "quality_checks": [
                    "Should NOT ask user for data that tools can provide",
                    "Should segment analysis by persona",
                    "Should provide confidence intervals",
                    "Should highlight surprising findings",
                    "Should connect insights to decisions"
                ]
            },
            {
                "name": "Churn analysis",
                "user_input": {
                    "analysis_goal": "Churn analysis",
                    "time_period": "Last quarter",
                    "specific_question": "Which persona segments are churning most and why?"
                },
                "expected_tools_called": [
                    "get_personas",
                    "get_feedback_items",
                    "get_themes"
                ],
                "expected_output_structure": {
                    "segments_by_churn_rate": True,
                    "root_cause_analysis": True,
                    "recommendations": True
                }
            }
        ]

        return {"adviser": "Insights Miner", "test_cases": test_cases}

    def test_prototyping_agent(self):
        """Test Prototyping Agent scenarios"""
        test_cases = [
            {
                "name": "Landing page for demand validation",
                "user_input": {
                    "concept_type": "Landing page",
                    "hypothesis": "Enterprise users will pay $99/month for advanced analytics",
                    "target_audience": "Enterprise product managers"
                },
                "expected_output_structure": {
                    "hypothesis_statement": True,
                    "experiment_design": True,
                    "success_metrics_with_thresholds": True,
                    "landing_page_mockup": True,
                    "validation_plan_with_timeline": True
                },
                "quality_checks": [
                    "Should define exact success threshold (e.g., >30% email capture)",
                    "Should specify target sample size",
                    "Should include recruitment plan",
                    "Should use realistic data in mockups",
                    "Should define go/no-go criteria upfront"
                ]
            }
        ]

        return {"adviser": "Prototyping Agent", "test_cases": test_cases}

    def test_prioritization_engine(self):
        """Test Prioritization Engine"""
        test_cases = [
            {
                "name": "Prioritize backlog items",
                "user_input": {
                    "items_to_prioritize": "SSO login\nDark mode\nAPI rate limiting\nMobile app\nAdvanced search",
                    "strategic_context": "Expand to enterprise market, improve retention",
                    "team_capacity": 10
                },
                "expected_tools_called": [
                    "get_features",
                    "get_themes",
                    "get_personas",
                    "calculate_rice_score"
                ],
                "expected_output_structure": {
                    "rice_scores_with_breakdown": True,
                    "reach_estimates": True,
                    "impact_assessments": True,
                    "confidence_levels": True,
                    "effort_estimates": True,
                    "portfolio_scenarios": True,
                    "trade_off_analysis": True
                },
                "quality_checks": [
                    "Should show calculation methodology for each RICE component",
                    "Should compare scores relatively",
                    "Should provide sensitivity analysis",
                    "Should segment by persona",
                    "Should include data from tools in estimates"
                ]
            }
        ]

        return {"adviser": "Prioritization Engine", "test_cases": test_cases}

    def test_prd_writer(self):
        """Test PRD Writer"""
        test_cases = [
            {
                "name": "Create PRD for new feature",
                "user_input": {
                    "feature_name": "Bulk user import",
                    "problem": "Team admins waste hours inviting users one by one",
                    "target_personas": "Enterprise Administrators"
                },
                "expected_tools_called": [
                    "get_personas",
                    "get_themes",
                    "get_feedback_items",
                    "get_features"
                ],
                "expected_output_structure": {
                    "executive_summary": True,
                    "customer_quotes": True,
                    "user_stories_with_acceptance_criteria": True,
                    "functional_requirements": True,
                    "non_functional_requirements": True,
                    "edge_cases": True,
                    "out_of_scope": True,
                    "success_metrics": True
                },
                "quality_checks": [
                    "Should include 2-3 real customer quotes from feedback",
                    "Should have testable acceptance criteria",
                    "Should cover error cases and edge cases",
                    "Should specify exact validation rules",
                    "Should distinguish v1 scope from future"
                ]
            }
        ]

        return {"adviser": "PRD Writer", "test_cases": test_cases}

    def test_opportunity_identifier(self):
        """Test Opportunity Identifier"""
        test_cases = [
            {
                "name": "Identify growth opportunities",
                "user_input": {
                    "focus_area": "Growth opportunities",
                    "time_period": "Last quarter"
                },
                "expected_tools_called": [
                    "get_feedback_items",
                    "get_themes",
                    "get_personas",
                    "get_feedback_summary"
                ],
                "expected_output_structure": {
                    "opportunities_with_signal_sources": True,
                    "scale_assessment": True,
                    "impact_quantification": True,
                    "affected_personas": True,
                    "feasibility_assessment": True,
                    "priority_ranking": True
                },
                "quality_checks": [
                    "Should distinguish widespread vs isolated issues",
                    "Should quantify users affected and revenue at risk",
                    "Should aggregate signals from multiple sources",
                    "Should assess strategic fit",
                    "Should include supporting quotes"
                ]
            }
        ]

        return {"adviser": "Opportunity Identifier", "test_cases": test_cases}

    def test_edge_cases(self):
        """Test how advisers handle edge cases"""
        edge_case_tests = [
            {
                "scenario": "No data available",
                "test": "When tools return empty results, adviser should acknowledge gracefully",
                "expected_behavior": "Should explain limitation and provide framework anyway"
            },
            {
                "scenario": "Conflicting data",
                "test": "When personas want opposite things",
                "expected_behavior": "Should explicitly call out conflict and explain trade-offs"
            },
            {
                "scenario": "Insufficient sample size",
                "test": "When data has small sample size",
                "expected_behavior": "Should note low confidence and recommend more data"
            },
            {
                "scenario": "Ambiguous user input",
                "test": "When user question is vague",
                "expected_behavior": "Should ask clarifying questions before proceeding"
            }
        ]

        return {"test_type": "Edge Cases", "tests": edge_case_tests}

    def test_prompt_quality_best_practices(self):
        """Test adherence to Anthropic's best practices"""
        best_practice_tests = [
            {
                "practice": "Clear and direct instructions",
                "test": "Instructions should be explicit about what to do"
            },
            {
                "practice": "XML structure",
                "test": "Should use <role>, <methodology>, <instructions>, <constraints>"
            },
            {
                "practice": "Tool usage workflow",
                "test": "Should have <critical_workflow> explaining when to call tools"
            },
            {
                "practice": "Proactive tool calling",
                "test": "Should call tools BEFORE asking user for data"
            },
            {
                "practice": "Specific constraints",
                "test": "Should have DO and DO NOT lists"
            },
            {
                "practice": "Output structure",
                "test": "Should specify exact output format"
            },
            {
                "practice": "Examples and methodology",
                "test": "Should provide concrete examples"
            }
        ]

        return {"test_type": "Best Practices", "tests": best_practice_tests}

    def run_all_tests(self):
        """Run all functional tests"""
        results = {
            "insights_miner": self.test_insights_miner(),
            "prototyping_agent": self.test_prototyping_agent(),
            "prioritization_engine": self.test_prioritization_engine(),
            "prd_writer": self.test_prd_writer(),
            "opportunity_identifier": self.test_opportunity_identifier(),
            "edge_cases": self.test_edge_cases(),
            "best_practices": self.test_prompt_quality_best_practices()
        }

        return results

    def generate_test_report(self, results):
        """Generate comprehensive test report"""
        report = []
        report.append("=" * 80)
        report.append("ADVISER FUNCTIONAL TEST REPORT")
        report.append("=" * 80)
        report.append("")

        for adviser_name, test_data in results.items():
            report.append(f"\n{adviser_name.upper()}")
            report.append("-" * 80)

            if "test_cases" in test_data:
                for test_case in test_data["test_cases"]:
                    report.append(f"\nTest: {test_case['name']}")
                    report.append(f"User Input: {test_case.get('user_input', {})}")

                    if "expected_tools_called" in test_case:
                        report.append(f"Expected Tools: {', '.join(test_case['expected_tools_called'])}")

                    if "quality_checks" in test_case:
                        report.append("Quality Checks:")
                        for check in test_case["quality_checks"]:
                            report.append(f"  ✓ {check}")

            elif "tests" in test_data:
                for test in test_data["tests"]:
                    report.append(f"\n{test.get('scenario', test.get('practice', 'Test'))}")
                    report.append(f"  {test.get('test', test.get('expected_behavior', ''))}")

        report.append("\n" + "=" * 80)
        report.append("TEST SUMMARY")
        report.append("=" * 80)
        report.append(f"Total test suites: {len(results)}")
        report.append("\nNOTE: These are test specifications.")
        report.append("Actual execution requires:")
        report.append("  1. LLM API integration")
        report.append("  2. Mock data for tools")
        report.append("  3. Response validation")
        report.append("  4. Quality assessment")

        return "\n".join(report)


if __name__ == "__main__":
    tester = AdviserFunctionalTests()
    results = tester.run_all_tests()
    report = tester.generate_test_report(results)

    # Print report
    print(report)

    # Save to file
    with open("tests/adviser_test_specifications.txt", "w") as f:
        f.write(report)

    print("\n✅ Test specifications saved to: tests/adviser_test_specifications.txt")
