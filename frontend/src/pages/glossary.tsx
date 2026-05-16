import Head from 'next/head'
import Link from 'next/link'
import { useTheme } from '@/contexts/ThemeContext'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import SpotlightCard from '@/components/SpotlightCard'

const TERMS = [
  {
    term: 'Handoff Tax',
    anchor: 'handoff-tax',
    definition:
      'The productivity cost incurred when context built in one AI session cannot transfer to the next person or role. Every handoff — developer to QA, sprint to sprint, engineer to engineer — requires expensive context reconstruction from scratch. Named and documented by Evols AI in 2026.',
    relatedPost: { label: 'The Handoff Tax: Why Your Team\'s AI Productivity Numbers Are Wrong', href: '/blog/the-handoff-tax' },
  },
  {
    term: 'AI Coordination Tax',
    anchor: 'ai-coordination-tax',
    definition:
      'The compounding overhead that accumulates when multiple teammates use AI tools independently with no shared state between their sessions. Takes three main forms: duplicate AI investigations, context loss at handoff, and synchronization overhead disguised as code review latency.',
    relatedPost: { label: 'The Hidden Coordination Tax of Async AI Work', href: '/blog/hidden-coordination-tax' },
  },
  {
    term: 'Cold Start Problem (AI Onboarding)',
    anchor: 'cold-start',
    definition:
      'The gap experienced by new teammates who must rebuild organizational context from scratch even in AI-native teams. AI tools transfer generic knowledge (from training data) but not organizational knowledge: past decisions, failed approaches, and codebase-specific constraints. A team knowledge layer is required to close this gap.',
    relatedPost: { label: 'The Onboarding Cold Start Problem', href: '/blog/onboarding-cold-start' },
  },
  {
    term: 'Token Exhaustion',
    anchor: 'token-exhaustion',
    definition:
      'The state reached when a team\'s collective AI usage exceeds quota limits, interrupting work mid-task. Distinct from individual rate limiting: at the team level, token exhaustion is a visibility and distribution problem — some teammates hit limits while others let quota expire unused. No current AI tool exposes collective capacity in real time.',
    relatedPost: { label: 'Token Exhaustion Is a Team Problem', href: '/blog/token-exhaustion-team-problem' },
  },
  {
    term: 'Multiplayer AI',
    anchor: 'multiplayer-ai',
    definition:
      'The emerging category of AI tooling that enables teams, not just individuals, to benefit from shared AI sessions. Analogous to the transition from individual code editors to GitHub: the individual layer (Claude Code, Cursor, Copilot) is mature; the team coordination layer — shared context, redundancy detection, quota visibility — is being built now.',
    relatedPost: { label: 'Multiplayer AI: The Category That Doesn\'t Exist Yet', href: '/blog/multiplayer-ai-the-category-that-doesnt-exist-yet' },
  },
  {
    term: 'Corrupt Success (AI Output)',
    anchor: 'corrupt-success',
    definition:
      'An AI-generated output that passes surface-level evaluation (correct structure, professional language, appropriate length) while failing to deliver the substance required for action. Research finds 27–78% of AI task completions are corrupt successes. Distinguished from failures because they require active evaluation to detect — they look done.',
    relatedPost: { label: 'AI-Generated Docs Are Productivity Theater', href: '/blog/ai-generated-docs-productivity-theater' },
  },
  {
    term: 'Team AI Brain',
    anchor: 'team-ai-brain',
    definition:
      'A shared knowledge layer that persists AI session outputs across teammates, enabling context retrieval instead of context rebuilding. A team AI brain gives every teammate — including new hires — access to the accumulated findings, decisions, and reasoning from all prior AI sessions without manual documentation or knowledge-base maintenance.',
    relatedPost: null,
  },
  {
    term: 'Session Context',
    anchor: 'session-context',
    definition:
      'The accumulated knowledge, reasoning, and decisions produced within a single AI coding or research session. Session context is currently ephemeral: it exists only within the active session and is lost when the session ends. Without a team AI brain, this context must be manually documented or rebuilt by the next person who needs it.',
    relatedPost: null,
  },
  {
    term: 'Redundancy Detection',
    anchor: 'redundancy-detection',
    definition:
      'An automated check that flags when a teammate is about to start AI work that overlaps with work already done by someone else on the team. Effective redundancy detection operates before tokens are burned — at session start — not after work collides at code review.',
    relatedPost: null,
  },
  {
    term: 'Quota Visibility',
    anchor: 'quota-visibility',
    definition:
      'Real-time awareness of collective AI token usage across an entire team, including remaining capacity, usage by member, and time until reset. Quota visibility enables teams to redirect expiring capacity to backlog tasks and prevents mid-task interruptions from unexpected rate limiting.',
    relatedPost: null,
  },
]

const SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'DefinedTermSet',
      '@id': 'https://evols.ai/glossary',
      name: 'Team AI Glossary',
      description:
        'Definitions of key terms in team AI coordination, AI productivity, and knowledge management for engineering and product teams.',
      url: 'https://evols.ai/glossary',
      publisher: { '@type': 'Organization', name: 'Evols AI', url: 'https://evols.ai' },
      hasDefinedTerm: TERMS.map(t => ({
        '@type': 'DefinedTerm',
        name: t.term,
        description: t.definition,
        url: `https://evols.ai/glossary#${t.anchor}`,
        inDefinedTermSet: 'https://evols.ai/glossary',
      })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://evols.ai' },
        { '@type': 'ListItem', position: 2, name: 'Glossary', item: 'https://evols.ai/glossary' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: TERMS.map(t => ({
        '@type': 'Question',
        name: `What is ${t.term}?`,
        acceptedAnswer: { '@type': 'Answer', text: t.definition },
      })),
    },
  ],
}

export default function GlossaryPage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const border = 'border-border'
  const textFaint = dark ? 'text-muted-foreground' : 'text-muted-foreground'

  return (
    <>
      <Head>
        <title>Team AI Glossary — Evols AI | Handoff Tax, Token Exhaustion &amp; More</title>
        <meta
          name="description"
          content="Definitions of key terms in team AI: handoff tax, AI coordination tax, token exhaustion, cold start, multiplayer AI, and more — coined and documented by Evols AI."
        />
        <link rel="canonical" href="https://evols.ai/glossary" />
        <meta property="og:title" content="Team AI Glossary — Evols AI" />
        <meta property="og:description" content="Definitions of key terms in team AI: handoff tax, AI coordination tax, token exhaustion, cold start, multiplayer AI, and more." />
        <meta property="og:url" content="https://evols.ai/glossary" />
        <meta property="og:image" content="https://evols.ai/api/og?title=Team+AI+Glossary&description=Handoff+tax%2C+token+exhaustion%2C+multiplayer+AI+and+more" />
        <meta name="twitter:title" content="Team AI Glossary — Evols AI" />
        <meta name="twitter:image" content="https://evols.ai/api/og?title=Team+AI+Glossary&description=Handoff+tax%2C+token+exhaustion%2C+multiplayer+AI+and+more" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />
      </Head>

      <div className="min-h-screen bg-background">
        <Header variant="landing" />

        <main className="container mx-auto px-6 pt-28 pb-20">
          <div className="max-w-3xl mx-auto">

            {/* Header */}
            <div className="mb-14">
              <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full text-sm text-primary mb-6">
                <span>Glossary</span>
              </div>
              <h1 className="text-5xl font-medium mb-4 text-foreground tracking-tight">
                Team AI Glossary
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Key terms in team AI coordination, AI productivity, and knowledge management — coined and documented by Evols AI.
              </p>
            </div>

            {/* Quick-jump index */}
            <div className={`mb-12 p-5 rounded-xl border ${border} bg-card`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Jump to</p>
              <div className="flex flex-wrap gap-2">
                {TERMS.map(t => (
                  <a
                    key={t.anchor}
                    href={`#${t.anchor}`}
                    className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    {t.term}
                  </a>
                ))}
              </div>
            </div>

            {/* Terms */}
            <div className="space-y-6">
              {TERMS.map(t => (
                <SpotlightCard key={t.anchor}>
                  <div className="p-6" id={t.anchor}>
                    <h2 className="text-xl font-semibold text-foreground mb-3 tracking-tight">{t.term}</h2>
                    <p className={`text-sm leading-relaxed ${textFaint} mb-4`}>{t.definition}</p>
                    {t.relatedPost && (
                      <Link
                        href={t.relatedPost.href}
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <span>→</span>
                        <span>{t.relatedPost.label}</span>
                      </Link>
                    )}
                  </div>
                </SpotlightCard>
              ))}
            </div>

            {/* CTA */}
            <div className={`mt-14 p-6 rounded-xl border ${border} bg-card text-center`}>
              <p className="text-sm font-medium text-foreground mb-1">See these concepts in action</p>
              <p className={`text-sm ${textFaint} mb-4`}>
                Evols eliminates the handoff tax, cold start, and token exhaustion for your entire team with one CLI install.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/85 transition-all"
              >
                Get early access
              </Link>
            </div>

          </div>
        </main>

        <Footer />
      </div>
    </>
  )
}
