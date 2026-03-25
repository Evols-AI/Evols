# Evols Architecture Changes: Before & After

Visual guide showing exactly how Evols changes with Unified PM OS integration.

---

## 🎯 Quick Summary

**What Changes:**
- Skills: 21 → 83
- New: Knowledge layer per product
- New: Memory system (context graph)
- New: Chained workflows
- Enhanced: Skills reference real customer data + product strategy

**What Stays the Same:**
- All existing Evols features work unchanged
- Theme clustering, RICE scoring, persona twins - all intact
- Same UI/UX patterns
- Same authentication and multi-tenancy

---

## 📊 Data Flow Comparison

### BEFORE: Current Evols

```
User starts skill session
        ↓
Frontend: POST /api/v1/skills/sessions
        ↓
Backend: Create conversation
        ↓
Get skill prompt (from skills table)
        ↓
Call LLM with:
  • System prompt (from skills.instructions)
  • User message
  • Tool registry (20+ Evols tools)
        ↓
LLM executes
        ↓
May call tools:
  • get_themes()
  • get_personas()
  • get_feedback_items()
  • calculate_rice_score()
        ↓
Return response
        ↓
Save to messages table
        ↓
Display to user
```

**Limitations:**
- ❌ Skill has NO knowledge of product strategy
- ❌ Skill has NO memory of past work
- ❌ Each skill session is isolated
- ❌ Generic outputs (not personalized to product)

### AFTER: With Unified PM OS

```
User starts skill session
        ↓
Frontend: POST /api/v1/skills/sessions
        ↓
Backend: Create conversation
        ↓
🆕 Load skill from unified-pm-os/skills/
   (SKILL.md file with framework instructions)
        ↓
🆕 Build enhanced context:
   ├─ Knowledge: product_knowledge table
   │  ├─ strategy.md
   │  ├─ customer_segments.md
   │  └─ metrics_and_targets.md
   │
   ├─ Memory: skill_memory table
   │  └─ Past 5 skill executions in this category
   │
   └─ Evols Data: (same as before)
      ├─ get_themes()
      ├─ get_personas()
      └─ get_feedback_items()
        ↓
Call LLM with:
  • System prompt (from SKILL.md + knowledge + memory)
  • User message
  • Tool registry (same 20+ tools)
        ↓
LLM executes
        ↓
Return response
        ↓
🆕 Save to messages table (same)
🆕 Save to skill_memory table (new)
   └─ For future sessions to reference
        ↓
Display to user (with "Saved to memory" indicator)
```

**Benefits:**
- ✅ Skill knows product strategy
- ✅ Skill has memory of past work
- ✅ Outputs are personalized
- ✅ Cross-session learning

---

## 🗄️ Database Schema Changes

### New Tables (4 additions)

```sql
┌────────────────────────────────────────────┐
│  product_knowledge                         │
│  • Per-product strategy docs               │
│  • strategy_doc (JSONB)                    │
│  • customer_segments_doc (JSONB)           │
│  • competitive_landscape_doc (JSONB)       │
│  • value_proposition_doc (JSONB)           │
│  • metrics_and_targets_doc (JSONB)         │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│  skill_memory                              │
│  • Context graph - accumulated outputs     │
│  • skill_name                              │
│  • skill_category                          │
│  • input_data (JSONB)                      │
│  • output_data (JSONB)                     │
│  • outcome_recorded (boolean)              │
│  • outcome_data (JSONB)                    │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│  skill_workflows                           │
│  • Chained skill sequences                 │
│  • name (e.g., "discover")                 │
│  • skill_sequence (JSONB array)            │
│  • execution_count                         │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│  skill_outcomes                            │
│  • Decision results tracking               │
│  • skill_memory_id (FK)                    │
│  • decision_made                           │
│  • outcome_type (success/partial/failure)  │
│  • metrics (JSONB)                         │
└────────────────────────────────────────────┘
```

### Modified Tables

```sql
ALTER TABLE skills ADD COLUMN:
  • category VARCHAR(50)              -- discovery, strategy, etc.
  • source VARCHAR(50)                -- 'unified_pm_os' or 'custom'
  • skill_file_path TEXT              -- Path to SKILL.md
  • framework_author VARCHAR(255)     -- e.g., 'Teresa Torres'
```

---

## 🏗️ Backend Architecture Changes

### File Structure

```
evols/backend/
├── app/
│   ├── api/v1/endpoints/
│   │   ├── copilot.py           (modified: enhanced context)
│   │   ├── knowledge.py         (NEW: knowledge CRUD)
│   │   └── memory.py            (NEW: memory & retrospective)
│   │
│   ├── models/
│   │   ├── skill.py             (modified: new fields)
│   │   ├── product_knowledge.py (NEW)
│   │   ├── skill_memory.py      (NEW)
│   │   └── skill_workflow.py    (NEW)
│   │
│   ├── services/
│   │   ├── unified_pm_os/       (NEW: integration layer)
│   │   │   ├── __init__.py
│   │   │   ├── skill_adapter.py      (loads SKILL.md files)
│   │   │   ├── knowledge_manager.py  (manages strategy docs)
│   │   │   ├── memory_manager.py     (context graph)
│   │   │   └── workflow_engine.py    (skill chaining)
│   │   │
│   │   └── skill_tools.py       (unchanged: same 20+ tools)
│   │
│   └── database.py              (unchanged)
│
└── unified-pm-os/               (NEW: git submodule or copy)
    ├── skills/
    │   ├── 01-discovery/        (13 SKILL.md files)
    │   ├── 02-strategy/         (12 SKILL.md files)
    │   └── ... (10 categories)
    │
    ├── knowledge/               (templates & examples)
    └── README.md
```

### New Service Layer

```python
# SkillAdapter
# Loads SKILL.md files from unified-pm-os at runtime
skill_adapter = SkillAdapter('/path/to/unified-pm-os')
skills = skill_adapter.discover_all_skills()  # Returns 83 skills

# KnowledgeManager
# CRUD for product strategy docs
knowledge = await knowledge_manager.get_product_knowledge(product_id)
# Returns: {strategy: {}, customer_segments: {}, ...}

# MemoryManager
# Saves skill outputs, provides retrospective insights
await memory_manager.save_skill_output(...)
insights = await memory_manager.get_retrospective_insights(product_id)

# WorkflowEngine
# Executes chained skills
results = await workflow_engine.execute_workflow('discover', input, context)
# Returns: [brainstorm → assumptions → prioritize → experiments]
```

---

## 🎨 Frontend Changes

### Navigation Updates

```
Current:                          After Integration:
──────────────────────            ──────────────────────
Dashboard                         Dashboard
Themes                            Themes
Initiatives                       Initiatives
Projects                          Projects
Personas                          Personas
Decision Workbench                Decision Workbench
Skills (21 skills)                Skills (83 skills) 🆕 Enhanced
                                  Knowledge 🆕 NEW
                                  Memory & Insights 🆕 NEW
Settings                          Settings
```

### Skills Page Changes

**BEFORE:**
```
┌──────────────────────────────────────┐
│  Skills (21)                         │
│  ────────────────────────────────    │
│                                      │
│  [Insights Miner]                    │
│  [PRD Writer]                        │
│  [Decision Logger]                   │
│  ... (18 more)                       │
│                                      │
│  Simple list, no categories          │
└──────────────────────────────────────┘
```

**AFTER:**
```
┌──────────────────────────────────────────────────┐
│  Skills Library (83)                             │
│  ──────────────────────────────────────────      │
│                                                  │
│  Categories:                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│  │ 🔍  │ │ 🎯  │ │ ⚡   │ │ 📊   │           │
│  │Discov│ │Strat │ │Exec  │ │Researc│           │
│  │ (13) │ │ (12) │ │ (15) │ │  (7)  │           │
│  └──────┘ └──────┘ └──────┘ └──────┘           │
│                                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│  │ 📈  │ │ 🚀  │ │ 📱   │ │ 🛠️  │           │
│  │Analyt│ │GTM   │ │Growth│ │Toolkit│           │
│  │  (3) │ │  (6) │ │  (5) │ │  (4)  │           │
│  └──────┘ └──────┘ └──────┘ └──────┘           │
│                                                  │
│  Showing: Discovery (13 skills)                 │
│  ────────────────────────────────────────────   │
│  [Brainstorm Ideas] - Multi-perspective ...     │
│  [Identify Assumptions] - VUVF risk mapping     │
│  [Opportunity Solution Tree] - Teresa Torres    │
│  ... (10 more)                                  │
└──────────────────────────────────────────────────┘
```

### NEW Page: Knowledge

```
┌────────────────────────────────────────────────────┐
│  Product Knowledge                                 │
│  ────────────────────────────────────────────      │
│                                                    │
│  [Strategy] [Segments] [Competitive] [Value] [...] │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │  Strategy                            [Edit]  │ │
│  │  ──────────────────────────────────────────  │ │
│  │                                              │ │
│  │  Product: Enterprise Analytics Platform     │ │
│  │                                              │ │
│  │  Strategic Pillars:                          │ │
│  │    1. Self-serve analytics (no SQL)          │ │
│  │    2. Cross-functional collaboration         │ │
│  │    3. Real-time insights                     │ │
│  │                                              │ │
│  │  North Star Metric:                          │ │
│  │    Weekly Active Analysts (WAA)              │ │
│  │                                              │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  💡 Skills automatically reference this knowledge │
│  when executing.                                  │
└────────────────────────────────────────────────────┘
```

### NEW Page: Memory & Insights

```
┌────────────────────────────────────────────────────┐
│  Product Memory & Insights                         │
│  ────────────────────────────────────────────      │
│                                                    │
│  Retrospective (Last 90 days)                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │   42    │  │Discovery│  │   15%   │          │
│  │ Skills  │  │ Most    │  │Validated│          │
│  │  Used   │  │  Used   │  │Outcomes │          │
│  └─────────┘  └─────────┘  └─────────┘          │
│                                                    │
│  ⚠️ Recommendations:                               │
│  • Only 15% of decisions have outcomes. Track!    │
│  • You identified 47 assumptions but validated     │
│    only 6%. Run experiments!                      │
│                                                    │
│  Memory Timeline                                   │
│  ────────────────────────────────────────          │
│  📅 Mar 18  [Identify Assumptions]                │
│    Mapped 12 assumptions for export feature       │
│                                                    │
│  📅 Mar 15  [Product Strategy]                    │
│    Created strategy canvas for Q2                 │
│                                                    │
│  📅 Mar 12  [SWOT Analysis]                       │
│    Competitive analysis vs Looker/Tableau         │
└────────────────────────────────────────────────────┘
```

---

## 🔄 User Flow Comparison

### Scenario: PM wants to discover assumptions for a new feature

#### BEFORE (Current Evols)

```
1. Go to Skills page
2. Find "Decision Logger" skill (closest match)
3. Start session
4. Type: "Help me identify assumptions for export feature"
5. LLM responds with generic assumption framework
6. No context about:
   ❌ Product strategy
   ❌ Past assumptions from other features
   ❌ Customer feedback themes
7. Output saved to messages table only
8. Next session starts fresh (no memory)
```

**Output Example:**
```
Here are common assumption categories:
- Desirability: Do users want this?
- Feasibility: Can we build it?
- Viability: Will it make money?
- Usability: Can users use it?

Please tell me more about your feature...
```

#### AFTER (With Unified PM OS)

```
1. Go to Skills page → Discovery category
2. Find "Identify Assumptions" skill
   (From pm-skills, based on Teresa Torres framework)
3. Start session
4. Type: "Help me identify assumptions for export feature"
5. LLM has context:
   ✅ Product strategy: "Self-serve analytics" pillar
   ✅ Past work: Previously identified 12 assumptions for dashboard feature
   ✅ Customer feedback: 127 items mention "export" from 43 accounts
   ✅ Themes: "Need for flexible data export formats" theme
6. LLM responds with personalized, evidence-backed assumptions
7. Output saved to:
   ✅ messages table (chat history)
   ✅ skill_memory table (for retrospectives)
8. Next session references this work
```

**Output Example:**
```
Based on your product strategy (Self-serve analytics pillar)
and customer feedback analysis, here are the riskiest assumptions
for your export feature:

## Assumptions (Prioritized by Risk)

### 1. Assumption: Users want CSV exports
**Category:** Value (Desirability)
**Risk Level:** HIGH
**Evidence from Evols:**
- Theme: "Need for flexible data export formats"
- 127 feedback items from 43 accounts ($2.1M ARR)
- 3 related themes

**Why this matters for your strategy:**
Your "Self-serve analytics" pillar means users expect
no-code solutions. CSV-only might force them to write scripts.

**Recommended Experiment:**
Build format picker prototype (CSV, JSON, Excel)
Test with 5 beta customers
Success metric: >80% choose CSV as primary

**Related Past Work:**
You identified similar format assumptions for the dashboard
feature (Feb 15). Those validated successfully - users wanted
multiple formats, not just one.

### 2. Assumption: Enterprise users want scheduled exports
...
```

---

## 📈 Benefits Summary

### For Users (PM Teams)

**Before:**
- 21 generic AI skills
- No product context
- Each session isolated
- Manual tracking of decisions
- Generic, repetitive outputs

**After:**
- 83 framework-based skills (Teresa Torres, Marty Cagan, etc.)
- Skills know product strategy
- Memory accumulates over time
- Automatic decision tracking
- Personalized, evidence-backed outputs
- Retrospective insights show patterns

### For Evols (Product)

**Before:**
- "Evols clusters feedback"
- Limited skill depth
- No competitive moat

**After:**
- "Evols is the AI operating system for product decisions"
- 83 proven PM frameworks
- Knowledge + Memory = compounding value
- Switching costs (invested knowledge + memory)
- Clear differentiation vs Productboard, Aha!, etc.

### Technical Benefits

**Before:**
- Skills defined in database (hard to update)
- No version control for skills
- Skills isolated from each other

**After:**
- Skills in .md files (easy to update, version control)
- Git-trackable skill library
- Skills chain together
- Memory enables cross-skill learning
- A/B test execution strategies, not skill content

---

## 🚀 Migration is Low-Risk

### What's NOT Changing

✅ Existing 21 Evols skills still work
✅ All theme clustering functionality intact
✅ RICE scoring still works
✅ Persona twins still work
✅ Decision workbench still works
✅ All existing API endpoints unchanged
✅ Frontend routing unchanged (just new pages added)
✅ Authentication unchanged
✅ Multi-tenancy unchanged

### Rollback Plan

If something breaks:
1. Database migration is reversible (drop new tables)
2. New service layer can be disabled (use old skill execution)
3. Frontend can revert (hide new pages)
4. Old 21 skills continue working

**Zero data loss** - all existing data untouched.

---

## 🎯 Success Metrics

### Week 1: Infrastructure
- ✅ 83 skills registered in database
- ✅ Skills page shows categories
- ✅ Can start skill session

### Week 2: Knowledge
- ✅ Knowledge page functional
- ✅ Users can create strategy docs
- ✅ Skills reference knowledge in output

### Week 3: Memory
- ✅ Memory saves after skill execution
- ✅ Retrospective page shows insights
- ✅ Skills reference past work

### Month 1: Adoption
- 📊 Average skill sessions per user: +50%
- 📊 Unique skills used per user: +200%
- 📊 Session completion rate: +30%
- 📊 User satisfaction (NPS): +15 points

### Quarter 1: Business Impact
- 💰 Pricing upgrade: Can charge more for 83 skills
- 💰 Retention: Memory creates switching costs
- 💰 Expansion: Users upgrade for full skill library
- 💰 Word of mouth: "Evols has EVERYTHING"

---

## 📝 Next Steps

Ready to integrate? Here's the sequence:

### Phase 1: Setup (No User Impact)
```bash
# 1. Add unified-pm-os to Evols repo
cd evols/
cp -r ../unified-pm-os ./unified-pm-os

# 2. Create database migrations
cd backend
alembic revision -m "add_unified_pm_os_tables"
# ... write SQL from EVOLS-INTEGRATION.md

# 3. Run migration
alembic upgrade head

# 4. Register 83 skills
python scripts/register_unified_pm_os_skills.py
# Skills now in database but using old execution
```

**Checkpoint:** Evols works exactly as before, but skills table has 83 records.

### Phase 2: Skill Execution (Gradual Rollout)
```python
# 5. Implement SkillAdapter (loads SKILL.md files)
# 6. Update copilot.py to use SkillAdapter
# 7. A/B test: 10% traffic → new execution path
# 8. Monitor: Compare old vs new skill outputs
# 9. Ramp to 100% if successful
```

**Checkpoint:** Skills execute using unified-pm-os framework. Users see better outputs.

### Phase 3: Knowledge & Memory
```python
# 10. Implement KnowledgeManager + MemoryManager
# 11. Add knowledge/memory API endpoints
# 12. Deploy frontend pages
# 13. User onboarding: "Create your product knowledge"
```

**Checkpoint:** Users can create knowledge docs. Memory accumulates.

### Phase 4: Advanced Features
```python
# 14. Implement WorkflowEngine (chained skills)
# 15. Add workflow UI
# 16. Retrospective improvements
# 17. Outcome tracking
```

**Checkpoint:** Full unified PM OS integration complete.

---

## Questions?

**Q: How long will integration take?**
A: 4-6 weeks for full integration. Can start seeing benefits after Week 2 (knowledge layer).

**Q: Do we need to rewrite our 21 existing skills?**
A: No. Keep them. Mark as `source='custom'`. Now you have 104 total skills (21 custom + 83 framework).

**Q: What if unified-pm-os updates?**
A: Re-run registration script. Skills load from files at runtime, so updates propagate automatically.

**Q: Performance concerns?**
A: Minimal. SKILL.md files are 10KB text. Add Redis caching if needed. Load time <50ms.

**Q: Can tenants customize skills?**
A: Yes! Same as now. Fork to `custom_skills` table with tenant-specific overrides.

Ready to start? See [EVOLS-INTEGRATION.md](EVOLS-INTEGRATION.md) for detailed code examples.
