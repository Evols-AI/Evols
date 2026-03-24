-- Make task creation MANDATORY and more explicit in sprint-plan

UPDATE skills
SET instructions = REPLACE(
  instructions,
  '9. **Create tasks in the task board**:

After presenting the sprint plan, CALL add_task for each committed story to create actual tasks:

For each story in your plan:
```
add_task(
  title="[Story title from your plan]",
  description="Story points: [X]\n\nAcceptance Criteria:\n- [Key criteria]\n- [Key criteria]",
  status="todo"
)
```

Example:
- If your plan has "Fix Android 13 launch crash (21 pts)", create a task with that title
- Include story points and key details in the description
- Set status="todo" for all sprint stories

This ensures tasks appear on the user''s task board, not just in the document.

10. **Define the sprint goal**: A single, clear sentence that captures the sprint''s primary value delivery.',
  '9. **Define the sprint goal**: A single, clear sentence that captures the sprint''s primary value delivery.

10. **MANDATORY: Create tasks by calling add_task for EVERY story**:

⚠️ THIS IS REQUIRED - NOT OPTIONAL ⚠️

After you present the sprint plan above, you MUST call add_task for EACH committed story.

For EVERY story in your sprint plan, make ONE add_task call:

add_task(title="Story title", description="Story points: X\n\nAcceptance Criteria:\n- Criteria", status="todo")

Example - If your plan has 3 stories, you MUST make 3 tool calls:
1. add_task(title="Fix Android 13 launch crash", description="Story points: 21\n\nCritical path item\n\nAcceptance Criteria:\n- Zero crashes on Android 13\n- Launch time <2s", status="todo")
2. add_task(title="Implement iOS background call mode", description="Story points: 13\n\nAcceptance Criteria:\n- Calls persist when app backgrounded\n- No audio interruption", status="todo")
3. add_task(title="Resolve WebRTC screenshare freezes", description="Story points: 8\n\nAcceptance Criteria:\n- No freezing during screenshare", status="todo")

DO NOT write the sprint plan without creating the tasks.
Tasks make the plan actionable - they appear on the user''s task board ready for execution.'
)
WHERE name = 'sprint-plan';

-- Verify
SELECT CASE
  WHEN instructions LIKE '%10. **MANDATORY: Create tasks by calling add_task%' THEN 'SUCCESS'
  ELSE 'FAILED'
END as status
FROM skills
WHERE name = 'sprint-plan';
