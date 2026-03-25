# Action Item Harvester

## Purpose

Extracts structured action items from unstructured input -- meeting notes, sync summaries, email threads, messaging conversations, or any text dump. Converts raw information into task board entries with proper tier categorization.

---

## Input Types

- Meeting notes (raw or summarized)
- Email threads or forwards
- Messaging conversation exports
- Calendar event descriptions
- Document comments or feedback
- Voice memo transcriptions
- Brain dumps

---

## Extraction Process

### Step 1: Scan for Action Signals

Look for these patterns in the raw input:

- **Explicit assignments:** "You need to...", "[Name] will...", "Action item: ..."
- **Commitments made:** "I'll follow up on...", "Let me get back to you about..."
- **Requests received:** "Can you...?", "We need you to...", "Please..."
- **Deadlines mentioned:** "By Friday", "Before the next sync", "EOD"
- **Decisions that require follow-up:** "We decided to..." (implies someone needs to execute)
- **Open questions:** "We still need to figure out...", "TBD", "Parking lot"
- **Dependencies:** "Blocked on...", "Waiting for...", "Once [X] is done..."

### Step 2: Structure Each Item

For each action item found, capture:

| Field | Description |
|-------|------------|
| **Task** | What needs to be done (clear, actionable verb) |
| **Owner** | Who is responsible (you or someone else) |
| **Source** | Where this came from (meeting name, thread, doc) |
| **Deadline** | When it's due (explicit or inferred) |
| **Context** | Why it matters (one line) |
| **Dependencies** | What needs to happen first |

### Step 3: Categorize for the Task Board

For items where the user is the owner, assign a tier:

- 🔴 **Critical Today** -- Has a hard deadline today or tomorrow, or blocks others
- 🟡 **High Leverage** -- Creates 1:many impact, advances a strategic initiative
- 🔵 **Stakeholder** -- Important relationship maintenance, exec-visible
- ⚪ **Sweep Queue** -- Quick follow-up, routine response, small ask
- 🟣 **Backlog** -- No urgency, park for later review

For items owned by others:
- Track as a **dependency** or **waiting-on** item if it blocks the user's work
- Otherwise, note it in the sweep log but don't add to the task board

### Step 4: Present and Confirm

Show the user the extracted items grouped by tier before writing to the task board. Ask:
> "Here's what I pulled from [source]. Review the categorization -- anything in the wrong tier, missing, or that should be dropped?"

### Step 5: Write to Task Board

After confirmation, add items to `context/task-board.md` in the appropriate tier sections.

---

## Output Format

```markdown
## Action Items from [Source] -- [Date]

### Your Items (for task board)
| Tier | Task | Deadline | Context |
|------|------|----------|---------|
| 🔴 | [Task description] | [Date] | [One-line context] |
| 🟡 | [Task description] | [Date] | [One-line context] |
| ⚪ | [Task description] | [Date] | [One-line context] |

### Others' Items (for tracking)
| Owner | Task | Deadline | Blocks You? |
|-------|------|----------|-------------|
| [Name] | [Task] | [Date] | [Yes/No -- what's blocked] |

### Decisions Made (for decision log)
- [Decision]: [Brief context]

### Open Questions (for follow-up)
- [Question]: [Who needs to answer? By when?]
```

---

## Rules

1. **Be aggressive about extraction.** Better to surface too many items and let the user prune than to miss something.
2. **Infer deadlines when possible.** "Before the next sync" = the day before the next recurring meeting.
3. **Flag decisions separately.** Decisions that were made should be offered to the decision log, not just the task board.
4. **Don't duplicate.** Check the task board for existing items before adding -- update existing items rather than creating duplicates.
5. **Separate signal from noise.** Not every sentence in a meeting note is an action item. Focus on commitments, assignments, and open loops.
