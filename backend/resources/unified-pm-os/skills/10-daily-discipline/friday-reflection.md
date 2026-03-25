# Friday Reflection

## Purpose

Internal weekly wrap-up. Reviews the week against the plan, identifies patterns, archives the sweep log, updates narrative inventory, and prompts for unlogged decisions. Not an external update -- this is for the user's own strategic awareness.

---

## When to Use

- Friday afternoon or end of the last working day of the week
- User says "Friday reflection" or "weekly wrap"
- Part of the weekly cadence defined in .clinerules

---

## Process

### Step 1: Read Current State

Read these files:
- `context/task-board.md` -- Three Things That Matter, sweep log, all tiers
- `context/work-context.md` -- projects, capacity, signals
- `context/decision-log.md` -- any decisions logged this week

### Step 2: Week vs. Plan Assessment

Compare the Three Things That Matter (set Monday) against what actually happened:

> **Three Things That Matter this week:**
> 1. [Thing 1] -- [Did it happen? What was the outcome?]
> 2. [Thing 2] -- [Did it happen? What was the outcome?]
> 3. [Thing 3] -- [Did it happen? What was the outcome?]
>
> **Hit rate:** [X/3]

If hit rate is low, explore why:
- Were the priorities wrong? (Planning issue)
- Did fires consume the week? (Capacity issue)
- Did new high-leverage work displace them? (Might be fine)

### Step 3: Wins and Impact

Surface the week's most impactful moments:
> **Biggest win this week:** [What had the most impact?]
> **Visibility moment:** [Did leadership see any of your work this week?]
> **Leverage play:** [What 1:many work got done?]

### Step 4: Pattern Scan

Look for recurring themes across the sweep log:
- **Time allocation:** How much went to 🟡 vs. ⚪? Is the ratio healthy?
- **Interrupt pattern:** Were there repeated context switches? From what source?
- **Capacity trend:** Is the board growing or shrinking? Sustainable?
- **Relationship signals:** Any relationships that need attention?

### Step 5: Decision Audit

> **Decisions made this week (logged):** [List from decision log]
> **Decisions made this week (not logged):** [Prompt user -- "Did you make any calls this week that aren't in the decision log?"]

If unlogged decisions surface, log them now.

### Step 6: Narrative Update

Check if any of this week's work should be added to the Narrative Inventory in work-context.md:
- High-visibility wins
- Strong decisions with clear reasoning
- Framework or process contributions
- Cross-functional alignment moments

### Step 7: Archive and Reset

1. Archive the week's sweep log to `archive/weekly/YYYY-MM-DD-sweep-log.md`
2. Clear the sweep log section in task-board.md
3. Move completed items older than 2 weeks from ⬛ to archive/completed-items.md

### Step 8: Work Context Quick Refresh

- Any project status changes this week?
- New relationships or stakeholders?
- Capacity shift?
- Update "Last Updated" date in work-context.md

---

## Output

Write the reflection to `outputs/friday-reflection-YYYY-MM-DD.md` with this structure:

```markdown
# Friday Reflection -- [Date]

## Week vs. Plan
[Step 2 output]

## Wins
[Step 3 output]

## Patterns
[Step 4 output]

## Decision Audit
[Step 5 output]

## Narrative Updates
[Step 6 output -- what was added]

## Next Week Preview
[What's on deck? Any known 🔴 items? What should the Three Things be?]
```

---

## Rules

1. **Honest, not performative.** This is for the user, not an audience. A week where the plan fell apart is useful data.
2. **Short.** 10 minutes of reflection, not an hour of writing.
3. **Always archive.** The sweep log must be archived every week. Non-negotiable.
4. **Prompt for decisions.** Most people undercount their decisions. Ask explicitly.
5. **End forward-looking.** Close with next week's preview so Monday's reset is easy.
