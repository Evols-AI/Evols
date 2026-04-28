---
title: "Multiplayer AI: The Category That Doesn't Exist Yet (But Will)"
description: "Every major productivity category follows the same arc: individual tools first, then a coordination layer that becomes the defensible platform. AI tooling is mid-transition and the multiplayer layer has not been built yet."
date: 2026-04-20
author: Akshay Saraswat
authorRole: Founder, Evols
readingTime: 14 min read
tags: [AI Strategy, Team AI, Product]
---

![Team AI](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*MY2HoyCaMToiqTvi.png)

Every major productivity category follows the same arc. First come tools for individuals, tools that help one person do their job faster, smarter, or with less friction. Then, as those tools become standard, teams realize the tools don’t talk to each other. A coordination layer has to be built. That layer eventually becomes the platform that everyone depends on.

Email begat shared inboxes and Slack. Word processors begat Google Docs and real-time collaboration. Code editors begat Git, then GitHub, then pull requests and team workflows. The individual tool came first; the team infrastructure came second. And it is the team infrastructure that becomes the defensible business, not the individual tool.

We are somewhere in the middle of this transition for AI tooling. And the coordination layer hasn’t been built yet.

---

## How This Pattern Has Always Played Out

![Historical pattern of coordination infrstructure](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*6XQGSx4Ok7J3xHYJ.png)

Understanding where we are with AI tools requires looking at how this transition happened in previous categories.

**Version control** is the cleanest example. Developers in the 1980s managed their own code on their own machines. CVS (1986) and then SVN (2000) were tools to help individuals track their own changes. Git (2005), created by Linus Torvalds for Linux kernel development, was still primarily an individual tool with better versioning, local operations, branching. Then GitHub launched in 2008, layering pull requests, code review workflows, issue tracking, and social features on top of Git. GitHub didn’t replace Git. It built the team coordination infrastructure that made Git usable at scale across organizations. Today GitHub has over 100 million registered developers. The individual tool and the coordination layer are both valuable, but the coordination layer is where the durable business lives.

**Documentation** followed the same arc. Word processors gave individuals the ability to produce professional documents. Google Docs (2006) didn’t make documents better, it made them collaborative. Real-time co-editing, commenting, suggestion mode, version history visible to the whole team. The shift wasn’t about the document; it was about what happened to the document after it was created.

**Communication** is perhaps the most dramatic example. Email gave individuals a way to send messages. Slack (2013) didn’t replace email, it added persistent channels, searchable history, shared context that anyone on the team could read. The individual message became team knowledge.

The pattern is consistent: individual tool → widespread adoption → coordination layer → that layer becomes the platform.

---

## Where AI Tooling Is Right Now

![Current state of AI Productivity](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*76HMtVTUxNNy-QZF.png)

The AI coding tool landscape in 2026 is essentially where individual code editors were in 1995 i.e. broadly adopted, genuinely useful, and designed entirely for one person at a time.

GitHub Copilot, Claude Code, Cursor, Kiro, Cline; each of these tools is exceptional at helping an individual developer write code faster. The Stack Overflow Developer Survey 2025, covering 49,000 respondents across 177 countries, found that 84% of developers use or plan to use AI tools. Among professional developers, daily AI tool usage is now the norm, not the exception.

But every one of these tools is architected the same way: one developer, one session, one context window. When that session ends, the context disappears. When the developer hands their work to a teammate, the teammate starts over.

GitHub tried to break this pattern early. In April 2024, they launched Copilot Workspace as a “technical preview”, a task-centric agentic environment where developers could go from GitHub issue to working code in natural language, with shared workspace links and collaborative features. It was the clearest attempt to build the team coordination layer on top of individual AI tooling. By 2025, it was quietly wound down. The current GitHub Copilot feature set includes agent mode, cloud agents, coding agents. It offers no persistent shared context between developers. The team layer hasn’t been rebuilt.

The DORA 2024 report, which surveyed thousands of software development professionals, found something that should have gotten more attention: AI tool adoption “significantly increases individual productivity, flow, and job satisfaction” while simultaneously “negatively impacting software delivery stability and throughput.” Individual metrics go up. Team metrics don’t. The tools are optimized for the wrong unit of analysis.

---

## What Makes AI Coordination Genuinely Harder Than Previous Categories

The obvious question is: if this pattern has played out reliably before, why hasn’t the coordination layer appeared yet for AI?

Three properties of AI tools make the coordination problem harder than it was for documents, code, or communication.

**The statefulness problem.** A Google Doc can be shared because it is a persistent object. That means, it exists on a server, can be linked to, can be edited simultaneously. An AI session is not a persistent object. It is a temporary context window that disappears when the conversation ends. There is no URL for a session’s accumulated knowledge. There is no diff. There is no version history. You cannot hand a session to a teammate the way you hand them a Figma file or a pull request. Building the coordination layer requires first solving the problem of how to make ephemeral session knowledge persistent in a form that others can access.

**The non-determinism problem.** Code is deterministic, the same input produces the same output. Git diffs are meaningful because “before” and “after” are well-defined states. AI sessions are not. Two developers asking the same AI the same question get different answers. This means the coordination layer cannot simply version-control AI outputs the way Git version-controls code. The value isn’t in the specific text produced but in the knowledge and decisions embedded in that text, which must be extracted, validated, and structured before it can be shared.

**The access control problem.** Documents have permissions. Code repositories have permissions. But AI sessions generate knowledge that is simultaneously personal (a developer’s debugging process) and organizational (a decision about how to architect a feature). The coordination layer has to solve who sees what, and the granularity required is different from file-level permissions on a document.

None of these are unsolvable. They are architectural problems that require deliberate design. But they explain why the coordination layer hasn’t appeared as a natural extension of existing tools. It has to be built specifically for AI’s properties.

---

## The Four Layers the Category Requires

![Four Layers of AI coordination category](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*dagolhykJ5XOkT2F.png)

Based on where individual AI tools are today and what teams actually need to coordinate, the team AI infrastructure category has four distinct layers:

**Shared knowledge layer.** The mechanism by which what one developer’s AI session produces becomes accessible to the next developer’s AI session. This requires capturing session outputs in structured, retrievable form, not dumping conversation logs into a wiki, but extracting the decisions, findings, and context that have ongoing relevance. The hard problem here is relevance filtering: most of what happens in an AI session is not worth propagating.

**Orchestration layer.** As AI tooling fragments across Claude Code, Copilot, Cursor, and Cline within a single organization, the coordination layer needs to work across all of them. The Model Context Protocol (MCP), which Anthropic released and which is becoming an industry standard, creates the integration surface for this. An orchestration layer that sits above individual tools and manages shared context across them is now technically feasible in a way it wasn’t two years ago.

**Governance layer.** Who sees what context. A PM’s AI session containing competitive analysis shouldn’t be injected into every engineer’s context by default. A developer’s debugging session in a security-sensitive codebase has different access requirements than their general code generation work. Enterprise adoption of team AI infrastructure requires governance that handles project-level and role-level permissions.

**Quota coordination layer.** Individual AI tools have per-user rate limits and context windows. Teams have no visibility into collective capacity, who’s using what, how close to limits the team is as a whole, and where expiring capacity could be redirected. This is a resource management problem that has no equivalent in previous productivity categories (Google Docs doesn’t expire) but is real and immediate in AI tooling.

---

## Who Gets to Define This Category

Three types of players could build the team AI coordination layer: the model companies, the tooling companies, and new infrastructure companies.

**The model companies** (Anthropic, OpenAI, Google) have the distribution and integration depth. Anthropic already controls the Claude Code surface and the MCP standard. If they chose to build persistent team context directly into their platform, they would have a significant advantage. But model companies have historically focused on models, not developer workflows. And building the coordination layer is an enterprise workflow problem, not a model problem.

**The tooling companies** (Cursor, Kiro, Cline) are competing on individual developer experience. Adding team coordination features requires them to shift from a single-user to a multi-user product model; a significant architectural pivot while they’re competing hard on individual features. GitHub tried this and retreated.

**New infrastructure companies** have no legacy architecture to defend and can design the coordination layer from scratch, optimized for the specific properties of AI sessions rather than adapted from document or code paradigms. The Model Context Protocol creates the integration surface they need to work across tools. The category is genuinely open.

The parallel that applies here is Figma. In 2012, design tools were individual applications: Sketch, Photoshop, Illustrator. Figma didn’t try to be a better individual design tool. It built the collaboration layer and became the platform the entire design workflow runs on. The individual tools still exist. But the coordination layer became the business.

---

## The Moment We're At

The 2025 Stack Overflow survey found that only 17% of developers who use AI tools say those tools have improved team collaboration. 84% using AI, 17% seeing team-level collaboration benefit; that gap is the clearest measurement of how far the coordination layer still has to be built.

The individual tools are past the adoption threshold. Teams are already experiencing the coordination failures. The model context protocol and plugin architectures that make a cross-tool coordination layer buildable exist now.

The category will exist. The question is whether it gets built as an afterthought bolted onto individual tools, or as first-principles infrastructure designed for how AI work actually flows through teams.

That’s the question that makes right now an interesting time to be working on it.