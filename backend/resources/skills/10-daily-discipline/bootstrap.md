# Bootstrap Skill -- PM OS First-Run Onboarding

## Purpose

This skill guides a new user through populating their PM operating system context files for the first time. It transforms an empty template into a personalized, grounded operating system through a structured conversation.

## When to Use

- First time opening the PM OS workspace
- Context files are empty or contain only template placeholders
- User says "bootstrap", "set up", "first time", or "let's get started"

## Process Overview

The bootstrap has 5 phases, each populating a specific part of the system. Complete them in order. The whole process takes 15-30 minutes.

1. **Role & Identity** -> Populates "Context: Who the User Is" in `.clinerules` and header of `work-context.md`
2. **Strategic Landscape** -> Populates Projects, Capacity, and Signals sections of `work-context.md`
3. **Key Relationships** -> Populates Key Relationships section of `work-context.md`
4. **Brain Dump** -> Populates `task-board.md` with initial task queue
5. **System Activation** -> Confirms setup, explains daily rhythm, does first sweep

---

## Phase 1: Role & Identity (5 minutes)

### Ask the user:

> Let's set up your PM OS. I'll ask you some questions to build your context files. This takes about 15-30 minutes and you'll be fully operational after.
>
> **First -- tell me about your role:**
> 1. What's your title and level? (e.g., Senior PM, Staff Engineer, L6 TPM)
> 2. What team/org are you on? What does it do?
> 3. Who is your direct manager?
> 4. What is the team size and shape? (How many PMs, engineers, designers, etc.?)
> 5. Has anything major changed recently? (Reorg, layoff, new leadership, team merge?)

### Then ask about working model:

> **Now tell me about how you work:**
> 1. What are your typical working hours? Any hard boundaries? (e.g., "I stop at 5:30 for family time")
> 2. What does your communication environment look like? (Slack-heavy? Email-heavy? Meetings-heavy?)
> 3. What's your biggest time sink right now?
> 4. Is there anything you want this system to help you protect? (Focus time, evenings, specific days?)

### Write to:
- `.clinerules` -> Update the "Context: Who the User Is" section with a concise paragraph
- `context/work-context.md` -> Populate the header section (Role, Team, Manager, Working Model)

---

## Phase 2: Strategic Landscape (5-10 minutes)

### Ask the user:

> **Now let's map your projects and strategic landscape.**
>
> For each active project or workstream you own or are heavily involved in, tell me:
> 1. Project name and one-line description
> 2. Current status (Green/Yellow/Red or your own framing)
> 3. What's the next milestone or deadline?
> 4. Who are the key stakeholders?
> 5. What's your specific role? (Owner, contributor, advisor, informed?)
>
> Don't worry about being complete -- we'll add more as they come up. Start with the top 3-5 things on your plate.

### Then ask about strategic signals:

> **What signals are you watching?**
> These are things happening around you that might change your priorities:
> - Leadership changes or reorgs in progress?
> - Budget / headcount decisions pending?
> - Competitive moves you're tracking?
> - Strategy shifts in your org?
> - Anything that makes you think "I should be paying attention to this"?

### Then ask about open decisions:

> **Are there any open decisions you're wrestling with right now?**
> Things where you know you need to decide but haven't yet. These could be:
> - Product direction choices
> - Staffing or resourcing decisions
> - Whether to take on or decline a new responsibility
> - Organizational or process changes

### Write to:
- `context/work-context.md` -> Populate Active Projects table, Signals section, and Open Decisions section
- Set initial Capacity Assessment (ask user: "On a scale of Sustainable / Stretched / Overloaded / Unsustainable, where are you right now?")

---

## Phase 3: Key Relationships (3-5 minutes)

### Ask the user:

> **Let's map the people who matter most to your work right now.**
>
> For each person, I need:
> 1. Name and role
> 2. Your relationship to them (manager, peer, skip-level, cross-functional partner, etc.)
> 3. What do they care about? What motivates them?
> 4. What's the current dynamic? (Strong, needs attention, new, complicated?)
> 5. Any specific communication preferences? (Prefers data, wants executive summary, needs context, etc.)
>
> Start with 3-5 people. Your manager, your closest collaborator, and the most important stakeholder for your biggest project.

### Write to:
- `context/work-context.md` -> Populate Key Relationships section

### Also ask:

> **Is there anyone you should be building a relationship with but aren't yet?**
> Someone who will matter in 6 months but isn't on your radar day-to-day?

Note these in a "Relationship Investments" subsection.

---

## Phase 4: Brain Dump (5-10 minutes)

### Ask the user:

> **Now let's get everything out of your head.**
>
> Tell me every task, to-do, follow-up, and open loop you can think of. Don't filter, don't organize, just dump. I'll sort it all into the task board tiers after.
>
> Include:
> - Things with deadlines
> - Things people are waiting on you for
> - Things you keep meaning to do
> - Messages you need to send
> - Documents you need to write
> - Meetings you need to prep for
> - Things you've been avoiding
> - Things you should probably say no to
>
> Go.

### After the dump, process everything:

For each item, categorize into:
- 🔴 **Critical Today** -- Hard deadline, real consequences if missed
- 🟡 **High Leverage** -- 1:many impact, compounds over time
- 🔵 **Stakeholder** -- 1:1 high-stakes, relationship-critical
- ⚪ **Sweep Queue** -- Small, batch-able, routine
- 🟣 **Backlog** -- Consciously parked
- ⬛ **Drop** -- Suggest dropping or delegating

### Present the categorization to the user for review:

> Here's how I'd categorize everything. Review this and tell me what's wrong -- what's in the wrong tier, what's missing, what should be dropped.

### After confirmation, write to:
- `context/task-board.md` -> Populate all tiers with the categorized items

### Then ask:

> **If you could only accomplish three things this week, what would they be?**

Write the answer to the "Three Things That Matter This Week" section of the task board.

---

## Phase 5: System Activation (2-3 minutes)

### Explain the daily rhythm:

> **Your PM OS is set up. Here's how to use it daily:**
>
> **Morning (2 minutes):** Start with "Morning. Let's check the board." I'll read your task board, confirm priorities, and surface the day's focus.
>
> **During the day:** When new things come in, tell me: "New task: [thing]. Where does this go?" I'll categorize and add it.
>
> **End of day (3 minutes):** Say "Sweep time" and tell me what you handled and what came in. I'll update the board.
>
> **Monday:** "Weekly reset." I'll do a full board review, backlog prune, and set the week's priorities.
>
> **Friday:** "Friday reflection." I'll review the week, archive the sweep log, and prompt for unlogged decisions.

### Do the first sweep:

> **Let's do your first morning sweep right now.**

Read the task board you just populated. Call out:
- The 🔴 items that need attention today
- The 🟡 item that deserves protected focus time
- Any ⚪ items that can be batched into a 30-minute sweep window
- Anything that looks like it should actually be dropped

### Write a sweep log entry:

Add a dated sweep log entry to the task board marking the system as bootstrapped.

### Offer the narrative seed:

> **One more thing. When your work is going well, what's the story you want your leadership to tell about you?**
>
> This seeds your Narrative Inventory -- the list of accomplishments, decisions, and impact moments that make your work legible to the organization. We'll build this over time as you log decisions and complete high-leverage work.

Write the answer to the Narrative Inventory section of work-context.md.

---

## Completion Checklist

Before declaring bootstrap complete, verify:

- [ ] `.clinerules` "Context: Who the User Is" section is populated
- [ ] `context/work-context.md` has: Role header, Active Projects, Key Relationships, Capacity Assessment, Signals, Open Decisions
- [ ] `context/task-board.md` has: Items in tiers, Three Things That Matter, first sweep log entry
- [ ] `context/decision-log.md` exists with empty template (ready for first entry)
- [ ] User understands the daily rhythm (morning sweep, during-day intake, end-of-day sweep)
- [ ] User knows the weekly cadence (Monday reset, Friday reflection)

### Final message:

> **You're operational.** Your context files are populated, your task board is set, and your first sweep is logged.
>
> Tomorrow morning, just say "Morning" and we'll pick up right where we left off. The system gets better the more you use it -- every sweep log entry, every decision logged, every brain dump processed makes the context richer and the advice more grounded.
>
> The most important habit: the morning and end-of-day sweeps. Even 2 minutes each builds the muscle. Everything else layers on top of that.
