-- Remove hardcoded scope sections from skills
-- These are no longer needed since skills now have access to the skill catalog

UPDATE skills
SET instructions = regexp_replace(
  instructions,
  E'## Scope\n\n\\*\\*This skill creates PRDs only\\.\\*\\* If the user asks for:\n- Sprint planning → Tell them: "For sprint planning, use @sprint-plan which will help estimate capacity and select stories\\."\n- Roadmapping → Tell them: "For roadmap planning, use @roadmap which will help prioritize initiatives\\."\n- Prioritization scoring → Tell them: "For feature scoring, use @rice-score or @prioritize-features\\."\n\nDo NOT attempt to create sprint plans, roadmaps, or prioritization frameworks\\. Stay focused on creating comprehensive PRDs\\.\n\n',
  '',
  'g'
)
WHERE name = 'create-prd';

-- Verify the update
SELECT name, LEFT(instructions, 200) as preview
FROM skills
WHERE name = 'create-prd';
