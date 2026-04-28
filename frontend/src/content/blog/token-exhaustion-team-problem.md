---
title: "Token Exhaustion Is a Team Problem. Most Companies Are Still Treating It as a Personal One."
description: "When GitHubs rate-limiting bug was fixed in 2026, developers discovered they had been hitting caps all along. The real problem is that no team has visibility into collective AI capacity before work stops."
date: 2026-04-23
author: Akshay Saraswat
authorRole: Founder, Evols
readingTime: 12 min read
tags: [AI Costs, Team AI, Engineering]
---

In March 2026, GitHub's developer community forums lit up. Developers across the world discovered that their Copilot sessions were hitting rate limits mid-task — sometimes on the first prompt of the morning. The complaints were immediate and specific. One user reported being rate-limited after "one single unit test." Another wrote: "I just woke up and started my workday, and I've already triggered the usage limit." A third: "These rate limit changes are too drastic. I'm finding it nearly impossible to work efficiently anymore."

GitHub eventually explained what had happened: a bug in their rate-limiting system had been undercounting tokens from newer, more capable models. When the bug was fixed, the limits snapped back to their configured values — and users whose previous usage looked fine suddenly found themselves exceeding those limits with completely normal workflows.

The proximate cause was a bug. The underlying cause was something more structural.

Newer AI models consume significantly more tokens to do work. Context windows have expanded to a million tokens for models like Claude Opus 4.7 and Sonnet 4.6. Features that used to fit in 20,000 tokens now fill 80,000. Teams whose usage felt comfortable six months ago are now consistently running against limits they didn't know existed. And they have no visibility into any of this until the work stops.

But here's the part that gets almost no attention: while some developers hit limits mid-morning, others on the same team let their capacity expire unused at midnight.

Both are waste. Neither is visible. And every AI tool on the market today is designed to make this problem invisible.

---

## The Asymmetry Nobody Is Tracking

Rate limits are typically framed as a personal problem — you used too much, wait for the reset. This framing is accurate for individual tools used by individuals. It becomes a misdiagnosis when those tools are used across a team.

Consider what's actually happening in a typical 10-person technical team in 2026:

Two or three developers — the early adopters, the heavy users, the ones with the most complex workstreams — push against limits regularly. They hit caps mid-debugging-session, lose their context window, and spend 20 minutes reconstructing before they can continue. Their productivity looks like a graph with spikes and valleys.

Three or four developers use AI tools intermittently, at moderate intensity. They rarely hit limits. Their daily quota resets at midnight. Most of it goes unused.

The remaining three developers use AI tools lightly — mostly for autocomplete and quick questions. They are consuming a fraction of their allocated capacity.

What this means at the team level: the team's collective AI capacity is substantially larger than what any individual sees, and it is distributed very unevenly relative to who actually needs it. The developers doing the most complex AI-intensive work are the ones most likely to hit limits, while capacity expires unused by developers doing lighter work.

No tool today surfaces this. No interface shows a team lead that three developers hit limits yesterday while four others used less than 10% of their quota. There is no mechanism for a team to see its collective capacity, let alone redistribute it.

The Pragmatic Engineer's April 2026 survey of 900 software engineers found that approximately 30% of respondents had hit usage limits — but that number is an individual statistic. It doesn't capture whether the teammates of that 30% had unused capacity on the same day.

---

## How Rate Limits Actually Work (and Why They're Designed for One Person)

The mechanics of AI tool rate limiting were not designed with teams in mind. They were designed for individual users.

Anthropic's published rate limit documentation describes a token bucket algorithm: capacity replenishes continuously at a configured rate, with a ceiling. Individual tiers have specific limits — at the Tier 1 level, Claude Sonnet 4.6 allows 50 requests per minute and 30,000 input tokens per minute. Higher tiers scale up from there, with enterprise and invoiced accounts getting higher limits without monthly spend caps.

Context window sizes compound this: Claude Opus 4.7 and Sonnet 4.6 support up to 1 million tokens in context. The Anthropic documentation itself notes that "a single debugging session or codebase exploration might generate and consume tens of thousands of tokens" and that "LLM performance degrades as context fills." The advice for managing this is to clear context between tasks — effectively discarding the accumulated knowledge of the session to stay within limits.

GitHub Copilot uses a different model: premium request allowances with model multipliers. A prompt to a premium model costs between 0.25x and 7.5x a "premium request" depending on the model tier. Paid plan users who exhaust their premium request allowance can continue using included-tier models only, subject to rate limiting. The system is designed to grade usage, not share it.

The common architecture across these systems: individual allocation, individual visibility, individual limits. The team layer doesn't exist.

This creates the asymmetry that the March 2026 complaints were really expressing. Users weren't just frustrated about hitting limits — they were frustrated that "I pay $40 to you and you take away the most important model from my access" (a direct quote from the GitHub community thread) while having no way to understand whether their overall team was over or under-utilizing its collective capacity.

---

## What "Quota Blindness" Costs at Scale

Building a rough model of the cost:

A 10-person team using Claude Code with a midrange plan allocation. If each developer has, say, 100,000 tokens per hour of capacity and the team works an 8-hour day:

- Three heavy users consume 95% of daily capacity by 3pm and stop or degrade
- Four moderate users consume around 40% of daily capacity
- Three light users consume around 10% of daily capacity

Across 10 developers, assume an average of 50% utilization across the team. If the 30% who hit limits could access the unused capacity of the 50% who left capacity on the table, the team's effective output increases meaningfully — without any additional cost.

But the tools don't surface this. The team lead doesn't know. The heavy users don't know their colleagues have unused capacity. The budget conversation at month-end looks at aggregate spend, not at whether that spend was used efficiently.

At the enterprise scale, this compounds. The Pragmatic Engineer reported in April 2026 that Uber exhausted its entire 2026 AI token budget within three months — a concrete example of what happens when usage is invisible and uncoordinated at scale. Companies typically pay around $200 per month per user for "max" plans (Claude Code, Cursor), per the same survey. A 100-person engineering org with uneven utilization is paying for capacity that is simultaneously being wasted by some developers and unavailable to others.

---

## The Three Ways Teams Are Handling This Right Now

Teams are not ignoring the problem. They're working around it with the tools they have, which means the workarounds are manual, brittle, and imperfect.

**Manual tracking in spreadsheets or Notion.** Some teams have started logging daily AI usage, asking developers to self-report when they hit limits or when they finish early with capacity remaining. This creates awareness but no coordination mechanism — knowing that three people hit limits yesterday doesn't automatically redirect tomorrow's unused capacity.

**Blanket per-user limit reductions.** Teams worried about runaway costs sometimes set conservative limits for all developers to avoid surprise overages. This prevents cost blowouts but imposes artificial constraints on every developer, including the ones who would benefit most from using capacity intensively. The rationale is sound; the tradeoff is real.

**Shifting lower-priority tasks to off-peak hours.** More sophisticated teams identify work that can be done by AI without human supervision — test generation, documentation, code review prep — and schedule it to run overnight or during hours when primary usage is lower. This is a genuine solution to one part of the problem: it makes use of capacity that would otherwise expire. But it requires identifying those tasks in advance, maintaining the automation, and accepting the latency of next-morning delivery.

Each of these workarounds requires deliberate effort that falls outside normal development workflow. They work because individual developers and team leads care enough to build the discipline, not because the tools support it.

---

## What Good Team Quota Management Looks Like

The principles are not complicated. The implementation requires that the tooling layer care about the team as a unit, not just the individual.

**Collective visibility.** A team lead should be able to see, in real time, how much of the team's aggregate capacity is being used, by whom, and at what rate. The same way a finance dashboard shows team-level budget burn, not just individual expenses.

**Usage patterns over time.** Not just today's usage, but which developers consistently hit limits, which consistently under-use, and whether there are predictable patterns (limits hit mid-afternoon on Tuesdays when a particular kind of work happens). Pattern visibility is what makes the problem actionable rather than reactive.

**Intelligent redistribution.** When a developer is close to their limit mid-task, the system should know whether there is unused capacity available at the team level, and it should either surface that information or handle it automatically. The developer shouldn't have to stop work because of a limit that their team has the headroom to accommodate.

**Background task queuing.** Work that doesn't require real-time completion — documentation, test generation, code analysis — should be queued to run when capacity is available, whether that's during off-peak hours or when other developers have unused quota. This is the difference between capacity expiring unused and capacity completing the backlog.

None of this requires changing how AI tools work at the model level. It requires building a team-level management layer that the current tools don't have.

---

## The Deeper Problem the Complaints Were Pointing To

The GitHub community thread from March 2026 contains a comment that captures something beyond frustration about rate limits: "I don't mind the rate limiting so much as the disruption it causes."

The disruption isn't just that work stops. It's that context is lost. When a developer hits a rate limit mid-session, they lose the accumulated context of that session — the history of what was tried, the intermediate outputs, the reasoning chain. Even after the limit resets, they're starting over in a meaningful sense.

This is the connection between token exhaustion and the broader problem of AI work management. Rate limits create forced context resets. Forced context resets are an extreme version of the general problem: AI sessions generate knowledge that has to be rebuilt every time there's a break in continuity.

Managing quota at the team level isn't just about efficiency and cost. It's about preserving the continuity that makes AI work compound rather than reset. A team that manages quota well keeps its most intensive sessions continuous. A team that doesn't sacrifices context at the moments when context is most needed.

The March 2026 complaints were individually about rate limits. They were collectively about the absence of a team-level layer that treats AI capacity as a shared resource rather than an individual allowance.

That layer doesn't exist in any current tool. Which is why the complaints keep coming.

---

*Akshay Saraswat is the founder of Evols. He previously led product teams at Samsung, VMware, and Amazon. He writes about the infrastructure gaps in how teams use AI at work. If your team is navigating quota management or utilization visibility problems, he'd like to hear about it: akshay@evols.ai.*
