# Code-Level Changes: Existing vs Enhanced

This document shows **ACTUAL CODE** from Evols and the **EXACT CHANGES** needed for unified-pm-os integration.

---

## 1. Frontend: advisers.tsx

### Current Code (Lines 111-146)

```typescript
// EXISTING: Simple grid, no filtering
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {advisers.map((adviser) => (
    <Card key={`${adviser.type}-${adviser.id}`} hover>
      <div className="p-6">
        {/* Icon & Badge */}
        <div className="flex items-start justify-between mb-4">
          <div className="text-4xl">{adviser.icon}</div>
          {adviser.is_custom && (
            <span className="px-2 py-1 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
              Custom
            </span>
          )}
        </div>

        {/* Name & Description */}
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {adviser.name}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 line-clamp-3">
          {adviser.description}
        </p>

        {/* Start Button */}
        <button
          onClick={() => startSession(adviser.id, adviser.type)}
          className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-lg transition-colors font-medium"
        >
          <MessageSquare className="w-4 h-4" />
          Start Session
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </Card>
  ))}
</div>
```

### Enhanced Code (ADD 25 lines before the grid)

```typescript
// NEW: Add state for category filtering
const [selectedCategory, setSelectedCategory] = useState<string>('all')

// NEW: Category tabs component (insert after line 102, before the grid)
{advisers.length > 0 && (
  <div className="mb-6 flex flex-wrap gap-2">
    {[
      { id: 'all', name: 'All', count: advisers.length },
      { id: 'discovery', name: 'Discovery', count: advisers.filter(a => a.category === 'discovery').length },
      { id: 'strategy', name: 'Strategy', count: advisers.filter(a => a.category === 'strategy').length },
      { id: 'execution', name: 'Execution', count: advisers.filter(a => a.category === 'execution').length },
      { id: 'market-research', name: 'Market Research', count: advisers.filter(a => a.category === 'market-research').length },
      { id: 'data-analytics', name: 'Data Analytics', count: advisers.filter(a => a.category === 'data-analytics').length },
      { id: 'go-to-market', name: 'Go-to-Market', count: advisers.filter(a => a.category === 'go-to-market').length }
    ].map((cat) => (
      <button
        key={cat.id}
        onClick={() => setSelectedCategory(cat.id)}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          selectedCategory === cat.id
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
      >
        {cat.name} ({cat.count})
      </button>
    ))}
  </div>
)}

// ENHANCED: Filter the advisers array
const filteredAdvisers = selectedCategory === 'all'
  ? advisers
  : advisers.filter(a => a.category === selectedCategory)

// EXISTING GRID - just change advisers to filteredAdvisers
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {filteredAdvisers.map((adviser) => (
    // ... rest stays exactly the same
  ))}
</div>
```

### Changes Summary
- **Add:** 1 state variable (1 line)
- **Add:** Category tabs component (24 lines)
- **Change:** `advisers.map` → `filteredAdvisers.map` (1 word)
- **Total:** ~26 lines added, 1 word changed
- **Keep unchanged:** Card component, startSession function, all styling, all layout

---

## 2. Backend: copilot_orchestrator.py

### Current Code: load_skill_config() (Lines 254-279)

```python
# EXISTING: Loads skill from database
async def load_skill_config(self, skill_id: int, skill_type: str) -> Dict[str, Any]:
    """Load skill configuration"""
    if skill_type == SkillType.CUSTOM:
        result = await self.db.execute(
            select(CustomSkill).where(CustomSkill.id == skill_id)
        )
        skill = result.scalars().first()
    else:
        result = await self.db.execute(
            select(Skill).where(Skill.id == skill_id)
        )
        skill = result.scalars().first()

    if not skill:
        return None

    return {
        'id': skill.id,
        'type': skill_type,
        'name': skill.name,
        'description': skill.description,
        'icon': skill.icon,
        'instructions': skill.instructions,
        'tools': skill.tools,
        'output_template': skill.output_template
    }
```

### Enhanced Code

```python
# ENHANCED: Try file first, fallback to database
from app.services.unified_pm_os.skill_adapter import SkillAdapter  # NEW IMPORT

async def load_skill_config(self, skill_id: int, skill_type: str) -> Dict[str, Any]:
    """Load skill configuration"""

    # NEW: Try loading from unified-pm-os SKILL.md file first
    if skill_type == SkillType.DEFAULT:
        skill_adapter = SkillAdapter('/path/to/unified-pm-os')

        # Check if this skill has a file_path
        result = await self.db.execute(
            select(Skill).where(Skill.id == skill_id)
        )
        skill_from_db = result.scalars().first()

        if skill_from_db and skill_from_db.file_path:
            # Load from SKILL.md file
            try:
                skill_from_file = skill_adapter.load_skill_from_file(skill_from_db.file_path)
                return {
                    'id': skill_from_db.id,
                    'type': skill_type,
                    'name': skill_from_file['name'],
                    'description': skill_from_file['description'],
                    'icon': skill_from_db.icon,  # Keep icon from DB
                    'instructions': skill_from_file['instructions'],
                    'tools': skill_from_file['tools'],
                    'output_template': skill_from_file.get('output_template')
                }
            except Exception as e:
                logger.warning(f"Failed to load skill from file, falling back to DB: {e}")
                # Fall through to original database loading

    # EXISTING: Original database loading (unchanged)
    if skill_type == SkillType.CUSTOM:
        result = await self.db.execute(
            select(CustomSkill).where(CustomSkill.id == skill_id)
        )
        skill = result.scalars().first()
    else:
        result = await self.db.execute(
            select(Skill).where(Skill.id == skill_id)
        )
        skill = result.scalars().first()

    if not skill:
        return None

    return {
        'id': skill.id,
        'type': skill_type,
        'name': skill.name,
        'description': skill.description,
        'icon': skill.icon,
        'instructions': skill.instructions,
        'tools': skill.tools,
        'output_template': skill.output_template
    }
```

### Current Code: build_system_prompt() (Lines 290-349)

```python
# EXISTING: Basic system prompt
def build_system_prompt(self, skill_config: Optional[Dict[str, Any]] = None) -> str:
    """Build system prompt for Claude"""
    if skill_config:
        return f"""You are {skill_config['name']}, an expert AI assistant for product managers.

{skill_config['instructions']}

Remember:
- Be conversational and helpful
- Ask clarifying questions when needed
- Use the available tools to access data
- Provide structured, actionable recommendations
- Cite specific data from the tools
"""
    else:
        return """You are EvolsAI, an expert AI copilot for product managers.

[... rest of generic prompt ...]
"""
```

### Enhanced Code

```python
# ENHANCED: Add product knowledge and memory context
from app.services.unified_pm_os.knowledge_manager import KnowledgeManager  # NEW IMPORT
from app.services.unified_pm_os.memory_manager import MemoryManager        # NEW IMPORT

async def build_system_prompt(
    self,
    skill_config: Optional[Dict[str, Any]] = None,
    product_id: Optional[int] = None  # NEW PARAMETER
) -> str:
    """Build system prompt for Claude with enhanced context"""

    # NEW: Build enhanced context
    enhanced_context = ""
    if product_id:
        # Get product knowledge
        km = KnowledgeManager(self.db)
        knowledge = await km.get_product_knowledge(product_id)

        if knowledge:
            enhanced_context += "\n## Product Knowledge\n"
            if knowledge.get('strategy_doc'):
                enhanced_context += f"\n**Strategy:** {knowledge['strategy_doc']}\n"
            if knowledge.get('customer_segments_doc'):
                enhanced_context += f"\n**Customer Segments:** {knowledge['customer_segments_doc']}\n"
            if knowledge.get('competitive_landscape_doc'):
                enhanced_context += f"\n**Competitive Landscape:** {knowledge['competitive_landscape_doc']}\n"

        # Get recent memory
        mm = MemoryManager(self.db)
        recent_work = await mm.get_recent_skill_outputs(product_id, limit=5)

        if recent_work:
            enhanced_context += "\n## Past Work (Memory)\n"
            for work in recent_work:
                enhanced_context += f"- {work['skill_name']} on {work['created_at'].strftime('%Y-%m-%d')}: {work['summary']}\n"

    # EXISTING: Original prompt building
    if skill_config:
        base_prompt = f"""You are {skill_config['name']}, an expert AI assistant for product managers.

{skill_config['instructions']}
{enhanced_context}

Remember:
- Be conversational and helpful
- Ask clarifying questions when needed
- Use the available tools to access data
- Provide structured, actionable recommendations
- Cite specific data from the tools
"""
        return base_prompt
    else:
        return f"""You are EvolsAI, an expert AI copilot for product managers.
{enhanced_context}

[... rest of generic prompt ...]
"""
```

### Current Code: chat() - Response Generation (Lines 454-486)

```python
# EXISTING: Generate response, no memory saving
# Build prompt
system_prompt = self.build_system_prompt(actual_skill_config)
conversation_history = self.format_conversation_history(history)

# Get LLM service
llm_service = await self.get_llm_service()

# ... tool execution ...

assistant_content, tool_calls = await handle_function_calling(
    user_message=message,
    conversation_history=conversation_history,
    system_prompt=system_prompt,
    skill_config=tools_config,
    llm_service=llm_service,
    tenant_id=self.user.tenant_id,
    db=self.db,
    product_id=product_id
)
```

### Enhanced Code

```python
# ENHANCED: Add product_id to prompt building and save to memory
from app.services.unified_pm_os.memory_manager import MemoryManager  # NEW IMPORT

# Build prompt WITH enhanced context
system_prompt = await self.build_system_prompt(
    actual_skill_config,
    product_id=product_id  # NEW: Pass product_id
)
conversation_history = self.format_conversation_history(history)

# Get LLM service (unchanged)
llm_service = await self.get_llm_service()

# ... tool execution (unchanged) ...

assistant_content, tool_calls = await handle_function_calling(
    user_message=message,
    conversation_history=conversation_history,
    system_prompt=system_prompt,
    skill_config=tools_config,
    llm_service=llm_service,
    tenant_id=self.user.tenant_id,
    db=self.db,
    product_id=product_id
)

# NEW: Save to memory if skill was used
if actual_skill_config and product_id:
    mm = MemoryManager(self.db)
    await mm.save_skill_output(
        product_id=product_id,
        skill_name=actual_skill_config['name'],
        skill_category=actual_skill_config.get('category', 'unknown'),
        input_data={'message': message},
        output_data={'content': assistant_content},
        summary=assistant_content[:200]  # First 200 chars as summary
    )
```

### Changes Summary
- **Modify:** `load_skill_config()` - add file loading fallback (20 lines)
- **Modify:** `build_system_prompt()` - add knowledge/memory context (30 lines)
- **Modify:** `chat()` - add memory saving call (10 lines)
- **Add:** 3 new imports (3 lines)
- **Total:** ~63 lines of changes
- **Keep unchanged:** All existing functionality, tool registry, LLM calls, conversation management

---

## 3. New Backend Services

### NEW FILE: app/services/unified_pm_os/skill_adapter.py

```python
"""
Skill Adapter - Loads skills from SKILL.md files
"""
import os
from pathlib import Path
from typing import Dict, Any, Optional
import yaml


class SkillAdapter:
    """Loads skills from unified-pm-os SKILL.md files"""

    def __init__(self, unified_pm_os_path: str):
        self.base_path = Path(unified_pm_os_path) / "skills"

    def load_skill_from_file(self, file_path: str) -> Dict[str, Any]:
        """
        Load a SKILL.md file and parse it into skill config

        Args:
            file_path: Relative path from unified-pm-os/skills/
                      e.g., "01-discovery/identify-assumptions/SKILL.md"

        Returns:
            Skill configuration dict
        """
        full_path = self.base_path / file_path

        if not full_path.exists():
            raise FileNotFoundError(f"Skill file not found: {full_path}")

        # Read file
        with open(full_path, 'r') as f:
            content = f.read()

        # Parse SKILL.md format
        # Expected format:
        # ---
        # name: Identify Assumptions
        # description: ...
        # category: discovery
        # tools: [get_themes, get_personas]
        # ---
        #
        # # Instructions
        # You are an expert...

        parts = content.split('---')
        if len(parts) < 3:
            raise ValueError("Invalid SKILL.md format - missing frontmatter")

        # Parse YAML frontmatter
        frontmatter = yaml.safe_load(parts[1])

        # Parse instructions (everything after second ---)
        instructions = parts[2].strip()

        return {
            'name': frontmatter['name'],
            'description': frontmatter['description'],
            'category': frontmatter.get('category', 'unknown'),
            'tools': frontmatter.get('tools', []),
            'instructions': instructions,
            'output_template': frontmatter.get('output_template')
        }
```

**Size:** ~70 lines

---

### NEW FILE: app/services/unified_pm_os/knowledge_manager.py

```python
"""
Knowledge Manager - CRUD for product knowledge docs
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any, Optional
from app.models.product_knowledge import ProductKnowledge  # NEW MODEL


class KnowledgeManager:
    """Manages product knowledge documents"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_product_knowledge(self, product_id: int) -> Optional[Dict[str, Any]]:
        """Get all knowledge docs for a product"""
        result = await self.db.execute(
            select(ProductKnowledge).where(ProductKnowledge.product_id == product_id)
        )
        knowledge = result.scalars().first()

        if not knowledge:
            return None

        return {
            'strategy_doc': knowledge.strategy_doc,
            'customer_segments_doc': knowledge.customer_segments_doc,
            'competitive_landscape_doc': knowledge.competitive_landscape_doc,
            'value_proposition_doc': knowledge.value_proposition_doc,
            'metrics_and_targets_doc': knowledge.metrics_and_targets_doc
        }

    async def update_knowledge_doc(
        self,
        product_id: int,
        doc_type: str,
        content: str
    ) -> ProductKnowledge:
        """Update a specific knowledge document"""
        result = await self.db.execute(
            select(ProductKnowledge).where(ProductKnowledge.product_id == product_id)
        )
        knowledge = result.scalars().first()

        if not knowledge:
            # Create new record
            knowledge = ProductKnowledge(product_id=product_id)
            self.db.add(knowledge)

        # Update specific doc
        if doc_type == 'strategy':
            knowledge.strategy_doc = content
        elif doc_type == 'customer_segments':
            knowledge.customer_segments_doc = content
        elif doc_type == 'competitive_landscape':
            knowledge.competitive_landscape_doc = content
        elif doc_type == 'value_proposition':
            knowledge.value_proposition_doc = content
        elif doc_type == 'metrics_and_targets':
            knowledge.metrics_and_targets_doc = content
        else:
            raise ValueError(f"Unknown doc_type: {doc_type}")

        await self.db.commit()
        await self.db.refresh(knowledge)

        return knowledge
```

**Size:** ~80 lines

---

### NEW FILE: app/services/unified_pm_os/memory_manager.py

```python
"""
Memory Manager - Saves and retrieves skill execution history
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Dict, Any, List
from datetime import datetime
from app.models.skill_memory import SkillMemory  # NEW MODEL


class MemoryManager:
    """Manages skill execution memory/history"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def save_skill_output(
        self,
        product_id: int,
        skill_name: str,
        skill_category: str,
        input_data: Dict[str, Any],
        output_data: Dict[str, Any],
        summary: str
    ) -> SkillMemory:
        """Save skill execution to memory"""
        memory = SkillMemory(
            product_id=product_id,
            skill_name=skill_name,
            skill_category=skill_category,
            input_data=input_data,
            output_data=output_data,
            summary=summary,
            created_at=datetime.utcnow()
        )

        self.db.add(memory)
        await self.db.commit()
        await self.db.refresh(memory)

        return memory

    async def get_recent_skill_outputs(
        self,
        product_id: int,
        limit: int = 10,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get recent skill executions for retrospective analysis"""
        query = select(SkillMemory).where(SkillMemory.product_id == product_id)

        if category:
            query = query.where(SkillMemory.skill_category == category)

        query = query.order_by(desc(SkillMemory.created_at)).limit(limit)

        result = await self.db.execute(query)
        memories = result.scalars().all()

        return [
            {
                'id': m.id,
                'skill_name': m.skill_name,
                'skill_category': m.skill_category,
                'summary': m.summary,
                'created_at': m.created_at
            }
            for m in memories
        ]

    async def get_memory_stats(self, product_id: int) -> Dict[str, Any]:
        """Get statistics about skill usage"""
        result = await self.db.execute(
            select(SkillMemory).where(SkillMemory.product_id == product_id)
        )
        all_memories = result.scalars().all()

        # Calculate stats
        category_counts = {}
        for memory in all_memories:
            cat = memory.skill_category
            category_counts[cat] = category_counts.get(cat, 0) + 1

        return {
            'total_executions': len(all_memories),
            'category_breakdown': category_counts,
            'most_used_skill': max(
                set([m.skill_name for m in all_memories]),
                key=lambda x: sum(1 for m in all_memories if m.skill_name == x)
            ) if all_memories else None
        }
```

**Size:** ~100 lines

---

## 4. Database Changes

### NEW MIGRATION: Add 3 columns to skills table

```python
# alembic/versions/xxxx_add_skill_category_source.py

def upgrade():
    # Add columns to skills table
    op.add_column('skills', sa.Column('category', sa.String(50), nullable=True))
    op.add_column('skills', sa.Column('source', sa.String(20), default='database'))
    op.add_column('skills', sa.Column('file_path', sa.String(255), nullable=True))

    # Backfill existing skills with 'unknown' category
    op.execute("UPDATE skills SET category = 'unknown', source = 'database' WHERE category IS NULL")
```

### NEW MODEL: app/models/product_knowledge.py

```python
from sqlalchemy import Column, Integer, String, Text, ForeignKey
from app.core.database import Base


class ProductKnowledge(Base):
    __tablename__ = 'product_knowledge'

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey('products.id'), nullable=False)

    # Knowledge documents (stored as text/markdown)
    strategy_doc = Column(Text, nullable=True)
    customer_segments_doc = Column(Text, nullable=True)
    competitive_landscape_doc = Column(Text, nullable=True)
    value_proposition_doc = Column(Text, nullable=True)
    metrics_and_targets_doc = Column(Text, nullable=True)
```

**Size:** ~20 lines

### NEW MODEL: app/models/skill_memory.py

```python
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON
from datetime import datetime
from app.core.database import Base


class SkillMemory(Base):
    __tablename__ = 'skill_memory'

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey('products.id'), nullable=False)

    skill_name = Column(String(255), nullable=False)
    skill_category = Column(String(50), nullable=False)

    input_data = Column(JSON, nullable=False)
    output_data = Column(JSON, nullable=False)
    summary = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
```

**Size:** ~20 lines

---

## 5. New Frontend Pages

### NEW PAGE: pages/knowledge.tsx

```typescript
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Book, Save } from 'lucide-react'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card, Loading } from '@/components/PageContainer'

const KNOWLEDGE_TABS = [
  { id: 'strategy', name: 'Strategy', description: 'Strategic pillars and vision' },
  { id: 'customer_segments', name: 'Customer Segments', description: 'Target segments and personas' },
  { id: 'competitive_landscape', name: 'Competitive Landscape', description: 'Competitors and positioning' },
  { id: 'value_proposition', name: 'Value Proposition', description: 'Unique value and differentiation' },
  { id: 'metrics_and_targets', name: 'Metrics & Targets', description: 'KPIs and goals' }
]

export default function KnowledgePage() {
  const router = useRouter()
  const { productId } = router.query

  const [activeTab, setActiveTab] = useState('strategy')
  const [content, setContent] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (productId) {
      loadKnowledge()
    }
  }, [productId])

  const loadKnowledge = async () => {
    try {
      const response = await api.get(`/products/${productId}/knowledge`)
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
      await api.put(`/products/${productId}/knowledge`, {
        doc_type: activeTab,
        content: content[activeTab] || ''
      })
      alert('Saved successfully!')
    } catch (err) {
      alert('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading />

  return (
    <>
      <Header currentPage="knowledge" />
      <PageContainer>
        <PageHeader
          title="Product Knowledge"
          description="Document your product strategy and context"
          icon={Book}
        />

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {KNOWLEDGE_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Editor */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-2">
              {KNOWLEDGE_TABS.find(t => t.id === activeTab)?.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {KNOWLEDGE_TABS.find(t => t.id === activeTab)?.description}
            </p>

            <textarea
              value={content[activeTab] || ''}
              onChange={(e) => setContent({ ...content, [activeTab]: e.target.value })}
              className="w-full h-96 p-4 border rounded-lg dark:bg-gray-800 dark:border-gray-700 font-mono text-sm"
              placeholder="Enter your knowledge here (supports Markdown)..."
            />

            <button
              onClick={saveKnowledge}
              disabled={saving}
              className="mt-4 flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </Card>
      </PageContainer>
    </>
  )
}
```

**Size:** ~130 lines

---

## Summary: What Actually Changes

| File | Type | Lines Changed | What Changes |
|------|------|---------------|--------------|
| **Frontend** |
| `pages/advisers.tsx` | ENHANCE | +26 lines | Add category filter tabs |
| `pages/knowledge.tsx` | NEW | 130 lines | New page for strategy docs |
| `components/Header.tsx` | ENHANCE | +2 lines | Add "Knowledge" nav link |
| **Backend** |
| `copilot_orchestrator.py` | ENHANCE | ~63 lines | Load from files, add context, save memory |
| `skill_adapter.py` | NEW | 70 lines | Load SKILL.md files |
| `knowledge_manager.py` | NEW | 80 lines | CRUD for knowledge docs |
| `memory_manager.py` | NEW | 100 lines | Save/retrieve skill history |
| **Database** |
| `skills` table | ENHANCE | 3 columns | Add category, source, file_path |
| `product_knowledge` table | NEW | 1 table | Store strategy docs |
| `skill_memory` table | NEW | 1 table | Store skill executions |
| **Models** |
| `product_knowledge.py` | NEW | 20 lines | Model for knowledge |
| `skill_memory.py` | NEW | 20 lines | Model for memory |

**Grand Total:**
- **Enhanced:** 91 lines across 3 existing files
- **New:** 550 lines across 5 new files
- **Total:** ~641 lines of code
- **Unchanged:** 99% of existing Evols code

---

## End-to-End Example: Code Flow

Let's trace **one skill execution** showing EXACTLY which lines of code execute:

### User Action: Click "Start Session" on "Identify Assumptions" skill

**1. Frontend: advisers.tsx:135**
```typescript
onClick={() => startSession(adviser.id, adviser.type)}
```

**2. Frontend: advisers.tsx:48-59**
```typescript
const startSession = async (adviserId: number, adviserType: string) => {
  const response = await api.post('/advisers/sessions', {
    adviser_id: adviserId,
    adviser_type: adviserType
  })
  router.push(`/advisers/session/${sessionId}`)
}
```

**3. Backend: Redirect to session page, user types message**

**4. Frontend: Session page calls chat API**
```typescript
await api.post('/copilot/chat', { message: "Help me with export feature" })
```

**5. Backend: copilot.py:84-106**
```python
@router.post("/chat")
async def chat(request: ChatRequest, ...):
    orchestrator = CopilotOrchestrator(db, current_user)
    result = await orchestrator.chat(
        conversation_id=request.conversation_id,
        message=request.message,
        product_id=request.product_id
    )
```

**6. Backend: copilot_orchestrator.py:427**
```python
skill_id, skill_type = await self.detect_skill(message, history)
# Returns: skill_id=42, skill_type='default' for "Identify Assumptions"
```

**7. Backend: copilot_orchestrator.py:431 (ENHANCED)**
```python
actual_skill_config = await self.load_skill_config(skill_id, skill_type)
# NEW: Loads from unified-pm-os/skills/01-discovery/identify-assumptions/SKILL.md
# Returns: { name: 'Identify Assumptions', instructions: '...', tools: [...] }
```

**8. Backend: copilot_orchestrator.py:454 (ENHANCED)**
```python
system_prompt = await self.build_system_prompt(actual_skill_config, product_id=product_id)
# NEW: Includes product strategy + recent memory
# Returns enhanced prompt with context
```

**9. Backend: copilot_orchestrator.py:468-477**
```python
assistant_content, tool_calls = await handle_function_calling(
    user_message=message,
    conversation_history=conversation_history,
    system_prompt=system_prompt,  # ENHANCED with context
    skill_config=tools_config,
    llm_service=llm_service,
    tenant_id=self.user.tenant_id,
    db=self.db,
    product_id=product_id
)
# LLM executes with enhanced context, calls tools, generates response
```

**10. Backend: copilot_orchestrator.py (NEW - after line 486)**
```python
# NEW: Save to memory
if actual_skill_config and product_id:
    mm = MemoryManager(self.db)
    await mm.save_skill_output(
        product_id=product_id,
        skill_name='Identify Assumptions',
        skill_category='discovery',
        input_data={'message': message},
        output_data={'content': assistant_content},
        summary=assistant_content[:200]
    )
```

**11. Backend: copilot_orchestrator.py:524-533**
```python
return {
    'conversation_id': conversation.id,
    'message': {
        'id': assistant_msg.id,
        'role': 'assistant',
        'content': assistant_content,  # ENHANCED output
        'skill': actual_skill_config,
        'created_at': assistant_msg.created_at.isoformat()
    }
}
```

**12. Frontend: Display response to user**

---

## Key Insight

**Only 3 functions changed in the entire execution path:**
1. `load_skill_config()` - try file first, fallback to DB
2. `build_system_prompt()` - inject knowledge + memory
3. `chat()` - save output to memory

**Everything else is unchanged:**
- Routing
- Tool execution
- LLM calls
- UI rendering
- Database conversations
- Session management

This is **enhancement**, not replacement.
