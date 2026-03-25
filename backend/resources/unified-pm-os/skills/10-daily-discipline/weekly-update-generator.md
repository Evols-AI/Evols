# Weekly Update Generator

## Purpose

Generates concise weekly status updates for the user's manager or team. Pulls from the task board (completed items, sweep log) and work context (projects, milestones) to create a scannable, impact-oriented update.

---

## When to Use

- End of week (Friday or Monday morning for the prior week)
- User says "weekly update" or "write my status update"
- As part of the Friday Reflection workflow

---

## Format

```markdown
# Weekly Update -- [Date Range]

## Highlights
- [Most impactful accomplishment this week -- lead with this]
- [Second highlight]
- [Third highlight if applicable]

## Progress by Project

### [Project 1]
- [What happened] -> [What it means / why it matters]
- Next: [What's coming next week]

### [Project 2]
- [What happened] -> [What it means / why it matters]
- Next: [What's coming next week]

## Decisions Made
- [Decision]: [One-line rationale]

## Next Week Focus
1. [Top priority]
2. [Second priority]
3. [Third priority]

## Risks / Needs Attention
- [Only include if there are genuine risks or asks -- don't pad this section]
```

---

## Generation Process

1. **Read task board** -- scan ⬛ (completed/dropped) items and the sweep log for the week
2. **Read work context** -- check active projects for milestone progress
3. **Read decision log** -- check for decisions logged this week
4. **Synthesize** -- group accomplishments by project, lead with impact
5. **Draft** -- write the update in the format above
6. **Present for review** -- user edits and sends

---

## Rules

1. **Impact over activity.** "Shipped the integration" not "Had 5 meetings about the integration." What moved, not what you did.
2. **3-5 highlights max.** If everything is a highlight, nothing is. Be selective.
3. **No fluff.** If a project had no meaningful progress, don't pad it. Saying "no significant updates" is fine.
4. **Risks are real or absent.** Don't invent risks to look diligent. Only include genuine concerns.
5. **One page max.** If the reader can't get the full picture in 60 seconds, it's too long.
6. **Next week's focus = Three Things That Matter.** Pull directly from the task board.
7. **Match the audience.** If the manager wants more detail, expand. If they want brevity, trim harder.

---

## Output

Write to `outputs/weekly-update-YYYY-MM-DD.md`
