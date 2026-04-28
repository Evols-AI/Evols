---
title: "AI-Generated Docs Are Productivity Theater. Here's How to Tell the Difference."
description: "AI-generated documents look complete because their structure is correct but research finds 27-78% of AI task completions are corrupt successes that pass surface evaluation while missing the decisions that make them actionable."
date: 2026-04-24
author: Akshay Saraswat
authorRole: Founder, Evols
readingTime: 13 min read
tags: [AI Quality, Documentation, Product Management]
---

There is a specific kind of document that has become common on technical teams in 2026. It has clear headers. It uses professional language. It is appropriately long. It has bullet points in all the right places. It looks, at a glance, like someone did serious work.

Then someone tries to act on it and discovers: the document describes the situation without making any decisions about it. Or it makes decisions without explaining the reasoning. Or it covers the straightforward cases and leaves the hard ones as "open questions." Or it is accurate in a generic sense but misses the five codebase-specific constraints that would make any of its recommendations actually work.

This is not a document that was written carelessly. In most cases, it was produced with genuine intent and reviewed before being shared. The problem is that it was primarily authored by an AI working from an underspecified prompt, and the AI optimized for something slightly different from what the document needed to do.

The term that comes to mind is "productivity theater"; the appearance of work completed, without the load-bearing substance that makes the work useful.

---

## Why This Happens at the Model Level

Language models are trained to produce text that is coherent, well-structured, and consistent with patterns in their training data. These are valuable properties. They are not the same as the properties that make a document useful for a specific team working on a specific problem.

A well-trained language model, given a prompt like "write a technical design document for an authentication service," will produce a document that looks like a technical design document. It will have the right sections. It will use correct terminology. It will hit the expected length. It will not hallucinate egregiously if the prompt contains enough specifics.

What it will not do — because it cannot — is make the decisions that require knowing which of three equally valid architectural options the team has already ruled out and why, what the specific performance constraints of this service are at the current traffic level, who is going to own this component after it ships, and what the team's actual risk tolerance is for the tradeoffs involved.

The document looks complete because its structure is correct. It isn't complete because the decisions aren't there.

Research from 2026 (Cao et al., arXiv:2603.03116) found that between 27% and 78% of AI agent task completions contain "corrupt successes" outputs that pass surface-level evaluation criteria while violating procedural integrity. The outputs look right. The process that produced them was wrong. This isn't a fringe finding. It is a systematic property of how these systems optimize.

The version in documentation is more subtle. A corrupt success in a deployment pipeline fails visibly. A corrupt success in a design document ships to the team, gets filed in Confluence, and creates problems three months later when someone tries to implement it and discovers the gaps.

---

## The Surface Completeness Trap

The specific failure mode to watch for is what I'd call surface completeness: a document that answers the questions the template asked, rather than the questions the work requires.

Design documents have standard sections because those sections cover the questions that usually matter. But "usually matter" is not the same as "matter for this specific situation." A document that fills in all the standard sections for a migration project might address performance, security, and rollback strategy as generic categories while missing the specific constraint that this migration has to run without downtime during a two-week period when two other teams are doing related database migrations in the same schema.

AI-generated documents fail at surface completeness in a characteristic way: they answer the general case confidently and handle edge cases vaguely. The general case gets bullet points and specific language. The edge cases get phrases like "additional consideration may be required" or "this should be reviewed with the relevant stakeholders."

The 2025 Stack Overflow Developer Survey, covering 49,000 respondents, found that 66% of developers struggle with "AI solutions that are almost right, but not quite." The documentation problem is the written analog of this. Not wrong enough to reject immediately. Wrong in ways that become apparent when you try to use it.

The same survey found that only 4.4% of developers report AI handling complex tasks "very well." For tasks that are structurally complex — not just technically complex but organizationally complex, involving multiple stakeholders and context that exists outside any single document or codebase — AI output quality drops significantly. Design documents are almost always this kind of task.

---

## A Diagnostic Framework: Six Questions for Evaluating AI-Generated Work

The following six questions are designed to distinguish documents that can be acted on from documents that look like they can be acted on.

**1. Does it contain a decision, or only a description?**

A document that describes options is not a document that makes decisions. This is the most common failure mode of AI-generated strategy documents: the AI produces a thorough analysis of the trade-offs between Option A and Option B, then stops. The reader knows more about the options but still has to make the actual choice, often without knowing what considerations should dominate.

The test: can you extract from this document a list of specific commitments the team is making? If the document reads more like a research report than a set of commitments, it hasn't done the work.

**2. Can someone act on this without asking a follow-up question?**

Read the document as if you were a developer picking up this work from scratch tomorrow morning. What would you build? If the answer is "I'd need to ask the person who wrote this at least two clarifying questions before I could start," the document hasn't transferred enough context. Documents that require synchronous follow-up are documents that failed to do their job.

**3. Does it reflect domain-specific constraints, or generic best practices?**

AI models are trained on enormous amounts of general writing, including thousands of design documents that describe good practices for generic systems. A document generated from insufficient context will look like good practice in general while missing the specific constraints of this system, this team, and this moment.

Watch for: recommendations that would be correct in most situations but that you know don't apply here. Watch for absence of the specific constraints that make this problem different from the textbook version.

**4. Is the scope explicit, or implied?**

"This document covers the authentication service redesign" is different from "This document covers the token storage and validation logic; it does not cover session management, which is addressed in [separate document], or the rate limiting layer, which will be designed separately." The first statement doesn't help the reader understand what falls outside this document. The second does.

Scope ambiguity is expensive. Work that gets done by two people because neither was sure who owned it. Integration points that get missed because each person assumed the other document covered them. AI-generated documents tend toward implied scope because explicit scope requires knowing what else is in play — context the model often doesn't have.

**5. Does it acknowledge what it doesn't know?**

A well-written document in uncertain territory says: "We don't yet have data on X, so this recommendation is conditional on Y." AI-generated documents often don't acknowledge uncertainty this way because doing so requires meta-awareness of what information would change the conclusion. The model generates confident-sounding text about uncertain things, because that's what the training data rewards.

**6. Would the person who knows the most about this topic disagree with any sentence?**

This is the fastest heuristic. Take the document to the person on your team with the deepest relevant knowledge. If they read it and say "this is fine" — not "this is what I would have written," but "this is fine" — the document has passed a basic threshold. If they say "this misses the thing that actually matters," you have a surface-complete document.

---

## Why Reviewers Default to Light Edits

Understanding why these documents keep shipping despite the diagnostic failures above requires understanding the review dynamic.

When a reviewer sees a document that is well-formatted, professionally written, and structurally complete, their default is to look for errors rather than to evaluate fitness. They read for what is wrong, not for what is missing. Missing decisions, missing constraints, missing acknowledgments of uncertainty — these don't generate comments. They're not visible to someone who is editing rather than evaluating.

This is compounded by the social dynamic around AI-generated work. A researcher at Microsoft found in 2024 that 52% of knowledge workers are hesitant to disclose AI use for important tasks. When documents are not explicitly labeled as AI-generated, reviewers often don't know what level of human judgment went into them. They assume a level of intentionality that may not be present. They edit the text they see rather than questioning the thinking they don't see.

The result is that AI-generated documents often survive review without getting the interrogation they need. The document's polish makes the reviewer feel that the hard work has been done, which reduces the cognitive energy they apply to questioning whether it actually was.

---

## What High-Quality AI-Assisted Documentation Actually Requires

The key distinction is between AI as author and AI as augmentation. The two produce superficially similar outputs with very different underlying quality.

**AI as author** means giving an AI model a prompt and a target format and using the output as the document. This works well for documents where quality is primarily about format (release notes, changelogs, meeting summaries) and poorly for documents where quality is primarily about judgment (design documents, product specifications, incident post-mortems).

**AI as augmentation** means a human who has already done the thinking uses AI to express it more completely and clearly than they would have alone. The human provides the decisions, the constraints, the domain-specific context, the acknowledgment of uncertainty. The AI provides the structure, the language, the completeness check. The resulting document is better than the human would have produced alone, because the AI catches gaps and improves clarity. But the substance is human-generated.

The test for which mode produced a document is exactly the six questions above. A document produced with AI as augmentation will answer all six. A document produced with AI as author will struggle with questions 1, 3, and 5.

Arize Phoenix, which builds evaluation tooling for AI systems, notes that "AI-assisted coding enhances developer productivity but also introduces challenges, such as verification overhead and over-reliance" — a finding from a systematic review of 90 studies (Sergeyuk et al., arXiv:2503.06195). Verification overhead is precisely the cost that surface-complete documentation creates downstream: not the cost of the document, but the cost of discovering its limitations when someone tries to act on it.

---

## The Organizational Pattern That Creates This Problem

Surface-complete documentation doesn't happen because teams want it. It happens because the incentive structure around documentation production rewards speed and format over substance.

Documentation is often seen as overhead — the tax on real work. When a PM is 70% sure what they want to communicate and 30% unsure about the hard parts, the AI can produce a document that covers the 70% thoroughly and handles the 30% generically. The PM saves time. The document ships. The 30% ambiguity is preserved rather than resolved.

Teams that consistently produce high-quality AI-assisted documentation have an explicit norm about this: the AI is allowed to help you write once you know what you're writing. It is not a substitute for the thinking that decides what to write. The expensive part of documentation is not the writing. It is the decisions that precede the writing. AI does not make that part cheaper. It makes the cheap part of documentation so cheap that the expensive part becomes the only real cost remaining — and teams that don't recognize this end up confusing fast documentation with good documentation.

The tell is downstream rework. If your team consistently produces documents quickly but regularly finds that the documentation needs substantial revision after engineers start implementation, the problem is usually not that the implementation revealed new information. It's that the documentation was never complete enough to begin with.

---

*Akshay Saraswat leads product development at Evols. He has shipped products to millions of users across Samsung, VMware, and Amazon, and spent considerable time on the receiving end of documentation that looked finished. If your team is working through how to raise the quality bar on AI-assisted work, he writes about it regularly — follow along at evols.ai.*
