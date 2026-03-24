-- Update sprint-plan to actually create tasks using add_task tool

UPDATE skills
SET instructions = REPLACE(
  instructions,
  E'9. **Define the sprint goal**: A single, clear sentence that captures the sprint''s primary value delivery.',
  E'9. **Create tasks in the task board**:

After presenting the sprint plan, CALL add_task for each committed story to create actual tasks:

For each story in your plan:
```
add_task(
  title="[Story title from your plan]",
  description="Story points: [X]\\n\\nAcceptance Criteria:\\n- [Key criteria]\\n- [Key criteria]",
  status="todo"
)
```

Example:
- If your plan has "Fix Android 13 launch crash (21 pts)", create a task with that title
- Include story points and key details in the description
- Set status="todo" for all sprint stories

This ensures tasks appear on the user''s task board, not just in the document.

10. **Define the sprint goal**: A single, clear sentence that captures the sprint''s primary value delivery.'
)
WHERE name = 'sprint-plan';

-- Verify update
SELECT CASE
  WHEN instructions LIKE '%9. **Create tasks in the task board**%' THEN 'SUCCESS: Task creation instructions added'
  ELSE 'FAILED: Instructions not updated'
END as status
FROM skills
WHERE name = 'sprint-plan';
