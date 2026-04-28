---
title: "The Hidden Coordination Tax of Async AI Work"
description: "AI makes individual work faster, which shrinks the natural coordination windows that kept teams aligned. The result is more duplicated work, more integration conflicts, and a coordination tax that grows as the tools improve."
date: 2026-04-25
author: Akshay Saraswat
authorRole: Founder, Evols
readingTime: 13 min read
tags: [Team AI, Coordination, Engineering]
---

A scenario that is now common enough to be mundane: two engineers on a team are both working on an infrastructure problem. They don't know the other is working on it. They each spend a few hours with AI assistance — investigating the issue, building a mental model, developing a solution. They both write code. One of them opens a pull request on Thursday. The other opens theirs on Friday and discovers in the review that the work has been duplicated.

The immediate reaction is coordination failure — someone should have checked. This is true. But the more structurally important observation is: this kind of failure is predictable, systematic, and getting more common as AI tools make it cheaper and faster to do work independently.

The speed that AI tools bring to individual work does not solve the problem of knowing what work is already being done. In some ways it makes it worse. The time between "deciding to work on something" and "producing meaningful output" used to be long enough that natural coordination happened — someone would ask a question in Slack, mention it in standup, notice a related PR in progress. At AI speeds, work that would have taken a day happens in an hour. The coordination mechanisms that worked when work was slow enough to observe are now too slow to matter.

---

## What the Research on Coordination Costs Says

Before AI became a significant factor in developer workflows, coordination overhead was already substantial and largely invisible.

Research conducted at UC Irvine (cited in an Atlassian analysis from 2022) found that after an interruption, it takes an average of 23 minutes and 15 seconds to return to the original task at full capacity. Context switches impose a 40% decrease in productivity for developers who experience frequent interruptions — and up to 9% of work time goes to reorientation after switching between tools, windows, or workstreams. The global economic estimate for context-switching-related lost productivity is approximately $450 billion annually (Atlassian, 2022).

These numbers were measured in pre-AI workflows. They capture the cost of coordination friction — the overhead of integrating individual work into collective output. AI tools haven't reduced that friction. They've changed where it appears.

The Microsoft 2024 Work Trend Index, surveying 31,000 knowledge workers across 31 countries, found that 68% struggle with pace and volume of work and that workers spend 60% of their time on email, chat, and meetings, leaving only 40% for the core work those tools are supposed to support. The coordination layer consumes three-fifths of knowledge worker time.

AI tools help with the 40%. They do nothing for the 60%.

---

## The Three Forms Coordination Tax Takes in AI-Native Teams

The coordination tax in AI-native work is structurally different from the coordination tax in traditional software development, because AI tools change the nature of individual output rather than just its speed.

**Duplicated AI work.** The infrastructure example above. Two developers independently investigate the same problem, build context about it, and produce solutions. The duplication isn't just the final code — it's the entire upstream process. Both developers paid the cost of understanding the problem and developing an approach. That cost was paid twice, and the second time produced a conflict rather than additional value.

This is distinct from traditional duplicate work in a critical way: the cost is hidden. When two developers write the same function, the duplication is visible in the code. When two developers do the same AI-assisted investigation, the duplication is visible only in the conversation history of two AI sessions — which no one is reading.

**Context reconstruction at handoff.** A developer completes a feature and hands it to QA. The developer's AI session contains extensive reasoning about edge cases, the specific failure modes they considered, the constraints that shaped the implementation. The QA engineer's AI session starts cold. They ask the AI to help them think through test cases. The AI generates generic test cases for a generic version of this feature. The QA engineer then iterates toward the specific cases that matter — spending time recreating the investigation that the developer's session already did.

The handoff looks clean. A PR was reviewed. Documentation was written. But the reasoning context didn't transfer. The QA engineer's first hour of work is partially a reconstruction of work the developer already did.

**Synchronization overhead disguised as review overhead.** Code review in AI-native teams has changed character. The increase is measurable: research by Xu et al. (arXiv:2510.10165, accepted to IEEE, 2025) found that after Copilot adoption, experienced core developers reviewed 6.5% more code — while their own original coding productivity dropped by 19%. The additional review load is real and it comes with a specific character: more code to review that requires more context to evaluate.

This is partly an AI code quality issue. It is also a coordination issue. Code generated quickly by AI in isolation often makes assumptions that conflict with work being done in parallel by other developers. The review process is where those conflicts surface — but surfacing conflicts at review time is more expensive than preventing them during development.

---

## Conway's Law in the Age of AI

Melvin Conway's 1968 observation — "any organization that designs a system will produce a design whose structure is a copy of the organization's communication structure" — applies to AI tooling with an interesting twist.

Conway's Law has historically been used to explain why software architecture reflects org charts: teams build software that mirrors how they communicate, for better or worse. Martin Fowler's documentation of the "Inverse Conway Maneuver" describes how teams deliberately restructure their communication patterns to encourage the software architecture they want.

Applied to AI tools: if every developer uses an AI tool that is architecturally isolated — no shared state, no visibility into what other developers' sessions are doing, no mechanism for session outputs to influence other sessions — the software produced by those tools will carry the imprint of that isolation. Each developer's AI is optimizing locally, without knowledge of what adjacent sessions are producing. The integration points, the inconsistencies, the duplications — these are not random. They reflect the communication structure of the tooling layer.

This is not a criticism of any specific AI tool. It is an observation about architecture. AI tools designed for individual use will produce individual-optimized outputs. The coordination tax is the price of that architecture.

---

## Measuring What You Can't See

One of the reasons coordination tax in AI-native work is so persistent is that it's hard to measure. Traditional duplicate work shows up in code. Traditional context-switching tax shows up in productivity measurements. AI coordination tax mostly doesn't.

Some proxy signals are visible if you know to look for them:

**PR age and revision count.** Pull requests that require extensive back-and-forth revision often reflect coordination failures that happened during development. The review is surfacing conflicts that could have been prevented by earlier coordination.

**Inter-developer question volume.** When developers are doing AI-assisted work in isolation and then integrating, synchronous questions spike at integration time. If standup and Slack show developers asking lots of "did you already handle X" and "what approach did you take for Y" questions, that's a signal that context isn't flowing during development.

**Repeated investigation of the same problems.** When two different developers, in the same month, each open Claude or Copilot and ask the AI to help them understand the same legacy service or the same infrastructure constraint, that's coordination overhead. Neither developer may know the other investigated it. No current tool surfaces this pattern.

**Review latency on AI-assisted PRs.** Research (GitClear, 2024) projected that AI-generated code churn — lines reverted or substantially updated within two weeks of authoring — would double in 2024 compared to 2021 baselines. Code churn is expensive because it means review cycles that surfaced problems that coordination during development could have prevented.

None of these are perfect measures. But teams that are paying attention to them can distinguish healthy coordination from the invisible tax.

---

## Five Structural Patterns That Reduce Coordination Tax

These are organizational and process changes, not tool dependencies. They're available to any team willing to design around the problem.

**Make AI work visible before it's done.** The most effective pattern: before a developer starts an AI-intensive investigation, they post a brief note in a shared channel — "working on understanding the auth service latency issue, checking X and Y." This takes 30 seconds and prevents the most common duplication scenario. The discipline required is low; the value when it prevents four hours of duplicated work is high.

**Treat AI session outputs as handoff artifacts, not just code review artifacts.** When a developer hands work to QA or to another engineer, the handoff should include the key findings from their AI work, not just the code. A brief summary of what was investigated, what was ruled out, and why the chosen approach was selected. This doesn't have to be exhaustive — a few sentences is usually enough to prevent the first hour of reconstruction by the receiving developer.

**Designate investigation leads for significant ambiguous problems.** When a problem is complex enough that multiple developers might investigate it, explicitly assign one person to lead the AI-assisted investigation and share findings before others start parallel work. This is standard practice for research tasks in most teams but often breaks down for technical investigations because they feel like they're "just work."

**Add an async coordination checkpoint before long AI sessions.** For sessions expected to take more than a couple of hours, a 5-minute check — has anyone else worked on this recently, are there related sessions in progress — has an asymmetric return. The check is cheap; the collision it prevents is expensive.

**Build integration points into the AI workflow, not just the code review workflow.** The current model: developers work independently, then integrate at code review. The coordination model that reduces tax: intermediate integration points during development, where developers share what their AI sessions have produced before writing the final implementation. This isn't a sync meeting — it can be async. But it moves conflict detection earlier, where it's cheaper to resolve.

---

## What the Tooling Needs to Do That It Doesn't

The organizational patterns above work when teams apply them with discipline. They are manual workarounds for a tooling gap.

What would make them unnecessary is AI tools that surface coordination signals automatically. Not in a surveillance sense — not monitoring what developers are doing and reporting to managers — but in the same way a code editor highlights a merge conflict: making visible, at the moment when it matters, that work is overlapping.

Some version of: "You're about to investigate the auth service rate limiting behavior. Two weeks ago, a colleague spent 3 hours on the same question and their findings are available."

This requires session knowledge to persist beyond the individual session. It requires that persistence to be shared in a way that can be queried when relevant. It requires relevance matching that can connect a new investigation to a previous one based on topic and codebase context, not just keyword search.

None of this is technically impossible. It's architecturally absent from the current generation of tools.

The coordination tax will remain invisible and unpriced until the tooling layer can see across sessions and across developers. At that point, preventing duplicated AI work becomes a feature rather than a discipline problem. The teams that figure this out first, whether through tooling or through uncommonly good process, will show the performance gap that eventually makes the tooling category inevitable.

---

*Akshay Saraswat is the founder of Evols. He has led product teams at Samsung, VMware, and Amazon, and has spent too many hours watching coordination failures happen in slow motion. He writes about the infrastructure layer that AI-native teams need. Reach him at akshay@evols.ai.*
