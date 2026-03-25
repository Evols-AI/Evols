# Document Accelerator

## Purpose

Templates and workflows for creating PM documents. Pre-populates with context from work-context.md. Covers common document types: PR/FAQ, decision documents, strategy briefs, project updates, and more.

---

## Document Types

### 1. PR/FAQ (Press Release / Frequently Asked Questions)

**When:** Proposing a new product, feature, or initiative. Working backwards from the customer.

**Structure:**
```markdown
# [Product/Feature Name]

## Press Release

**[City, Date]** -- [Company/Team] today announced [product/feature], a [one-sentence description] that enables [target customer] to [key benefit].

[Customer problem paragraph -- what's painful today]

[Solution paragraph -- what this product does and why it matters]

"[Customer quote -- fictional, from target persona]" said [Name, Title]. "[How this changes their world]."

[How it works paragraph -- high level]

[Availability and next steps]

## FAQ

### Customer FAQ
1. **Q: What is [product]?**
   A: [Answer]

2. **Q: Who is this for?**
   A: [Answer]

3. **Q: How is this different from [alternative]?**
   A: [Answer]

### Internal FAQ
1. **Q: How does this fit our strategy?**
   A: [Answer]

2. **Q: What are the key risks?**
   A: [Answer]

3. **Q: What's the investment required?**
   A: [Answer]
```

### 2. Decision Document

**When:** Making or proposing a significant product, technical, or organizational decision.

**Structure:**
```markdown
# Decision: [Title]

**Date:** [Date]
**Author:** [Name]
**Stakeholders:** [Names]
**Decision needed by:** [Date]

## Context
[What's the situation? What prompted this decision?]

## Problem Statement
[What specifically needs to be decided? One clear sentence.]

## Options

### Option A: [Name]
- **Description:** [What this option entails]
- **Pros:** [Benefits]
- **Cons:** [Risks/costs]
- **Effort:** [Rough estimate]

### Option B: [Name]
[Same structure]

### Option C: [Name]
[Same structure]

## Recommendation
[Which option and why. Be specific about the reasoning.]

## Tradeoffs We're Accepting
[What we're giving up with this choice]

## Reversibility
[How easy is this to undo if we're wrong?]

## Next Steps
[If approved, what happens immediately?]
```

### 3. Strategy Brief

**When:** Articulating a strategic direction, investment thesis, or vision for a workstream.

**Structure:**
```markdown
# [Strategy Name]

**Author:** [Name]
**Date:** [Date]
**Audience:** [Who this is written for]

## Executive Summary
[3-5 sentences: What, why, and so what]

## Current State
[Where are we today? What's working? What isn't?]

## The Opportunity
[What's the market/customer/organizational opportunity?]

## Strategic Direction
[Where are we going? What's the thesis?]

## Key Bets
1. [Bet 1]: [Why we believe this]
2. [Bet 2]: [Why we believe this]
3. [Bet 3]: [Why we believe this]

## What We Won't Do
[Equally important -- what are we explicitly choosing not to pursue?]

## Success Metrics
[How will we know this is working? 6-month and 12-month markers]

## Key Risks
[What could go wrong? What are we watching for?]

## Resource Requirements
[What do we need to execute?]
```

### 4. Project Status Update

**When:** Regular cadence update for stakeholders on a project.

**Structure:**
```markdown
# [Project Name] -- Status Update [Date]

**Status:** [Green / Yellow / Red]
**Owner:** [Name]

## Summary
[2-3 sentences: Where are we and what matters]

## Progress Since Last Update
- [Accomplishment 1]
- [Accomplishment 2]

## Next Milestones
| Milestone | Target Date | Status |
|-----------|------------|--------|
| [Milestone 1] | [Date] | [On track / At risk / Blocked] |
| [Milestone 2] | [Date] | [On track / At risk / Blocked] |

## Risks & Blockers
| Risk | Impact | Mitigation |
|------|--------|-----------|
| [Risk 1] | [H/M/L] | [What we're doing about it] |

## Asks
- [Any decisions, resources, or help needed from the audience]
```

---

## Drafting Process

1. **Read work-context.md** -- pull project details, stakeholder list, and strategic framing
2. **Identify the audience** -- adjust depth, framing, and emphasis accordingly
3. **Draft using the template** -- fill in what you know, flag gaps for the user
4. **Review with the user** -- present the draft and iterate before finalizing
5. **Write to outputs/** -- save as `[doc-name]-YYYY-MM-DD.md`

---

## Rules

1. **Pre-populate aggressively.** Use work context to fill in as much as possible before asking the user for input. They should be editing, not starting from scratch.
2. **Flag what's missing.** Use `[TODO: ...]` markers for anything you can't infer.
3. **Match the stakes to the effort.** A Slack update doesn't need a full doc. A VP-facing strategy doesn't need to be rushed.
4. **The executive summary is the document.** Everything below it is supporting evidence. If someone only reads the first paragraph, they should get 80% of the value.
5. **Be opinionated in drafts.** It's easier for the user to edit a strong position than to make decisions from a neutral one.
