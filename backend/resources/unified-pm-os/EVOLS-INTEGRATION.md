# Evols Integration Guide
## How Evols Uses Unified PM OS as Its Intelligence Layer

This document explains how to integrate the Unified PM OS into Evols, transforming it from a feedback clustering platform into a comprehensive AI operating system for product management.

---

## Table of Contents

1. [Current Evols Architecture](#current-evols-architecture)
2. [New Architecture with Unified PM OS](#new-architecture-with-unified-pm-os)
3. [What Changes in Evols](#what-changes-in-evols)
4. [Implementation Plan](#implementation-plan)
5. [Code Examples](#code-examples)
6. [Migration Strategy](#migration-strategy)

---

## Current Evols Architecture

### Current System (Without Unified PM OS)

```
┌─────────────────────────────────────────┐
│         Evols Frontend (React)          │
│  • Skills page (21 custom skills)       │
│  • Themes page (feedback clustering)    │
│  • Initiatives page                     │
│  • Projects page (RICE scoring)         │
│  • Personas page (digital twins)        │
│  • Decision workbench                   │
└─────────────────────────────────────────┘
                  ↓ API
┌─────────────────────────────────────────┐
│       Evols Backend (FastAPI)           │
│  • 21 AI skills (custom prompts)        │
│  • Skill tool registry (20+ tools)      │
│  • Context management (entity extract)  │
│  • Clustering service (themes)          │
│  • Persona twin service                 │
│  • A/B testing + adaptive bandits       │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│   PostgreSQL + pgvector Database        │
│  • skills (21 records)                  │
│  • conversations (skill sessions)       │
│  • messages (chat history)              │
│  • context_sources (uploaded feedback)  │
│  • extracted_entities                   │
│  • themes, initiatives, projects        │
│  • personas                             │
└─────────────────────────────────────────┘
```

**Limitations:**
- Only 21 custom skills (manually created)
- No systematic PM frameworks
- Skills don't reference strategy/knowledge
- No memory accumulation across sessions
- Each skill is isolated (no chaining)

---

## New Architecture with Unified PM OS

### Enhanced System (With Unified PM OS Integration)

```
┌──────────────────────────────────────────────────────────────┐
│              Evols Frontend (React)                          │
│  • Skills page (85+ skills in 10 categories)                │
│  • Knowledge page (strategy docs per product)               │
│  • Memory page (retrospective insights)                     │
│  • All existing pages (themes, projects, personas, etc.)    │
└──────────────────────────────────────────────────────────────┘
                            ↓ API
┌──────────────────────────────────────────────────────────────┐
│              Evols Backend (FastAPI)                         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │   NEW: Unified PM OS Integration Layer                 │ │
│  │   • SkillAdapter (loads SKILL.md files)                │ │
│  │   • KnowledgeManager (per-product strategy docs)       │ │
│  │   • MemoryManager (context graph)                      │ │
│  │   • WorkflowEngine (skill chaining)                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↓                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │   Existing Evols Services (Enhanced)                   │ │
│  │   • Skill tool registry (same 20+ tools)               │ │
│  │   • Context management (entity extraction)             │ │
│  │   • Clustering service (themes)                        │ │
│  │   • Persona twin service                               │ │
│  │   • A/B testing + adaptive bandits                     │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│        PostgreSQL + pgvector Database                        │
│                                                              │
│  Existing Tables:                                            │
│  • skills (now 85+ records)                                 │
│  • conversations, messages                                  │
│  • context_sources, extracted_entities                      │
│  • themes, initiatives, projects, personas                  │
│                                                              │
│  NEW Tables:                                                 │
│  • product_knowledge (strategy docs per product)            │
│  • skill_memory (context graph - accumulated outputs)       │
│  • skill_workflows (chained skill sequences)                │
│  • skill_outcomes (decision results tracking)               │
└──────────────────────────────────────────────────────────────┘
                            ↑
┌──────────────────────────────────────────────────────────────┐
│         Unified PM OS (File System)                          │
│  • skills/ (83 SKILL.md files)                              │
│  • knowledge/ (templates and examples)                      │
│  • templates/ (for generating product-specific knowledge)   │
│                                                              │
│  Read by SkillAdapter at runtime                            │
└──────────────────────────────────────────────────────────────┘
```

---

## What Changes in Evols

### 1. Database Schema Changes

#### New Tables

**A. product_knowledge**
```sql
CREATE TABLE product_knowledge (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,

    -- Knowledge docs stored as JSON
    strategy_doc JSONB,
    customer_segments_doc JSONB,
    competitive_landscape_doc JSONB,
    value_proposition_doc JSONB,
    metrics_and_targets_doc JSONB,

    -- Version control
    version INTEGER DEFAULT 1,
    last_updated_by_user_id INTEGER REFERENCES users(id),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_product_knowledge_product ON product_knowledge(product_id);
CREATE INDEX idx_product_knowledge_tenant ON product_knowledge(tenant_id);
```

**B. skill_memory**
```sql
CREATE TABLE skill_memory (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id VARCHAR(36) REFERENCES conversations(id),

    -- Skill identification
    skill_name VARCHAR(255) NOT NULL,
    skill_category VARCHAR(50) NOT NULL,  -- discovery, strategy, execution, etc.

    -- Execution data
    input_data JSONB NOT NULL,
    output_data JSONB NOT NULL,

    -- For retrospectives
    outcome_recorded BOOLEAN DEFAULT FALSE,
    outcome_data JSONB,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_skill_memory_product ON skill_memory(product_id);
CREATE INDEX idx_skill_memory_category ON skill_memory(skill_category);
CREATE INDEX idx_skill_memory_created ON skill_memory(created_at DESC);
```

**C. skill_workflows**
```sql
CREATE TABLE skill_workflows (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,  -- e.g., "discover", "strategy", "prd-to-launch"
    description TEXT,

    -- Workflow definition
    skill_sequence JSONB NOT NULL,  -- ["skill1", "skill2", "skill3"]

    -- Usage tracking
    execution_count INTEGER DEFAULT 0,
    avg_completion_rate FLOAT,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**D. skill_outcomes**
```sql
CREATE TABLE skill_outcomes (
    id SERIAL PRIMARY KEY,
    skill_memory_id INTEGER REFERENCES skill_memory(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,

    -- Outcome tracking
    decision_made VARCHAR(500),
    outcome_type VARCHAR(50),  -- 'success', 'partial', 'failure', 'unknown'
    outcome_description TEXT,

    -- Metrics
    metrics JSONB,  -- e.g., {"metric": "activation_rate", "before": 20, "after": 35}

    recorded_at TIMESTAMP DEFAULT NOW(),
    recorded_by_user_id INTEGER REFERENCES users(id)
);
```

#### Modified Tables

**Update skills table:**
```sql
-- Add new fields to existing skills table
ALTER TABLE skills ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE skills ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'custom';  -- 'unified_pm_os' or 'custom'
ALTER TABLE skills ADD COLUMN IF NOT EXISTS skill_file_path TEXT;  -- Path to SKILL.md in unified-pm-os
ALTER TABLE skills ADD COLUMN IF NOT EXISTS framework_author VARCHAR(255);  -- e.g., 'Teresa Torres', 'Marty Cagan'
```

### 2. Backend Changes

#### New Services

**File:** `evols/backend/app/services/unified_pm_os/__init__.py`

```python
"""
Unified PM OS Integration Layer
Adapts unified-pm-os skills for use in Evols
"""
from .skill_adapter import SkillAdapter
from .knowledge_manager import KnowledgeManager
from .memory_manager import MemoryManager
from .workflow_engine import WorkflowEngine

__all__ = [
    'SkillAdapter',
    'KnowledgeManager',
    'MemoryManager',
    'WorkflowEngine'
]
```

**File:** `evols/backend/app/services/unified_pm_os/skill_adapter.py`

```python
"""
Skill Adapter: Loads and executes SKILL.md files from unified-pm-os
"""
import os
from pathlib import Path
from typing import Dict, Any, Optional
import yaml
import re

class SkillAdapter:
    """
    Adapter that loads SKILL.md files from unified-pm-os and executes them
    """

    def __init__(self, unified_pm_os_path: str):
        self.base_path = Path(unified_pm_os_path)
        self.skills_cache = {}

    def discover_all_skills(self) -> list:
        """
        Scan unified-pm-os/skills/ directory and return all skills
        """
        skills = []
        skills_dir = self.base_path / "skills"

        for category_dir in skills_dir.iterdir():
            if not category_dir.is_dir():
                continue

            category = category_dir.name

            for skill_dir in category_dir.iterdir():
                if not skill_dir.is_dir():
                    continue

                skill_md = skill_dir / "SKILL.md"
                if skill_md.exists():
                    skill = self.parse_skill_md(skill_md, category)
                    skills.append(skill)

        return skills

    def parse_skill_md(self, skill_path: Path, category: str) -> Dict[str, Any]:
        """
        Parse SKILL.md file and extract metadata
        """
        with open(skill_path, 'r') as f:
            content = f.read()

        # Extract YAML frontmatter (if present)
        frontmatter = {}
        if content.startswith('---'):
            parts = content.split('---', 2)
            if len(parts) >= 3:
                frontmatter = yaml.safe_load(parts[1])
                content = parts[2]

        # Extract skill metadata
        skill_name = frontmatter.get('name', skill_path.parent.name)
        description = frontmatter.get('description', '')

        # Extract sections from markdown
        sections = self.extract_markdown_sections(content)

        return {
            'name': skill_name,
            'description': description,
            'category': category,
            'file_path': str(skill_path),
            'instructions': content,  # Full markdown content
            'tools': frontmatter.get('tools', []),
            'framework_author': frontmatter.get('author', None),
            'sections': sections
        }

    def extract_markdown_sections(self, content: str) -> Dict[str, str]:
        """Extract sections from markdown"""
        sections = {}
        current_section = None
        current_content = []

        for line in content.split('\n'):
            if line.startswith('## '):
                if current_section:
                    sections[current_section] = '\n'.join(current_content).strip()
                current_section = line[3:].strip()
                current_content = []
            else:
                current_content.append(line)

        if current_section:
            sections[current_section] = '\n'.join(current_content).strip()

        return sections

    async def execute_skill(
        self,
        skill_name: str,
        user_input: str,
        context: Dict[str, Any],
        db
    ) -> Dict[str, Any]:
        """
        Execute a skill with Evols context
        """
        # Get skill definition
        skill = self.skills_cache.get(skill_name)
        if not skill:
            raise ValueError(f"Skill '{skill_name}' not found")

        # Build full context for LLM
        full_context = {
            **context,
            'skill_instructions': skill['instructions'],
            'user_input': user_input
        }

        # Execute skill (via LLM service)
        from app.services.llm_service import get_llm_service_for_tenant

        llm_service = get_llm_service_for_tenant(context['tenant_id'])

        # Build system prompt from skill instructions
        system_prompt = self.build_system_prompt(skill, context)

        # Call LLM
        result = await llm_service.complete(
            system_prompt=system_prompt,
            user_message=user_input,
            tools=self.get_skill_tools(skill, context),
            context=context
        )

        return {
            'output': result.content,
            'tool_calls': result.tool_calls,
            'skill_name': skill_name,
            'skill_category': skill['category']
        }

    def build_system_prompt(self, skill: Dict, context: Dict) -> str:
        """
        Build system prompt for skill execution
        Combines skill instructions with Evols context
        """
        prompt_parts = []

        # Add skill instructions
        prompt_parts.append(skill['instructions'])

        # Add knowledge layer context if available
        if context.get('knowledge'):
            prompt_parts.append("\n\n## Product Knowledge\n")
            for key, value in context['knowledge'].items():
                prompt_parts.append(f"### {key}\n{value}\n")

        # Add memory context if available
        if context.get('memory'):
            prompt_parts.append("\n\n## Past Work (Memory)\n")
            for mem in context['memory'][:5]:  # Last 5 relevant memories
                prompt_parts.append(f"- {mem['skill_name']} ({mem['created_at']}): {mem['summary']}\n")

        # Add Evols data context
        if context.get('themes'):
            prompt_parts.append(f"\n\n## Customer Themes\n")
            prompt_parts.append(f"You have access to {len(context['themes'])} customer feedback themes.\n")

        if context.get('personas'):
            prompt_parts.append(f"\n\n## Personas\n")
            prompt_parts.append(f"You have access to {len(context['personas'])} customer personas.\n")

        return '\n'.join(prompt_parts)

    def get_skill_tools(self, skill: Dict, context: Dict) -> list:
        """
        Get available tools for skill
        Maps skill tool requirements to Evols tool registry
        """
        from app.services.skill_tools import tool_registry

        tool_names = skill.get('tools', [])

        # Add default Evols tools
        default_tools = [
            'get_themes',
            'get_personas',
            'get_feedback_items',
            'get_context_sources'
        ]

        all_tool_names = list(set(tool_names + default_tools))

        return tool_registry.get_tools_schema_by_names(all_tool_names)
```

**File:** `evols/backend/app/services/unified_pm_os/knowledge_manager.py`

```python
"""
Knowledge Manager: Manages per-product strategy docs
"""
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.product import Product

class KnowledgeManager:
    """
    Manages product knowledge layer (strategy, personas, metrics, etc.)
    """

    async def get_product_knowledge(
        self,
        product_id: int,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Get knowledge docs for a product
        """
        from app.models import ProductKnowledge  # Assuming we create this model

        query = select(ProductKnowledge).where(
            ProductKnowledge.product_id == product_id
        )
        result = await db.execute(query)
        knowledge = result.scalar_one_or_none()

        if not knowledge:
            # Return empty template
            return self.get_empty_template()

        return {
            'strategy': knowledge.strategy_doc or {},
            'customer_segments': knowledge.customer_segments_doc or {},
            'competitive_landscape': knowledge.competitive_landscape_doc or {},
            'value_proposition': knowledge.value_proposition_doc or {},
            'metrics_and_targets': knowledge.metrics_and_targets_doc or {}
        }

    async def update_product_knowledge(
        self,
        product_id: int,
        knowledge_type: str,
        content: Dict[str, Any],
        user_id: int,
        db: AsyncSession
    ) -> None:
        """
        Update a specific knowledge document
        """
        from app.models import ProductKnowledge

        query = select(ProductKnowledge).where(
            ProductKnowledge.product_id == product_id
        )
        result = await db.execute(query)
        knowledge = result.scalar_one_or_none()

        if not knowledge:
            # Create new record
            knowledge = ProductKnowledge(
                product_id=product_id,
                tenant_id=context['tenant_id']
            )
            db.add(knowledge)

        # Update specific doc
        if knowledge_type == 'strategy':
            knowledge.strategy_doc = content
        elif knowledge_type == 'customer_segments':
            knowledge.customer_segments_doc = content
        # ... etc for other types

        knowledge.version += 1
        knowledge.last_updated_by_user_id = user_id

        await db.commit()

    def get_empty_template(self) -> Dict[str, Any]:
        """
        Return empty knowledge template
        """
        return {
            'strategy': {},
            'customer_segments': {},
            'competitive_landscape': {},
            'value_proposition': {},
            'metrics_and_targets': {}
        }
```

**File:** `evols/backend/app/services/unified_pm_os/memory_manager.py`

```python
"""
Memory Manager: Context graph accumulation
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

class MemoryManager:
    """
    Manages skill memory (context graph)
    """

    async def save_skill_output(
        self,
        product_id: int,
        tenant_id: int,
        conversation_id: str,
        skill_name: str,
        skill_category: str,
        input_data: Dict[str, Any],
        output_data: Dict[str, Any],
        db: AsyncSession
    ) -> int:
        """
        Save skill execution to memory
        """
        from app.models import SkillMemory

        memory = SkillMemory(
            product_id=product_id,
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            skill_name=skill_name,
            skill_category=skill_category,
            input_data=input_data,
            output_data=output_data
        )

        db.add(memory)
        await db.commit()
        await db.refresh(memory)

        return memory.id

    async def get_relevant_memory(
        self,
        product_id: int,
        skill_category: Optional[str] = None,
        limit: int = 10,
        db: AsyncSession
    ) -> List[Dict[str, Any]]:
        """
        Get relevant past skill executions for context
        """
        from app.models import SkillMemory

        query = select(SkillMemory).where(
            SkillMemory.product_id == product_id
        )

        if skill_category:
            query = query.where(SkillMemory.skill_category == skill_category)

        query = query.order_by(desc(SkillMemory.created_at)).limit(limit)

        result = await db.execute(query)
        memories = result.scalars().all()

        return [
            {
                'id': m.id,
                'skill_name': m.skill_name,
                'skill_category': m.skill_category,
                'input': m.input_data,
                'output': m.output_data,
                'created_at': m.created_at.isoformat(),
                'summary': self.summarize_memory(m)
            }
            for m in memories
        ]

    def summarize_memory(self, memory) -> str:
        """
        Create a short summary of a memory for context
        """
        # Extract key info from output_data
        if isinstance(memory.output_data, dict):
            if 'summary' in memory.output_data:
                return memory.output_data['summary'][:200]
            if 'output' in memory.output_data:
                return str(memory.output_data['output'])[:200]

        return f"{memory.skill_name} executed"

    async def get_retrospective_insights(
        self,
        product_id: int,
        days_back: int = 90,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Generate retrospective insights from accumulated memory
        """
        from app.models import SkillMemory
        from sqlalchemy import func

        cutoff_date = datetime.utcnow() - timedelta(days=days_back)

        # Get all memories in time window
        query = select(SkillMemory).where(
            SkillMemory.product_id == product_id,
            SkillMemory.created_at >= cutoff_date
        )

        result = await db.execute(query)
        memories = result.scalars().all()

        # Analyze patterns
        category_counts = {}
        skill_counts = {}

        for mem in memories:
            category_counts[mem.skill_category] = category_counts.get(mem.skill_category, 0) + 1
            skill_counts[mem.skill_name] = skill_counts.get(mem.skill_name, 0) + 1

        # Calculate outcome validation rate
        outcome_count = await db.execute(
            select(func.count()).select_from(SkillMemory).where(
                SkillMemory.product_id == product_id,
                SkillMemory.outcome_recorded == True
            )
        )

        validation_rate = (outcome_count.scalar() / len(memories) * 100) if memories else 0

        return {
            'total_skills_used': len(memories),
            'date_range': f"Last {days_back} days",
            'most_used_category': max(category_counts, key=category_counts.get) if category_counts else None,
            'most_used_skill': max(skill_counts, key=skill_counts.get) if skill_counts else None,
            'category_distribution': category_counts,
            'skill_distribution': skill_counts,
            'outcome_validation_rate': round(validation_rate, 1)
        }
```

**File:** `evols/backend/app/services/unified_pm_os/workflow_engine.py`

```python
"""
Workflow Engine: Chained skill execution
"""
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

class WorkflowEngine:
    """
    Execute chained workflows (e.g., /discover = 4 skills in sequence)
    """

    WORKFLOWS = {
        'discover': [
            'brainstorm-ideas',
            'identify-assumptions',
            'prioritize-assumptions',
            'brainstorm-experiments'
        ],
        'strategy': [
            'product-strategy',
            'swot-analysis',
            'competitive-analysis'
        ],
        'prd-to-launch': [
            'create-prd',
            'stakeholder-map',
            'pre-mortem',
            'plan-launch'
        ]
    }

    def __init__(self, skill_adapter):
        self.skill_adapter = skill_adapter

    async def execute_workflow(
        self,
        workflow_name: str,
        initial_input: str,
        context: Dict[str, Any],
        db: AsyncSession
    ) -> List[Dict[str, Any]]:
        """
        Execute a workflow (chain of skills)
        """
        if workflow_name not in self.WORKFLOWS:
            raise ValueError(f"Workflow '{workflow_name}' not found")

        skill_sequence = self.WORKFLOWS[workflow_name]
        results = []

        current_input = initial_input

        for skill_name in skill_sequence:
            # Execute skill
            result = await self.skill_adapter.execute_skill(
                skill_name=skill_name,
                user_input=current_input,
                context=context,
                db=db
            )

            results.append({
                'skill_name': skill_name,
                'output': result['output'],
                'tool_calls': result.get('tool_calls', [])
            })

            # Use output as input for next skill
            current_input = result['output']

        return results

    def get_available_workflows(self) -> Dict[str, List[str]]:
        """
        Return all available workflows
        """
        return self.WORKFLOWS
```

### 3. Frontend Changes

#### New Pages

**A. Knowledge Page**
```typescript
// evols/frontend/src/pages/knowledge.tsx

import React, { useState, useEffect } from 'react';
import { useProduct } from '@/contexts/ProductContext';

interface KnowledgeDocs {
  strategy: any;
  customer_segments: any;
  competitive_landscape: any;
  value_proposition: any;
  metrics_and_targets: any;
}

export default function KnowledgePage() {
  const { currentProduct } = useProduct();
  const [knowledge, setKnowledge] = useState<KnowledgeDocs | null>(null);
  const [activeTab, setActiveTab] = useState('strategy');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchKnowledge();
  }, [currentProduct]);

  const fetchKnowledge = async () => {
    const response = await fetch(`/api/v1/products/${currentProduct.id}/knowledge`);
    const data = await response.json();
    setKnowledge(data);
  };

  const saveKnowledge = async (type: string, content: any) => {
    await fetch(`/api/v1/products/${currentProduct.id}/knowledge/${type}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content)
    });
    setEditing(false);
    fetchKnowledge();
  };

  const tabs = [
    { id: 'strategy', label: 'Strategy' },
    { id: 'customer_segments', label: 'Customer Segments' },
    { id: 'competitive_landscape', label: 'Competitive Landscape' },
    { id: 'value_proposition', label: 'Value Proposition' },
    { id: 'metrics_and_targets', label: 'Metrics & Targets' }
  ];

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Product Knowledge</h1>

      <div className="flex gap-4 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded ${activeTab === tab.id ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white p-6 rounded shadow">
        {knowledge && (
          <KnowledgeEditor
            type={activeTab}
            content={knowledge[activeTab]}
            onSave={(content) => saveKnowledge(activeTab, content)}
          />
        )}
      </div>

      <div className="mt-6 text-sm text-gray-600">
        <p>Skills automatically reference this knowledge when executing.</p>
        <p>Example: "north-star-metric" skill will read your Strategic Pillars to suggest relevant metrics.</p>
      </div>
    </div>
  );
}
```

**B. Memory/Retrospective Page**
```typescript
// evols/frontend/src/pages/memory.tsx

import React, { useState, useEffect } from 'react';
import { useProduct } from '@/contexts/ProductContext';

export default function MemoryPage() {
  const { currentProduct } = useProduct();
  const [insights, setInsights] = useState(null);
  const [memoryTimeline, setMemoryTimeline] = useState([]);

  useEffect(() => {
    fetchRetrospective();
    fetchMemoryTimeline();
  }, [currentProduct]);

  const fetchRetrospective = async () => {
    const response = await fetch(`/api/v1/products/${currentProduct.id}/memory/retrospective`);
    const data = await response.json();
    setInsights(data);
  };

  const fetchMemoryTimeline = async () => {
    const response = await fetch(`/api/v1/products/${currentProduct.id}/memory/timeline`);
    const data = await response.json();
    setMemoryTimeline(data);
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Product Memory & Insights</h1>

      {/* Retrospective Insights */}
      {insights && (
        <div className="bg-white p-6 rounded shadow mb-6">
          <h2 className="text-2xl font-semibold mb-4">Retrospective Insights</h2>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded">
              <p className="text-sm text-gray-600">Total Skills Used</p>
              <p className="text-3xl font-bold">{insights.total_skills_used}</p>
            </div>
            <div className="bg-green-50 p-4 rounded">
              <p className="text-sm text-gray-600">Most Used Category</p>
              <p className="text-xl font-semibold">{insights.most_used_category}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded">
              <p className="text-sm text-gray-600">Outcome Validation Rate</p>
              <p className="text-3xl font-bold">{insights.outcome_validation_rate}%</p>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Skill Usage Distribution</h3>
            {/* Bar chart of category_distribution */}
          </div>

          <div className="bg-yellow-50 p-4 rounded">
            <h3 className="text-lg font-semibold mb-2">⚠️ Recommendations</h3>
            <ul className="list-disc list-inside">
              {insights.outcome_validation_rate < 20 && (
                <li>Only {insights.outcome_validation_rate}% of decisions have recorded outcomes. Run outcome tracking!</li>
              )}
              {/* More recommendations based on patterns */}
            </ul>
          </div>
        </div>
      )}

      {/* Memory Timeline */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-2xl font-semibold mb-4">Memory Timeline</h2>
        <div className="space-y-4">
          {memoryTimeline.map(memory => (
            <div key={memory.id} className="border-l-4 border-blue-500 pl-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{memory.skill_name}</h3>
                  <p className="text-sm text-gray-600">{memory.skill_category}</p>
                </div>
                <p className="text-sm text-gray-500">{new Date(memory.created_at).toLocaleDateString()}</p>
              </div>
              <p className="text-sm mt-2">{memory.summary}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**C. Enhanced Skills Page**
```typescript
// evols/frontend/src/pages/skills.tsx (updated)

const SKILL_CATEGORIES = [
  { id: '01-discovery', name: 'Product Discovery', icon: '🔍', count: 13 },
  { id: '02-strategy', name: 'Product Strategy', icon: '🎯', count: 12 },
  { id: '03-execution', name: 'Execution', icon: '⚡', count: 15 },
  { id: '04-market-research', name: 'Market Research', icon: '📊', count: 7 },
  { id: '05-data-analytics', name: 'Data Analytics', icon: '📈', count: 3 },
  { id: '06-go-to-market', name: 'Go-to-Market', icon: '🚀', count: 6 },
  { id: '07-marketing-growth', name: 'Marketing & Growth', icon: '📱', count: 5 },
  { id: '08-toolkit', name: 'Toolkit', icon: '🛠️', count: 4 },
  { id: '09-os-infrastructure', name: 'Infrastructure', icon: '🧠', count: 10 },
  { id: '10-daily-discipline', name: 'Daily Discipline', icon: '📅', count: 8 }
];

export default function SkillsPage() {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [skills, setSkills] = useState([]);

  useEffect(() => {
    fetchSkills();
  }, [selectedCategory]);

  const fetchSkills = async () => {
    const url = selectedCategory
      ? `/api/v1/skills?category=${selectedCategory}`
      : '/api/v1/skills';

    const response = await fetch(url);
    const data = await response.json();
    setSkills(data.skills);
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Skills Library</h1>
      <p className="text-gray-600 mb-6">
        83 framework-based PM skills from Teresa Torres, Marty Cagan, Alberto Savoia, and more.
      </p>

      {/* Category Grid */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {SKILL_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`p-4 rounded border-2 ${selectedCategory === cat.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
          >
            <div className="text-4xl mb-2">{cat.icon}</div>
            <div className="text-sm font-semibold">{cat.name}</div>
            <div className="text-xs text-gray-500">{cat.count} skills</div>
          </button>
        ))}
      </div>

      {/* Skills List */}
      <div className="grid grid-cols-3 gap-4">
        {skills.map(skill => (
          <SkillCard key={skill.id} skill={skill} />
        ))}
      </div>
    </div>
  );
}
```

### 4. API Endpoints Changes

#### New Endpoints

```python
# evols/backend/app/api/v1/endpoints/knowledge.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

@router.get("/products/{product_id}/knowledge")
async def get_product_knowledge(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get knowledge docs for a product"""
    from app.services.unified_pm_os import KnowledgeManager

    knowledge_manager = KnowledgeManager()
    knowledge = await knowledge_manager.get_product_knowledge(product_id, db)

    return knowledge

@router.put("/products/{product_id}/knowledge/{knowledge_type}")
async def update_product_knowledge(
    product_id: int,
    knowledge_type: str,
    content: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a specific knowledge doc"""
    from app.services.unified_pm_os import KnowledgeManager

    knowledge_manager = KnowledgeManager()
    await knowledge_manager.update_product_knowledge(
        product_id,
        knowledge_type,
        content,
        current_user.id,
        db
    )

    return {"status": "success"}

@router.get("/products/{product_id}/memory/retrospective")
async def get_retrospective_insights(
    product_id: int,
    days_back: int = 90,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get retrospective insights from memory"""
    from app.services.unified_pm_os import MemoryManager

    memory_manager = MemoryManager()
    insights = await memory_manager.get_retrospective_insights(
        product_id,
        days_back,
        db
    )

    return insights

@router.get("/products/{product_id}/memory/timeline")
async def get_memory_timeline(
    product_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get memory timeline"""
    from app.services.unified_pm_os import MemoryManager

    memory_manager = MemoryManager()
    timeline = await memory_manager.get_relevant_memory(
        product_id,
        limit=limit,
        db=db
    )

    return timeline
```

#### Modified Endpoints

```python
# evols/backend/app/api/v1/endpoints/copilot.py (updated)

@router.post("/sessions/{session_id}/chat")
async def chat_with_skill(
    session_id: str,
    request: SkillSessionChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Chat with a skill (now enhanced with knowledge + memory)"""

    # Get session
    session = await get_session(session_id, db)

    # NEW: Build enhanced context
    context = await build_enhanced_context(
        product_id=session.product_id,
        tenant_id=session.tenant_id,
        skill_category=session.skill.category,
        db=db
    )

    # Execute skill with enhanced context
    from app.services.unified_pm_os import SkillAdapter

    skill_adapter = SkillAdapter(UNIFIED_PM_OS_PATH)
    result = await skill_adapter.execute_skill(
        skill_name=session.skill.name,
        user_input=request.message,
        context=context,
        db=db
    )

    # NEW: Save to memory
    from app.services.unified_pm_os import MemoryManager

    memory_manager = MemoryManager()
    await memory_manager.save_skill_output(
        product_id=session.product_id,
        tenant_id=session.tenant_id,
        conversation_id=session_id,
        skill_name=session.skill.name,
        skill_category=session.skill.category,
        input_data={'message': request.message},
        output_data=result,
        db=db
    )

    # Save message
    message = SkillMessage(
        conversation_id=session_id,
        role='assistant',
        content=result['output'],
        skill_id=session.skill_id,
        sequence_number=get_next_sequence(session_id)
    )
    db.add(message)
    await db.commit()

    return {
        'response': result['output'],
        'memory_saved': True
    }

async def build_enhanced_context(
    product_id: int,
    tenant_id: int,
    skill_category: str,
    db: AsyncSession
) -> dict:
    """
    Build enhanced context with knowledge + memory + Evols data
    """
    from app.services.unified_pm_os import KnowledgeManager, MemoryManager
    from app.services.skill_tools import (
        get_themes,
        get_personas,
        get_feedback_items,
        get_context_sources
    )

    # Get knowledge
    knowledge_manager = KnowledgeManager()
    knowledge = await knowledge_manager.get_product_knowledge(product_id, db)

    # Get memory
    memory_manager = MemoryManager()
    memory = await memory_manager.get_relevant_memory(
        product_id,
        skill_category=skill_category,
        limit=5,
        db=db
    )

    # Get Evols data
    themes = await get_themes(tenant_id, db, product_id=product_id)
    personas = await get_personas(tenant_id, db, product_id=product_id)
    feedback = await get_feedback_items(tenant_id, db, product_id=product_id, limit=20)

    return {
        'tenant_id': tenant_id,
        'product_id': product_id,
        'knowledge': knowledge,
        'memory': memory,
        'themes': themes['themes'],
        'personas': personas['personas'],
        'feedback': feedback['feedback_items']
    }
```

---

## Migration Strategy

### Phase 1: Setup (Week 1)

**Goal:** Infrastructure ready, no user-facing changes

**Tasks:**
1. Add unified-pm-os as git submodule or copy to Evols repo
2. Create new database tables (product_knowledge, skill_memory, etc.)
3. Run migration scripts
4. Deploy to staging

**SQL Migration:**
```sql
-- Run this migration
BEGIN;

-- Create new tables
CREATE TABLE product_knowledge (...);
CREATE TABLE skill_memory (...);
CREATE TABLE skill_workflows (...);
CREATE TABLE skill_outcomes (...);

-- Update skills table
ALTER TABLE skills ADD COLUMN category VARCHAR(50);
ALTER TABLE skills ADD COLUMN source VARCHAR(50);
ALTER TABLE skills ADD COLUMN skill_file_path TEXT;

COMMIT;
```

**Deployment:**
```bash
# Add unified-pm-os to Evols
cd evols/
git submodule add ../unified-pm-os unified-pm-os

# Or copy
cp -r ../unified-pm-os evols/unified-pm-os

# Run migration
cd evols/backend
alembic upgrade head
```

### Phase 2: Skill Registration (Week 2)

**Goal:** 83 skills available in database

**Tasks:**
1. Create script to discover and register all skills
2. Run registration script
3. Verify in database

**Script:** `evols/backend/scripts/register_unified_pm_os_skills.py`
```python
import asyncio
from app.database import AsyncSessionLocal
from app.services.unified_pm_os import SkillAdapter
from app.models import Skill

async def register_all_skills():
    skill_adapter = SkillAdapter('../unified-pm-os')

    # Discover all skills
    discovered_skills = skill_adapter.discover_all_skills()

    print(f"Found {len(discovered_skills)} skills")

    async with AsyncSessionLocal() as db:
        for skill_data in discovered_skills:
            # Create Skill record
            skill = Skill(
                name=skill_data['name'],
                description=skill_data['description'],
                category=skill_data['category'],
                source='unified_pm_os',
                skill_file_path=skill_data['file_path'],
                framework_author=skill_data.get('framework_author'),
                instructions=skill_data['instructions'],
                tools=[],  # Will be populated dynamically
                initial_questions=[],
                task_definitions=[],
                is_active=True
            )
            db.add(skill)

        await db.commit()
        print(f"Registered {len(discovered_skills)} skills")

if __name__ == '__main__':
    asyncio.run(register_all_skills())
```

Run:
```bash
cd evols/backend
python scripts/register_unified_pm_os_skills.py
```

### Phase 3: Frontend Updates (Week 3)

**Goal:** Users can see and use 83 skills

**Tasks:**
1. Update skills page with category navigation
2. Add knowledge page
3. Add memory/retrospective page
4. Deploy frontend

**Testing:**
- Click through all 10 categories
- Start a skill session
- Verify skill execution works

### Phase 4: Knowledge & Memory (Week 4)

**Goal:** Skills reference knowledge and save to memory

**Tasks:**
1. Implement knowledge API endpoints
2. Implement memory API endpoints
3. Update skill execution to use KnowledgeManager and MemoryManager
4. Test end-to-end

**Testing Scenario:**
```
1. Create product knowledge (strategy doc)
2. Run "north-star-metric" skill
3. Verify skill references strategy doc in output
4. Check memory table - verify skill output saved
5. Run another skill in same category
6. Verify it has access to previous memory
```

### Phase 5: Workflows (Week 5+)

**Goal:** Chained workflows available

**Tasks:**
1. Implement WorkflowEngine
2. Add workflow API endpoints
3. Add workflow UI
4. Test /discover, /strategy, /prd-to-launch

---

## Success Metrics

**Technical:**
- ✅ 83 skills registered in database
- ✅ All skills executable via API
- ✅ Knowledge layer functional (CRUD operations)
- ✅ Memory accumulating (10+ entries per product)
- ✅ Skills reference knowledge in outputs
- ✅ Skills reference memory in outputs

**User Experience:**
- ✅ Skills page shows 10 categories
- ✅ Users can create/edit knowledge docs
- ✅ Retrospective page shows insights
- ✅ Skill outputs are more personalized (use product context)

**Business:**
- ✅ Skill usage increases (from 21 → 83 available)
- ✅ Session duration increases (chained workflows)
- ✅ User retention increases (memory provides value over time)

---

## Rollback Plan

If integration fails:

1. **Database:** Revert migrations (remove new tables)
2. **Backend:** Remove unified_pm_os service layer
3. **Frontend:** Revert to old skills page
4. **Skills:** Keep old 21 skills working

No data loss - Evols continues working with original 21 skills.

---

## FAQ

**Q: Do we delete the old 21 Evols skills?**
A: No. Keep them. Mark as `source='custom'`. Now you have 21 custom + 83 framework = 104 total. Users can use both.

**Q: What if a skill file changes in unified-pm-os?**
A: Re-run registration script. Skills are loaded from file at runtime, so updates propagate immediately.

**Q: Performance impact of reading SKILL.md files?**
A: Minimal. Add caching layer (Redis) if needed. Skills are ~10KB markdown files.

**Q: Can tenants customize unified-pm-os skills?**
A: Yes! Fork to custom_skills table. Tenant-specific overrides. Same mechanism as current custom skills.

**Q: What about A/B testing?**
A: Still works! Test variants of how you execute the skill (different LLM prompts, different tool selections), not the skill content itself.

---

## Next Steps

Ready to start? Let's begin with Phase 1:

```bash
# 1. Copy unified-pm-os into Evols
cd /Users/akshay/Desktop/workspace/evols
mkdir -p unified-pm-os-integration
cp -r ../unified-pm-os unified-pm-os-integration/

# 2. Create database migrations
cd backend
alembic revision -m "add_unified_pm_os_tables"

# 3. Write migration SQL (see Phase 1)
# 4. Run migration
alembic upgrade head

# 5. Register skills
python scripts/register_unified_pm_os_skills.py
```

After Phase 1 complete, Evols has 83 skills but still uses old execution path. No risk.

Then incrementally add SkillAdapter, KnowledgeManager, MemoryManager in subsequent phases.
