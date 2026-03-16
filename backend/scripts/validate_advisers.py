"""
Simple validation script for advisers (no external dependencies)
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Import adviser data
from scripts.complete_advisers_suite import COMPLETE_ADVISERS
from scripts.remaining_advisers import REMAINING_ADVISERS

def validate_adviser(adviser):
    """Validate a single adviser configuration"""
    errors = []
    warnings = []
    name = adviser.get('name', 'Unknown')

    # Required fields
    required_fields = ['name', 'description', 'icon', 'tools', 'initial_questions',
                       'task_definitions', 'instructions', 'output_template']

    for field in required_fields:
        if field not in adviser:
            errors.append(f"Missing required field: {field}")

    # Instructions quality
    instructions = adviser.get('instructions', '')

    required_tags = ['<role>', '<methodology>', '<instructions>', '<constraints>']
    for tag in required_tags:
        if tag not in instructions:
            warnings.append(f"Missing recommended tag: {tag}")

    if len(instructions) < 500:
        warnings.append("Instructions may be too short (< 500 chars)")

    # Tool usage
    tools = adviser.get('tools', [])
    if tools and 'critical_workflow' not in instructions.lower():
        warnings.append("Has tools but no critical_workflow section")

    for tool in tools:
        if tool not in instructions:
            warnings.append(f"Tool '{tool}' not mentioned in instructions")

    # Output template
    output_template = adviser.get('output_template', '')
    if len(output_template) < 50:
        warnings.append("Output template may be too vague")

    return errors, warnings


def main():
    all_advisers = COMPLETE_ADVISERS + REMAINING_ADVISERS

    print(f"{'='*80}")
    print(f"VALIDATING {len(all_advisers)} ADVISERS")
    print(f"{'='*80}\n")

    total_errors = 0
    total_warnings = 0
    passed = 0
    failed = 0

    for adviser in all_advisers:
        name = adviser.get('name', 'Unknown')
        print(f"\n{name}")
        print(f"{'-'*80}")

        errors, warnings = validate_adviser(adviser)

        if errors:
            failed += 1
            total_errors += len(errors)
            print(f"❌ FAILED")
            for error in errors:
                print(f"  ERROR: {error}")
        else:
            passed += 1
            print(f"✅ PASSED")

        if warnings:
            total_warnings += len(warnings)
            for warning in warnings:
                print(f"  ⚠️  WARNING: {warning}")

    # Summary
    print(f"\n{'='*80}")
    print(f"VALIDATION SUMMARY")
    print(f"{'='*80}")
    print(f"Total: {len(all_advisers)}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"Errors: {total_errors}")
    print(f"Warnings: {total_warnings}")
    print(f"Success rate: {passed/len(all_advisers)*100:.1f}%")

    return 0 if failed == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
