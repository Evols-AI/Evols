import Head from 'next/head'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef, useEffect, useCallback } from 'react'
import {
  ArrowRight,
  Zap, Users, Brain, Shield,
  BarChart3, GitMerge, AlertTriangle, RefreshCw, DollarSign,
  MessageSquare, Layers, Activity
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import Header from '@/components/Header'
import { LogoWordmark } from '@/components/Logo'

// ─── Cruip-style mouse-tracking spotlight card with lavender glow ─────────────
function SpotlightCard({
  children,
  dark,
  className = '',
}: {
  children: React.ReactNode
  dark: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
    el.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('mousemove', handleMouseMove)
    return () => el.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  return (
    <div
      ref={ref}
      className={`
        group/card relative h-full overflow-hidden rounded-2xl p-px
        ${dark ? 'bg-white/[0.07]' : 'bg-black/[0.08]'}
        before:pointer-events-none before:absolute before:-left-40 before:-top-40 before:z-10
        before:h-80 before:w-80
        before:translate-x-[var(--mouse-x,0px)] before:translate-y-[var(--mouse-y,0px)]
        before:rounded-full before:bg-primary/70 before:opacity-0 before:blur-3xl
        before:transition-opacity before:duration-500
        after:pointer-events-none after:absolute after:-left-48 after:-top-48 after:z-30
        after:h-64 after:w-64
        after:translate-x-[var(--mouse-x,0px)] after:translate-y-[var(--mouse-y,0px)]
        after:rounded-full after:bg-primary after:opacity-0 after:blur-3xl
        after:transition-opacity after:duration-500
        hover:after:opacity-15 hover:before:opacity-100
        ${className}
      `}
    >
      <div className={`relative z-20 h-full overflow-hidden rounded-[inherit] bg-card`}>
        {children}
      </div>
    </div>
  )
}


const PROBLEMS = [
  {
    icon: <GitMerge className="w-5 h-5" />,
    label: 'Handoff Tax',
    title: 'Context built once, rebuilt constantly',
    body: 'PM research, engineering decisions, UX insights — every teammate rebuilds from scratch. The same 12,000 tokens of context compiled daily across every role.',
  },
  {
    icon: <RefreshCw className="w-5 h-5" />,
    label: 'Invisible Waste',
    title: 'Duplicate work nobody sees coming',
    body: 'Two engineers solve the same infra problem. Three PMs research the same competitor. Work collides at review — after the tokens are burned.',
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    label: 'Quota Blindness',
    title: 'Capacity burns or expires, both wasted',
    body: 'Some teammates hit session lockouts mid-task. Others let quota reset unused. No tool shows collective AI capacity across the team.',
  },
  {
    icon: <AlertTriangle className="w-5 h-5" />,
    label: 'Low-Value Output',
    title: 'Polished output, shallow substance',
    body: 'AI drafts look complete. Teammates spend time verifying, rewriting, clarifying — the hidden rework tax on every AI-assisted deliverable.',
  },
  {
    icon: <Layers className="w-5 h-5" />,
    label: 'Tool Fragmentation',
    title: 'Debugging across too many layers',
    body: 'Agentic systems span models, orchestrators, APIs, logs, dashboards. When something breaks, engineers reconstruct what happened from scratch.',
  },
  {
    icon: <DollarSign className="w-5 h-5" />,
    label: 'Cost Blowups',
    title: 'Token costs grow faster than value',
    body: 'Teams underestimate how fast inference costs scale. Productivity gains get erased by optimization work and unplanned budget pressure.',
  },
]

const FEATURES = [
  {
    icon: <Brain className="w-6 h-6" />,
    title: 'Zero Cold Start',
    description: 'New teammates inherit the team knowledge graph on day one. No setup, no accumulation period — full context from the first session.',
    stat: 'Day one',
    statLabel: 'full context',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Auto-Compiled Knowledge',
    description: 'Every AI session contributes to a shared team knowledge base automatically. Query it instead of rebuilding it — at 8× fewer tokens.',
    stat: '~8×',
    statLabel: 'token efficiency',
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: 'Redundancy Prevention',
    description: 'Detect duplicate AI work before tokens are burned — not after the work collides at code review or the decks land in the same meeting.',
    stat: '0',
    statLabel: 'duplicate sessions',
  },
  {
    icon: <Activity className="w-6 h-6" />,
    title: 'Quota Visibility',
    description: 'See collective team AI capacity in real time. Redirect expiring quota to backlog tasks before it resets unused.',
    stat: '+15%',
    statLabel: 'effective quota',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Governance & Access',
    description: 'Project-level and role-level context permissions. Teams control who sees what knowledge — built for orgs that handle sensitive context.',
    stat: 'SOC 2',
    statLabel: 'in progress',
  },
  {
    icon: <MessageSquare className="w-6 h-6" />,
    title: 'Works Where You Work',
    description: 'One plugin install activates everything in Claude Code. MCP integration covers Copilot, Kiro, Cursor, and Cline automatically.',
    stat: '1 cmd',
    statLabel: 'to activate',
  },
]

const TESTIMONIALS = [
  {
    quote: 'I think there is room here for an incredible new product instead of a hacky collection of scripts.',
    author: 'Andrej Karpathy',
    role: 'AI Researcher',
    initials: 'AK',
    date: 'April 2026',
  },
  {
    quote: "We're stopping at individual productivity. One department doesn't know what the other one does. That's where it cracks.",
    author: 'Sven Peters',
    role: 'AI Evangelist, Atlassian',
    initials: 'SP',
    date: 'March 2026',
  },
]

const STATS = [
  { value: '84%', label: 'of technical workers use AI daily' },
  { value: '75%', label: 'say tools focus too much on individuals' },
  { value: '~300K', label: 'tokens saved weekly per 10-person team' },
  { value: '+15%', label: 'effective quota extension' },
]

export default function Home() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])
  const heroY = useTransform(scrollYProgress, [0, 0.6], [0, 40])

  // override globals.css body bg so it doesn't bleed through
  useEffect(() => {
    document.body.style.background = ''
    document.body.style.backgroundImage = 'none'
  }, [dark])

  // Theme tokens
  const bg        = dark ? 'bg-background'       : 'bg-background'
  const bgAlt     = dark ? 'bg-background'       : 'bg-secondary'
  const bgCard    = dark ? 'bg-card'        : 'bg-card'
  const border    = 'border-border'
  const text      = dark ? 'text-foreground'      : 'text-foreground'
  const textMuted = dark ? 'text-muted-foreground'      : 'text-muted-foreground'
  const textFaint = dark ? 'text-muted-foreground'      : 'text-muted-foreground'

  // Lavender accent (using CSS variables via getComputedStyle is not needed;
  // keep string constants for the few inline style usages that remain)
  const lav       = 'hsl(var(--primary))'
  const lavDeep   = 'hsl(var(--primary))'
  const lavDeeper = 'hsl(var(--primary) / 0.85)'
  const lavIconBg = dark
    ? 'bg-primary/10 border border-primary/20 text-primary'
    : 'bg-primary/15 border border-primary/30 text-primary'
  const lavPill = dark
    ? 'border-primary/30 bg-primary/10 text-primary/80'
    : 'border-primary/40 bg-primary/15 text-primary'

  return (
    <>
      <Head>
        <title>Evols AI - The Team AI Operating System</title>
        <meta name="description" content="Evols eliminates the handoff tax. Every AI session your team runs compounds into shared intelligence — zero cold start, no duplicate work, full quota visibility." />
        <meta property="og:title" content="Evols AI — The Team AI Operating System" />
        <meta property="og:description" content="Turn every AI session into team intelligence. One plugin install activates everything." />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "Evols AI",
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "offers": { "@type": "Offer", "price": "49", "priceCurrency": "USD" },
          "description": "The team AI operating system.",
          "url": "https://evols.ai",
        })}} />
      </Head>

      <div className={`min-h-screen ${bg} ${text} antialiased transition-colors duration-300`}>

        {/* ── NAV ── */}
        <Header variant="landing" />

        {/* ── HERO ── */}
        <section ref={heroRef} className="relative pt-40 pb-32 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] blur-[120px] rounded-full bg-primary/10" />
            <div className={`absolute top-20 left-1/4 w-[400px] h-[300px] blur-[100px] rounded-full ${dark ? 'bg-primary/5' : 'bg-primary/[0.07]'}`} />
          </div>
          <div className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: dark
                ? 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)'
                : 'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }} />

          <motion.div style={{ opacity: heroOpacity, y: heroY }}
            className="relative max-w-4xl mx-auto px-6 text-center">

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-8 ${lavPill} text-xs font-medium tracking-wide`}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: lav }} />
              Now in early access — limited design partner spots
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.05 }}
              className="text-5xl md:text-7xl font-medium tracking-[-0.03em] leading-[1.04] mb-6 text-balance">
              The team brain<br />
              <span style={{ color: lav }}>for every AI session</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.1 }}
              className={`text-lg md:text-xl ${textMuted} max-w-2xl mx-auto mb-10 leading-relaxed tracking-[-0.01em]`}>
              Evols turns every AI session your team runs into shared, compounding intelligence →
              zero cold start, no duplicate work, full quota visibility.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.15 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/register"
                style={{ backgroundColor: lavDeep }}
                className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-primary-foreground font-medium text-sm tracking-[-0.01em] transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5 shadow-lg"
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = lavDeeper)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = lavDeep)}>
                Get early access
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link href="/book-demo"
                className={`inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border font-medium text-sm tracking-[-0.01em] transition-all duration-200 ${
                  dark
                    ? 'border-white/10 hover:border-white/20 text-muted-foreground hover:text-primary-foreground hover:bg-white/[0.03]'
                    : 'border-black/10 hover:border-black/20 text-muted-foreground hover:text-foreground hover:bg-black/[0.03]'
                }`}>
                Book a demo
              </Link>
            </motion.div>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className={`mt-6 text-xs ${textFaint}`}>
              No credit card required · Try and Cancel anytime
            </motion.p>
          </motion.div>

          {/* Hero terminal */}
          <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
            className="relative max-w-3xl mx-auto mt-20 px-6">
            <div className={`rounded-2xl border ${border} ${bgCard} overflow-hidden shadow-2xl ${dark ? 'shadow-black/60' : 'shadow-black/8'}`}>
              <div className={`flex items-center gap-1.5 px-4 py-3 border-b ${border}`}>
                <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                <span className={`ml-3 text-xs ${textFaint} font-mono`}>evols · session end</span>
              </div>
              <div className="p-5 font-mono text-xs leading-relaxed">
                <p className="text-[#22C55E]">✅ Session complete: retention pain points mapped</p>
                <p className={`${textFaint} mt-2`}>Added to team knowledge base:</p>
                <p className={`${textMuted} ml-3`}>→ 5 insights on SMB churn triggers</p>
                <p className={`${textMuted} ml-3`}>→ 2 product decisions: onboarding over activation</p>
                <p className={`${textMuted} ml-3`}>→ Interview framework filed under /customers/smb/</p>
                <div className={`mt-3 pt-3 border-t ${border}`}>
                  <p className={textFaint}>Retrieved from team knowledge base:</p>
                  <p className={`${textMuted} ml-3`}>→ Tom's pricing research <span className={textFaint}>(847 tokens — saved ~6,800)</span></p>
                  <p className={`${textMuted} ml-3`}>→ Jordan's onboarding drop-off analysis <span className={textFaint}>(623 tokens — saved ~5,200)</span></p>
                </div>
                <div className={`mt-3 pt-3 border-t ${border}`}>
                  <p className={textFaint}>Quota: <span style={{ color: lav }}>████████░░ 68% used</span> · resets in 4h 12m</p>
                  <p className={textFaint}>Background task: <span className={textMuted}>PRD-47 gap analysis queued ↗</span></p>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-2/3 h-16 blur-2xl rounded-full pointer-events-none"
              style={{ backgroundColor: `${lav}20` }} />
          </motion.div>
        </section>

        {/* ── STATS STRIP ── */}
        <section className={`border-y ${border} py-12 ${bgAlt} transition-colors duration-300`}>
          <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                className="text-center">
                <div className={`text-3xl font-medium tracking-[-0.03em] ${text} mb-1`}>{s.value}</div>
                <div className={`text-xs ${textFaint} leading-snug`}>{s.label}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── PROBLEMS ── */}
        <section id="product" className="py-28 max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <SectionLabel dark={dark} border={border} textFaint={textFaint}>The problem</SectionLabel>
            <h2 className={`text-4xl md:text-5xl font-medium tracking-[-0.03em] leading-[1.08] mb-5 ${text}`}>
              Six ways teams waste<br />
              <span className={textMuted}>their collective AI investment</span>
            </h2>
            <p className={`${textFaint} max-w-xl mx-auto text-base leading-relaxed`}>
              AI tools are built for individuals. Teams using them collectively suffer compounding failures that no single tool today addresses.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROBLEMS.map((p, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                className="h-full">
                <SpotlightCard dark={dark}>
                  <div className="p-6">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${lavIconBg}`}>
                        {p.icon}
                      </div>
                      <span className={`text-xs font-medium ${textFaint} tracking-wide uppercase`}>{p.label}</span>
                    </div>
                    <h3 className={`text-base font-medium tracking-[-0.02em] mb-2 ${text}`}>{p.title}</h3>
                    <p className={`text-sm ${textFaint} leading-relaxed`}>{p.body}</p>
                  </div>
                </SpotlightCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className={`py-28 ${bgAlt} border-y ${border} transition-colors duration-300`}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <SectionLabel dark={dark} border={border} textFaint={textFaint}>The solution</SectionLabel>
              <h2 className={`text-4xl md:text-5xl font-medium tracking-[-0.03em] leading-[1.08] mb-5 ${text}`}>
                One install. Everything connects.
              </h2>
              <p className={`${textFaint} max-w-xl mx-auto text-base leading-relaxed`}>
                The Evols plugin bundles hooks, MCP server, and team context — no manual configuration.
              </p>
            </div>

            <div className="max-w-2xl mx-auto mb-16">
              <div className={`rounded-2xl border ${border} ${bgCard} overflow-hidden shadow-lg ${dark ? 'shadow-black/40' : 'shadow-black/6'}`}>
                <div className={`flex items-center gap-1.5 px-4 py-3 border-b ${border}`}>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                  <span className={`ml-3 text-xs ${textFaint} font-mono`}>terminal</span>
                </div>
                <div className="p-5 font-mono text-sm">
                  <p><span className={textFaint}>$ </span><span className={text}>claude plugin install evols</span></p>
                  <p className={`${textMuted} mt-2`}>→ Enter your team workspace URL: <span style={{ color: lav }}>app.evols.ai/acme</span></p>
                  <p className={textMuted}>→ Enter your API key: <span style={{ color: lav }}>••••••••••••</span></p>
                  <p className="text-[#22C55E] mt-2">✓ Hooks registered · MCP server active · Team context loaded</p>
                  <p className="text-[#22C55E]">✓ Done. Your team's knowledge base is ready.</p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { step: '01', title: 'Session starts', body: 'Evols fires the SessionStart hook. Team knowledge base context is injected immediately. No cold start. No accumulation period. Day one.' },
                { step: '02', title: 'Every prompt, enriched', body: 'UserPromptSubmit hook checks for redundant work. Injects relevant prior context. Tracks session token usage client-side in real time.' },
                { step: '03', title: 'Session ends, team gets smarter', body: 'Stop hook syncs outcomes to the team knowledge base. StopFailure hook detects rate limits and queues work for the next window.' },
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="h-full">
                  <SpotlightCard dark={dark}>
                    <div className="p-6">
                      <div className={`text-4xl font-medium tracking-[-0.04em] mb-4 ${dark ? 'text-primary-foreground/10' : 'text-black/10'}`}>{s.step}</div>
                      <h3 className={`text-base font-medium tracking-[-0.02em] mb-2 ${text}`}>{s.title}</h3>
                      <p className={`text-sm ${textFaint} leading-relaxed`}>{s.body}</p>
                    </div>
                  </SpotlightCard>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="py-28 max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <SectionLabel dark={dark} border={border} textFaint={textFaint}>Capabilities</SectionLabel>
            <h2 className={`text-4xl md:text-5xl font-medium tracking-[-0.03em] leading-[1.08] mb-5 ${text}`}>
              Four capabilities.<br />
              <span className={textMuted}>One compounding system.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                className="h-full">
                <SpotlightCard dark={dark}>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${lavIconBg}`}>
                        {f.icon}
                      </div>
                      <div className="text-right">
                        <div className={`text-xl font-medium tracking-[-0.03em] ${text}`}>{f.stat}</div>
                        <div className={`text-[10px] ${textFaint} tracking-wide uppercase`}>{f.statLabel}</div>
                      </div>
                    </div>
                    <h3 className={`text-base font-medium tracking-[-0.02em] mb-2 ${text}`}>{f.title}</h3>
                    <p className={`text-sm ${textFaint} leading-relaxed`}>{f.description}</p>
                  </div>
                </SpotlightCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── TESTIMONIALS ── */}
        <section className={`py-28 ${bgAlt} border-y ${border} transition-colors duration-300`}>
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-14">
              <SectionLabel dark={dark} border={border} textFaint={textFaint}>Validation</SectionLabel>
              <h2 className={`text-4xl md:text-5xl font-medium tracking-[-0.03em] leading-[1.08] ${text}`}>
                The gap is publicly named<br />
                <span className={textMuted}>at the highest level</span>
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {TESTIMONIALS.map((t, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="h-full">
                  <SpotlightCard dark={dark}>
                    <div className="p-8">
                      <p className={`${text} text-lg leading-relaxed tracking-[-0.01em] mb-6`}>
                        "{t.quote}"
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium flex-shrink-0"
                          style={{ backgroundColor: lavDeep }}>
                          {t.initials}
                        </div>
                        <div>
                          <div className={`text-sm font-medium ${text}`}>{t.author}</div>
                          <div className={`text-xs ${textFaint}`}>{t.role} · {t.date}</div>
                        </div>
                      </div>
                    </div>
                  </SpotlightCard>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 grid md:grid-cols-3 gap-4">
              {[
                { icon: '📰', text: 'Token exhaustion documented by BBC, Forbes, MacRumors — March 2026' },
                { icon: '💡', text: 'VCs calling team context infrastructure "the next big thing in AI" — Forbes, April 2026' },
                { icon: '🔴', text: 'GitHub Copilot Workspace shut down. No replacement exists.' },
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                  className="h-full">
                  <SpotlightCard dark={dark}>
                    <div className="flex items-start gap-3 p-4">
                      <span className="text-lg">{s.icon}</span>
                      <p className={`text-xs ${textFaint} leading-relaxed`}>{s.text}</p>
                    </div>
                  </SpotlightCard>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className={`py-28 ${bgAlt} border-t ${border} transition-colors duration-300`}>
          <div className="max-w-3xl mx-auto px-6 text-center">
            <div className="relative">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] blur-[100px] rounded-full"
                  style={{ backgroundColor: `${lav}18` }} />
              </div>
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <h2 className={`text-4xl md:text-5xl font-medium tracking-[-0.03em] leading-[1.08] mb-5 ${text}`}>
                  Stop rebuilding what<br />
                  <span className={textMuted}>your team already knows</span>
                </h2>
                <p className={`${textFaint} text-lg mb-10 leading-relaxed`}>
                  Every session should compound into shared intelligence — not disappear when the window closes.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link href="/register"
                    style={{ backgroundColor: lavDeep }}
                    className="group inline-flex items-center gap-2 px-7 py-4 rounded-xl text-primary-foreground font-medium text-base tracking-[-0.01em] transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5 shadow-lg"
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = lavDeeper)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = lavDeep)}>
                    Get early access
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                  <Link href="/book-demo"
                    className={`inline-flex items-center gap-2 px-7 py-4 rounded-xl border font-medium text-base tracking-[-0.01em] transition-all duration-200 ${
                      dark
                        ? 'border-white/10 hover:border-white/20 text-muted-foreground hover:text-primary-foreground hover:bg-white/[0.03]'
                        : 'border-black/10 hover:border-black/20 text-muted-foreground hover:text-foreground hover:bg-black/[0.03]'
                    }`}>
                    Book a demo
                  </Link>
                </div>
                <p className={`mt-5 text-xs ${textFaint}`}>Active with Claude Code, Copilot, Kiro, Cursor, and Cline</p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className={`border-t ${border} py-12 transition-colors duration-300`}>
          <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <LogoWordmark iconSize={32} />
            <div className="flex items-center gap-6 flex-wrap justify-center">
              {[
                { label: 'Docs', href: '/docs' },
                { label: 'Support', href: '/support' },
                { label: 'Login', href: '/login' },
              ].map(l => (
                <Link key={l.label} href={l.href}
                  {...(l.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className={`text-sm ${textFaint} transition-colors duration-150`}>
                  {l.label}
                </Link>
              ))}
            </div>
            <p className={`text-xs ${textFaint}`}>© 2026 Evols AI</p>
          </div>
        </footer>

      </div>
    </>
  )
}

function SectionLabel({ dark, border, textFaint, children }: {
  dark: boolean
  border: string
  textFaint: string
  children: React.ReactNode
}) {
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${border} ${dark ? 'bg-white/[0.03]' : 'bg-black/[0.03]'} ${textFaint} text-xs font-medium tracking-wide mb-5`}>
      {children}
    </div>
  )
}
