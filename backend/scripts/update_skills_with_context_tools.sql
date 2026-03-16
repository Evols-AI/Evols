-- Update Skills to Use Context System Tools
-- This script updates key skills to leverage the new unified context system

-- ==========================================
-- 1. INSIGHTS MINER - Add Context Tools
-- ==========================================
UPDATE skills
SET
    tools = '["get_themes", "get_personas", "get_feedback_items", "get_features", "get_feedback_summary", "calculate_rice_score", "get_context_sources", "get_extracted_entities", "get_entity_summary"]'::json,
    instructions = REPLACE(
        instructions,
        'You have access to the following tools to gather data:',
        'You have access to the following tools to gather data:

<critical_workflow>
1. FIRST call get_context_sources to see what raw context data is available (meeting transcripts, surveys, documents)
2. THEN call get_extracted_entities to get AI-discovered insights (personas, pain points, use cases, capabilities)
3. SUPPLEMENT with traditional tools (get_themes, get_personas, get_feedback_items) for additional context
4. Use get_entity_summary for high-level statistics
</critical_workflow>

IMPORTANT: The context system contains richer, more recent data than the legacy tables. Always check context sources first.

You have access to the following tools to gather data:'
    ),
    updated_at = NOW()
WHERE name = 'Insights Miner';

-- ==========================================
-- 2. PERSONA ANALYZER - Add Context Tools
-- ==========================================
UPDATE skills
SET
    tools = '["get_personas", "get_feedback_items", "get_themes", "get_extracted_entities", "get_context_sources"]'::json,
    instructions = REPLACE(
        instructions,
        'You are a customer research expert',
        'You are a customer research expert specializing in synthesizing insights from multiple data sources.

<critical_workflow>
1. FIRST call get_extracted_entities with entity_type="persona" to see AI-discovered personas from context sources
2. THEN call get_personas to get managed/validated personas
3. Use get_context_sources to understand where persona insights originated (interviews, surveys, etc.)
4. Cross-reference with get_feedback_items and get_themes for validation
</critical_workflow>

IMPORTANT: Extracted entities from the context system often contain fresher insights from recent customer conversations, meetings, and research.

You are a customer research expert'
    ),
    updated_at = NOW()
WHERE name = 'Persona Analyzer';

-- ==========================================
-- 3. PRD WRITER - Add Context Tools
-- ==========================================
UPDATE skills
SET
    tools = '["get_themes", "get_personas", "get_feedback_items", "get_features", "get_extracted_entities", "get_context_sources"]'::json,
    instructions = REPLACE(
        instructions,
        'You are an experienced product manager',
        'You are an experienced product manager who writes data-driven PRDs.

<critical_workflow>
1. Call get_extracted_entities to find relevant pain points, use cases, and feature requests from context data
2. Call get_context_sources to reference specific customer quotes, meeting notes, or research
3. Supplement with get_themes and get_personas for additional validation
4. Use get_features to check existing capabilities
</critical_workflow>

IMPORTANT: Always cite specific sources (meetings, surveys, research documents) from context_sources when making claims about customer needs.

You are an experienced product manager'
    ),
    updated_at = NOW()
WHERE name = 'PRD Writer';

-- ==========================================
-- 4. DECISION WORKBENCH - Add Context Tools
-- ==========================================
UPDATE skills
SET
    tools = '["get_themes", "get_personas", "get_feedback_items", "get_features", "calculate_rice_score", "get_extracted_entities", "get_context_sources", "get_entity_summary"]'::json,
    instructions = REPLACE(
        instructions,
        'You help product teams make evidence-based decisions',
        'You help product teams make evidence-based decisions by synthesizing data from all available sources.

<critical_workflow>
1. Use get_entity_summary to understand the breadth of available context data
2. Call get_extracted_entities to find relevant insights (pain points, use cases, stakeholders, competitors)
3. Reference get_context_sources to cite specific evidence (meeting transcripts, research documents)
4. Validate with legacy tools (themes, personas, feedback) for comprehensive analysis
</critical_workflow>

IMPORTANT: Modern decisions require both quantitative data (themes/feedback counts) AND qualitative evidence (meeting transcripts, customer quotes). Use context sources for the latter.

You help product teams make evidence-based decisions'
    ),
    updated_at = NOW()
WHERE name = 'Decision Workbench';

-- ==========================================
-- 5. ROADMAP PLANNER - Add Context Tools
-- ==========================================
UPDATE skills
SET
    tools = '["get_themes", "get_personas", "get_features", "calculate_rice_score", "get_feedback_summary", "get_extracted_entities", "get_entity_summary"]'::json,
    instructions = REPLACE(
        instructions,
        'You are a strategic product leader',
        'You are a strategic product leader who builds data-driven roadmaps.

<critical_workflow>
1. Call get_entity_summary to understand the landscape of customer needs
2. Use get_extracted_entities to identify emerging patterns (pain points, use cases, capabilities)
3. Supplement with get_themes and get_personas for prioritization
4. Calculate impact using calculate_rice_score
</critical_workflow>

IMPORTANT: Extracted entities often reveal emerging trends before they show up in aggregated theme data.

You are a strategic product leader'
    ),
    updated_at = NOW()
WHERE name = 'Roadmap Planner';

-- ==========================================
-- 6. RICE CALCULATOR - Add Context Tools
-- ==========================================
UPDATE skills
SET
    tools = '["get_themes", "get_personas", "get_feedback_items", "calculate_rice_score", "get_extracted_entities"]'::json,
    instructions = REPLACE(
        instructions,
        'You are a product prioritization expert',
        'You are a product prioritization expert who uses data to inform scoring.

<workflow>
1. Use get_extracted_entities to understand the breadth of impact (how many personas, pain points, use cases mentioned)
2. Reference get_themes for reach estimation
3. Use get_personas for segment-specific impact analysis
4. Call calculate_rice_score with validated inputs
</workflow>

IMPORTANT: Entity counts (personas affected, pain points addressed) help estimate reach more accurately.

You are a product prioritization expert'
    ),
    updated_at = NOW()
WHERE name = 'RICE Calculator';

-- ==========================================
-- 7. COMPETITIVE ANALYST - Add Context Tools
-- ==========================================
UPDATE skills
SET
    tools = '["get_themes", "get_personas", "get_feedback_items", "get_features", "get_extracted_entities", "get_context_sources"]'::json,
    instructions = REPLACE(
        instructions,
        'You are a competitive intelligence analyst',
        'You are a competitive intelligence analyst with access to comprehensive market data.

<critical_workflow>
1. Call get_extracted_entities with entity_type="competitor" to see AI-discovered competitive mentions
2. Use get_context_sources to find meeting notes, win/loss interviews, and research documents mentioning competitors
3. Supplement with get_themes and get_feedback_items for customer perspectives
</critical_workflow>

IMPORTANT: Context sources often contain unstructured competitive intelligence from sales calls and customer conversations.

You are a competitive intelligence analyst'
    ),
    updated_at = NOW()
WHERE name = 'Competitive Analyst';

-- ==========================================
-- 8. UPDATE ALL OTHER SKILLS
-- ==========================================
-- Add basic context tool access to remaining skills
UPDATE skills
SET
    tools = tools::jsonb || '["get_context_sources", "get_extracted_entities"]'::jsonb,
    updated_at = NOW()
WHERE name NOT IN (
    'Insights Miner',
    'Persona Analyzer',
    'PRD Writer',
    'Decision Workbench',
    'Roadmap Planner',
    'RICE Calculator',
    'Competitive Analyst'
)
AND NOT (tools::text LIKE '%get_context_sources%');

-- Verification Query
SELECT
    name,
    jsonb_array_length(tools::jsonb) as tool_count,
    CASE
        WHEN tools::text LIKE '%get_context_sources%' THEN '✓'
        ELSE '✗'
    END as has_context_tools,
    updated_at
FROM skills
ORDER BY name;
