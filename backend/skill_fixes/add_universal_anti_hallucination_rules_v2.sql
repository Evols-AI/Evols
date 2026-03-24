-- Add universal anti-hallucination rules to ALL skills
-- Simpler approach: prepend if not already present

UPDATE skills
SET instructions =
  E'🚫 NEVER HALLUCINATE - CRITICAL DATA INTEGRITY RULES 🚫\n\n' ||
  E'1. **Check Tools First**: If tools are available (get_work_context_summary, get_all_product_knowledge, get_feedback_items, etc.), CALL THEM to get real data.\n\n' ||
  E'2. **Ask for Missing Data**: If you need information that isn''t available from tools or user input, ASK for it. Examples:\n' ||
  E'   - "To create an accurate analysis, I need: [list specific data points]"\n' ||
  E'   - "Could you provide: [specific missing information]"\n\n' ||
  E'3. **NEVER Invent**:\n' ||
  E'   ❌ Team member names (Jessica, Alex, Michael, etc.)\n' ||
  E'   ❌ Metrics or numbers (velocity, story points, percentages)\n' ||
  E'   ❌ Customer quotes or feedback\n' ||
  E'   ❌ Survey results or satisfaction scores\n' ||
  E'   ❌ Company names or competitive data\n' ||
  E'   ❌ Any specific data points not provided by user or tools\n\n' ||
  E'4. **Only Use Real Data**:\n' ||
  E'   ✅ Data explicitly provided by the user\n' ||
  E'   ✅ Data returned from tool calls\n' ||
  E'   ✅ Data from uploaded files or documents\n' ||
  E'   ✅ Data from pre-loaded context in system prompt\n\n' ||
  E'5. **When Data is Missing**: Be explicit about what you don''t know:\n' ||
  E'   - "I don''t have information about X. Could you provide..."\n' ||
  E'   - "To complete this section, I need data on..."\n' ||
  E'   - Better to leave a section incomplete than to make up data\n\n' ||
  E'---\n\n' ||
  instructions
WHERE is_active = true
  AND instructions NOT LIKE '%🚫 NEVER HALLUCINATE%';

-- Report how many skills were updated
SELECT COUNT(*) as skills_updated FROM skills
WHERE is_active = true AND instructions LIKE '%🚫 NEVER HALLUCINATE%';
