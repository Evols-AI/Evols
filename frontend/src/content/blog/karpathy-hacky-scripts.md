---
title: "What Karpathy's \"Hacky Scripts\" Observation Reveals About Where Developer Tools Are Heading"
description: "Andrej Karpathy described his LLM knowledge workflow as a hacky collection of scripts and noted room for an incredible new product. What that product actually needs to be is more specific than it first appears."
date: 2026-04-22
author: Akshay Saraswat
authorRole: Founder, Evols
readingTime: 13 min read
tags: [AI Tools, Knowledge Management, Developer Tools]
---

![The gap between what exists and what should exist](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*X7JXd0FzsVwcRLqi0Vpa-g.png)

In early April 2026, Andrej Karpathy posted an observation on X that got shared extensively in developer circles. He described a personal workflow he'd been building: raw data collected from multiple sources, compiled by an LLM into a markdown wiki, then operated on by various CLI tools to do Q&A and incrementally enhance the wiki over time, all viewable in Obsidian, with the LLM handling nearly all writing and editing.

The part that stuck was how he characterized it: "a hacky collection of scripts." And the part that followed: "I think there is room here for an incredible new product."

Karpathy is not an average user. He's one of the people who built the foundational architecture that makes these tools possible. When he describes his own LLM knowledge management workflow as "hacky," he's not complaining about usability. He's describing a category gap, the absence of a product that should exist and doesn't.

Understanding what that product would actually need to be requires understanding what the workflow he described is actually trying to solve.

---

## The Pattern Karpathy Was Describing

The workflow is more interesting than it first appears. Breaking it down:

**Raw data collection from multiple sources.** Karpathy isn't working with a single document or a clean API. He's aggregating across sources; the kind of unstructured, multi-format, multi-origin information that characterizes real knowledge work i.e. Emails, papers, code, documentation, notes, conversations.

**LLM compilation into a persistent wiki.** The LLM is not answering one-off questions and forgetting. It's building and maintaining a structured knowledge artifact: a wiki that persists, accumulates, and grows. The output isn't a response. It's a knowledge base.

**CLI tools for Q&A and incremental enhancement.** The wiki is not static. It gets queried and then updated based on those queries. New information comes in, and the wiki gets refined. The system is designed to compound, each interaction makes the knowledge base more useful.

**Viewable in Obsidian.** The human can read, navigate, and understand what the system has accumulated. Transparency and inspectability are part of the design.

**Rarely manually edited.** The LLM does the writing. The human does the directing. This is not "AI-assisted writing" in the Grammarly sense; it's the LLM as a knowledge infrastructure manager, with the human as an architect setting intent.

The workflow is essentially a personal knowledge operating system built out of components that weren't designed to work together. Which is precisely why he called it "hacky."

---

## Why Every Developer Ends Up Building This Themselves

Karpathy's frustration is familiar to anyone who has been using LLMs seriously for more than six months. There is a point in every knowledge worker's AI journey where the built-in memory of the interface isn't enough, where you start thinking about how to make what you're learning in conversations persist in a way that's useful tomorrow and next month and a year from now.

The tools that exist for this problem have a structural mismatch with how AI sessions actually generate knowledge.

**Traditional documentation tools (Notion, Confluence, wiki software)** are designed for manually authored content. They have no mechanism for ingesting the output of an AI session and transforming it into organized, searchable knowledge. The transfer is always manual: someone has to read the session, decide what matters, write the document, file it in the right place. This is work that erases most of the time savings the AI created.

**Note-taking tools (Obsidian, Roam, Logseq)** have become increasingly popular for AI-adjacent workflows precisely because their graph-based architectures handle linked, emergent knowledge better than hierarchical wikis. Karpathy uses Obsidian specifically for this reason. But the tool still requires the knowledge to be authored by a human. It stores what you put in it; it doesn't capture what your AI sessions know.

**Vector databases and RAG pipelines** are the technical answer, and they work at the infrastructure level. But they require engineering to build and maintain, they don't have native interfaces for knowledge workers to interact with, and they're designed for retrieval, not for the kind of incremental enrichment Karpathy was describing. You query them; you don't converse with them about what they know.

**CLAUDE.md files** i.e. Anthropic's own recommendation for persistent context in Claude Code are the most direct acknowledgment that this problem exists. The official documentation suggests: create a CLAUDE.md file at the root of your project, check it into git so your team can contribute to it, and update it with information that Claude should know about your codebase. This is the current state-of-the-art for team AI context management: a manually authored markdown file.

This is what Karpathy called "a hacky collection of scripts." Not because the individual components are bad, but because no product has integrated them into something that works automatically, where the AI session itself contributes to the knowledge base rather than requiring a human to extract and file its output.

![When the wiki finally learns](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*dcB_s-kciSKTinVOHZ3LzA.png)

---

## The Specific Gap: Session Knowledge Doesn't Flow Into Shared Knowledge

The Anthropic Claude Code documentation is admirably honest about what the current tools don't do. It notes that "a single debugging session or codebase exploration might generate and consume tens of thousands of tokens" and that managing context is "the most important resource to manage." It recommends clearing context between unrelated tasks.

But it has no mechanism for taking what happened in that debugging session (i.e. the knowledge of what was tried, what worked, what didn't, and why) and making it available to the next developer who debugs the same part of the codebase. The team sharing mechanism is CLAUDE.md: a static file that someone has to update manually after the session, if they remember, if it seems worth the effort.

The gap between what an AI session produces and what gets captured in shared team knowledge is where the compounding stops. Every session that doesn't contribute to shared knowledge is a one-way value creation event: value for the developer in that session, value that disappears when the session ends.

---

## The Three Architectures Being Explored

The developer community has been building toward Karpathy's "incredible new product" from several directions simultaneously. None of them are the product yet, but they illuminate what the product would need to look like.

**RAG pipelines bolted onto documentation systems.** The pattern: take an existing documentation store (Confluence, Notion, a git repository), run a retrieval-augmented generation layer on top of it, and inject relevant context into new AI sessions automatically. This works for retrieval. It doesn't solve the input problem, knowledge still has to be manually added to the documentation store before it becomes retrievable.

**Conversation-logging middleware with summarization.** Some teams are building logging layers that capture AI session transcripts and run periodic summarization jobs, storing the results in searchable form. This solves the capture problem but not the structure problem. A dump of summarized conversation transcripts is better than nothing but isn't a knowledge base; it lacks the organization, deduplication, and freshness management that make knowledge actually useful.

**Plugin-native hooks that capture session outcomes.** The most architecturally promising approach. Tools like Claude Code expose hook interfaces at session boundaries: events that fire when a session starts and stops, when prompts are submitted, when sessions fail. A system built on these hooks can capture not just the final output but the intermediate reasoning, the decisions made, the context used, and it can do this automatically, without requiring any manual action from the developer.

This is the architecture that most directly answers what Karpathy described: the LLM contributing to the knowledge base as a side effect of normal work, rather than requiring a separate knowledge-management workflow.

---

## What Makes This Genuinely Hard

The reason the "incredible new product" doesn't exist yet isn't lack of demand or lack of technical capability. It's that the problem has three subproblems that are hard in different ways.

**Relevance filtering at capture time.** Not everything in an AI session is worth capturing. A 45-minute debugging session generates a lot of reasoning that is intermediate and specific to that particular run of that particular issue, not generalizable, not useful to future sessions. The hard problem is distinguishing "this decision matters for how we architect this system going forward" from "I tried this approach and it didn't work because of an environment issue that's been fixed." Both kinds of knowledge exist in every session. Only one kind compounds.

**Freshness management at retrieval time.** Knowledge that was accurate in January can be actively misleading in April. A codebase decision that made sense for 50,000 users doesn't make sense for 500,000 users. A knowledge base that accumulates without any mechanism for identifying stale entries becomes a liability rather than an asset, injecting outdated context can be worse than injecting no context. The product has to solve not just capture and retrieval but expiration.

**Access control at every level.** This is the enterprise problem. A developer's session on a security-sensitive service has different access requirements than their session on a front-end feature. A PM's competitive research shouldn't flow automatically into every engineer's context. Knowledge generated by contractors shouldn't be visible to all employees. The coordination layer has to have a governance model that handles these distinctions, and that model has to be granular enough to be useful without being so granular that it requires per-item management.

These are architectural choices, not research problems. They're the decisions that determine whether the resulting product is useful to real teams or just technically impressive.

---

## The "Incredible New Product": What It Looks Like

![Human wanted context janitor](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*SJRlkmgO4u1_BQKq)

The product Karpathy was describing, built to its full potential, would do what no current tool does: make every AI session a contribution to shared team knowledge, automatically, without requiring the developer to do anything other than their normal work.

A developer debugs an authentication issue. The session captures the diagnosis, the fix, and the reasoning. That knowledge is indexed and made available to future sessions in the same codebase. The next developer who encounters an authentication issue doesn't start from zero, their AI starts with the context that was built by their teammate two weeks ago.

A PM analyzes customer research. The session produces synthesized insights. Those insights are available to the engineer designing the solution, the designer creating the flows, the QA engineer writing the test cases, all without anyone sending documents or scheduling syncs to share context.

The operational shift is small, it just works, as a side effect of normal AI usage. The compound effect is significant, because every session makes the next session slightly more efficient, and that efficiency compounds across a team.

This is what "a hacky collection of scripts" is approximating today for Karpathy and for every developer who has built their own version of his workflow. It exists as individual, bespoke infrastructure because the product doesn't exist yet.

That gap is what makes the timing interesting.