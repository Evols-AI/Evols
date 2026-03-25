# Unified PM OS Integration - Deployment Guide

## Overview

This integration upgrades Evols from 21 generic skills to 83 expert-curated framework skills, adding:
- **Framework Skills**: Load from SKILL.md files in unified-pm-os directory
- **Knowledge Layer**: 5 product strategy documents that AI can reference
- **Memory System**: Track skill execution history for retrospective analysis
- **Internet Search**: Real-time web grounding via Tavily AI (primary) + Serper (fallback)
- **Enhanced Context**: Skills receive product knowledge + past work automatically

## Architecture Changes

### Three-Layer Enhancement
```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Framework Skills (83 SKILL.md files)         │
│  - Load from unified-pm-os/skills/ directory           │
│  - Backward compatible (existing DB skills still work)  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 2: Knowledge + Memory                            │
│  - Product Knowledge: 5 strategy docs                   │
│  - Skill Memory: Execution history                      │
│  - Auto-injected into skill context                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 3: Enhanced Execution                            │
│  - Internet search tool (Tavily + Serper)              │
│  - Context-aware recommendations                        │
│  - Memory saves after each execution                    │
└─────────────────────────────────────────────────────────┘
```

## Database Changes

### New Tables
1. **product_knowledge** - 5 markdown document fields per product
   - strategy_doc
   - customer_segments_doc
   - competitive_landscape_doc
   - value_proposition_doc
   - metrics_and_targets_doc

2. **skill_memory** - Skill execution history
   - skill_name, skill_category
   - input_data (JSONB)
   - output_data (JSONB)
   - summary (text)

### Modified Tables
**skills** table - 3 new columns:
- category (e.g., 'discovery', 'strategy')
- source ('unified-pm-os' or 'custom')
- file_path (relative path to SKILL.md)

## Deployment Steps

### 1. Prerequisites

Ensure you have unified-pm-os repository at the correct location:
```bash
cd /Users/akshay/Desktop/workspace
ls unified-pm-os/skills/  # Should see 01-discovery/, 02-strategy/, etc.
```

### 2. Backend Setup

#### Install New Dependencies
```bash
cd evols/backend
pip install tavily-python  # Internet search
pip install PyYAML  # SKILL.md parsing (if not already installed)
```

#### Update Environment Variables
Add to `evols/backend/.env`:
```bash
# unified-pm-os path (relative to backend directory)
UNIFIED_PM_OS_PATH=../../unified-pm-os

# Internet Search API Keys (optional - has fallbacks)
TAVILY_API_KEY=your_tavily_key_here  # Get from https://tavily.com (1000 free/month)
SERPER_API_KEY=your_serper_key_here  # Get from https://serper.dev (2500 free/month)
```

**Note**: Internet search works without API keys but with degraded functionality. Tavily is recommended for best results.

#### Run Database Migration
```bash
cd evols/backend
alembic upgrade head
```

This creates:
- product_knowledge table
- skill_memory table
- Adds category/source/file_path columns to skills

#### Register Skills from unified-pm-os
```bash
cd evols/backend
python scripts/register_unified_pm_os_skills.py
```

Expected output:
```
============================================================
Unified PM OS Skill Registration
============================================================

Using unified-pm-os at: /Users/akshay/Desktop/workspace/unified-pm-os
Discovered 83 SKILL.md files

Processing: Customer Interview Scheduler (01-discovery/customer-interviews/schedule-interviews/SKILL.md)
  → Created new skill: Customer Interview Scheduler

...

============================================================
REGISTRATION COMPLETE
============================================================
Total skills found:    83
Created new:           83
Updated existing:      0
Errors:                0
============================================================

✓ Skills are now available in Evols!
  Visit /advisers to see all skills
  Skills will load instructions from SKILL.md files
  Make sure UNIFIED_PM_OS_PATH is set in .env
```

### 3. Frontend Setup

No additional dependencies needed. The frontend changes are already in place:
- [advisers.tsx](evols/frontend/src/pages/advisers.tsx) - Category filter added
- [knowledge.tsx](evols/frontend/src/pages/knowledge.tsx) - New page for strategy docs

### 4. Start Services

```bash
# Terminal 1 - Backend
cd evols/backend
uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend
cd evols/frontend
npm run dev
```

## End-to-End Testing

### Test 1: Verify Skill Registration

1. Navigate to http://localhost:3000/advisers
2. You should see ~83 skills organized by category
3. Filter by "Discovery", "Strategy", "Execution" etc.
4. Skills should display with appropriate icons and descriptions

### Test 2: Knowledge Layer

1. Select a product from header dropdown
2. Navigate to "Knowledge" page (should be in header navigation)
3. Fill in each tab:
   - **Strategy**: "We're building an AI-powered product management platform"
   - **Customer Segments**: "Product managers at B2B SaaS companies, 50-500 employees"
   - **Competitive Landscape**: "Competing with Productboard, Aha!, and Jira"
   - **Value Proposition**: "AI advisers + framework skills + memory context"
   - **Metrics & Targets**: "MAU: 1000, Conversion: 5%, Retention: 80%"
4. Click Save on each tab
5. Verify green "Saved" checkmark appears

### Test 3: Skill Execution with Knowledge Context

1. Go back to Advisers page
2. Start a session with "Customer Interview Scheduler" skill
3. The skill should now have context about your product strategy
4. Check browser console / network tab:
   - POST to `/advisers/sessions` should succeed
   - System prompt should include "## Product Knowledge" section

### Test 4: Memory System

1. Complete a skill session (e.g., Customer Interview Scheduler)
2. Make API call to check memory:
   ```bash
   curl http://localhost:8000/api/v1/memory/products/{product_id}/memory \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```
3. Should return JSON with skill execution history
4. Verify saved output includes summary

### Test 5: Internet Search Tool

1. Start a session with "Competitive Intelligence" skill
2. Ask: "Search for recent news about Productboard"
3. The skill should use `search_internet` tool
4. Response should include:
   - Synthesized answer
   - Source URLs
   - Recent information (not from training data)

### Test 6: Memory Stats API

```bash
curl http://localhost:8000/api/v1/memory/products/{product_id}/memory/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Should return:
```json
{
  "total_executions": 5,
  "category_breakdown": {
    "discovery": 3,
    "strategy": 2
  },
  "most_used_skills": [...],
  "recent_activity": [...]
}
```

## File Changes Summary

### Backend - New Files
- `alembic/versions/001_add_unified_pm_os_tables.py` - Database migration
- `app/models/product_knowledge.py` - Knowledge model
- `app/models/skill_memory.py` - Memory model
- `app/services/unified_pm_os/__init__.py` - Package init
- `app/services/unified_pm_os/skill_adapter.py` - Load SKILL.md files
- `app/services/unified_pm_os/knowledge_manager.py` - Knowledge CRUD
- `app/services/unified_pm_os/memory_manager.py` - Memory CRUD
- `app/api/v1/endpoints/knowledge.py` - Knowledge endpoints
- `app/api/v1/endpoints/memory.py` - Memory endpoints
- `scripts/register_unified_pm_os_skills.py` - Skill registration script

### Backend - Modified Files
- `app/services/copilot_orchestrator.py`
  - load_skill_config() - Try file load first, DB fallback
  - build_system_prompt() - Inject knowledge + memory
  - chat() - Save outputs to memory
- `app/services/skill_tools.py`
  - Added search_internet() tool with Tavily + Serper
- `app/api/v1/__init__.py`
  - Registered knowledge and memory routers

### Frontend - New Files
- `src/pages/knowledge.tsx` - Knowledge documentation page

### Frontend - Modified Files
- `src/pages/advisers.tsx`
  - Added category filter (Discovery, Strategy, Execution, etc.)
  - Filter advisers by selected category

## API Endpoints Reference

### Knowledge Endpoints
```
GET    /api/v1/knowledge/products/{product_id}/knowledge
PUT    /api/v1/knowledge/products/{product_id}/knowledge
GET    /api/v1/knowledge/products/{product_id}/knowledge/summary
```

### Memory Endpoints
```
GET    /api/v1/memory/products/{product_id}/memory
GET    /api/v1/memory/products/{product_id}/memory/{memory_id}
GET    /api/v1/memory/products/{product_id}/memory/stats
GET    /api/v1/memory/products/{product_id}/memory/search?q=keyword
DELETE /api/v1/memory/products/{product_id}/memory
```

## Troubleshooting

### Skills not loading from files
**Problem**: Skills still using old database instructions

**Solution**:
1. Check UNIFIED_PM_OS_PATH in .env points to correct location
2. Verify skills have `file_path` column populated:
   ```sql
   SELECT id, name, file_path, source FROM skills WHERE source = 'unified-pm-os' LIMIT 5;
   ```
3. Re-run registration script: `python scripts/register_unified_pm_os_skills.py`

### Internet search not working
**Problem**: search_internet tool returns errors

**Solution**:
1. Check if API keys are set (TAVILY_API_KEY and/or SERPER_API_KEY)
2. Verify rate limits not exceeded
3. Check logs for specific error messages
4. Tool gracefully degrades to "not available" if both services fail

### Knowledge not appearing in skill context
**Problem**: Skills don't seem to know product strategy

**Solution**:
1. Verify knowledge was saved (check browser network tab)
2. Query database:
   ```sql
   SELECT * FROM product_knowledge WHERE product_id = {your_product_id};
   ```
3. Check skill execution logs for system prompt content
4. Knowledge only injected for product-scoped skills (not tenant-level)

### Memory not saving
**Problem**: Skill executions not appearing in memory

**Solution**:
1. Check if skill_memory table exists: `\dt skill_memory` in psql
2. Verify memory_manager is being called in copilot_orchestrator
3. Check logs for save_skill_output() errors
4. Memory only saves for successful skill completions

## Performance Considerations

### Skill Loading
- First load from file is ~50ms (YAML parse + file read)
- Subsequent loads can be cached in memory if needed
- Database fallback for existing/custom skills

### Knowledge Injection
- Knowledge docs loaded once per session
- Adds ~1-2KB to system prompt
- Negligible impact on LLM performance

### Memory Storage
- JSONB columns compress well in PostgreSQL
- Indexes on product_id, skill_name, created_at
- Old memory can be archived/deleted if needed

### Internet Search
- Tavily: ~500ms per search
- Serper: ~300ms per search
- Results cached within skill session
- Rate limits: Tavily 1000/month, Serper 2500/month (free tiers)

## Next Steps

After successful deployment:

1. **Populate Knowledge Base**
   - Have PMs document their product strategy
   - Start with key products
   - Knowledge quality directly improves skill outputs

2. **Monitor Memory Growth**
   - Track skill execution patterns
   - Identify most valuable skills
   - Use memory stats for product insights

3. **Customize Skills**
   - Fork unified-pm-os for org-specific skills
   - Add custom SKILL.md files
   - Register with same script

4. **Optimize Performance**
   - Add memory cache for frequent skills
   - Implement knowledge summarization for large docs
   - Monitor API rate limits

5. **User Feedback**
   - Compare old generic skills vs framework skills
   - Measure improvement in response quality
   - Iterate based on PM feedback

## Support

For issues or questions:
1. Check logs in `evols/backend/logs/`
2. Review migration output: `alembic history`
3. Verify environment variables: `printenv | grep UNIFIED_PM_OS`
4. Check skill registration output for errors

## Success Metrics

After deployment, track:
- ✅ 83 skills registered and accessible
- ✅ Knowledge docs populated for key products
- ✅ Memory accumulating from skill executions
- ✅ Internet search functioning for real-time data
- ✅ PM feedback on response quality improvement

---

**Integration Status**: ✅ Complete and ready for deployment

**Backward Compatibility**: ✅ Existing skills continue working via database fallback

**Production Readiness**: ⚠️  Test thoroughly before production deployment
