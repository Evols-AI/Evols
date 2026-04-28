---
title: "Debugging Agentic AI: Why Multi-Tool Workflows Fail in Ways That Are Hard to See"
description: "Agentic AI introduces a category of failure that does not announce itself — tasks that complete normally while being procedurally wrong. The debugging tools for traditional software have to be significantly extended to work here."
date: 2026-04-26
author: Akshay Saraswat
authorRole: Founder, Evols
readingTime: 16 min read
tags: [Agentic AI, Engineering, AI Quality]
---

There is a category of production failure that experienced engineers have learned to dread more than others: the failure that doesn't announce itself.

A service returning 500s is bad, but it's immediately visible. A memory leak that builds slowly over days is harder to catch. A race condition that manifests under specific load patterns is harder still. These failures have one thing in common: they leave traces. You can find them if you look in the right place.

Agentic AI failures are different. An agent can complete a task — in the sense that it produces output and terminates normally — while having done something procedurally wrong along the way. The output passes surface evaluation. The logs show success. The failure doesn't reveal itself until a human tries to use the result, or until the error propagates to a downstream step that expected the first step's output to be correct.

Research from early 2026 (Cao et al., arXiv:2603.03116) measured this directly: between 27% and 78% of benchmark-reported agent successes are what the authors call "corrupt successes" — tasks that appear completed based on output-level evaluation while containing violations of procedural integrity. The output is wrong, but the system doesn't know it.

This is the debugging problem that agentic AI introduces. It is not the same as debugging traditional software. The tools, methods, and mental models that work for traditional systems have to be significantly extended to work here.

---

## The Anatomy of an Agentic Failure

Before understanding how to debug agentic failures, it helps to understand what kinds of failures actually occur. A useful taxonomy has five categories:

**Model reasoning failures.** The model chose the wrong action given the available context. This is the failure that most people intuitively associate with AI errors: the model misunderstood the task, or made a faulty inference, or was confused by ambiguous instructions. Model reasoning failures are not always obvious in logs because the model's output looks coherent — the failure is in the choice, not in the expression of the choice.

**Tool invocation failures.** The model identified the correct tool but called it incorrectly: wrong parameters, wrong sequence, wrong assumptions about the tool's state. Research on LLM-based API integrations (Maninger et al., arXiv:2509.20172) found that in tasks requiring API calls, none of the evaluated open-source models solved more than 40% of tasks correctly — with hallucinated endpoints, incorrect argument usage, and API rule violations as the primary failure modes. Models call APIs they've invented. They pass arguments that look plausible but aren't valid. The call fails or returns garbage, and the agent proceeds.

**Environmental failures.** The infrastructure beneath the agent changed. An API schema was updated. A service was temporarily unavailable. A rate limit was hit. The agent called a real tool with correct parameters and got an unexpected response. In a simple system, environmental failures are easy to detect because they produce clear error codes. In agentic systems that span multiple APIs, these failures can produce partial results that look like success.

**State propagation failures.** Context was lost or corrupted between steps. Agentic workflows pass information forward through context — the output of step 3 becomes part of the input to step 4. When that propagation fails, step 4 proceeds without the information it needed. It may produce output anyway — output that is confidently wrong rather than an error.

**Cascade failures.** An early error produced output that was plausible-but-wrong. Downstream steps treated it as correct and built on it. By the time the final output is evaluated, it may be multiple layers of reasoning removed from the original error. Cascade failures are the hardest to debug because the observable failure point is distant from the actual failure point.

Research by Shi Qiu et al. (arXiv:2603.27646) benchmarking agents on physics research tasks found a failure mode they described as "fabrication of output data" — agents generating plausible-looking results rather than signaling failure. This is cascade failure in its most dangerous form: the agent invents a number and continues.

---

## Why Standard Debugging Methods Don't Transfer

Debugging traditional software assumes that the same input produces the same output. A bug is reproducible. You can bisect the problem: run the code, find the failure, narrow the conditions, identify the line.

Agentic AI systems violate this assumption fundamentally.

A study measuring agent behavioral consistency (Mehta, arXiv:2602.11619, February 2026) ran 3,000 agent runs across identical inputs using three different LLM backbones and found that ReAct-style agents produce between 2 and 4.2 distinct action sequences per 10 runs on the same input. Tasks where the agent behaved consistently had 80–92% accuracy. Tasks where the agent was highly variable — more than 6 distinct paths on 10 runs — had only 25–60% accuracy. The gap was 32 to 55 percentage points depending on the model.

The debugging implication: a failure you observed may not reproduce on the next run. The agent took a different path. If you add logging to the next run, the logging itself may change the agent's behavior by altering the context. The tools don't have a stable execution path to instrument.

There's no call stack. Traditional stack traces locate failures precisely because program execution is sequential and deterministic. An agentic workflow spans model inference calls, tool invocations, API responses, and state management — across potentially multiple systems, with the model making routing decisions at each step. When something goes wrong, there is no canonical "line 47 in auth_service.py" to blame. The failure is in the interaction between components, not in any component alone.

Logs live in multiple places. The orchestration layer logs what the agent decided to do. The model layer logs what prompt was sent and what was returned. Each tool logs its own execution. The infrastructure underneath each tool has its own logs. Correlating these across systems to reconstruct what actually happened in a specific failing run requires either heroic manual effort or purpose-built tooling that doesn't come standard with any agent framework.

---

## The Current Observability Landscape and Its Gaps

A small ecosystem of observability tools has emerged specifically for LLM and agent applications. The gap between what these tools offer and what production agentic debugging requires is significant.

**Langfuse** captures structured traces of agent runs — the exact prompt sent, the model's response, token usage, latency, and tool invocations in nested form. It's the equivalent of application logging with a schema designed for AI workloads. What it doesn't offer: anomaly detection, evaluation of agent behavior relative to expected behavior, or alerts when an agent is taking unusual paths.

**Weights and Biases Weave** offers "trace trees purpose-built for agentic systems" and online evaluation scoring of live production traces. The visualization of agent rollouts for identifying issues is genuinely useful. Gap: full multimodal support is still in development; the evaluation framework is useful but requires you to define what "correct" looks like in advance, which is hard for complex multi-step tasks.

**Arize Phoenix** provides embeddings-based clustering and isolation of failures, with pre-built evaluation templates. The open-source, self-hosted model is appealing for teams with data residency concerns. Gap: no real-time alerting or anomaly detection mentioned in their documentation.

**AgentSight** (Zheng et al., arXiv:2508.02736) takes a different architectural approach: using eBPF to monitor agents at system boundaries without code instrumentation, with less than 3% performance overhead. It can detect prompt injection attacks, identify resource-wasting reasoning loops, and surface coordination bottlenecks in multi-agent systems. It's a research prototype, not a production product — but it represents the kind of zero-overhead, non-invasive observability that production agentic systems will eventually need.

The common gap across all of these tools: they require you to know what to look for. They capture data; they don't diagnose failures. They tell you what happened; they don't tell you whether what happened was correct. For cascade failures — where the output looks plausible but was produced via a corrupted chain — current observability tools have limited ability to detect the problem without you already knowing where to look.

---

## The Four Layers You Need to Instrument

Adequate observability for an agentic system requires instrumentation at four distinct layers. Most teams start with one or two and discover the others when they encounter failures they can't explain.

**The orchestration layer.** What did the agent framework decide to do at each step? Which tool was selected, and why? What was the agent's current state representation when it made the decision? This is the layer closest to the agent's "reasoning" — it tells you what the agent thought it was doing.

For agentic systems built on top of Claude Code or similar tools, hooks are the primary instrumentation surface at this layer: events that fire at session start, at each prompt submission, at session end, and on failure. These hooks capture what the agent was told to do and what it reported back.

**The model layer.** What exact prompt was sent to the model? What was the complete response? What were the token counts and latency? This layer is necessary for diagnosing model reasoning failures — you cannot evaluate why the model made a wrong choice without seeing the exact context it was given. Prompt truncation, context ordering, and instruction clarity problems are only visible here.

**The tool execution layer.** What API call was made, with what parameters? What was the exact response? How long did it take? What was the HTTP status code? This layer is the source of truth for tool invocation failures and environmental failures. It's also where you catch the gap between what the model thought it called and what actually happened — the API call that failed silently, the response that looked like success but contained a meaningful error in the body.

**The state layer.** What did the session know before each step? What did it know after? When the agent passes context from step N to step N+1, what actually got passed? State propagation failures are only diagnosable here, because they live in the transition between steps rather than in any single step.

Most agent frameworks make it easy to instrument the model layer (everything passes through the model, and logging the inputs and outputs is straightforward). They make it moderately easy to instrument the orchestration and tool layers with middleware. The state layer is the hardest, because "what the agent knew at each point" requires capturing context windows — which are large, expensive to log verbatim, and require semantic understanding to interpret rather than just reading.

---

## Debugging Patterns That Work

**Binary search through agentic step sequences.** When you have a failing run and you know approximately where in the sequence the failure occurred, bisect: test the agent with inputs that start at the midpoint of the sequence rather than the beginning. If the failure reproduces, the problem is in the second half; if it doesn't, the problem is in the first half. This requires the ability to initialize the agent at arbitrary points in its workflow, which requires state to be serializable — a good architectural practice for reasons beyond debugging.

**Input/output isolation testing per step.** Take the inputs and outputs you have from a specific run and test each step in isolation. Does step 3 produce the expected output given its specific inputs? Does step 4 behave correctly when given exactly what step 3 produced? This converts a multi-step failure into a set of single-step evaluation problems, which are tractable even for non-deterministic systems (run each step multiple times and look at the distribution of outputs).

**The frozen session technique for non-determinism.** For failures that don't reproduce reliably, capture the complete state of the session at the point of failure — context window, current step, all prior outputs — and freeze it. Then run the failing step repeatedly from this identical starting point and measure the distribution of outcomes. If the failure reproduces consistently from the frozen state, you've isolated the source. If it doesn't, the failure depends on state that you haven't captured, which tells you what to instrument next.

**Trace ID propagation.** Every agent run should have a unique trace ID that propagates across all tool calls and all system boundaries. When a failure occurs, you should be able to search your logs for the trace ID and retrieve the complete record of every action taken in that run, across every system, in chronological order. This sounds obvious and is frequently absent. Teams that haven't built trace ID propagation routinely spend significant time reconstructing run histories that should have been automatic.

---

## What to Instrument First When Starting From Scratch

If you're building an agentic system and have no observability yet, instrument in this order:

**1. Complete prompt and response logging at the model layer.** Every prompt, every response, every token count. This is cheap to add, requires no changes to agent logic, and gives you the foundation for every other diagnostic. Without this, you are debugging with one hand tied behind your back.

**2. Tool call logging with parameters and responses.** Every call to every tool: what was sent, what was returned, and how long it took. This should include errors, timeouts, and unexpected response formats — not just successful calls.

**3. Step-level state snapshots.** At each decision point in the agentic workflow, log a representation of the agent's current state. This doesn't have to be the full context window — a structured summary of key state variables is often sufficient and is much cheaper to store and query.

**4. Trace IDs across all systems.** Generate a trace ID at the start of each agent run, propagate it to every tool call, every API call, every downstream service. Log it everywhere. Make searching by trace ID the standard first step in any debugging investigation.

**5. Anomaly baselines.** After you have enough run data, establish baselines for normal agent behavior: typical step counts, typical token consumption per step, typical latency per tool, typical success rate per step. Failures that deviate significantly from these baselines are worth investigating even before they produce user-visible errors.

---

## The Harder Truth About Agentic Observability

The research on agentic failure rates is sobering. Benchmark task completion rates in the 50% range (Lu et al., ASE 2025), zero end-to-end success rates on complex physics tasks (Qiu et al.), 23% incorrect tool sequencing on industrial benchmarks (Das et al., arXiv:2604.01532) — these are not edge cases. They are the current state of agentic AI on complex real-world tasks.

No amount of observability changes these numbers. Observability tells you why something failed; it doesn't prevent the failure. The value of better instrumentation is that it transforms debugging from a forensic reconstruction — trying to figure out what happened from incomplete evidence — into a targeted diagnosis where you have the evidence you need.

The teams shipping agentic systems in production right now are mostly doing so with under-instrumented systems. Not because they don't care about observability, but because the tooling is new, the frameworks are immature, and there are no widely-adopted standards for what "good" agentic observability looks like. The AgentOps research (Dong et al., arXiv:2411.05285) surveying the observability landscape in late 2024 found that existing tools have "incomplete lifecycle coverage" — they instrument parts of the agentic workflow but not the whole.

The teams that will have the best production agentic systems in two years are the ones that are building the observability infrastructure now, before they need it urgently. Debugging a production agentic failure at 2am without trace IDs, without state snapshots, and without tool call logs is a specific kind of miserable experience. The investment to avoid it is available today, even if the tooling isn't yet as mature as you'd want.

---

*Akshay Saraswat is the founder of Evols and has spent over a decade shipping products at scale at Samsung, VMware, and Amazon. He writes about the infrastructure that agentic AI teams need to build reliable systems. If you're navigating agentic observability problems or want to compare notes on what's working, reach out at akshay@evols.ai.*
