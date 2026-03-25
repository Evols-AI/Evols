# What Actually Changes in Evols
## Realistic Integration Plan - Using Existing Pages

You're absolutely right - I was over-proposing! Let me clarify what **already exists** vs what's **truly new**.

---

## ✅ WHAT ALREADY EXISTS IN EVOLS

### 1. Skills/Advisers Page (`advisers.tsx`)
**Location:** `/advisers`
**Current State:**
```typescript
// Shows 21 advisers in a simple grid
- No categories
- Simple list
- Start session button
- History link
```

**What we ENHANCE (not rebuild):**
```typescript
// Add category filter at top
const categories = [
  { id: 'all', name: 'All', count: 83 },
  { id: 'discovery', name: 'Discovery', count: 13 },
  { id: 'strategy', name: 'Strategy', count: 12 },
  // ... etc
]

// Add category tabs
<div className="flex gap-2 mb-6">
  {categories.map(cat => (
    <button onClick={() => setFilter(cat.id)}>
      {cat.name} ({cat.count})
    </button>
  ))}
</div>

// Grid stays the same - just filtered
<div className="grid grid-cols-3 gap-6">
  {filteredAdvisers.map(adviser => (
    <AdviserCard />  // EXISTING COMPONENT
  ))}
</div>
```

**Changes Required:**
- ✏️ Add category filter (10 lines of code)
- ✏️ Filter advisers by category (5 lines)
- ✅ Keep everything else the same

**NOT NEEDED:**
- ❌ Don't rebuild the grid
- ❌ Don't change AdviserCard component
- ❌ Don't change routing

---

### 2. Context Page (`context.tsx`)
**Location:** `/context`
**Current State:**
```typescript
// For uploading customer feedback
Tabs: [Sources, Entities, Insights]
- Upload CSV, docs, etc.
- Extract entities (personas, pain points, etc.)
- View insights
```

**What we DO:** Keep it exactly as-is!

**Clarification:**
- `context.tsx` = Customer feedback uploads (existing)
- `knowledge` page = Product strategy docs (NEW - see below)
- These are DIFFERENT things!

**Changes Required:**
- ✅ NONE! Keep context.tsx as-is

---

### 3. Backend Skill Execution
**Already exists:**
- `copilot.py` - Skill session endpoints
- `copilot_orchestrator.py` - Skill execution
- `skill_tools.py` - Tool registry (20+ tools)

**What we ENHANCE:**
```python
# Current: app/api/v1/endpoints/copilot.py
@router.post("/sessions/{session_id}/chat")
async def chat_with_skill(...):
    # Get skill prompt from database
    skill = get_skill(session.skill_id)

    # Execute with tools
    result = await llm.complete(
        prompt=skill.instructions,
        tools=tool_registry.get_all()
    )

# Enhanced: Same endpoint, add context
@router.post("/sessions/{session_id}/chat")
async def chat_with_skill(...):
    # Get skill prompt (now from SKILL.md file)
    skill = skill_adapter.load_skill(session.skill_id)

    # NEW: Build enhanced context
    context = {
        'knowledge': await get_product_knowledge(product_id),  # NEW
        'memory': await get_recent_memory(product_id),         # NEW
        'themes': await get_themes(tenant_id),                 # Existing
        'personas': await get_personas(tenant_id)              # Existing
    }

    # Execute with tools (same)
    result = await llm.complete(
        prompt=build_prompt(skill, context),  # Enhanced
        tools=tool_registry.get_all()         # Same
    )

    # NEW: Save to memory
    await save_to_memory(result)
```

**Changes Required:**
- ✏️ Add `build_enhanced_context()` function
- ✏️ Add `save_to_memory()` call
- ✅ Keep all existing tool registry
- ✅ Keep all existing endpoints

---

## 🆕 WHAT'S TRULY NEW

### 1. Knowledge Page (NEW)
**Location:** `/knowledge` (new route)
**Purpose:** Product strategy docs (different from context uploads)

```typescript
// NEW FILE: pages/knowledge.tsx
export default function KnowledgePage() {
  // Tabs: [Strategy, Segments, Competitive, Metrics, Value Prop]
  // Each tab shows markdown editor
  // Save button updates product_knowledge table
}
```

**Why it's different from context.tsx:**
- Context = Customer feedback uploads (CSV, docs, meetings)
- Knowledge = Product strategy (your team's strategy docs)

**Example:**
```
Context page:
- Upload: "Q4 customer feedback.csv"
- Upload: "Sales call with Acme Corp.pdf"
- Extract: personas, pain points, feature requests

Knowledge page:
- Edit: "Our Q2 Strategy"
- Edit: "Customer Segments we target"
- Edit: "How we differentiate vs Looker"
```

---

### 2. Memory/Insights Page (NEW)
**Location:** `/memory` or `/insights` (new route)
**Purpose:** Retrospective analysis of skill usage

```typescript
// NEW FILE: pages/memory.tsx
export default function MemoryPage() {
  // Show stats from skill_memory table
  // Timeline of skill executions
  // Recommendations based on patterns
}
```

**Why it's new:**
- No equivalent exists
- Reads from new `skill_memory` table
- Shows patterns across skill usage

---

### 3. Database Tables (NEW)
```sql
-- NEW TABLE: Product knowledge
CREATE TABLE product_knowledge (
    id SERIAL PRIMARY KEY,
    product_id INT,
    strategy_doc JSONB,
    customer_segments_doc JSONB,
    -- ...
);

-- NEW TABLE: Skill memory
CREATE TABLE skill_memory (
    id SERIAL PRIMARY KEY,
    product_id INT,
    skill_name VARCHAR(255),
    input_data JSONB,
    output_data JSONB,
    -- ...
);
```

---

### 4. Backend Services (NEW)
```
app/services/unified_pm_os/
├── skill_adapter.py       # NEW - loads SKILL.md files
├── knowledge_manager.py   # NEW - CRUD for strategy docs
├── memory_manager.py      # NEW - skill memory
└── workflow_engine.py     # NEW - skill chaining
```

---

## 📊 Summary: What Changes vs What's New

| Component | Status | Changes Required |
|-----------|--------|------------------|
| **advisers.tsx** | ✏️ ENHANCE | Add category filter (15 lines) |
| **context.tsx** | ✅ KEEP | No changes |
| **copilot.py** | ✏️ ENHANCE | Add context building, save memory (50 lines) |
| **skill_tools.py** | ✅ KEEP | No changes |
| **Header nav** | ✏️ ENHANCE | Add "Knowledge" and "Memory" links (5 lines) |
| **knowledge.tsx** | 🆕 NEW | Create new page (~200 lines) |
| **memory.tsx** | 🆕 NEW | Create new page (~150 lines) |
| **Database** | 🆕 NEW | 2 new tables |
| **Backend services** | 🆕 NEW | 4 new service files |
| **Skills table** | ✏️ ENHANCE | Add 3 columns (category, source, file_path) |

**Total Changes:**
- ✏️ Enhance: 4 existing files (~100 lines total)
- 🆕 New: 2 pages + 4 services (~600 lines total)
- ✅ Keep unchanged: 90% of existing code

---

## 🔄 End-to-End Skill Example

Let me walk through how the "Identify Assumptions" skill works, showing what **already exists** vs **what changes**.

### BEFORE Integration (Current Evols)

**Step 1: User goes to /advisers**
```typescript
// advisers.tsx (EXISTING)
// Shows: [Insights Miner, PRD Writer, Decision Logger, ...]
```

**Step 2: User clicks "Start Session" on any skill**
```typescript
// POST /advisers/sessions (EXISTING)
// Creates conversation in database
// Redirects to /advisers/session/{id}
```

**Step 3: Skill asks initial questions**
```typescript
// Session page shows initial_questions (EXISTING)
// User answers questions
```

**Step 4: Skill executes**
```python
# copilot.py (EXISTING)
skill = get_skill_from_db(skill_id)

result = await llm.complete(
    system_prompt=skill.instructions,  # From database
    user_message=user_input,
    tools=[get_themes, get_personas, get_feedback]  # Existing tools
)
```

**Step 5: Response shown to user**
```typescript
// Session page displays result (EXISTING)
```

**Limitations:**
- ❌ Skill doesn't know product strategy
- ❌ No memory of past work
- ❌ Generic output

---

### AFTER Integration (With Unified PM OS)

**Step 1: User goes to /advisers** (SAME)
```typescript
// advisers.tsx (ENHANCED with category filter)
// Shows categories: Discovery, Strategy, Execution...
// User clicks "Discovery" → sees 13 skills
// Finds "Identify Assumptions" (new skill from unified-pm-os)
```

**Step 2: User clicks "Start Session"** (SAME)
```typescript
// POST /advisers/sessions (SAME)
// Creates conversation
// Redirects to /advisers/session/{id}
```

**Step 3: Skill asks initial questions** (SAME)
```typescript
// Session page shows initial_questions (SAME)
```

**Step 4: Skill executes** (ENHANCED)
```python
# copilot.py (ENHANCED)
# NEW: Load skill from file instead of database
skill = skill_adapter.load_skill(skill_id)
# Returns skill from unified-pm-os/skills/01-discovery/identify-assumptions/SKILL.md

# NEW: Build enhanced context
context = await build_enhanced_context(product_id, tenant_id)
# Returns:
{
    'knowledge': {
        'strategy': 'Our strategic pillars: 1. Self-serve analytics...',
        'customer_segments': 'Mid-market SaaS companies...',
        # From product_knowledge table
    },
    'memory': [
        {
            'skill_name': 'brainstorm-ideas',
            'summary': 'Generated 12 feature ideas for dashboard...',
            'created_at': '2026-03-10'
        }
        # From skill_memory table
    ],
    'themes': [...],      # EXISTING - from get_themes()
    'personas': [...],    # EXISTING - from get_personas()
    'feedback': [...]     # EXISTING - from get_feedback()
}

# Build enhanced prompt
system_prompt = f"""
{skill.instructions}

## Product Knowledge
Strategy: {context['knowledge']['strategy']}
Customer Segments: {context['knowledge']['customer_segments']}

## Past Work (Memory)
- You previously ran brainstorm-ideas on 2026-03-10
- Generated 12 feature ideas for dashboard feature

## Customer Feedback
You have access to {len(context['themes'])} themes and {len(context['feedback'])} feedback items.
"""

# Execute (SAME LLM call)
result = await llm.complete(
    system_prompt=system_prompt,
    user_message=user_input,
    tools=[get_themes, get_personas, get_feedback, ...]  # SAME tools
)

# NEW: Save to memory
await memory_manager.save_skill_output(
    product_id=product_id,
    skill_name='identify-assumptions',
    skill_category='discovery',
    input_data={'message': user_input},
    output_data=result
)
```

**Step 5: Response shown to user** (ENHANCED)
```typescript
// Session page displays result (SAME UI)
// But result is now personalized with:
// - References to product strategy
// - Links to customer feedback themes
// - Connections to past work

// NEW: Small indicator
<div className="text-sm text-gray-500 mt-2">
  💾 Saved to memory for future reference
</div>
```

**Benefits:**
- ✅ Skill knows product strategy
- ✅ References past work
- ✅ Evidence-backed output
- ✅ Memory for future sessions

---

## 💡 Concrete Example Output

### Input:
```
User: "Help me identify assumptions for our export feature"
```

### BEFORE (Current Evols):
```
Here are common assumption categories:

1. Desirability
   - Do users want this feature?
   - Will they use it regularly?

2. Feasibility
   - Can we build it with current tech?
   - What's the effort required?

3. Viability
   - Will this drive revenue?
   - What's the business case?

Please tell me more about your export feature...
```

### AFTER (With Unified PM OS):
```
Based on your product strategy (Self-serve analytics pillar) and customer
feedback analysis, here are the riskiest assumptions for your export feature:

## High-Risk Assumptions

### 1. Users want CSV exports only
**Category:** Value (Desirability)
**Risk Level:** HIGH
**Why this is risky for YOUR product:**
Your "Self-serve analytics" pillar means users expect no-code solutions.
CSV-only might force them to write scripts, contradicting your strategy.

**Evidence from your customer feedback:**
- Theme: "Need for flexible data export formats" (127 feedback items)
- From: 43 accounts representing $2.1M ARR
- Top requests: JSON (38%), Excel (24%), API (21%), CSV (17%)

**Connection to past work:**
You identified similar format assumptions for the dashboard feature
(March 10). Those validated successfully - 89% of beta users wanted
multiple formats, not just one.

**Recommended Experiment:**
1. Build format picker prototype (CSV, JSON, Excel)
2. Test with 5 beta customers from "Mid-market SaaS" segment
3. Success metric: >70% choose non-CSV format
4. Timeline: 1 week

### 2. Enterprise users want scheduled exports
**Category:** Usability
**Risk Level:** MEDIUM
...

## Next Steps
Based on your past workflow (you usually run brainstorm-experiments
after identify-assumptions), I can help you design experiments to test
these assumptions. Would you like me to do that?
```

**Difference:**
- ❌ Before: Generic framework
- ✅ After: Product-specific, evidence-backed, connected to strategy

---

## 🎯 What You REALLY Need to Build

### Week 1: Backend Foundation
```bash
# 1. Add 2 database tables
alembic revision -m "add_product_knowledge_and_skill_memory"
# SQL: CREATE TABLE product_knowledge...
# SQL: CREATE TABLE skill_memory...

# 2. Create 2 service files
# app/services/unified_pm_os/knowledge_manager.py (100 lines)
# app/services/unified_pm_os/memory_manager.py (80 lines)

# 3. Enhance 1 endpoint
# app/api/v1/endpoints/copilot.py
# Add: context = await build_enhanced_context(...)
# Add: await save_to_memory(...)
# (50 lines of changes)
```

### Week 2: Frontend Pages
```bash
# 1. Enhance advisers page
# pages/advisers.tsx
# Add: Category filter component (15 lines)

# 2. Create knowledge page
# pages/knowledge.tsx (200 lines - NEW)

# 3. Create memory page
# pages/memory.tsx (150 lines - NEW)

# 4. Update nav
# components/Header.tsx
# Add: Knowledge and Memory links (5 lines)
```

### Week 3: Skill Registration
```bash
# 1. Register 83 skills
# python scripts/register_unified_pm_os_skills.py

# 2. Test one skill end-to-end
# Start session with "identify-assumptions"
# Verify it loads from SKILL.md file
# Verify it uses enhanced context
# Verify it saves to memory
```

**Total:** ~700 lines of new code + ~100 lines of changes to existing code

---

## ❓ Your Questions Answered

**Q: Why new skills page? Don't we already have one?**
A: You're right! We DON'T need a new one. We ENHANCE `advisers.tsx` with a category filter (15 lines). Everything else stays the same.

**Q: Memory page vs Context page - aren't they similar?**
A: No, different purposes:
- **Context page** (existing) = Upload customer feedback (CSV, docs, meetings)
- **Memory page** (new) = Retrospective on YOUR skill usage patterns

**Q: Can we reuse existing components?**
A: YES!
- ✅ Reuse: AdviserCard, PageContainer, Header, Loading, etc.
- ✅ Reuse: All existing API service functions
- ✅ Reuse: Tool registry, LLM service, skill execution flow
- 🆕 New: Only knowledge + memory pages (~350 lines total)

**Q: Is this building from scratch?**
A: NO!
- 90% of Evols stays unchanged
- We ENHANCE 4 files
- We ADD 2 pages + 4 services
- We REUSE all existing components

---

## 🚀 Minimal Viable Integration

Want to start even smaller? Here's the MVP:

### Phase 1: Just Skills (No Knowledge/Memory)
```bash
# Week 1
1. Register 83 skills in database (script)
2. Load skills from SKILL.md files (skill_adapter.py)
3. Enhance advisers.tsx with category filter

Result: Users can use 83 framework-based skills (up from 21)
Skipped: Knowledge layer, memory system
```

**Test:**
- Go to /advisers
- See categories
- Start "Identify Assumptions" skill
- Get better output (uses framework from SKILL.md)

### Phase 2: Add Knowledge (Later)
```bash
# Week 2-3
1. Create product_knowledge table
2. Create knowledge.tsx page
3. Enhance copilot.py to read knowledge

Result: Skills reference product strategy
```

### Phase 3: Add Memory (Later)
```bash
# Week 4-5
1. Create skill_memory table
2. Create memory.tsx page
3. Save skill outputs to memory

Result: Retrospective insights
```

**Each phase is independently valuable!**

---

## 📝 Next Steps

Ready to start? I recommend:

### Option 1: MVP (Week 1)
```bash
# Just add 62 more skills, no other changes
cd evols/backend
python scripts/register_unified_pm_os_skills.py

# Enhance advisers page with categories
# (15 lines in advisers.tsx)

# Test: Use new skills
```

### Option 2: Full Integration (4 weeks)
Follow the 4-phase plan in EVOLS-INTEGRATION.md

### Option 3: Proof of Concept (1 day)
```bash
# Test one skill manually:
# 1. Copy one SKILL.md file
# 2. Load it in copilot.py
# 3. Execute
# 4. See if output is better
```

Which would you like to try first?
