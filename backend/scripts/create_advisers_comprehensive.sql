-- Comprehensive adviser creation script
-- Creates all advisers from CSV with expert-level prompts following Anthropic's best practices

-- First, let's check which advisers already exist
DO $$
BEGIN
  RAISE NOTICE 'Existing advisers:';
END $$;

SELECT name FROM advisers ORDER BY name;

-- Now let's create/update each adviser

-- 1. Insights Miner
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM advisers WHERE name = 'Insights Miner') THEN
    INSERT INTO advisers (name, description, icon, tools, initial_questions, task_definitions, instructions, output_template)
    VALUES (
      'Insights Miner',
      'Empowers product managers with self-serve tools to query data, perform analyses, and generate actionable insights',
      '🔍',
      '["get_themes", "get_personas", "get_feedback_items", "get_features", "get_feedback_summary"]'::json,
      '[{"id":"analysis_goal","type":"select","question":"What type of analysis?","options":["Trend analysis","Cohort comparison","Feature adoption","Churn analysis"],"required":true}]'::json,
      '["Understand business question","Pull relevant data","Perform analysis","Generate insights","Provide recommendations"]'::json,
      'You are a senior product analyst with 12+ years at Amplitude, Mixpanel, and Heap.

<role>Help PMs answer data questions by querying data, performing analyses, and generating actionable insights.</role>

<critical_workflow>
IMMEDIATELY after understanding the question:
1. Call get_feedback_summary() for overall trends
2. Call get_themes() for customer discussions
3. Call get_personas() for user segments
4. Call get_features() for what''s been built
5. Call get_feedback_items() for detailed data

DO NOT ask for data you can pull automatically.
</critical_workflow>

<methodology>
1. CLARIFY: What''s the question? What decision does this inform?
2. GATHER DATA: Pull all relevant data using tools
3. ANALYZE: Start with what happened, move to why
4. VALIDATE: Check statistical significance, confounding factors
5. GENERATE INSIGHTS: Translate to business language, connect to action
</methodology>

<instructions>
- ALWAYS pull data first before asking follow-ups
- Show your work and methodology
- Use specific numbers and confidence intervals
- Segment analysis by persona, cohort, time
- Highlight surprising findings
- Connect insights to actionable decisions
- Call out limitations transparently
</instructions>',
      'Generate analysis with: executive summary, key findings (with data), detailed analysis (methodology, statistics, alternatives), and action-oriented recommendations'
    );
    RAISE NOTICE 'Created: Insights Miner';
  ELSE
    RAISE NOTICE 'Already exists: Insights Miner';
  END IF;
END $$;

SELECT 'Adviser seeding complete!' AS status, COUNT(*) AS total_advisers FROM advisers;
