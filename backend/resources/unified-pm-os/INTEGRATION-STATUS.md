# Unified PM OS Integration - Current Status

**Started:** March 18, 2026
**Current Progress:** ~40% Complete

---

## ✅ Completed (Backend Foundation)

### 1. Planning & Documentation
- [x] Internet search tool research → **Tavily AI + Serper fallback**
- [x] Complete implementation plan created
- [x] Architecture comparison documented
- [x] VS Code extension strategy outlined

### 2. Database Layer
- [x] Migration file created: `001_add_unified_pm_os_tables.py`
  - product_knowledge table
  - skill_memory table
  - Enhanced skills table (category, source, file_path columns)
- [x] ProductKnowledge model created
- [x] SkillMemory model created

### 3. Backend Services (unified_pm_os/)
- [x] SkillAdapter service - Load SKILL.md files
- [x] KnowledgeManager service - CRUD for product knowledge
- [x] MemoryManager service - Skill execution history
- [x] Module __init__.py created

**Location:** `evols/backend/app/services/unified_pm_os/`

---

## 🔄 In Progress

### Internet Search Tool
- File location: `evols/backend/app/services/skill_tools.py`
- Status: Design complete, implementation pending
- Approach: Tavily AI (primary) + Serper.dev (fallback)

---

## ⏳ Remaining Work (Backend Integration)

### 1. Core Integration (~2-3 days)

#### copilot_orchestrator.py Modifications
**File:** `evols/backend/app/services/copilot_orchestrator.py`

**Changes needed:**
```python
# 1. Add imports
from app.services.unified_pm_os import SkillAdapter, KnowledgeManager, MemoryManager

# 2. Modify load_skill_config()
# Try loading from SKILL.md file if file_path exists

# 3. Enhance build_system_prompt()
# Inject product knowledge and recent memory

# 4. Modify chat()
# Save skill output to memory after execution
```

**Lines to modify:** ~100 lines

#### Internet Search Tool Implementation
**File:** `evols/backend/app/services/skill_tools.py`

**Add:**
```python
@tool_registry.register(name="search_internet", ...)
async def search_internet(query: str, ...):
    # Try Tavily, fallback to Serper
```

**Lines to add:** ~80 lines

### 2. API Endpoints (~1 day)

#### Knowledge API
**New file:** `evols/backend/app/api/v1/endpoints/knowledge.py`
- GET `/knowledge/products/{product_id}/knowledge`
- PUT `/knowledge/products/{product_id}/knowledge`

#### Memory API
**New file:** `evols/backend/app/api/v1/endpoints/memory.py`
- GET `/memory/products/{product_id}/memory`
- GET `/memory/products/{product_id}/memory/stats`

#### Register Routes
**File:** `evols/backend/app/api/v1/api.py`
```python
from app.api.v1.endpoints import knowledge, memory
api_router.include_router(knowledge.router, ...)
api_router.include_router(memory.router, ...)
```

### 3. Skill Registration (~1 day)

#### Registration Script
**New file:** `evols/backend/scripts/register_unified_pm_os_skills.py`

**Purpose:** Discover all 83 SKILL.md files and register them in database

**Run once:**
```bash
cd evols/backend
python scripts/register_unified_pm_os_skills.py
```

### 4. Configuration (~30 min)

#### Settings
**File:** `evols/backend/app/core/config.py`

**Add:**
```python
class Settings(BaseSettings):
    # Existing settings...

    # NEW: unified-pm-os integration
    UNIFIED_PM_OS_PATH: str = "../unified-pm-os"

    # NEW: Internet search
    TAVILY_API_KEY: Optional[str] = None
    SERPER_API_KEY: Optional[str] = None
```

#### Environment Variables
**File:** `evols/backend/.env`
```bash
UNIFIED_PM_OS_PATH=/Users/akshay/Desktop/workspace/unified-pm-os
TAVILY_API_KEY=tvly-xxx
SERPER_API_KEY=xxx
```

#### Dependencies
**File:** `evols/backend/requirements.txt`
```
tavily-python==0.3.0
pyyaml==6.0.1
```

---

## ⏳ Remaining Work (Frontend)

### 1. Category Filter (~2 hours)

**File:** `evols/frontend/src/pages/advisers.tsx`

**Changes:**
```typescript
// Add state
const [selectedCategory, setSelectedCategory] = useState('all')

// Add category tabs (before grid)
<div className="mb-6 flex flex-wrap gap-2">
  {categories.map(cat => <button ...>)}
</div>

// Filter advisers
const filteredAdvisers = selectedCategory === 'all'
  ? advisers
  : advisers.filter(a => a.category === selectedCategory)
```

**Lines to add:** ~35 lines

### 2. Knowledge Page (~4 hours)

**New file:** `evols/frontend/src/pages/knowledge.tsx`

**Features:**
- 5 tabs (Strategy, Segments, Competitive, Value Prop, Metrics)
- Markdown editor for each
- Save button with API integration
- Auto-save (optional)

**Lines:** ~150 lines

### 3. Navigation Updates (~30 min)

**File:** `evols/frontend/src/components/Header.tsx`

**Add:**
```typescript
{ name: 'Knowledge', href: '/knowledge', current: currentPage === 'knowledge' }
```

**Lines:** ~5 lines

### 4. API Service Updates (~1 hour)

**File:** `evols/frontend/src/services/api.ts`

**Add methods:**
```typescript
// Knowledge
getProductKnowledge(productId)
updateProductKnowledge(productId, docType, content)

// Memory
getProductMemory(productId, category?, limit?)
getMemoryStats(productId)
```

---

## 📊 Progress Summary

### Backend
- ✅ Foundation: 100% (Database + Models + Services)
- 🔄 Integration: 0% (copilot_orchestrator, search tool)
- ⏳ APIs: 0% (knowledge, memory endpoints)
- ⏳ Scripts: 0% (skill registration)
- **Overall Backend: 40% complete**

### Frontend
- ⏳ Category Filter: 0%
- ⏳ Knowledge Page: 0%
- ⏳ Navigation: 0%
- **Overall Frontend: 0% complete**

### **Total Project: ~40% Complete**

---

## 🎯 Next Steps (Priority Order)

### Immediate (Today/Tomorrow)
1. **Implement internet search tool** (1-2 hours)
2. **Modify copilot_orchestrator.py** (3-4 hours)
3. **Create API endpoints** (2-3 hours)
4. **Run database migration** (5 min)

### Day 2-3
5. **Create skill registration script** (2 hours)
6. **Register 83 skills** (Run script - 5 min)
7. **Test backend end-to-end** (2 hours)

### Day 4-5
8. **Add category filter to frontend** (2 hours)
9. **Create knowledge page** (4 hours)
10. **Update navigation** (30 min)
11. **Test frontend end-to-end** (2 hours)

### Day 6-7
12. **Integration testing** (Full day)
13. **Bug fixes** (Full day)
14. **Documentation** (Half day)

---

## 🧪 Testing Checklist

### Backend Tests
- [ ] Database migration runs successfully
- [ ] SkillAdapter loads SKILL.md files
- [ ] KnowledgeManager CRUD operations work
- [ ] MemoryManager saves/retrieves skill history
- [ ] Internet search tool works (Tavily + Serper fallback)
- [ ] Skills load from files (with file_path)
- [ ] Skills fall back to database (without file_path)
- [ ] System prompts include knowledge context
- [ ] System prompts include memory context
- [ ] Skill outputs saved to memory automatically

### Frontend Tests
- [ ] Category filter shows all categories
- [ ] Filtering works correctly
- [ ] 83+ skills visible
- [ ] Knowledge page loads
- [ ] Knowledge page saves all tabs
- [ ] Navigation includes "Knowledge" link
- [ ] Knowledge page accessible from navigation

### End-to-End Tests
- [ ] Run skill from web UI
- [ ] Skill loads from SKILL.md file
- [ ] Skill references product knowledge in output
- [ ] Skill output saved to memory
- [ ] Next skill can reference previous work
- [ ] Search tool callable from skills
- [ ] Skills work without knowledge (graceful fallback)

---

## 🚀 Deployment Steps

### 1. Environment Setup
```bash
# Backend .env
UNIFIED_PM_OS_PATH=/path/to/unified-pm-os
TAVILY_API_KEY=tvly-xxx
SERPER_API_KEY=xxx
```

### 2. Install Dependencies
```bash
cd evols/backend
pip install tavily-python pyyaml
```

### 3. Run Migration
```bash
cd evols/backend
alembic upgrade head
```

### 4. Register Skills
```bash
python scripts/register_unified_pm_os_skills.py
```

### 5. Restart Backend
```bash
# Backend will load skills from files
uvicorn app.main:app --reload
```

### 6. Deploy Frontend
```bash
cd evols/frontend
npm run build
npm run start
```

### 7. Verify
- Visit `/advisers` → See 83+ skills with categories
- Visit `/knowledge` → Create product knowledge
- Run a skill → Check output references knowledge
- Check database → Verify skill_memory record created

---

## 📝 Files Created So Far

### Backend
```
evols/backend/
├── alembic/versions/
│   └── 001_add_unified_pm_os_tables.py ✅
├── app/
│   ├── models/
│   │   ├── product_knowledge.py ✅
│   │   └── skill_memory.py ✅
│   └── services/
│       └── unified_pm_os/
│           ├── __init__.py ✅
│           ├── skill_adapter.py ✅
│           ├── knowledge_manager.py ✅
│           └── memory_manager.py ✅
```

### Documentation
```
unified-pm-os/
├── IMPLEMENTATION-PLAN.md ✅
├── INTEGRATION-STATUS.md ✅ (this file)
├── VSCODE-EXTENSION-STRATEGY.md ✅
├── ARCHITECTURE-COMPARISON.md ✅
├── EVOLS-CODE-LEVEL-CHANGES.md ✅
├── EVOLS-WHAT-ACTUALLY-CHANGES.md ✅
└── EVOLS-INTEGRATION.md ✅
```

---

## 💡 Key Decisions Made

### 1. Internet Search Tool
- **Decision:** Tavily AI (primary) + Serper (fallback)
- **Reasoning:** AI-optimized, generous free tier, clean API
- **Cost:** 1,000 free searches/month (Tavily) + 2,500 (Serper)

### 2. Storage Format
- **Decision:** Keep skills in database + file_path reference
- **Reasoning:** Backward compatibility, gradual migration
- **Benefit:** Existing skills continue working during rollout

### 3. Memory Granularity
- **Decision:** Save every skill execution
- **Reasoning:** Build rich context graph over time
- **Storage:** ~1KB per execution, manageable at scale

### 4. Knowledge Structure
- **Decision:** 5 separate documents (strategy, segments, competitive, value prop, metrics)
- **Reasoning:** Modular, easier to maintain than single doc
- **UI:** Tab-based editor for each document

---

## 🔥 Known Risks & Mitigation

### Risk 1: Skills Don't Load from Files
**Mitigation:** Fallback to database instructions if file load fails
**Code:** Try-catch in load_skill_config()

### Risk 2: Knowledge Layer Not Used
**Mitigation:** Show onboarding prompt, example templates
**Metric:** Track knowledge completeness %

### Risk 3: Memory Table Grows Large
**Mitigation:** Add retention policy (e.g., keep 6 months)
**Future:** Archive old memories to separate table

### Risk 4: Internet Search Quota Exceeded
**Mitigation:** Fallback to Serper, then error gracefully
**Future:** Add rate limiting per user

---

## 📧 Support & Continuation

To continue implementation:

1. **Complete internet search tool** - I can provide the full implementation
2. **Modify copilot_orchestrator.py** - I can show exact code changes
3. **Create API endpoints** - I can generate the full files
4. **Frontend components** - I can build category filter + knowledge page

**Estimated time to completion:** 3-4 days of focused development

---

**Last Updated:** March 18, 2026
**Next Update:** After copilot_orchestrator.py integration
