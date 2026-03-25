# Architecture Comparison: Current Evols Skills vs Unified-PM-OS Skills

## TL;DR: They're NOT Separate Agents

Both systems use **the same architecture**:
- One LLM instance (Claude/GPT)
- Different system prompts per skill
- Same tool registry
- Different prompt = different "skill"

**Not separate agents. Just different instructions to the same LLM.**

---

## Current Evols Skills Architecture

### Storage: PostgreSQL Database

```sql
-- skills table
CREATE TABLE skills (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),              -- "Insights Miner"
    description TEXT,               -- "Self-serve data analysis..."
    icon VARCHAR(50),               -- "🔍"

    -- Configuration
    tools JSON,                     -- ["get_themes", "get_personas", ...]
    initial_questions JSON,         -- Form questions to ask user
    task_definitions JSON,          -- Execution steps
    instructions TEXT,              -- System prompt (500-2000 words)
    output_template TEXT,           -- How to format results

    is_active BOOLEAN
);
```

### Example Skill Definition (from DB)

```json
{
  "name": "Insights Miner",
  "description": "Self-serve data analysis and insight generation",
  "icon": "🔍",
  "tools": [
    "get_themes",
    "get_personas",
    "get_feedback_items",
    "get_features",
    "get_feedback_summary",
    "calculate_rice_score"
  ],
  "instructions": "You are a senior product analyst with 12+ years at Amplitude...\n\n<role>Help PMs answer data questions through rigorous analysis...</role>\n\n<critical_workflow>\nAfter understanding the question, IMMEDIATELY:\n1. Call get_feedback_summary() for overall trends\n2. Call get_themes() for customer discussions\n...",
  "initial_questions": [
    {
      "id": "analysis_goal",
      "type": "select",
      "question": "What analysis do you need?",
      "options": ["Trend analysis", "Cohort comparison", ...]
    }
  ],
  "output_template": "Executive summary with key finding and action; Key findings with data; ..."
}
```

### Execution Flow

```python
# 1. User clicks "Insights Miner" skill
# 2. Backend loads from database
skill = await db.execute(
    select(Skill).where(Skill.name == "Insights Miner")
)

# 3. Build system prompt
system_prompt = skill.instructions  # The long text from DB

# 4. Build tool list
tools = [tool_registry.get_tool(name) for name in skill.tools]

# 5. Call Claude with this config
response = await claude.complete(
    system_prompt=system_prompt,
    tools=tools,
    user_message="Analyze churn trends"
)
```

**Key Point:** It's ONE Claude instance. The "skill" is just:
- A system prompt (instructions field)
- A list of tool names
- Stored in PostgreSQL

---

## Unified-PM-OS Skills Architecture

### Storage: SKILL.md Files

```
unified-pm-os/skills/
├── 01-discovery/
│   ├── identify-assumptions/
│   │   └── SKILL.md          ← One skill
│   ├── brainstorm-ideas/
│   │   └── SKILL.md
│   └── opportunity-solution-tree/
│       └── SKILL.md
├── 02-strategy/
│   ├── business-model/
│   │   └── SKILL.md
│   ├── ansoff-matrix/
│   │   └── SKILL.md
│   └── pestle-analysis/
│       └── SKILL.md
```

### Example Skill Definition (from file)

```markdown
---
name: ansoff-matrix
description: "Generate an Ansoff Matrix analysis mapping growth strategies"
tools: [get_themes, get_personas, get_features]
category: strategy
---

# Ansoff Matrix

## Instructions

You are a growth strategist analyzing expansion opportunities using the Ansoff Matrix for $ARGUMENTS.

Your task is to evaluate growth options across product and market dimensions.

## Input Requirements
- Current product(s) and market definition
- Current market penetration
- Growth targets and timelines

## Framework

### 2x2 Matrix: Products vs. Markets

|  | Current Market | New Market |
|---|---|---|
| **Current Product** | Market Penetration | Market Development |
| **New Product** | Product Development | Diversification |

### 1. Market Penetration (Current Product + Current Market)
Grow revenue by increasing usage in existing market.

**Strategies:**
- Increase frequency of product usage
- Expand use cases within existing customer base
- Acquire competitors' customers
- Reduce churn and improve retention

[... detailed framework continues ...]

## Output Format

Present a complete 2x2 matrix with:
- Current state analysis
- Specific strategies for each quadrant
- Risk assessment per quadrant
- Recommended priority path
```

### Execution Flow (If Integrated)

```python
# 1. User clicks "Ansoff Matrix" skill
# 2. Backend loads from file
skill_adapter = SkillAdapter('/path/to/unified-pm-os')
skill = skill_adapter.load_skill('02-strategy/ansoff-matrix/SKILL.md')

# Parse SKILL.md
# Returns:
{
  'name': 'ansoff-matrix',
  'description': 'Generate an Ansoff Matrix...',
  'tools': ['get_themes', 'get_personas', 'get_features'],
  'category': 'strategy',
  'instructions': '# Ansoff Matrix\n\nYou are a growth strategist...'
}

# 3. Build system prompt (SAME AS EVOLS)
system_prompt = skill['instructions']

# 4. Build tool list (SAME AS EVOLS)
tools = [tool_registry.get_tool(name) for name in skill['tools']]

# 5. Call Claude with this config (SAME AS EVOLS)
response = await claude.complete(
    system_prompt=system_prompt,
    tools=tools,
    user_message="What's our growth strategy?"
)
```

**Key Point:** Still ONE Claude instance. The "skill" is just:
- A system prompt (from SKILL.md file)
- A list of tool names
- Stored in filesystem instead of DB

---

## Key Differences

| Aspect | Current Evols | Unified-PM-OS |
|--------|---------------|---------------|
| **Storage** | PostgreSQL database | Filesystem (SKILL.md files) |
| **Format** | JSON + TEXT columns | YAML frontmatter + Markdown |
| **Maintenance** | SQL scripts or admin UI | Git + text editor |
| **Version Control** | Database backups | Git history |
| **Editing** | Admin interface or SQL | Any text editor |
| **Deployment** | Database migration | Copy files |
| **Skill Count** | 21 skills | 83 skills |
| **Content Focus** | Task-focused ("Insights Miner") | Framework-focused ("Ansoff Matrix") |
| **Curation** | Custom-built by you | Curated by PM experts |
| **LLM Architecture** | ✅ Same: One Claude instance | ✅ Same: One Claude instance |
| **Tool Registry** | ✅ Same: tool_registry.py | ✅ Same: Can use same tools |
| **Execution** | ✅ Same: LLM + tools | ✅ Same: LLM + tools |

---

## What's the Same (Critical Understanding)

### 1. NOT Separate Agents

**Wrong mental model:**
```
❌ Each skill = separate AI agent running independently
❌ 21 Claude instances running in parallel
❌ Different neural networks per skill
```

**Correct mental model:**
```
✅ Each skill = different instruction set for SAME Claude
✅ ONE Claude instance handles all skills
✅ "Skill" = system prompt + tool list
✅ Like giving the same person different job descriptions
```

### 2. Architecture is Identical

Both systems:
1. Load skill configuration (from DB or file)
2. Extract system prompt
3. Extract tool list
4. Call LLM with this config
5. Return response

The ONLY difference is step 1: where you load config from.

### 3. Tool Registry is Shared

Both use the same `tool_registry` from `skill_tools.py`:

```python
# This is the SAME for both systems
tool_registry.register(
    name="get_personas",
    description="Get all personas for the tenant",
    parameters=[...]
)

tool_registry.register(
    name="calculate_rice_score",
    description="Calculate RICE score for a feature",
    parameters=[...]
)
```

Skills just reference tools by name:
- Evols: `"tools": ["get_personas", "calculate_rice_score"]` (in DB)
- Unified-PM-OS: `tools: [get_personas, calculate_rice_score]` (in YAML)

Same tools. Same registry. Same execution.

---

## What's Different (The Real Value)

### 1. Content Quality

**Current Evols Skills:**
```
"Insights Miner" instructions:
- ~800 words
- Task-focused: "Pull data, analyze, provide insights"
- Generic PM workflow
- Works but could be more structured
```

**Unified-PM-OS Skills:**
```
"Ansoff Matrix" instructions:
- ~1500 words
- Framework-focused: Step-by-step Ansoff Matrix application
- Specific methodology from growth strategy literature
- Structured output template
- More expert guidance
```

**Why this matters:** Unified-PM-OS skills encode expert PM frameworks, not just generic workflows.

### 2. Maintenance Model

**Current Evols:**
```sql
-- Updating a skill = SQL script or admin UI
UPDATE skills
SET instructions = 'new prompt...'
WHERE name = 'Insights Miner';
```

**Unified-PM-OS:**
```bash
# Updating a skill = edit text file + git commit
vim skills/02-strategy/ansoff-matrix/SKILL.md
git commit -m "Improve Ansoff Matrix output format"
```

**Why this matters:**
- PM experts can contribute skills via GitHub
- Version control built-in
- Easier to review changes (git diff)
- Can fork and customize
- Community contributions possible

### 3. Framework-Based vs Task-Based

**Current Evols Approach:**
- "Insights Miner" - general data analysis
- "PRD Writer" - general PRD creation
- "Roadmap Planner" - general roadmap

**Unified-PM-OS Approach:**
- "VUVF Assumption Mapping" (Alberto Savoia's framework)
- "Opportunity Solution Tree" (Teresa Torres' framework)
- "Jobs-to-be-Done Interview" (Clayton Christensen's framework)
- "Porter's Five Forces" (Michael Porter's framework)

**Why this matters:** Framework skills teach PMs methodologies, not just automate tasks.

---

## Integration Path: What Actually Changes

### Current Code Flow

```python
# copilot_orchestrator.py
async def load_skill_config(skill_id, skill_type):
    # Load from database
    skill = await db.execute(
        select(Skill).where(Skill.id == skill_id)
    )

    return {
        'name': skill.name,
        'instructions': skill.instructions,  # ← From DB
        'tools': skill.tools
    }

async def chat(message, conversation_id):
    skill_id = detect_skill(message)
    skill_config = await load_skill_config(skill_id)  # ← From DB

    response = await llm.complete(
        system_prompt=skill_config['instructions'],
        tools=skill_config['tools']
    )
```

### Enhanced Code Flow

```python
# copilot_orchestrator.py
from app.services.unified_pm_os.skill_adapter import SkillAdapter

async def load_skill_config(skill_id, skill_type):
    # Try file first
    skill_from_db = await db.execute(
        select(Skill).where(Skill.id == skill_id)
    )

    if skill_from_db.file_path:  # ← NEW: Check if skill has file path
        adapter = SkillAdapter('/path/to/unified-pm-os')
        skill_from_file = adapter.load_skill(skill_from_db.file_path)

        return {
            'name': skill_from_file['name'],
            'instructions': skill_from_file['instructions'],  # ← From FILE
            'tools': skill_from_file['tools']
        }

    # Fallback to database
    return {
        'name': skill_from_db.name,
        'instructions': skill_from_db.instructions,  # ← From DB
        'tools': skill_from_db.tools
    }

# Everything else stays EXACTLY the same
async def chat(message, conversation_id):
    skill_id = detect_skill(message)
    skill_config = await load_skill_config(skill_id)  # ← Returns same structure

    response = await llm.complete(
        system_prompt=skill_config['instructions'],  # ← Same usage
        tools=skill_config['tools']
    )
```

**Changes required:**
1. Add `file_path` column to skills table
2. Create `SkillAdapter` class to parse SKILL.md files
3. Modify `load_skill_config()` to try file first, fallback to DB
4. Everything else unchanged

**Lines of code:** ~100 lines total

---

## Why "Separate Agents" is a Misconception

### What People Think "Agents" Means

"Each skill has its own AI brain running independently"

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Insights Miner  │    │   PRD Writer    │    │ Roadmap Planner │
│   (Agent 1)     │    │   (Agent 2)     │    │   (Agent 3)     │
│                 │    │                 │    │                 │
│  Claude API 1   │    │  Claude API 2   │    │  Claude API 3   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**This is NOT how it works.**

### How It Actually Works

"One AI instance, different instructions"

```
┌───────────────────────────────────────────────────────────┐
│                      Claude API                           │
│                   (ONE instance)                          │
└───────────────────────────────────────────────────────────┘
                             ▲
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         │                   │                   │
    Prompt A             Prompt B            Prompt C
    (Insights)            (PRD)              (Roadmap)
    + Tools 1-6          + Tools 2-8         + Tools 3-9
```

**It's like hiring one expert consultant:**
- Same person (Claude)
- Different job descriptions (system prompts)
- Different tools available per job (tool list)

### Analogy

**Wrong understanding:**
- Hiring 21 different consultants (one per skill)
- Each has their own office, resources, brain

**Correct understanding:**
- Hiring ONE versatile consultant (Claude)
- Giving them 21 different job briefs
- Each brief includes: role description, available tools, output format
- Same consultant, different contexts

---

## The Real Question

**Not:** "Should we use separate agents vs current architecture?"
**But:** "Should we use expert-curated framework prompts vs our custom prompts?"

**Architecture is identical. Content is different.**

---

## Answering Your Original Question

### "Are current skills separate agents?"

**No.** They're different system prompts passed to the same LLM instance.

### "How is that different from unified-pm-os?"

**It's not architecturally different.** Both are:
- One LLM instance
- Different system prompts per skill
- Same tool execution pattern

**The difference is CONTENT:**
- Current skills: Task-focused, custom-written
- Unified-PM-OS: Framework-focused, expert-curated

### "What actually changes if we integrate?"

**Code changes:** ~100 lines
- Load skills from SKILL.md files instead of DB
- Everything else stays the same

**Content changes:** Major
- 21 task-focused skills → 83 framework-based skills
- Generic prompts → Expert methodologies
- "Do analysis" → "Apply Teresa Torres OST framework step-by-step"

---

## Bottom Line

**Current Evols and Unified-PM-OS use the SAME architecture.**

The integration isn't about changing HOW skills work.
It's about changing WHAT skills say.

**The value proposition:**
- Same technical foundation ✓
- Better content (expert-curated frameworks) ✓
- More skills (83 vs 21) ✓
- Easier maintenance (git vs database) ✓
- Community contributions possible ✓

**The risk:**
- Will users actually use framework-based skills?
- Are they too prescriptive?
- Do they fix the "skills don't work" problem?

That's the real question to validate.
