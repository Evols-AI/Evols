# Meeting Prep Generator

## Purpose

Generates meeting prep documents calibrated to meeting type, stakes, and participants. Pulls from work context for project details and relationship dynamics.

---

## Meeting Types

### 1:1 with Manager
**Focus:** Career, priorities, blockers, relationship maintenance
**Prep template:**
```markdown
# 1:1 with [Manager] -- [Date]

## My top 3 this week
1. [Priority 1 -- status]
2. [Priority 2 -- status]
3. [Priority 3 -- status]

## Updates to share
- [Key progress or wins worth mentioning]

## Discussion topics
- [Topic I want their input on]
- [Decision I need their support for]

## Asks
- [Anything I need from them]

## Career / development
- [Optional -- only if there's something to discuss]
```

### 1:1 with Peer / Cross-Functional Partner
**Focus:** Alignment, dependencies, relationship building
**Prep template:**
```markdown
# 1:1 with [Name] -- [Date]

## Shared context
- [What we're both working on / where our work intersects]

## My updates relevant to them
- [Progress on shared initiatives]

## Questions for them
- [What I need to understand about their work]

## Alignment topics
- [Anything we need to agree on or coordinate]
```

### Skip-Level / Executive Meeting
**Focus:** Visibility, strategic alignment, concise impact
**Prep template:**
```markdown
# Meeting with [Executive] -- [Date]

## Context
- [Why this meeting exists / what they care about]
- [Their known priorities relevant to my work]

## Key messages (3 max)
1. [Most important thing they should walk away knowing]
2. [Second point]
3. [Third point]

## Potential questions and answers
- Q: [Likely question] -> A: [Prepared answer]
- Q: [Likely question] -> A: [Prepared answer]

## Ask (if any)
- [What I need from them -- be specific]
```

### Project/Strategy Review
**Focus:** Status, decisions, forward-looking
**Prep template:**
```markdown
# [Project] Review -- [Date]

## Attendees and their stakes
| Person | Role | What they care about |
|--------|------|---------------------|
| [Name] | [Role] | [Their priority] |

## Current status: [Green/Yellow/Red]
- [Key facts about where we are]

## Decisions needed
- [Decision 1]: [Options and recommendation]

## Risks to raise
- [Risk]: [Impact and mitigation]

## Demo / walkthrough plan
- [What to show, in what order]
```

### Brainstorm / Working Session
**Focus:** Clear problem statement, productive structure
**Prep template:**
```markdown
# [Topic] Working Session -- [Date]

## Problem statement
[What are we trying to solve? One clear sentence.]

## Context
[What participants need to know going in]

## Starting point / hypothesis
[Where I think we should start -- gives the group something to react to]

## Questions to answer
1. [Question 1]
2. [Question 2]

## Success criteria
[What does "good" look like at the end of this session?]
```

---

## Generation Process

1. **Identify meeting type** from the calendar event or user description
2. **Read work context** for project status, relationship dynamics, and recent decisions
3. **Read task board** for current priorities and recent completions relevant to the meeting
4. **Check for prior prep docs** in outputs/ for recurring meetings
5. **Generate prep doc** using the appropriate template
6. **Write to outputs/** as `[meeting-name]-prep-YYYY-MM-DD.md`

---

## Rules

1. **Prep is about confidence, not completeness.** The goal is for the user to walk in knowing their top 3 points and likely questions.
2. **Anticipate questions.** For exec meetings especially -- what will they ask? Prepare the answer.
3. **Reuse prior prep.** For recurring 1:1s, check the last prep doc and build on it.
4. **Time-box the prep.** 5 minutes for routine 1:1s, 15 minutes for exec-facing, 30 minutes for strategy reviews.
5. **Always include the ask.** If the user wants something from this meeting, it should be explicit in the prep.
