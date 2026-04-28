---
title: "Why AI Costs Scale Faster Than Productivity Does — and What to Do About It"
description: "AI tool costs scale with usage volume, session complexity, and model capability — three variables that each grow faster than most teams forecast. The productivity curve is logarithmic; the cost curve is closer to linear."
date: 2026-04-27
author: Akshay Saraswat
authorRole: Founder, Evols
readingTime: 14 min read
tags: [AI Costs, ROI, Team AI]
---

The first thing most teams experience when they start measuring AI costs is surprise. The per-user subscription feels reasonable. The monthly invoice doesn't.

This gap has a predictable structure. It's not that AI tools are more expensive than advertised. It's that the cost growth curve has properties that differ from the productivity growth curve in ways that don't become apparent until you're past the early adoption phase.

A 10-person engineering team using Claude Code with midrange plans might spend around $2,000 per month. That's $24,000 per year — real money, but plausibly justified by productivity gains. Now scale to 100 engineers. The naive calculation says $240,000 per year. The actual cost is higher, for reasons that are structural rather than accidental.

Understanding those reasons requires understanding not just what AI tools cost, but how usage patterns change as teams scale, mature, and push the tools harder.

---

## The Three Growth Curves That Create the Gap

AI tool costs scale with three independent variables, each of which grows faster than teams typically forecast.

**Usage volume.** Adoption curves for AI tools are steep. The Microsoft 2024 Work Trend Index found that among knowledge workers who use AI, 46% began using it within the previous six months — usage nearly doubled in a single six-month window. Once developers discover that AI tools are useful for a problem class, they use them for that problem class consistently. What starts as occasional use for unfamiliar territory becomes daily use across the full workflow. Per-user costs that are stable during a trial period grow significantly once the tool is integrated into daily habits.

**Session complexity.** As developers become more sophisticated users, the tasks they send to AI become more complex. Early use cases are typically contained: "write a test for this function," "explain what this regex does." Advanced use cases are context-heavy and multi-turn: "here is the entire authentication service, help me redesign the token refresh logic to handle these three edge cases we've been hitting in production." Context-heavy sessions consume dramatically more tokens than simple queries. A developer who started with average sessions of 5,000 tokens may be running sessions of 50,000 tokens a year later — not because the tool changed, but because their usage pattern matured.

**Model capability consumption.** The newest and most capable models cost significantly more per token than previous generations. Current pricing for Claude Opus 4.7 is $5 per million input tokens and $25 per million output tokens. That's a substantial reduction from Claude Opus 4.1, which cost $15 input / $75 output. But as models improve, developers migrate to the latest versions for the most valuable work, while costs per session remain high for complex tasks. Anthropic's new Opus 4.7 tokenizer also consumes up to 35% more tokens for identical text compared to previous models — a cost escalation that happens without any visible change in the interface.

The compound effect: usage volume doubles, session complexity triples, and capable model consumption stays constant. The total token consumption is 6x what it was at initial deployment, while the value created hasn't necessarily grown proportionally. The productivity curve is logarithmic; the cost curve is closer to linear or superlinear.

---

## Where Tokens Actually Go

Most teams, when asked where their AI token budget goes, focus on output — the responses the models generate. This is the visible part of AI cost. The invisible part is often larger.

**Input token asymmetry.** For complex development tasks, input tokens typically exceed output tokens by a significant ratio. Sending a 40,000-token context window (a large codebase section, a set of prior conversation messages, a detailed system prompt) to get a 2,000-token response means the cost is heavily weighted toward input. Claude Sonnet 4.6, for example, charges $3 per million input tokens and $15 per million output tokens — but if every request involves 20x more input tokens than output, the input cost dominates total spend.

**The context repetition problem.** This is the one that surprises most teams. In a typical development workflow, the same context gets sent to the model repeatedly. A developer working on an authentication service sends the full service context in every request during their session. If that context is 20,000 tokens and they make 30 requests in a session, they've sent 600,000 tokens of context repetition for a single coding session, on top of whatever tokens the actual work consumes.

Anthropic's prompt caching feature addresses this directly: cached reads cost 10% of the standard input rate. But cache write costs 2x the standard rate for a 1-hour cache, and teams that don't actively manage caching strategy pay full price for context that gets resent repeatedly. The savings are available; capturing them requires implementation work that is rarely prioritized during initial deployment.

**Background vs. foreground usage.** Many AI platforms include features that run in the background — auto-completions, proactive suggestions, ambient monitoring. These run continuously without explicit developer action and can consume a significant fraction of quota invisibly. Teams that have visibility into explicit usage (prompts sent) often lack visibility into passive consumption.

---

## The Optimization Work Nobody Budgets For

There is a non-obvious cost category in AI deployment that doesn't show up on the invoice: the engineering time spent optimizing prompt efficiency, managing context, and tuning usage patterns to stay within budget.

This work is real, it's skilled, and it's not what you hired your engineers to do.

The DORA 2024 report found that teams adopting AI see individual productivity gains while "software delivery stability and throughput" at the team level can decline. One reason is that the optimization overhead — debugging AI suggestions, fact-checking outputs, tuning prompts for quality — consumes time that offsets the speed gains. The net result in controlled measurement is closer to 10% throughput improvement than the 50%+ commonly claimed.

The Deloitte 2026 State of Generative AI in the Enterprise report found that while 66% of organizations report productivity gains, only 20% have grown revenue through AI. The gap between perceived productivity improvement and measurable business outcome is partly explained by the untracked cost of optimization work: developers spend time making AI tools work well, and that time doesn't get counted against the benefit calculation.

Specific optimization categories that require engineering effort:

**Prompt engineering for token efficiency.** Getting reliable results with shorter prompts requires iteration and testing. Some teams have developed internal guidelines, templates, and prompt libraries that achieve better results per token than ad hoc prompting. Building these libraries takes time that is typically attributed to general productivity rather than to AI cost management.

**Context caching strategy.** Implementing cache warming, managing cache invalidation, and designing application flow to maximize cache hit rates is meaningful engineering work. The benefit is real — 90% reduction in cost for cache reads — but the implementation is not free.

**Model routing.** Using Claude Haiku 4.5 (at $1/$5 input/output per million tokens) for tasks that don't require Sonnet or Opus capabilities can reduce costs by 5–15x for appropriate task types. Building routing logic that makes the right model selection automatically requires defining what "appropriate" means for each task type and implementing the selection logic. Teams that do this well have much better cost-to-value ratios than teams that default to the most capable model for everything.

---

## A Framework for Forecasting AI Costs as Teams Scale

The standard financial model for AI tool cost — headcount times per-user subscription price — captures only one component. A more accurate model has five variables:

**Base subscription cost.** Number of active users times per-user subscription price. This is the floor, not the total.

**Overage and premium model cost.** For teams where heavy users regularly exceed their plan's included capacity, overage charges can equal or exceed base subscription costs. This is especially common on plans where the base includes unlimited use of standard models but charges for premium model access.

**Context repetition multiplier.** Estimate the average tokens sent per session (including repeated context) and compare it to the average tokens that would be sent with effective caching. On teams without caching, this multiplier is often 3–5x versus a well-optimized baseline.

**Optimization labor cost.** Engineering hours spent on prompt optimization, cache management, model routing, and quality review of AI outputs. Track this explicitly for at least one quarter to get a realistic figure. It is typically 5–15% of total engineering time in teams with mature AI usage.

**Opportunity cost of rate limits.** When developers hit rate limits mid-task and stop working while they wait for the limit to reset, that's lost productivity. For teams where 30% of developers hit limits regularly (per the Pragmatic Engineer's April 2026 survey), the productivity cost of limit interruptions is real and usually uncounted.

Adding these components typically produces a total cost 2–4x the base subscription figure. This is why the per-user subscription price feels reasonable but the total cost doesn't.

---

## Five Cost Reduction Levers and Their Trade-offs

These levers are ordered roughly from lowest to highest implementation cost.

**1. Prompt caching.** For applications where the same base context is sent repeatedly, implementing prompt caching can reduce costs by 80–90% for the cached portion. The trade-off is cache management complexity: stale context in the cache can produce worse results than fresh context. Cache invalidation logic has to be designed carefully.

**2. Model tiering.** Identifying task types that can be handled effectively by smaller models and routing those tasks accordingly. The trade-off is capability reduction for some tasks: the smaller model is cheaper because it's less capable, and the capability gap matters for complex tasks. The routing logic has to be accurate, or you end up using the expensive model unnecessarily or using the cheap model for tasks where the results are worse.

**3. Usage visibility and team-level management.** Giving team leads visibility into per-developer usage patterns creates opportunities to redistribute capacity and identify optimization opportunities. This has almost no direct cost trade-off, but it has an implementation overhead: someone has to build the monitoring, define the metrics, and create a process for acting on them.

**4. Context compression.** Building summarization layers that reduce context to the minimum necessary for each task. Instead of sending a 40,000-token codebase section, send a 5,000-token summary of the relevant portions. The trade-off is information loss: the summary may omit context that turns out to matter. Building good compression requires understanding which context is necessary for which task types — domain knowledge that is task-specific and hard to generalize.

**5. Background task scheduling.** Moving non-time-sensitive AI work to off-peak hours when capacity is cheaper or when daily limits have more headroom. The trade-off is latency: the result isn't available immediately. For tasks like documentation generation, test case creation, and code analysis, overnight turnaround is often acceptable. For interactive development, it isn't.

---

## What the Mature AI Teams Are Doing Differently

Teams that have maintained AI investment without experiencing cost blowouts have generally done three things that less mature teams haven't.

They track costs at task-type granularity, not just aggregate spend. They know which kinds of work are expensive per value unit (complex multi-turn debugging sessions) and which are cheap (single-turn code generation for well-specified tasks). This knowledge drives allocation decisions: expensive task types get investment in caching and context management; cheap task types get expanded without concern.

They treat AI cost management as an engineering discipline with the same rigor as infrastructure cost management. The pattern that works in cloud cost optimization — measure, baseline, target, optimize — applies directly to AI token cost management. Teams that do this have developed internal tooling: dashboards, cost alerts, usage reports that attribute spend to the task types and developers generating it.

They build prompt quality into their development process rather than treating it as an afterthought. High-quality prompts — specific, well-contextualized, appropriately scoped — produce better results per token than vague prompts that require multiple clarifying exchanges. Teams with internal prompt libraries and review practices for high-value prompts get more value per dollar than teams where every developer starts from scratch.

The Microsoft 2024 Work Trend Index found that 59% of leaders cannot quantify AI productivity gains. The teams that are managing costs well can, because they built the measurement infrastructure as part of the deployment, not after the fact. Measurement isn't just useful for managing costs — it's what lets you make the case that the costs are justified.

---

*Akshay Saraswat is the founder of Evols. He has shipped products to millions of users at Samsung, VMware, and Amazon, and has watched AI cost management go from an afterthought to a budget line item across industries. If you're building the infrastructure to manage AI at team scale, he writes about it at evols.ai.*
