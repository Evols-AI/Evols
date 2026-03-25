# Context Refresh

## Purpose

Cross-file consistency audit and staleness detection. Ensures the PM OS context files are current, consistent, and not misleading the agent. Run monthly or when something feels off.

---

## When to Use

- Monthly system health check
- User says "context refresh" or "system check"
- After a significant change (reorg, new project, role shift)
- When agent advice seems out of date

---

## Audit Process

### Step 1: Staleness Check

Read all three context files and check dates:

| File | Last Updated | Stale If Older Than |
|------|-------------|-------------------|
| work-context.md | [Check "Last Updated"] | 2 weeks |
| task-board.md | [Check latest sweep log] | 3 days |
| decision-log.md | [Check latest decision date] | 2 weeks (unless no decisions made) |

Flag anything overdue.

### Step 2: Cross-File Consistency

Check for contradictions:

- **Projects in work-context vs. task board:** Are all active projects represented in both? Are there task board items for projects not listed in work-context?
- **Relationships in work-context vs. communication drafter:** Are audience profiles consistent with relationship descriptions?
- **Capacity assessment vs. task board reality:** Does the stated capacity match the actual board load?
- **Open decisions in work-context vs. decision log:** Have any open decisions been resolved but not moved to the log?
- **Three Things That Matter vs. actual tier distribution:** Is what the user says matters reflected in where time is going?

### Step 3: Completeness Check

Verify each section of work-context.md has current content:

- [ ] Role & Position -- still accurate?
- [ ] Working Model -- hours, boundaries, time sinks still current?
- [ ] Active Projects -- all listed? Statuses current? Any completed projects still listed?
- [ ] Key Relationships -- anyone missing? Any dynamics changed?
- [ ] Capacity Assessment -- reflects reality?
- [ ] Signals & Landscape -- still relevant? New signals to add?
- [ ] Open Decisions -- resolved ones to move? New ones to add?
- [ ] Narrative Inventory -- any recent wins to capture?

### Step 4: File Health Check

| File | Target Lines | Current Lines | Status |
|------|-------------|--------------|--------|
| task-board.md | < 350 | [Count] | [OK / Needs pruning] |
| work-context.md | < 300 | [Count] | [OK / Needs pruning] |
| decision-log.md | < 800 | [Count] | [OK / Needs archiving] |

If any file exceeds its target, propose specific pruning actions.

### Step 5: Skill File Relevance

Quick scan of skill files:
- Are audience profiles in communication-drafter.md still current?
- Any new recurring workflows that should become a skill?
- Any skills that haven't been used in a month? (May indicate a gap between the system and actual usage)

---

## Output

Present findings to the user as a structured report:

```markdown
# Context Refresh -- [Date]

## Staleness Report
| File | Last Updated | Status |
|------|-------------|--------|
| [File] | [Date] | [Current / Stale / Critical] |

## Consistency Issues
- [Issue 1]: [What's contradictory and where]
- [Issue 2]: [What's contradictory and where]

## Completeness Gaps
- [Gap 1]: [What's missing or outdated]

## File Health
| File | Lines | Target | Action Needed |
|------|-------|--------|--------------|
| [File] | [N] | [Target] | [None / Prune / Archive] |

## Recommended Updates
1. [Most important update]
2. [Second update]
3. [Third update]

## Questions for You
- [Anything that requires user input to resolve]
```

After user confirms, make the updates directly.

---

## Rules

1. **Don't update without confirmation.** Present findings first, then update after the user agrees.
2. **Prioritize accuracy over completeness.** Better to have fewer sections that are accurate than comprehensive content that's stale.
3. **Flag misleading content.** If a section could cause the agent to give bad advice, that's the top priority to fix.
4. **Keep it fast.** This should take 10-15 minutes, not an hour. Scan, flag, fix.
