# Adviser Testing Suite

Comprehensive testing framework for validating adviser prompts and functionality.

## Test Types

### 1. Structure Validation (No LLM required)

Validates adviser configuration structure without making LLM API calls.

```bash
python3 scripts/validate_advisers.py
```

**What it checks:**
- ✅ Required fields present (name, description, icon, tools, etc.)
- ✅ XML tags present (`<role>`, `<methodology>`, `<instructions>`, `<constraints>`)
- ✅ Tool integration (tools mentioned in instructions)
- ✅ Critical workflow sections for advisers with tools
- ✅ Output template quality

**Expected output:**
```
Total: 21 advisers
✅ Passed: 21 (100%)
❌ Failed: 0
Warnings: 0-4 (minor)
```

### 2. Functional Tests (Requires LLM API)

Tests advisers with real LLM API calls using mock data.

```bash
# Test default advisers (Insights Miner, Prioritization Engine, PRD Writer)
python3 tests/run_functional_tests.py

# Test specific advisers
python3 tests/run_functional_tests.py "Insights Miner" "Roadmap Planner"

# Test all advisers with scenarios
python3 tests/run_functional_tests.py "Insights Miner" "Prototyping Agent" "PRD Writer" "Prioritization Engine"
```

**What it tests:**
- ✅ Adviser loads from database correctly
- ✅ LLM generates valid response
- ✅ Response uses data from mock tools
- ✅ Response doesn't ask for data already provided
- ✅ Response mentions personas and themes from data
- ✅ Response provides recommendations
- ✅ Response shows confidence/caveats
- ✅ Response is well-structured

**Quality Assessment:**
Each response is scored on 8 quality checks:
1. Has substantial content (>100 chars)
2. Doesn't ask for data that tools provided
3. Uses specific numbers from data
4. Well-structured (multiple sections)
5. Mentions personas from mock data
6. Mentions themes from mock data
7. Provides recommendations
8. Shows confidence levels/caveats

**Expected output:**
```
Testing: Insights Miner
✅ Loaded adviser
📝 Sending prompt to LLM...
✅ Received response: 2345 chars

📊 Quality Score: 87.5%
  ✅ has_content
  ✅ no_data_requests
  ✅ uses_data
  ✅ well_structured
  ✅ mentions_personas
  ✅ mentions_themes
  ✅ provides_recommendations
  ❌ shows_confidence

Total tests: 3
✅ Successful: 3
Average quality score: 85.2%
```

## Prerequisites

### For Structure Validation
- Python 3.13+
- No external dependencies needed

### For Functional Tests
- Python 3.13+
- PostgreSQL database running
- LLM API configuration (one of):
  - Tenant with LLM config in database (Settings → LLM Settings)
  - Environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.)

**Required Python packages:**
```bash
# Already installed if backend is set up
sqlalchemy
asyncpg
anthropic  # or openai, depending on provider
```

## Mock Data

Test scenarios use realistic mock data fixtures defined in `tests/mock_data_fixtures.py`:

**Mock Themes:**
- Performance Issues (234 votes, high urgency)
- Better Search (156 votes, medium urgency)
- Mobile Support (189 votes, medium urgency)
- SSO/Authentication (198 votes, high urgency)

**Mock Personas:**
- Enterprise Admin ($500K ARR, 450 votes)
- Power User ($200K ARR, 320 votes)
- End User ($100K ARR, 180 votes)

**Mock Features:**
- Dashboard Analytics (45% adoption, RICE: 850)
- Team Collaboration (in development, RICE: 720)

**Mock Feedback:**
- 123 total feedback items
- 950 total votes
- Sentiment: 40% negative, 45% neutral, 15% positive

## Test Scenarios

### Insights Miner
**Scenario:** "Why did adoption of the search feature drop by 15% last month?"
- Provides feedback summary, themes, personas, features
- Expects segmented analysis with confidence intervals
- Should NOT ask for data

### Prioritization Engine
**Scenario:** Prioritize 4 features (SSO, Mobile app, Search, Performance)
- Provides themes, personas, features
- Expects RICE scores with calculations
- Should show trade-off analysis

### PRD Writer
**Scenario:** Create PRD for "Bulk user import"
- Provides personas, themes, feedback, features
- Expects user stories with acceptance criteria
- Should include customer quotes

## Interpreting Results

### Structure Validation

**100% pass rate expected:** All advisers should pass structure validation.

**Warnings are OK if minor:**
- Missing optional tags
- Tools not mentioned explicitly (if they're implied in workflow)

**Failures indicate:**
- Missing required fields
- Broken prompt structure
- Invalid JSON in configuration

### Functional Tests

**Quality Score Interpretation:**
- **90-100%:** Excellent - Response is high quality, follows all best practices
- **75-89%:** Good - Response is solid, minor improvements possible
- **60-74%:** Acceptable - Response works but has quality issues
- **<60%:** Needs improvement - Prompt may need revision

**Common Issues:**

❌ **no_data_requests fails:**
- Adviser is asking for data that tools already provided
- FIX: Add or strengthen `<critical_workflow>` section

❌ **uses_data fails:**
- Response is too generic, not using mock data
- FIX: Emphasize in instructions to use specific numbers

❌ **mentions_personas/themes fails:**
- Response doesn't reference actual data
- FIX: Add explicit instruction to cite data from tools

❌ **shows_confidence fails:**
- Response too certain, no caveats
- FIX: Add instruction to call out assumptions and limitations

## Continuous Testing

### When to Run Tests

**Structure validation:** After any changes to adviser definitions
```bash
python3 scripts/validate_advisers.py
```

**Functional tests:**
- After updating adviser prompts
- Before deploying to production
- When adding new advisers
- Periodically (weekly/monthly) to catch regressions

```bash
python3 tests/run_functional_tests.py
```

### CI/CD Integration

Add to your CI pipeline:
```yaml
# Example GitHub Actions
- name: Validate Adviser Structure
  run: python3 scripts/validate_advisers.py

- name: Run Functional Tests
  run: python3 tests/run_functional_tests.py
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Troubleshooting

### "No LLM configuration available"
**Problem:** Functional tests can't find LLM API keys

**Solution:**
1. Configure in database: Settings → LLM Settings
2. Or set environment variable:
   ```bash
   export ANTHROPIC_API_KEY="your-key"
   # or
   export OPENAI_API_KEY="your-key"
   ```

### "Adviser not found in database"
**Problem:** Adviser hasn't been seeded

**Solution:**
```bash
python3 scripts/generate_adviser_sql.py
PGPASSWORD=postgres psql -U postgres -d evols -h localhost -p 5432 \
    -f scripts/seed_all_advisers_generated.sql
```

### Quality score consistently low
**Problem:** Adviser prompt needs improvement

**Solution:**
1. Check which quality checks are failing
2. Review adviser instructions
3. Add/strengthen relevant sections:
   - `<critical_workflow>` for tool usage
   - `<instructions>` for specific behaviors
   - `<constraints>` for boundaries
4. Regenerate and re-test

### Rate limiting errors
**Problem:** Too many API calls too quickly

**Solution:**
- Tests include 2-second delay between advisers
- If still hitting limits, increase delay in `run_functional_tests.py`
- Or test fewer advisers at once

## Adding New Tests

### Add Mock Data
Edit `tests/mock_data_fixtures.py`:
```python
TEST_SCENARIOS["new_adviser"] = {
    "user_input": {
        "question_id": "answer"
    },
    "mock_tools": {
        "get_themes": MockToolResponses.get_themes()
    }
}
```

### Add Quality Checks
Edit `assess_response_quality()` in `tests/run_functional_tests.py`:
```python
# Add custom check
checks["custom_check"] = "expected_text" in response.lower()
```

## Reports

### Structure Validation
- Console output only
- Summary at end

### Functional Tests
- Console output with real-time progress
- Detailed JSON report saved to:
  ```
  tests/functional_test_report_YYYYMMDD_HHMMSS.json
  ```

**Report includes:**
- Timestamp
- Adviser name and scenario
- Full LLM response
- Quality score and individual checks
- Errors and warnings

## Best Practices

1. **Run structure validation after every prompt change**
2. **Run functional tests before deploying to production**
3. **Keep mock data realistic** - based on actual user data
4. **Review failed quality checks** - they indicate prompt issues
5. **Monitor quality scores over time** - catch regressions
6. **Add scenarios for new advisers** - ensure comprehensive coverage

## Reference

**Anthropic Best Practices:**
- [Prompt Engineering Overview](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview)
- [Best Practices Guide](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-prompting-best-practices)

**Files:**
- `scripts/validate_advisers.py` - Structure validator
- `tests/run_functional_tests.py` - Functional test runner
- `tests/mock_data_fixtures.py` - Mock data
- `tests/test_advisers_functional.py` - Test specifications (documentation)

---

*Last Updated: 2026-03-13*
