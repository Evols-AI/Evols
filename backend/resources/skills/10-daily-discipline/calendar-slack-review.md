# Calendar & Messaging Review

## Purpose

Workflow for processing calendar exports and messaging conversation dumps. Turns a block of raw scheduling and communication data into triaged action items, meeting prep needs, and task board updates.

---

## When to Use

- User provides a calendar export or screenshot
- User provides messaging conversation exports or summaries
- Weekly review of upcoming calendar
- Processing a backlog of unread messages
- Any time the user says "process this" with a raw dump

---

## Step 1: Ingest and Categorize

### For Calendar Events

Scan each event and categorize:

| Category | Criteria | Action |
|----------|----------|--------|
| **🔴 Prep Required** | High-stakes meeting, exec-facing, decision point | Create prep doc in outputs/ |
| **🟡 Strategic** | Advances key projects, alignment conversations | Note key objectives |
| **🔵 Relationship** | 1:1s with key stakeholders, skip-levels | Review relationship notes in work-context |
| **⚪ Routine** | Recurring syncs, standups, info-sharing | Assess if still needed |
| **❌ Decline Candidate** | Low value, no clear purpose, could be async | Flag for potential decline |

### For Messaging Conversations

Scan each thread/DM and categorize:

| Category | Criteria | Action |
|----------|----------|--------|
| **🔴 Urgent Response** | Blocking someone, time-sensitive, exec-facing | Respond immediately |
| **🟡 Thoughtful Response** | Requires analysis, strategic implications | Queue for focused time |
| **🔵 Relationship Touch** | Check-in, congratulations, relationship maintenance | Batch into sweep |
| **⚪ FYI / Acknowledge** | Read receipt, quick confirmation, no action needed | Quick sweep |
| **❌ Ignore** | Noise, not relevant, someone else will handle | Skip |

---

## Step 2: Extract Action Items

Use the Action Item Harvester skill on any items that contain tasks, commitments, or follow-ups. Feed the output back into the task board.

---

## Step 3: Meeting Prep Triage

For any 🔴 (Prep Required) meetings:

1. Check: Is there an existing prep doc in outputs/?
2. If not: Create one using the Meeting Prep Generator skill
3. If yes: Update with any new context from messaging threads
4. Add "Prep for [meeting]" to the task board at the appropriate tier

---

## Step 4: Calendar Hygiene

Flag these patterns:
- **Meeting stacking:** 3+ back-to-back meetings with no break -> suggest declining or moving one
- **Recurring meetings without clear value:** -> suggest auditing or declining
- **Missing prep time:** High-stakes meetings without prep blocks before them -> suggest adding prep blocks
- **Boundary violations:** Meetings outside stated working hours -> flag for decline
- **Double-booked slots:** -> flag for resolution

---

## Step 5: Write Updates

1. **Task board:** Add new action items to appropriate tiers
2. **Sweep log:** Note what was processed and key decisions
3. **Outputs:** Generate any needed prep docs
4. **Work context:** Update if new information about projects or relationships surfaced

---

## Output Format

```markdown
## Calendar & Messaging Review -- [Date Range]

### Meetings Requiring Prep
| Meeting | Date | Stakes | Prep Status |
|---------|------|--------|-------------|
| [Name] | [Date] | [High/Med/Low] | [Created/Updated/Existing] |

### Action Items Extracted
[Output from Action Item Harvester]

### Decline Candidates
| Meeting/Thread | Reason | Suggested Action |
|---------------|--------|-----------------|
| [Name] | [Low value / duplicate / not needed] | [Decline / Convert to async / Delegate] |

### Calendar Health Notes
- [Any patterns flagged from Step 4]

### Messages Requiring Response
| Priority | From | Topic | Suggested Response |
|----------|------|-------|-------------------|
| 🔴 | [Name] | [Topic] | [Brief response direction] |
| 🟡 | [Name] | [Topic] | [Brief response direction] |
```

---

## Rules

1. **Process, don't just list.** The user doesn't need a summary of what's on the calendar -- they need decisions about what to do about it.
2. **Be opinionated about declines.** If a meeting doesn't serve the Three Things That Matter, flag it.
3. **Batch messaging responses.** Group ⚪ items into a single sweep window recommendation.
4. **Protect deep work.** If the calendar shows no open blocks for 🟡 work, flag this as a capacity issue.
5. **Cross-reference work context.** Use project and relationship context to assess meeting importance accurately.
