import Head from 'next/head'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import {
  ArrowRight, Sparkles,
  Zap, Users, Brain, Shield,
  BarChart3, GitMerge, AlertTriangle, RefreshCw, DollarSign,
  MessageSquare, Layers, Activity,
} from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import SpotlightCard from '@/components/SpotlightCard'
import { LogoIcon } from '@/components/Logo'

/* ────────────────────────────────────────────────────────────
   Content
   ──────────────────────────────────────────────────────────── */

const PROBLEMS = [
  {
    icon: GitMerge,
    label: 'Handoff tax',
    title: 'Context built once, rebuilt constantly.',
    body: 'PM research, engineering decisions, UX insights — every teammate rebuilds from scratch. The same 12,000 tokens of context compiled daily across every role.',
  },
  {
    icon: RefreshCw,
    label: 'Invisible waste',
    title: 'Duplicate work nobody sees coming.',
    body: 'Two engineers solve the same infra problem. Three PMs research the same competitor. Work collides at review — after the tokens are burned.',
  },
  {
    icon: BarChart3,
    label: 'Quota blindness',
    title: 'Capacity burns or expires, both wasted.',
    body: 'Some teammates hit session lockouts mid-task. Others let quota reset unused. No tool shows collective AI capacity across the team.',
  },
  {
    icon: AlertTriangle,
    label: 'Shallow output',
    title: 'Polished output, shallow substance.',
    body: 'AI drafts look complete. Teammates spend time verifying, rewriting, clarifying — the hidden rework tax on every AI-assisted deliverable.',
  },
  {
    icon: Layers,
    label: 'Tool fragmentation',
    title: 'Debugging across too many layers.',
    body: 'Agentic systems span models, orchestrators, APIs, logs, dashboards. When something breaks, engineers reconstruct what happened from scratch.',
  },
  {
    icon: DollarSign,
    label: 'Cost blowups',
    title: 'Token costs grow faster than value.',
    body: 'Teams underestimate how fast inference costs scale. Productivity gains get erased by optimization work and unplanned budget pressure.',
  },
]

const FEATURES = [
  { icon: Brain,         title: 'Zero cold start',         description: 'New teammates inherit the team knowledge graph on day one. No setup, no accumulation period — full context from the first session.', stat: 'Day one',  statLabel: 'full context' },
  { icon: Zap,           title: 'Auto-compiled knowledge', description: 'Every AI session contributes to a shared team knowledge base automatically. Query it instead of rebuilding it — at 8× fewer tokens.', stat: '~8×',     statLabel: 'token efficiency' },
  { icon: Users,         title: 'Redundancy prevention',   description: 'Detect duplicate AI work before tokens are burned — not after the work collides at code review or the decks land in the same meeting.', stat: '0',     statLabel: 'duplicate sessions' },
  { icon: Activity,      title: 'Quota visibility',        description: 'See collective team AI capacity in real time. Redirect expiring quota to backlog tasks before it resets unused.', stat: '+15%',     statLabel: 'effective quota' },
  { icon: Shield,        title: 'Governance & access',     description: 'Project-level and role-level context permissions. Teams control who sees what knowledge — built for orgs that handle sensitive context.', stat: 'SOC 2', statLabel: 'in progress' },
  { icon: MessageSquare, title: 'Works where you work',    description: 'One plugin install activates everything in Claude Code. MCP integration covers Copilot, Kiro, Cursor, and Cline automatically.', stat: '1 cmd', statLabel: 'to activate' },
]

const TESTIMONIALS = [
  { quote: 'I think there is room here for an incredible new product instead of a hacky collection of scripts.', author: 'Andrej Karpathy',  role: 'AI Researcher',           initials: 'AK', date: 'April 2026' },
  { quote: "We're stopping at individual productivity. One department doesn't know what the other one does. That's where it cracks.", author: 'Sven Peters', role: 'AI Evangelist, Atlassian', initials: 'SP', date: 'March 2026' },
]

const STATS = [
  { value: '84%',   label: 'of technical workers use AI daily' },
  { value: '75%',   label: 'say tools focus too much on individuals' },
  { value: '~300K', label: 'tokens saved weekly per 10-person team' },
  { value: '+15%',  label: 'effective quota extension' },
]

/* ────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────── */

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])
  const heroY = useTransform(scrollYProgress, [0, 0.6], [0, 40])

  return (
    <>
      <Head>
        <title>Evols — your team's AI brain</title>
        <meta name="description" content="The calm, AI-native ProductOS. Evols turns every AI session into shared, compounding intelligence — zero cold start, no duplicate work, full quota visibility." />
        <meta property="og:title" content="Evols — your team's AI brain" />
        <meta property="og:description" content="Turn every AI session into team intelligence. One plugin install activates everything." />
        <meta name="robots" content="index, follow" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Evols',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              description: "Your team's AI brain. The calm, AI-native ProductOS.",
              url: 'https://evols.ai',
            }),
          }}
        />
      </Head>

      <div className="aurora-bg min-h-screen text-foreground antialiased">
        <Header variant="landing" />

        {/* ─── HERO ─── */}
        <section ref={heroRef} className="relative pt-40 pb-32 overflow-hidden">
          {/* Subtle grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.6]"
            style={{
              backgroundImage:
                'linear-gradient(hsl(var(--border) / 0.18) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.18) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
              maskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 75%)',
            }}
          />

          <motion.div
            style={{ opacity: heroOpacity, y: heroY }}
            className="relative max-w-4xl mx-auto px-6 text-center"
          >
            {/* Eyebrow with halo */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 rounded-full border border-border bg-card/50 backdrop-blur-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--brand-mint)' }} />
              <span className="text-xs font-medium text-muted-foreground tracking-[0.02em]">
                Now in early access — limited design partner spots
              </span>
            </motion.div>

            {/* Hero headline */}
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="text-display-2xl font-medium tracking-[-0.03em] mb-7 text-balance"
            >
              Your team's AI brain,{' '}
              <span
                className="font-display"
                style={{ fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.025em' }}
              >
                taking shape.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed tracking-[-0.005em] text-pretty"
            >
              Evols turns every AI session your team runs into shared, compounding
              intelligence — zero cold start, no duplicate work, full quota visibility.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <Link
                href="/register"
                className="group btn-pulse text-base px-6 py-3.5"
              >
                Get early access
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-fast" strokeWidth={2} />
              </Link>
              <Link
                href="/book-demo"
                className="btn-secondary text-base px-6 py-3.5"
              >
                Book a demo
              </Link>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 text-xs text-muted-foreground/70"
            >
              No credit card required · Try and cancel anytime
            </motion.p>
          </motion.div>

          {/* Hero terminal — the AI session end mock */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative max-w-3xl mx-auto mt-20 px-6"
          >
            {/* Glow behind */}
            <div
              className="absolute -inset-x-8 -top-4 -bottom-12 rounded-3xl pointer-events-none opacity-60"
              style={{ background: 'var(--brand-pulse-soft)', filter: 'blur(80px)' }}
            />
            <div className="relative rounded-2xl border border-border bg-card/95 overflow-hidden shadow-elev-3 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-card">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#FB7185' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#F4B445' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#5EEAD4' }} />
                <span className="ml-3 text-xs text-muted-foreground/80 font-mono">evols · session end</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: 'var(--brand-mint)' }} />
                  <span className="text-[10px] font-mono text-muted-foreground/70">syncing</span>
                </div>
              </div>
              <div className="p-5 font-mono text-xs leading-relaxed">
                <p style={{ color: 'var(--brand-mint)' }}>✓ Session complete · retention pain points mapped</p>
                <p className="text-muted-foreground/80 mt-2.5">Added to team knowledge base:</p>
                <p className="text-muted-foreground ml-3">→ 5 insights on SMB churn triggers</p>
                <p className="text-muted-foreground ml-3">→ 2 product decisions: onboarding over activation</p>
                <p className="text-muted-foreground ml-3">→ Interview framework filed under <span className="text-primary">/customers/smb/</span></p>
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-muted-foreground/80">Retrieved from team knowledge base:</p>
                  <p className="text-muted-foreground ml-3">→ Tom's pricing research <span className="text-muted-foreground/70">(847 tokens — saved ~6,800)</span></p>
                  <p className="text-muted-foreground ml-3">→ Jordan's onboarding drop-off analysis <span className="text-muted-foreground/70">(623 tokens — saved ~5,200)</span></p>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-muted-foreground/80">
                    Quota:{' '}
                    <span className="text-pulse">████████░░ 68% used</span>{' '}
                    · resets in 4h 12m
                  </p>
                  <p className="text-muted-foreground/80">
                    Background task:{' '}
                    <span className="text-muted-foreground">PRD-47 gap analysis queued ↗</span>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ─── STATS STRIP ─── */}
        <section className="relative border-y border-border/60 py-14 bg-card/30 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-medium tracking-[-0.03em] text-foreground mb-1.5">
                  {s.value}
                </div>
                <div className="text-xs text-muted-foreground/80 leading-snug">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ─── PROBLEMS ─── */}
        <section id="product" className="relative py-28 max-w-6xl mx-auto px-6">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <SectionLabel>The problem</SectionLabel>
            <h2 className="text-display-xl font-medium tracking-[-0.025em] leading-[1.06] mb-5 text-foreground">
              Six ways teams waste{' '}
              <span
                className="font-display"
                style={{ fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.022em', color: 'hsl(var(--muted-foreground))' }}
              >
                their collective AI investment.
              </span>
            </h2>
            <p className="text-base text-muted-foreground/90 leading-relaxed text-pretty">
              AI tools are built for individuals. Teams using them collectively suffer
              compounding failures that no single tool today addresses.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROBLEMS.map((p, i) => {
              const Icon = p.icon
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full"
                >
                  <SpotlightCard>
                    <div className="p-6 h-full">
                      <div className="flex items-center gap-2.5 mb-4">
                        <div className="grid place-items-center w-9 h-9 rounded-lg border border-border bg-background/60 text-primary">
                          <Icon className="w-4 h-4" strokeWidth={1.5} />
                        </div>
                        <span className="text-overline uppercase tracking-[0.08em] text-[11px] font-medium text-muted-foreground/80">
                          {p.label}
                        </span>
                      </div>
                      <h3 className="text-base font-medium tracking-[-0.018em] mb-2 text-foreground">
                        {p.title}
                      </h3>
                      <p className="text-sm text-muted-foreground/85 leading-relaxed">{p.body}</p>
                    </div>
                  </SpotlightCard>
                </motion.div>
              )
            })}
          </div>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section id="how-it-works" className="relative py-28 border-y border-border/60 bg-card/30 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16 max-w-3xl mx-auto">
              <SectionLabel>The solution</SectionLabel>
              <h2 className="text-display-xl font-medium tracking-[-0.025em] leading-[1.06] mb-5 text-foreground">
                One install.{' '}
                <span
                  className="font-display"
                  style={{ fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.022em' }}
                >
                  Everything connects.
                </span>
              </h2>
              <p className="text-base text-muted-foreground/90 leading-relaxed text-pretty">
                The Evols plugin bundles hooks, MCP server, and team context — no manual configuration.
              </p>
            </div>

            <div className="max-w-2xl mx-auto mb-16">
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-elev-2">
                <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#FB7185' }} />
                  <div className="w-2 h-2 rounded-full" style={{ background: '#F4B445' }} />
                  <div className="w-2 h-2 rounded-full" style={{ background: '#5EEAD4' }} />
                  <span className="ml-3 text-xs text-muted-foreground/80 font-mono">terminal</span>
                </div>
                <div className="p-5 font-mono text-sm">
                  <p>
                    <span className="text-muted-foreground/70">$ </span>
                    <span className="text-foreground">claude plugin install evols</span>
                  </p>
                  <p className="text-muted-foreground/85 mt-2">
                    → Enter your team workspace URL: <span className="text-primary">app.evols.ai/acme</span>
                  </p>
                  <p className="text-muted-foreground/85">
                    → Enter your API key: <span className="text-primary">••••••••••••</span>
                  </p>
                  <p className="mt-2" style={{ color: 'var(--brand-mint)' }}>✓ Hooks registered · MCP server active · Team context loaded</p>
                  <p style={{ color: 'var(--brand-mint)' }}>✓ Done. Your team's knowledge base is ready.</p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { step: '01', title: 'Session starts',          body: 'Evols fires the SessionStart hook. Team knowledge base context is injected immediately. No cold start. No accumulation period. Day one.' },
                { step: '02', title: 'Every prompt, enriched',  body: 'UserPromptSubmit hook checks for redundant work. Injects relevant prior context. Tracks session token usage client-side in real time.' },
                { step: '03', title: 'Session ends, team gets smarter', body: 'Stop hook syncs outcomes to the team knowledge base. StopFailure hook detects rate limits and queues work for the next window.' },
              ].map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full"
                >
                  <SpotlightCard>
                    <div className="p-6 h-full">
                      <div className="font-display text-5xl tracking-[-0.04em] mb-4 text-pulse" style={{ fontStyle: 'italic' }}>
                        {s.step}
                      </div>
                      <h3 className="text-base font-medium tracking-[-0.018em] mb-2 text-foreground">{s.title}</h3>
                      <p className="text-sm text-muted-foreground/85 leading-relaxed">{s.body}</p>
                    </div>
                  </SpotlightCard>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FEATURES ─── */}
        <section id="features" className="relative py-28 max-w-6xl mx-auto px-6">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <SectionLabel>Capabilities</SectionLabel>
            <h2 className="text-display-xl font-medium tracking-[-0.025em] leading-[1.06] mb-5 text-foreground">
              Six capabilities.{' '}
              <span
                className="font-display"
                style={{ fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.022em', color: 'hsl(var(--muted-foreground))' }}
              >
                One compounding system.
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full"
                >
                  <SpotlightCard>
                    <div className="p-6 h-full">
                      <div className="flex items-start justify-between mb-5">
                        <div className="grid place-items-center w-10 h-10 rounded-xl border border-border bg-background/60 text-primary">
                          <Icon className="w-5 h-5" strokeWidth={1.5} />
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-medium tracking-[-0.03em] text-foreground">{f.stat}</div>
                          <div className="text-[10px] text-muted-foreground/80 tracking-[0.08em] uppercase">
                            {f.statLabel}
                          </div>
                        </div>
                      </div>
                      <h3 className="text-base font-medium tracking-[-0.018em] mb-2 text-foreground">{f.title}</h3>
                      <p className="text-sm text-muted-foreground/85 leading-relaxed">{f.description}</p>
                    </div>
                  </SpotlightCard>
                </motion.div>
              )
            })}
          </div>
        </section>

        {/* ─── TESTIMONIALS ─── */}
        <section className="relative py-28 border-y border-border/60 bg-card/30 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-14 max-w-3xl mx-auto">
              <SectionLabel>Validation</SectionLabel>
              <h2 className="text-display-xl font-medium tracking-[-0.025em] leading-[1.06] text-foreground">
                The gap is publicly named{' '}
                <span
                  className="font-display"
                  style={{ fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.022em', color: 'hsl(var(--muted-foreground))' }}
                >
                  at the highest level.
                </span>
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {TESTIMONIALS.map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full"
                >
                  <SpotlightCard>
                    <div className="p-8 h-full flex flex-col">
                      <p className="text-foreground text-lg leading-relaxed tracking-[-0.005em] mb-6 flex-1 font-display" style={{ fontStyle: 'italic' }}>
                        "{t.quote}"
                      </p>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full grid place-items-center text-white text-sm font-semibold flex-shrink-0"
                          style={{ background: 'var(--brand-pulse)' }}
                        >
                          {t.initials}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground">{t.author}</div>
                          <div className="text-xs text-muted-foreground/80">{t.role} · {t.date}</div>
                        </div>
                      </div>
                    </div>
                  </SpotlightCard>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 grid md:grid-cols-3 gap-4">
              {[
                { text: 'Token exhaustion documented by BBC, Forbes, MacRumors — March 2026' },
                { text: 'VCs calling team context infrastructure "the next big thing in AI" — Forbes, April 2026' },
                { text: 'GitHub Copilot Workspace shut down. No replacement exists.' },
              ].map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full"
                >
                  <SpotlightCard>
                    <div className="flex items-start gap-3 p-4">
                      <span
                        className="w-1.5 h-1.5 mt-1.5 rounded-full flex-shrink-0"
                        style={{ background: 'var(--brand-pulse)' }}
                      />
                      <p className="text-xs text-muted-foreground/85 leading-relaxed">{s.text}</p>
                    </div>
                  </SpotlightCard>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FINAL CTA ─── */}
        <section className="relative py-28 border-t border-border/60">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <div className="relative">
              {/* Aperture mark above headline */}
              <div className="flex justify-center mb-8">
                <div className="grid place-items-center w-16 h-16 rounded-full halo-ring">
                  <LogoIcon size={36} variant="pulse" strokeWidth={2} />
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ ease: [0.16, 1, 0.3, 1] }}
              >
                <h2 className="text-display-xl font-medium tracking-[-0.025em] leading-[1.06] mb-5 text-foreground">
                  Stop rebuilding{' '}
                  <span
                    className="font-display"
                    style={{ fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.022em', color: 'hsl(var(--muted-foreground))' }}
                  >
                    what your team already knows.
                  </span>
                </h2>
                <p className="text-base md:text-lg text-muted-foreground/90 mb-10 leading-relaxed">
                  Every session should compound into shared intelligence — not disappear when the window closes.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    href="/register"
                    className="group btn-pulse text-base px-7 py-4"
                  >
                    Get early access
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-fast" strokeWidth={2} />
                  </Link>
                  <Link href="/book-demo" className="btn-secondary text-base px-7 py-4">
                    Book a demo
                  </Link>
                </div>
                <p className="mt-5 text-xs text-muted-foreground/70">
                  Active with Claude Code, Copilot, Kiro, Cursor, and Cline
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  )
}

/* ────────────────────────────────────────────────────────────
   Small helpers
   ──────────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/60 backdrop-blur-sm text-xs font-medium tracking-[0.04em] text-muted-foreground mb-5">
      <span className="w-1 h-1 rounded-full" style={{ background: 'var(--brand-mint)' }} />
      {children}
    </div>
  )
}
