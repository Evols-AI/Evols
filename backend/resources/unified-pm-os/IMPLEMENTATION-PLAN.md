# Unified PM OS Integration - Implementation Plan

## Overview

Integrate unified-pm-os framework skills, knowledge layer, and memory system into Evols backend, plus add internet search tool.

**Timeline:** 4 weeks
**Scope:** Backend integration + minimal frontend changes

---

## Internet Search Tool Decision

### Selected: Tavily AI (Primary) + Serper (Fallback)

**Why:**
- ✅ Tavily: 1,000 free searches/month, AI-optimized, returns sources + synthesized answer
- ✅ Serper: 2,500 free searches/month as fallback
- ✅ Both have clean APIs, cheap scaling

**Implementation:**
```python
# Add to skill_tools.py
@tool_registry.register(
    name="search_internet",
    description="Search the internet for current information"
)
async def search_internet(query: str, ...):
    # Try Tavily first
    # Fall back to Serper if quota exceeded
    # Return sources + answer
```

---

## Phase 1: Database Schema (Week 1, Day 1-2)

### New Tables

**1. product_knowledge** - Store product strategy docs
```sql
CREATE TABLE product_knowledge (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,

    -- Knowledge documents (markdown)
    strategy_doc TEXT,
    customer_segments_doc TEXT,
    competitive_landscape_doc TEXT,
    value_proposition_doc TEXT,
    metrics_and_targets_doc TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**2. skill_memory** - Store skill execution history
```sql
CREATE TABLE skill_memory (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,

    skill_name VARCHAR(255) NOT NULL,
    skill_category VARCHAR(50),

    input_data JSONB NOT NULL,
    output_data JSONB NOT NULL,
    summary TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_skill_memory_product ON skill_memory(product_id);
CREATE INDEX idx_skill_memory_category ON skill_memory(skill_category);
```

**3. Enhance skills table** - Add unified-pm-os support
```sql
ALTER TABLE skills
ADD COLUMN category VARCHAR(50),
ADD COLUMN source VARCHAR(20) DEFAULT 'database',
ADD COLUMN file_path VARCHAR(500);

-- Backfill
UPDATE skills SET source = 'database', category = 'unknown';
```

### Migration Files

**File:** `backend/alembic/versions/001_add_unified_pm_os_tables.py`

---

## Phase 2: Backend Services (Week 1, Day 3-5)

### Service 1: SkillAdapter

**Purpose:** Load skills from unified-pm-os SKILL.md files

**File:** `backend/app/services/unified_pm_os/skill_adapter.py`

```python
class SkillAdapter:
    def __init__(self, unified_pm_os_path: str):
        self.base_path = Path(unified_pm_os_path) / "skills"

    def load_skill_from_file(self, file_path: str) -> Dict[str, Any]:
        """
        Load SKILL.md and parse into skill config

        Args:
            file_path: "01-discovery/identify-assumptions/SKILL.md"

        Returns:
            {
                'name': 'identify-assumptions',
                'description': '...',
                'category': 'discovery',
                'tools': ['get_themes', 'get_personas'],
                'instructions': '# Instructions...'
            }
        """
```

**Size:** ~100 lines

---

### Service 2: KnowledgeManager

**Purpose:** CRUD operations for product knowledge docs

**File:** `backend/app/services/unified_pm_os/knowledge_manager.py`

```python
class KnowledgeManager:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_product_knowledge(self, product_id: int) -> Optional[Dict]:
        """Get all knowledge docs for a product"""

    async def update_knowledge_doc(
        self,
        product_id: int,
        doc_type: str,  # 'strategy', 'customer_segments', etc.
        content: str
    ) -> ProductKnowledge:
        """Update specific knowledge document"""
```

**Size:** ~100 lines

---

### Service 3: MemoryManager

**Purpose:** Save and retrieve skill execution history

**File:** `backend/app/services/unified_pm_os/memory_manager.py`

```python
class MemoryManager:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def save_skill_output(
        self,
        product_id: int,
        skill_name: str,
        skill_category: str,
        input_data: Dict,
        output_data: Dict,
        summary: str
    ) -> SkillMemory:
        """Save skill execution to memory"""

    async def get_recent_skill_outputs(
        self,
        product_id: int,
        limit: int = 10,
        category: Optional[str] = None
    ) -> List[Dict]:
        """Get recent skill executions"""
```

**Size:** ~120 lines

---

## Phase 3: Core Integration (Week 2)

### Modify: copilot_orchestrator.py

**Changes to make:**

**1. Load skills from files (if available)**
```python
async def load_skill_config(self, skill_id: int, skill_type: str):
    # Load skill from database
    skill = await self.db.execute(
        select(Skill).where(Skill.id == skill_id)
    )

    # NEW: If skill has file_path, load from file
    if skill.file_path:
        adapter = SkillAdapter(settings.UNIFIED_PM_OS_PATH)
        skill_from_file = adapter.load_skill_from_file(skill.file_path)
        return {
            'id': skill.id,
            'name': skill_from_file['name'],
            'instructions': skill_from_file['instructions'],
            'tools': skill_from_file['tools'],
            'category': skill_from_file['category']
        }

    # Fallback to database
    return {...}
```

**2. Build enhanced system prompt with context**
```python
async def build_system_prompt(
    self,
    skill_config: Optional[Dict],
    product_id: Optional[int] = None
) -> str:
    enhanced_context = ""

    if product_id:
        # Get product knowledge
        km = KnowledgeManager(self.db)
        knowledge = await km.get_product_knowledge(product_id)

        if knowledge:
            enhanced_context += "\n## Product Knowledge\n"
            if knowledge.get('strategy_doc'):
                enhanced_context += f"**Strategy:**\n{knowledge['strategy_doc']}\n\n"
            if knowledge.get('customer_segments_doc'):
                enhanced_context += f"**Customer Segments:**\n{knowledge['customer_segments_doc']}\n\n"

        # Get recent memory
        mm = MemoryManager(self.db)
        recent_work = await mm.get_recent_skill_outputs(product_id, limit=5)

        if recent_work:
            enhanced_context += "\n## Past Work (Memory)\n"
            for work in recent_work:
                enhanced_context += f"- {work['skill_name']} ({work['created_at']}): {work['summary']}\n"

    # Build final prompt
    if skill_config:
        return f"""{skill_config['instructions']}

{enhanced_context}

Remember to reference the product knowledge and past work when relevant.
"""
```

**3. Save skill output to memory**
```python
async def chat(self, conversation_id, message, product_id):
    # ... existing code ...

    # Execute skill
    assistant_content = await handle_function_calling(...)

    # NEW: Save to memory
    if skill_config and product_id:
        mm = MemoryManager(self.db)
        await mm.save_skill_output(
            product_id=product_id,
            skill_name=skill_config['name'],
            skill_category=skill_config.get('category', 'unknown'),
            input_data={'message': message},
            output_data={'content': assistant_content},
            summary=assistant_content[:200]  # First 200 chars
        )

    return response
```

**Lines changed:** ~100 lines added/modified

---

## Phase 4: Internet Search Tool (Week 2)

### Add to skill_tools.py

```python
import os
from tavily import TavilyClient
import httpx

# Initialize clients
tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
serper_api_key = os.getenv("SERPER_API_KEY")

@tool_registry.register(
    name="search_internet",
    description="Search the internet for current information, news, research, or facts. Use this when user asks about recent events, current data, or information not in your training data.",
    parameters=[
        ToolParameter(
            name="query",
            type="string",
            description="Search query (e.g., 'latest trends in product management 2026')"
        ),
        ToolParameter(
            name="max_results",
            type="integer",
            description="Maximum number of results to return (default: 5)",
            required=False
        )
    ]
)
async def search_internet(
    query: str,
    tenant_id: int,
    db: AsyncSession,
    max_results: int = 5
) -> Dict[str, Any]:
    """
    Search the internet using Tavily AI (primary) or Serper (fallback)
    """
    try:
        # Try Tavily first
        response = tavily_client.search(
            query=query,
            max_results=max_results,
            include_answer=True,
            include_raw_content=False
        )

        return {
            "query": query,
            "answer": response.get("answer", ""),
            "results": [
                {
                    "title": r["title"],
                    "url": r["url"],
                    "content": r["content"][:500],  # Truncate
                    "score": r.get("score", 0)
                }
                for r in response.get("results", [])[:max_results]
            ],
            "source": "tavily"
        }

    except Exception as tavily_error:
        # Fallback to Serper
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://google.serper.dev/search",
                    headers={
                        "X-API-KEY": serper_api_key,
                        "Content-Type": "application/json"
                    },
                    json={"q": query, "num": max_results}
                )
                data = response.json()

                return {
                    "query": query,
                    "answer": data.get("answerBox", {}).get("answer", ""),
                    "results": [
                        {
                            "title": r["title"],
                            "url": r["link"],
                            "content": r["snippet"],
                            "score": 0
                        }
                        for r in data.get("organic", [])[:max_results]
                    ],
                    "source": "serper"
                }

        except Exception as serper_error:
            return {
                "error": f"Search failed. Tavily: {tavily_error}. Serper: {serper_error}",
                "query": query,
                "results": []
            }
```

**Dependencies:**
```bash
pip install tavily-python httpx
```

**Environment variables:**
```bash
TAVILY_API_KEY=tvly-xxx
SERPER_API_KEY=xxx
```

---

## Phase 5: Register Skills (Week 3, Day 1-2)

### Create registration script

**File:** `backend/scripts/register_unified_pm_os_skills.py`

```python
"""
Register all 83 skills from unified-pm-os into Evols database
"""
import asyncio
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import async_session_maker
from app.models.skill import Skill
from app.services.unified_pm_os.skill_adapter import SkillAdapter

async def register_all_skills():
    """Register all SKILL.md files from unified-pm-os"""

    unified_pm_os_path = Path(__file__).parent.parent.parent / "unified-pm-os"
    adapter = SkillAdapter(str(unified_pm_os_path))

    # Discover all SKILL.md files
    skills_base = unified_pm_os_path / "skills"
    skill_files = list(skills_base.rglob("SKILL.md"))

    print(f"Found {len(skill_files)} skills")

    async with async_session_maker() as db:
        for skill_file in skill_files:
            # Get relative path from skills/ folder
            rel_path = skill_file.relative_to(skills_base)

            try:
                # Load skill from file
                skill_data = adapter.load_skill_from_file(str(rel_path))

                # Check if already exists
                from sqlalchemy import select
                result = await db.execute(
                    select(Skill).where(Skill.name == skill_data['name'])
                )
                existing = result.scalars().first()

                if existing:
                    # Update file_path and category
                    existing.file_path = str(rel_path)
                    existing.category = skill_data['category']
                    existing.source = 'unified-pm-os'
                    print(f"Updated: {skill_data['name']}")
                else:
                    # Create new skill entry
                    new_skill = Skill(
                        name=skill_data['name'],
                        description=skill_data['description'],
                        icon='⚡',  # Default icon
                        tools=skill_data.get('tools', []),
                        initial_questions=[],
                        task_definitions=[],
                        instructions=skill_data['instructions'],
                        output_template=None,
                        category=skill_data['category'],
                        source='unified-pm-os',
                        file_path=str(rel_path),
                        is_active=True
                    )
                    db.add(new_skill)
                    print(f"Created: {skill_data['name']}")

                await db.commit()

            except Exception as e:
                print(f"Error with {rel_path}: {e}")
                continue

    print("Registration complete!")

if __name__ == "__main__":
    asyncio.run(register_all_skills())
```

**Run:**
```bash
cd backend
python scripts/register_unified_pm_os_skills.py
```

---

## Phase 6: API Endpoints (Week 3, Day 3-4)

### Knowledge API

**File:** `backend/app/api/v1/endpoints/knowledge.py` (NEW)

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.unified_pm_os.knowledge_manager import KnowledgeManager

router = APIRouter()

class KnowledgeUpdateRequest(BaseModel):
    doc_type: str  # 'strategy', 'customer_segments', etc.
    content: str

@router.get("/products/{product_id}/knowledge")
async def get_product_knowledge(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all knowledge docs for a product"""
    km = KnowledgeManager(db)
    knowledge = await km.get_product_knowledge(product_id)

    if not knowledge:
        return {
            "strategy_doc": "",
            "customer_segments_doc": "",
            "competitive_landscape_doc": "",
            "value_proposition_doc": "",
            "metrics_and_targets_doc": ""
        }

    return knowledge

@router.put("/products/{product_id}/knowledge")
async def update_knowledge_doc(
    product_id: int,
    request: KnowledgeUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a specific knowledge document"""
    km = KnowledgeManager(db)

    result = await km.update_knowledge_doc(
        product_id=product_id,
        doc_type=request.doc_type,
        content=request.content
    )

    return {"status": "updated"}
```

### Memory API

**File:** `backend/app/api/v1/endpoints/memory.py` (NEW)

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.unified_pm_os.memory_manager import MemoryManager

router = APIRouter()

@router.get("/products/{product_id}/memory")
async def get_skill_memory(
    product_id: int,
    category: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get skill execution history for a product"""
    mm = MemoryManager(db)

    memory = await mm.get_recent_skill_outputs(
        product_id=product_id,
        limit=limit,
        category=category
    )

    return {"memory": memory}

@router.get("/products/{product_id}/memory/stats")
async def get_memory_stats(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get statistics about skill usage"""
    mm = MemoryManager(db)
    stats = await mm.get_memory_stats(product_id)
    return stats
```

**Register routes in main app:**

`backend/app/api/v1/api.py`:
```python
from app.api.v1.endpoints import knowledge, memory

api_router.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])
api_router.include_router(memory.router, prefix="/memory", tags=["memory"])
```

---

## Phase 7: Frontend Changes (Week 3, Day 5 - Week 4)

### 1. Add Category Filter to advisers.tsx

**File:** `frontend/src/pages/advisers.tsx`

**Changes:**
```typescript
// Add state for category filtering
const [selectedCategory, setSelectedCategory] = useState<string>('all')

// Add category tabs (insert after line 102, before grid)
{advisers.length > 0 && (
  <div className="mb-6 flex flex-wrap gap-2">
    {[
      { id: 'all', name: 'All Skills' },
      { id: 'discovery', name: 'Discovery' },
      { id: 'strategy', name: 'Strategy' },
      { id: 'execution', name: 'Execution' },
      { id: 'market-research', name: 'Market Research' },
      { id: 'data-analytics', name: 'Data & Analytics' },
      { id: 'go-to-market', name: 'Go-to-Market' },
    ].map((cat) => (
      <button
        key={cat.id}
        onClick={() => setSelectedCategory(cat.id)}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          selectedCategory === cat.id
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
        }`}
      >
        {cat.name}
      </button>
    ))}
  </div>
)}

// Filter advisers
const filteredAdvisers = selectedCategory === 'all'
  ? advisers
  : advisers.filter(a => a.category === selectedCategory)

// Use filteredAdvisers in the grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {filteredAdvisers.map((adviser) => (
    // ... existing card code
  ))}
</div>
```

**Lines added:** ~35 lines

---

### 2. Create Knowledge Page

**File:** `frontend/src/pages/knowledge.tsx` (NEW)

```typescript
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Book, Save, Loader2 } from 'lucide-react'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card } from '@/components/PageContainer'
import { getCurrentUser } from '@/utils/auth'

const KNOWLEDGE_TABS = [
  { id: 'strategy_doc', name: 'Product Strategy', description: 'Vision, mission, and strategic pillars' },
  { id: 'customer_segments_doc', name: 'Customer Segments', description: 'Target personas and segments' },
  { id: 'competitive_landscape_doc', name: 'Competitive Landscape', description: 'Competitors and positioning' },
  { id: 'value_proposition_doc', name: 'Value Proposition', description: 'Unique value and differentiation' },
  { id: 'metrics_and_targets_doc', name: 'Metrics & Targets', description: 'KPIs and success metrics' }
]

export default function KnowledgePage() {
  const router = useRouter()
  const { productId } = router.query
  const [user, setUser] = useState<any>(null)

  const [activeTab, setActiveTab] = useState('strategy_doc')
  const [content, setContent] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const currentUser = getCurrentUser()
    setUser(currentUser)

    if (productId) {
      loadKnowledge()
    }
  }, [productId])

  const loadKnowledge = async () => {
    try {
      const response = await api.get(`/knowledge/products/${productId}/knowledge`)
      setContent(response.data)
    } catch (err) {
      console.error('Failed to load knowledge', err)
    } finally {
      setLoading(false)
    }
  }

  const saveKnowledge = async () => {
    setSaving(true)
    try {
      await api.put(`/knowledge/products/${productId}/knowledge`, {
        doc_type: activeTab,
        content: content[activeTab] || ''
      })
      // Show success message
    } catch (err) {
      alert('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <>
      <Header user={user} currentPage="knowledge" />
      <PageContainer>
        <PageHeader
          title="Product Knowledge"
          description="Document your product strategy and context for AI skills"
          icon={Book}
        />

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {KNOWLEDGE_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Editor */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {KNOWLEDGE_TABS.find(t => t.id === activeTab)?.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {KNOWLEDGE_TABS.find(t => t.id === activeTab)?.description}
            </p>

            <textarea
              value={content[activeTab] || ''}
              onChange={(e) => setContent({ ...content, [activeTab]: e.target.value })}
              className="w-full h-96 p-4 border border-gray-300 dark:border-gray-700 rounded-lg
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={`Enter your ${KNOWLEDGE_TABS.find(t => t.id === activeTab)?.name.toLowerCase()} here (supports Markdown)...`}
            />

            <div className="flex justify-between items-center mt-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                💡 Tip: AI skills will reference this context to provide personalized recommendations
              </p>

              <button
                onClick={saveKnowledge}
                disabled={saving}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400
                           text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </Card>
      </PageContainer>
    </>
  )
}
```

**Lines:** ~150 lines

---

### 3. Update Header Navigation

**File:** `frontend/src/components/Header.tsx`

Add "Knowledge" link to navigation:

```typescript
const navItems = [
  { name: 'Dashboard', href: '/dashboard', current: currentPage === 'dashboard' },
  { name: 'Context', href: '/context', current: currentPage === 'context' },
  { name: 'Advisers', href: '/advisers', current: currentPage === 'advisers' },
  { name: 'Knowledge', href: '/knowledge', current: currentPage === 'knowledge' }, // NEW
  // ... other items
]
```

---

## Testing Checklist

### Backend
- [ ] Database migration runs successfully
- [ ] SkillAdapter loads SKILL.md files correctly
- [ ] Skills registered with correct categories and file_paths
- [ ] Knowledge API endpoints work (GET/PUT)
- [ ] Memory system saves skill outputs
- [ ] Enhanced system prompts include knowledge + memory
- [ ] Internet search tool works (try both Tavily and Serper)

### Frontend
- [ ] Category filter shows all categories
- [ ] Filtering works correctly
- [ ] 83 skills visible in advisers page
- [ ] Knowledge page loads and saves
- [ ] All 5 knowledge tabs work

### Integration
- [ ] Run a skill from unified-pm-os
- [ ] Skill loads from SKILL.md file
- [ ] Skill has access to product knowledge
- [ ] Skill output saved to memory
- [ ] Next skill can reference previous work
- [ ] Internet search tool callable from skills

---

## Environment Setup

### Backend `.env`

```bash
# Existing variables...

# unified-pm-os path
UNIFIED_PM_OS_PATH=/Users/akshay/Desktop/workspace/unified-pm-os

# Internet search
TAVILY_API_KEY=tvly-xxx
SERPER_API_KEY=xxx
```

### Install Dependencies

```bash
cd backend
pip install tavily-python httpx pyyaml
```

---

## Deployment Order

1. **Database Migration**
   ```bash
   cd backend
   alembic upgrade head
   ```

2. **Register Skills**
   ```bash
   python scripts/register_unified_pm_os_skills.py
   ```

3. **Restart Backend**
   ```bash
   # Backend will now load skills from files
   ```

4. **Deploy Frontend**
   ```bash
   cd frontend
   npm run build
   npm run start
   ```

5. **Test End-to-End**
   - Create product knowledge
   - Run a skill
   - Verify enhanced output
   - Check memory saved

---

## Success Metrics

After 1 week of usage:
- [ ] Skills used 3x more than before
- [ ] Users fill out knowledge layer
- [ ] Skill outputs reference product context
- [ ] Users report "less generic, more relevant"
- [ ] Memory system shows patterns over time

---

## Rollback Plan

If integration fails:
1. Keep new tables (don't lose data)
2. Set `source='database'` for all skills
3. Skills fall back to database instructions
4. Remove knowledge/memory features from UI
5. System works as before

---

## Timeline Summary

| Week | Focus | Deliverable |
|------|-------|-------------|
| 1 | Backend foundation | DB tables, services, models |
| 2 | Core integration | Modified orchestrator, search tool |
| 3 | Skills & APIs | Registered skills, knowledge/memory APIs |
| 4 | Frontend & testing | Category filter, knowledge page, E2E testing |

**Total:** 4 weeks to production
