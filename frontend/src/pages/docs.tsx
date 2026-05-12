import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
  Zap, Users, UserPlus, CheckCircle2, Copy, Check, ArrowRight,
  Sparkles, Search, Brain, MessageSquare,
  Plug, RefreshCw, Shield, Database, GitMerge,
  Mail, BookOpen, BarChart2, HelpCircle, Github,
  Clock, AlertCircle, Info,
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

type QuickstartTab = 'solo' | 'team-setup' | 'new-member'

const NAV_GROUPS = [
  {
    group: 'Getting Started',
    items: [{ id: 'getting-started', label: 'Quickstart' }],
  },
  {
    group: 'Features',
    items: [
      { id: 'workbench', label: 'AI Workbench' },
      { id: 'work-context', label: 'Work Context' },
      { id: 'knowledge', label: 'Knowledge & Graph' },
      { id: 'integrations', label: 'Integrations' },
    ],
  },
  {
    group: 'Developer',
    items: [
      { id: 'developer-tools', label: 'Developer Tools' },
      { id: 'api', label: 'REST API' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { id: 'tenancy', label: 'Tenancy & Workspaces' },
      { id: 'byok', label: 'BYOK — LLM Providers' },
    ],
  },
  {
    group: 'Help',
    items: [{ id: 'support', label: 'Support' }],
  },
]

const ALL_SECTION_IDS = NAV_GROUPS.flatMap(g => g.items.map(i => i.id))

const INTEGRATION_SOURCES = [
  {
    icon: MessageSquare,
    name: 'Slack',
    authType: 'OAuth 2.0 (Bot token)',
    scopes: ['channels:history', 'channels:read', 'users:read'],
    configFields: 'Channel IDs to watch (leave empty = all public channels)',
    syncFrequency: 'Every 5 minutes',
    dataFetched: 'Public and private channel messages, threads, and reactions you have access to',
    identitySignal: 'Slack user ID linked to email for cross-source identity resolution',
    notes: 'Requires workspace admin to install the Slack app. Direct messages are never fetched.',
  },
  {
    icon: Mail,
    name: 'Outlook / Office 365',
    authType: 'Microsoft OAuth (delegated, per-user)',
    scopes: ['Mail.Read', 'Calendars.Read', 'User.Read', 'offline_access'],
    configFields: 'None — fetches your own inbox and calendar',
    syncFrequency: 'Every 5 minutes via Microsoft Graph delta API',
    dataFetched: 'Email subjects, senders, bodies (truncated at 4 KB), and calendar event titles',
    identitySignal: 'Microsoft account UPN linked to Evols user',
    notes: 'Only your own mailbox and calendar — no tenant-wide access. Uses incremental delta tokens to avoid re-fetching old mail.',
  },
  {
    icon: Users,
    name: 'Microsoft Teams',
    authType: 'Microsoft OAuth (delegated, per-user)',
    scopes: ['ChannelMessage.Read.All', 'Chat.Read', 'User.Read', 'offline_access'],
    configFields: 'None — fetches channels and chats you are a member of',
    syncFrequency: 'Every 5 minutes via Microsoft Graph',
    dataFetched: 'Channel messages and replies you have access to; direct chat messages',
    identitySignal: 'Microsoft account UPN linked to Evols user',
    notes: 'Requires Microsoft to grant ChannelMessage.Read.All for your tenant — some IT admins restrict this scope.',
  },
  {
    icon: BookOpen,
    name: 'Notion',
    authType: 'Notion OAuth (per-user integration)',
    scopes: ['read_content'],
    configFields: 'None — fetches all pages and databases shared with the Notion integration',
    syncFrequency: 'Every 5 minutes',
    dataFetched: 'Page titles, block text, and database rows from pages you share with the integration',
    identitySignal: 'Notion workspace ID linked to Evols user',
    notes: 'You control which pages are shared — open the Notion page menu and click "Connect to Evols" to grant access.',
  },
  {
    icon: BarChart2,
    name: 'Salesforce',
    authType: 'Salesforce OAuth 2.0 (per-user)',
    scopes: ['api', 'refresh_token'],
    configFields: 'None — fetches Accounts, Contacts, Opportunities, and Notes you have read access to',
    syncFrequency: 'Every 5 minutes',
    dataFetched: 'Account names, contact names + titles, opportunity stages and amounts, activity notes',
    identitySignal: 'Salesforce user email linked to Evols user',
    notes: 'Only records visible to your Salesforce profile are fetched — Evols does not elevate permissions.',
  },
  {
    icon: HelpCircle,
    name: 'Zendesk',
    authType: 'Zendesk API token (Bearer)',
    scopes: ['read'],
    configFields: 'Zendesk subdomain (e.g. acme for acme.zendesk.com)',
    syncFrequency: 'Every 5 minutes',
    dataFetched: 'Ticket subjects, descriptions, comments, and tags from tickets assigned to or CC\'d to you',
    identitySignal: 'Zendesk agent email linked to Evols user',
    notes: 'Paste your Zendesk API token (not your password) from Zendesk → Profile → API → Token Access.',
  },
  {
    icon: Github,
    name: 'GitHub',
    authType: 'GitHub Personal Access Token',
    scopes: ['repo (read)', 'read:user'],
    configFields: 'Repository name in org/repo format (e.g. acme/backend)',
    syncFrequency: 'Every 5 minutes',
    dataFetched: 'Issue titles and bodies, pull request titles, descriptions, and review comments',
    identitySignal: 'GitHub username linked to Evols user',
    notes: 'Use a fine-grained token scoped to specific repos for least-privilege access.',
  },
]

export default function Docs() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const [activeSection, setActiveSection] = useState('getting-started')
  const [quickstartTab, setQuickstartTab] = useState<QuickstartTab>('solo')

  useEffect(() => {
    document.body.style.background = ''
    document.body.style.backgroundImage = 'none'
  }, [dark])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        }
      },
      { rootMargin: '-15% 0px -75% 0px', threshold: 0 }
    )
    ALL_SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  const quickstartTabs: { id: QuickstartTab; label: string; icon: React.ElementType; time: string }[] = [
    { id: 'solo',       label: 'Individual Setup', icon: Zap,      time: '2 min' },
    { id: 'team-setup', label: 'Team Setup',        icon: Users,    time: '5 min' },
    { id: 'new-member', label: 'New Team Member',   icon: UserPlus, time: '3 min' },
  ]

  return (
    <>
      <Head>
        <title>Documentation - Evols</title>
        <style>{`h1,h2,h3,h4,h5,h6{font-family:'Syne',system-ui,sans-serif!important}`}</style>
      </Head>

      <div className="min-h-screen bg-background">
        <Header variant="landing" />

        <div className="flex pt-16">

          {/* Left sidebar */}
          <aside className="hidden lg:flex flex-col w-56 shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto border-r border-border py-8 px-3">
            <div className="space-y-5">
              {NAV_GROUPS.map(({ group, items }) => (
                <div key={group}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-2">
                    {group}
                  </p>
                  <ul className="space-y-0.5">
                    {items.map(({ id, label }) => (
                      <li key={id}>
                        <button
                          onClick={() => scrollTo(id)}
                          className={`w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors ${
                            activeSection === id
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                          }`}
                        >
                          {label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0 px-8 lg:px-14 py-10">
            <div className="space-y-14">

              {/* ── Quickstart ─────────────────────────────────────── */}
              <Section id="getting-started" title="Quickstart">
                <p className="text-sm text-muted-foreground mb-6">
                  Your team&apos;s AI brain — shared knowledge graph, coding agent intelligence, and PM skills in one place.
                </p>

                {/* Tab selector */}
                <div className="flex gap-2 flex-wrap mb-8">
                  {quickstartTabs.map(({ id, label, icon: Icon, time }) => (
                    <button
                      key={id}
                      onClick={() => setQuickstartTab(id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        quickstartTab === id
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        quickstartTab === id ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>{time}</span>
                    </button>
                  ))}
                </div>

                {/* Individual Setup */}
                {quickstartTab === 'solo' && (
                  <div>
                    <div className="mb-6">
                      <h3 className="text-base font-medium text-foreground mb-1">Individual Setup</h3>
                      <p className="text-sm text-muted-foreground">
                        Get Evols running for yourself in under 2 minutes. Start building your personal knowledge base and wiring it into your coding agents — your teammates can join later.
                      </p>
                    </div>
                    <Step n={1} title="Create your account">
                      <p>
                        Register at <Link href="/register" className="text-primary hover:underline">/register</Link>.
                        Your account creates an isolated workspace — all your knowledge, skills, and AI config live here.
                      </p>
                      <Callout type="info">
                        Check your inbox for a verification email before logging in. If it doesn&apos;t arrive within a minute, check your spam folder.
                      </Callout>
                    </Step>
                    <Step n={2} title="Configure your LLM provider">
                      <p>
                        Evols requires your own LLM API key (BYOK). Go to <strong className="text-foreground">Settings → LLM Settings</strong> and connect a provider.
                      </p>
                      <div className="rounded-lg border border-border bg-card p-4 space-y-1.5 mt-2">
                        {[
                          ['AWS Bedrock', 'Best overall — native embeddings + strong models'],
                          ['OpenAI', 'GPT-4o / GPT-5.4 — native embeddings'],
                          ['Anthropic', 'Claude Sonnet 4.6 — no native embeddings, falls back to local'],
                          ['OpenRouter', '200+ models via one key — good for experimentation'],
                        ].map(([name, note]) => (
                          <div key={name} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                            <span><strong className="text-foreground">{name}</strong> — {note}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2">After saving, click <strong className="text-foreground">Test Connection</strong> to confirm the key and model are reachable.</p>
                      <Callout type="tip">
                        AWS Bedrock is recommended — Amazon Titan embeddings are included automatically, enabling full semantic search in the knowledge graph.
                      </Callout>
                    </Step>
                    <Step n={3} title="Add knowledge sources">
                      <p>
                        Go to <strong className="text-foreground">Knowledge</strong> and upload your first documents — meeting notes, product briefs, customer research, or any text, PDF, or Markdown file.
                        Evols runs LightRAG entity extraction in the background and builds your knowledge graph automatically.
                      </p>
                      <p>What gets extracted:</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {['Personas', 'Pain Points', 'Feature Requests', 'Decisions', 'Competitors', 'Meetings', 'Products'].map(t => (
                          <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{t}</span>
                        ))}
                      </div>
                    </Step>
                    <Step n={4} title="Install the Evols CLI and wire your coding agents">
                      <p>
                        The Evols CLI wires a global MCP server and process-level hooks into every coding agent on your machine. Claude Code, Cursor, Zed, Codex, and Antigravity are detected and configured automatically.
                      </p>
                      <p className="font-medium text-foreground">macOS / Linux</p>
                      <CodeBlock>{`# Install the CLI
curl -fsSL https://api.evols.ai/api/v1/install/script | sh

# Log in with your API key (Settings → Security → New Key)
evols login

# Wire up all detected coding agents
evols install`}</CodeBlock>
                      <p className="font-medium text-foreground">Windows</p>
                      <CodeBlock>{`# Install the CLI (PowerShell — run as Administrator)
irm https://api.evols.ai/api/v1/install/script.ps1 | iex

# Log in with your API key
evols login

# Wire up all detected coding agents
evols install`}</CodeBlock>
                      <Callout type="info">
                        On Windows, WSL is also supported — run the macOS/Linux install inside a WSL terminal if you prefer a Unix environment.
                      </Callout>
                      <p>Then initialise Evols in any project repo:</p>
                      <CodeBlock>{`cd ~/your-project
evols init`}</CodeBlock>
                      <Callout type="tip">
                        Restart your coding agent after running <code className="bg-muted px-1 py-0.5 rounded text-xs">evols install</code> to pick up the new MCP server and hooks.
                      </Callout>
                    </Step>
                    <Step n={5} title="Open the Workbench and start using skills">
                      <p>
                        Go to <strong className="text-foreground">Workbench</strong> in the app. It&apos;s a conversational AI chat pre-loaded with 80+ PM and engineering skills — product strategy, PRD writing, competitive analysis, sprint planning, and more.
                      </p>
                      <p>Try a few prompts to see your knowledge in action:</p>
                      <div className="space-y-1.5 mt-2">
                        {[
                          '"What are the top pain points from our last customer research?"',
                          '"Draft a PRD for the async commenting feature."',
                          '"Summarise what we know about our remote worker persona."',
                        ].map(p => (
                          <div key={p} className="flex items-start gap-2 text-sm italic text-muted-foreground">
                            <span className="text-primary mt-0.5">→</span>
                            <span>{p}</span>
                          </div>
                        ))}
                      </div>
                    </Step>
                    <div className="mt-4 p-5 rounded-xl border border-primary/20 bg-primary/5">
                      <h3 className="text-sm font-medium text-foreground mb-1">Ready to bring in your team?</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Switch to <strong>Team Setup</strong> to invite teammates and start sharing the knowledge graph.
                      </p>
                      <button onClick={() => setQuickstartTab('team-setup')} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                        Team Setup guide <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Team Setup */}
                {quickstartTab === 'team-setup' && (
                  <div>
                    <div className="mb-6">
                      <h3 className="text-base font-medium text-foreground mb-1">Team Setup</h3>
                      <p className="text-sm text-muted-foreground">
                        For the person creating the workspace. Complete the individual setup first, then follow these steps to onboard your team.
                      </p>
                      <Callout type="info">
                        Already done individual setup? Start from step 1. New here? Switch to the <button onClick={() => setQuickstartTab('solo')} className="text-primary hover:underline">Individual Setup</button> tab first.
                      </Callout>
                    </div>
                    <Step n={1} title="Generate an API key for each team member">
                      <p>
                        Go to <strong className="text-foreground">Settings → Security → New Key</strong>. Generate one key per person, or share a single team key — your choice. Keys use the <code className="bg-muted px-1 py-0.5 rounded text-xs">evols_</code> prefix.
                      </p>
                    </Step>
                    <Step n={2} title="Invite team members to your workspace">
                      <p>
                        Go to <strong className="text-foreground">Settings → Team → Invite</strong>. Enter each person&apos;s email — they&apos;ll receive an invitation link to create their account and join your workspace automatically.
                      </p>
                      <Callout type="info">
                        Only <strong>TENANT_ADMIN</strong> users can invite teammates. The first person to register is automatically the admin.
                      </Callout>
                    </Step>
                    <Step n={3} title="Seed the knowledge graph with your team's context">
                      <p>
                        Upload your most important documents to <strong className="text-foreground">Knowledge</strong> before teammates join — so they arrive to a populated knowledge graph, not an empty one. Good starting points:
                      </p>
                      <div className="space-y-1 mt-2">
                        {[
                          'Customer research and interview notes',
                          'Product strategy and roadmap docs',
                          'Architecture decision records (ADRs)',
                          'Meeting transcripts or summaries',
                          'Competitive analysis',
                        ].map(item => (
                          <div key={item} className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </Step>
                    <Step n={4} title="Connect live data integrations">
                      <p>
                        Go to <strong className="text-foreground">Settings → Integrations</strong> to connect Slack, Notion, GitHub, Salesforce, Zendesk, Outlook, or Teams. Each integration syncs every 5 minutes and feeds entities into the knowledge graph automatically.
                      </p>
                      <button onClick={() => scrollTo('integrations')} className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1">
                        Integration setup guide <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </Step>
                    <Step n={5} title="Initialise Evols in your shared repositories">
                      <p>
                        Run <code className="bg-muted px-1 py-0.5 rounded text-xs">evols init</code> in each shared repo. When teammates pull the repo, they automatically get the team context injected for whatever coding agent they use.
                      </p>
                      <CodeBlock>{`cd ~/your-project
evols init
git add .
git commit -m "chore: add Evols team intelligence config"`}</CodeBlock>
                    </Step>
                    <Step n={6} title="Share the New Team Member guide with teammates">
                      <p>
                        Send teammates the link to this page and tell them to open the <strong className="text-foreground">New Team Member</strong> tab in the Quickstart section. All they need is the invite email, the CLI, and their API key.
                      </p>
                    </Step>
                    <div className="mt-4 p-4 rounded-xl border border-border bg-card text-sm text-muted-foreground">
                      <p className="font-medium text-foreground mb-2">What your team gets from day one</p>
                      <div className="space-y-1">
                        {[
                          'Shared knowledge graph — every upload benefits the whole team',
                          'Redundancy detection — coding agents warn before re-doing work a teammate already did',
                          'Session sync — decisions and context automatically captured at every compaction',
                          '80+ PM and engineering skills available in Workbench',
                        ].map(item => (
                          <div key={item} className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* New Team Member */}
                {quickstartTab === 'new-member' && (
                  <div>
                    <div className="mb-6">
                      <h3 className="text-base font-medium text-foreground mb-1">New Team Member</h3>
                      <p className="text-sm text-muted-foreground">
                        You&apos;ve been invited to an existing Evols workspace. Follow these steps to join and get your coding agents wired up.
                      </p>
                      <Callout type="info">
                        You&apos;ll need: the invite email from your admin, and an <code className="bg-muted px-1 py-0.5 rounded text-xs">evols_...</code> API key — ask your admin to generate one from Settings → Security.
                      </Callout>
                    </div>
                    <Step n={1} title="Accept the invitation">
                      <p>
                        Click the link in your invite email. It takes you to Evols where you&apos;ll create your account and join your team&apos;s workspace automatically.
                        You&apos;ll land directly inside the shared knowledge graph — no tenant setup needed.
                      </p>
                    </Step>
                    <Step n={2} title="Install the Evols CLI">
                      <p className="font-medium text-foreground">macOS / Linux</p>
                      <CodeBlock>{`curl -fsSL https://api.evols.ai/api/v1/install/script | sh`}</CodeBlock>
                      <p className="font-medium text-foreground">Windows</p>
                      <CodeBlock>{`# PowerShell — run as Administrator
irm https://api.evols.ai/api/v1/install/script.ps1 | iex`}</CodeBlock>
                      <Callout type="info">
                        On Windows, WSL is also supported — run the macOS/Linux install inside a WSL terminal if you prefer a Unix environment.
                      </Callout>
                    </Step>
                    <Step n={3} title="Log in with your API key">
                      <p>
                        Get an <code className="bg-muted px-1 py-0.5 rounded text-xs">evols_...</code> API key from <strong className="text-foreground">Settings → Security → New Key</strong>, or ask your admin.
                      </p>
                      <CodeBlock>{`evols login
# Paste your evols_... API key when prompted`}</CodeBlock>
                    </Step>
                    <Step n={4} title="Install into your coding agents">
                      <p>One command detects and wires up Claude Code, Cursor, Zed, and Codex automatically:</p>
                      <CodeBlock>{`evols install`}</CodeBlock>
                      <p>Restart your coding agent after this step, then verify:</p>
                      <CodeBlock>{`evols status`}</CodeBlock>
                      <p>You should see <code className="bg-muted px-1 py-0.5 rounded text-xs">✓ MCP installed</code> for each detected agent and all hooks registered.</p>
                    </Step>
                    <Step n={5} title="Initialise Evols in your project repos">
                      <p>
                        If your team already ran <code className="bg-muted px-1 py-0.5 rounded text-xs">evols init</code> and committed the result, you&apos;re done — pull the repo and restart your agent.
                        If not, run:
                      </p>
                      <CodeBlock>{`cd ~/your-project
evols init`}</CodeBlock>
                    </Step>
                    <Step n={6} title="Verify team context is loading">
                      <p>Start a new session in your coding agent. You should see a message like:</p>
                      <div className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground font-mono">
                        [Evols] Loaded 12 team knowledge entries (4,320 tokens retrieved · ~30,240 tokens saved vs. compiling fresh)
                      </div>
                      <Callout type="info">
                        If you see <em>&ldquo;No relevant context yet&rdquo;</em>, your workspace may be freshly set up. Ask your admin to upload some documents to Knowledge, or add some yourself.
                      </Callout>
                    </Step>
                    <div className="mt-4 p-5 rounded-xl border border-primary/20 bg-primary/5">
                      <h3 className="text-sm font-medium text-foreground mb-2">What happens in your coding sessions now</h3>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        {[
                          ['Before every prompt', 'Evols checks if a teammate already researched your topic and surfaces it'],
                          ['Before every Bash / web fetch', 'Redundancy check fires — prevents re-doing work a colleague already did'],
                          ['Before context compaction', 'Session knowledge is synced to the team graph automatically'],
                          ['At session end', 'Token usage and quota tracked across your team'],
                        ].map(([when, what]) => (
                          <div key={when} className="flex gap-3">
                            <span className="shrink-0 text-primary font-medium">{when}</span>
                            <span>{what}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Section>

              {/* ── AI Workbench ───────────────────────────────────── */}
              <Section id="workbench" title="AI Workbench">
                <div className="space-y-6">
                  <p className="text-sm text-muted-foreground">
                    The Workbench is a conversational AI interface pre-configured for team collaboration and coordination work.
                    It connects to your uploaded knowledge (via LightRAG), your Work Context, and optionally the web (via Tavily/Serper)
                    to produce responses grounded in your actual product situation.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      { icon: Brain, title: 'Knowledge-grounded', desc: 'Responses use your uploaded documents and extracted entities from the Knowledge Graph' },
                      { icon: Search, title: 'Internet search', desc: 'Real-time web search via Tavily or Serper for competitive research and market data' },
                      { icon: Zap, title: '80+ PM skills', desc: 'Pre-built skills for strategy, execution, discovery, and communication' },
                      { icon: MessageSquare, title: 'Persistent memory', desc: 'Conversation history is preserved — pick up where you left off' },
                    ].map(({ icon: Icon, title, desc }) => (
                      <div key={title} className="p-4 rounded-xl border bg-card border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-foreground">{title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <h3 className="text-base font-medium text-foreground mb-3">Skills Library</h3>
                    <p className="text-sm text-muted-foreground mb-3">Skills are selected from the sidebar or via the skills menu in the chat. Each skill loads a focused PM prompt context.</p>
                    <div className="space-y-3">
                      {[
                        { category: 'Strategy', skills: ['Product strategy document', 'Competitive analysis', 'Opportunity sizing', 'Market positioning', 'Roadmap planning'] },
                        { category: 'Discovery', skills: ['Assumption mapping', 'Jobs-to-be-done analysis', 'User story generation', 'Problem statement framing', 'Research plan'] },
                        { category: 'Execution', skills: ['PRD writer', 'Technical spec', 'Sprint planning', 'Acceptance criteria', 'Definition of done'] },
                        { category: 'Communication', skills: ['Stakeholder update', 'Executive briefing', 'Meeting prep', 'Weekly update', 'Decision brief', 'Retrospective summary'] },
                        { category: 'Analysis', skills: ['RICE scoring', 'OKR drafting', 'Pre-mortem', 'Feedback synthesis', 'Win/loss analysis'] },
                      ].map(({ category, skills }) => (
                        <div key={category} className="p-4 rounded-xl border bg-card border-border">
                          <h4 className="text-sm font-medium text-foreground mb-2">{category}</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {skills.map(s => (
                              <span key={s} className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border">{s}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-medium text-foreground mb-2">Internet Search</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      When internet search is enabled (configure a Tavily or Serper API key in Settings), the AI can pull real-time information for:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                      <li>Competitor feature research</li>
                      <li>Market sizing and trends</li>
                      <li>Industry benchmarks</li>
                      <li>Recent product announcements</li>
                    </ul>
                    <p className="text-sm text-muted-foreground mt-2">Internet search is triggered automatically when the AI determines external data would improve the response.</p>
                  </div>

                  <div>
                    <h3 className="text-base font-medium text-foreground mb-2">Knowledge Integration</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      The Workbench uses your team&apos;s knowledge context automatically. When you ask a question, it retrieves
                      relevant content from your uploaded sources and the Knowledge Graph using hybrid RAG (local + global search modes).
                    </p>
                    <p className="text-sm text-muted-foreground">
                      To ensure good grounding: add sources via the Knowledge page, then use the Sync Data button on the
                      Knowledge Graph tab to populate the LightRAG index. The Workbench will then cite from those sources.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-medium text-foreground mb-2">Tips</h3>
                    <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                      <li><strong className="text-foreground">Be specific:</strong> &ldquo;Write a PRD for mobile offline sync targeting Enterprise customers in Q3&rdquo; beats &ldquo;write a PRD&rdquo;</li>
                      <li><strong className="text-foreground">Use constraints:</strong> Include team size, timeline, and tech constraints for more realistic outputs</li>
                      <li><strong className="text-foreground">Reference personas:</strong> Ask the AI to frame recommendations from the perspective of a specific persona — they&apos;re extracted automatically from your knowledge sources</li>
                      <li><strong className="text-foreground">Iterate:</strong> Skills work best as a starting point — refine the output in follow-up messages</li>
                    </ul>
                  </div>
                </div>
              </Section>

              {/* ── Work Context ───────────────────────────────────── */}
              <Section id="work-context" title="Work Context">
                <FeatureDoc
                  title="Your Personal Work Hub"
                  description="Work Context is a structured view of your role, current projects, tasks, and team. It surfaces what matters most so the AI can ground its responses in your actual situation."
                  features={[
                    'Role and capacity: define your title, team, reporting structure, and weekly bandwidth',
                    'Project tracking: status, stakeholders, goals, and key milestones',
                    'Task board with priority tiers: Critical, High Leverage, Stakeholder, Sweep, Backlog',
                    'AI surfaces Work Context automatically when generating recommendations in Workbench',
                  ]}
                />
              </Section>

              {/* ── Knowledge & Graph ──────────────────────────────── */}
              <Section id="knowledge" title="Knowledge & Knowledge Graph">
                <div className="space-y-4">
                  <FeatureDoc
                    title="Document Intelligence"
                    description="Upload documents, meeting notes, PDFs, or plain text. Evols extracts entities and relationships using LightRAG and builds a queryable knowledge graph."
                    features={[
                      'Supported sources: PDFs, plain text, meeting transcripts, CSV, Markdown',
                      'LightRAG extracts entities: personas, features, pain points, competitors, decisions, and more',
                      'Confidence scoring per entity based on source count, relationship density, and description richness',
                      'Semantic search and graph query via the Query panel in the Knowledge Graph tab',
                    ]}
                  />
                  <FeatureDoc
                    title="Knowledge Graph"
                    description="Explore extracted entities and their relationships in an interactive graph. Filter by entity type, inspect confidence breakdowns, edit or merge nodes."
                    features={[
                      'Entity List and Graph views — filter by type: persona, pain point, feature, competitor, and more',
                      'Edit entity name, type, and description directly from either view',
                      'Merge duplicate entities — relationships are transferred automatically',
                      'Ask the graph natural language questions using hybrid RAG mode',
                      'Personas appear as persona-type entities — automatically extracted, no manual management needed',
                    ]}
                  />
                  <div className="p-5 rounded-xl border bg-card border-border">
                    <h3 className="text-base font-medium mb-1.5 text-foreground">Entity Attributes</h3>
                    <p className="text-sm mb-3 text-muted-foreground">
                      Each extracted entity is tagged with three signal attributes — <strong>sentiment</strong>, <strong>urgency</strong>, and <strong>business impact</strong> — inferred from the source text.
                    </p>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 mb-4 text-xs text-muted-foreground">
                      <span><strong className="text-foreground">Sentiment:</strong> positive · mostly_positive · neutral · mostly_negative · negative</span>
                      <span><strong className="text-foreground">Urgency:</strong> critical · high · medium · low · minimal</span>
                      <span><strong className="text-foreground">Business impact:</strong> transformative · high · medium · low · negligible</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 pr-4 font-medium text-foreground w-32">Entity type</th>
                            <th className="text-left py-2 pr-4 font-medium text-foreground">Sentiment</th>
                            <th className="text-left py-2 pr-4 font-medium text-foreground">Urgency</th>
                            <th className="text-left py-2 font-medium text-foreground">Business impact</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {[
                            ['PainPoint / FeatureRequest', 'User/customer sentiment toward the problem or request', 'How soon this needs to be addressed', 'Consequence to retention or revenue if left unresolved'],
                            ['Decision', 'Team confidence or controversy around the decision', 'Time pressure that drove the decision', 'Strategic weight of the outcome'],
                            ['Person', 'Tone used to describe this person in the source', 'How soon they need follow-up or attention', 'Organisational influence or seniority'],
                            ['Persona', 'Emotional state or frustration level of the segment', 'How urgently the segment needs a solution', 'Revenue or growth potential of the segment'],
                            ['Product / Feature', 'Market or user perception', 'Urgency to ship, fix, or deprecate', 'Revenue or adoption impact'],
                            ['Technology', 'Team attitude toward the technology', 'Urgency to adopt, replace, or upgrade', 'How critical it is to current operations'],
                            ['Competitor', 'Sentiment toward this competitor in the source', 'How imminently they threaten a deal or roadmap item', 'Competitive threat level to the business'],
                            ['Organization', 'Relationship tone (partner, customer, risk)', 'Urgency of any pending action with this org', 'Commercial or strategic importance'],
                            ['Meeting', 'Overall tone of the discussion', 'How time-sensitive the outcomes are', 'Significance of the decisions made'],
                          ].map(([type, sentiment, urgency, impact]) => (
                            <tr key={type}>
                              <td className="py-2 pr-4 font-medium text-foreground align-top">{type}</td>
                              <td className="py-2 pr-4 text-muted-foreground align-top">{sentiment}</td>
                              <td className="py-2 pr-4 text-muted-foreground align-top">{urgency}</td>
                              <td className="py-2 text-muted-foreground align-top">{impact}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                      Values are inferred by the LLM from source text and should be treated as directional signals, not precise measurements.
                    </p>
                  </div>
                </div>
              </Section>

              {/* ── Integrations ───────────────────────────────────── */}
              <Section id="integrations" title="Integrations">
                <div className="space-y-8">
                  <p className="text-sm text-muted-foreground">
                    Connect Slack, Outlook, Teams, Notion, Salesforce, Zendesk, and GitHub to pull live data into the knowledge graph. Each team member connects their own account — data is synced every 5 minutes and entities are extracted automatically.
                  </p>

                  <div>
                    <h3 className="text-base font-medium text-foreground mb-3">Where to Find Integrations</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Integrations live inside the <strong className="text-foreground">Context</strong> page — the same place you upload documents, PDFs, and meeting notes.
                    </p>
                    <StepList steps={[
                      { title: 'Open Context', body: 'Click Context in the left sidebar (the database icon). This opens the unified source management panel.' },
                      { title: 'Switch to the Integrations tab', body: 'At the top of the panel, click the Integrations tab. You will see Connected sources (active) and Available sources (not yet connected).' },
                      { title: 'Pick a source and connect', body: 'Click Connect on any available source card. The card expands to show auth instructions specific to that source.' },
                    ]} />
                    <Callout type="info">
                      The Integrations tab is separate from the Sources tab. Sources = files you upload manually. Integrations = live connections that pull data automatically.
                    </Callout>
                  </div>

                  <div>
                    <h3 className="text-base font-medium text-foreground mb-3">How to Connect a Source</h3>
                    <p className="text-sm font-medium text-foreground mb-2">OAuth sources (Slack, Outlook, Teams, Notion, Salesforce)</p>
                    <StepList steps={[
                      { title: 'Click Connect on the source card', body: 'A popup window opens taking you to the provider\'s login page.' },
                      { title: 'Authorise the Evols application', body: 'Sign in with the account you use for that service. Evols requests read-only access only.' },
                      { title: 'Window closes automatically', body: 'After approval the popup closes and the source card shows a green Connected status. The first sync starts within 5 minutes.' },
                    ]} />
                    <p className="text-sm font-medium text-foreground mt-4 mb-2">Token-based sources (Zendesk, GitHub)</p>
                    <StepList steps={[
                      { title: 'Click Connect on the source card', body: 'The card expands to show a token input field.' },
                      {
                        title: 'Generate an API token in the provider\'s settings',
                        body: (
                          <span>
                            <strong className="text-foreground">Zendesk:</strong> Profile → Security → API Tokens → Add Token.{' '}
                            <strong className="text-foreground">GitHub:</strong> Settings → Developer Settings → Personal Access Tokens → Fine-grained token. Scope to the specific repositories you want Evols to read.
                          </span>
                        ),
                      },
                      { title: 'Paste the token and save', body: 'Enter the token and any required config (e.g. Zendesk subdomain, GitHub repo slug), then click Save.' },
                    ]} />
                    <Callout type="tip">
                      Each team member connects their own account — this lets Evols resolve who is who across different tools (your Slack @name, GitHub username, and Outlook email are all the same person).
                    </Callout>
                  </div>

                  <div>
                    <h3 className="text-base font-medium text-foreground mb-3">Source Reference</h3>
                    <div className="space-y-3">
                      {INTEGRATION_SOURCES.map(source => {
                        const Icon = source.icon
                        return (
                          <details key={source.name} className="rounded-xl border bg-card border-border group">
                            <summary className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none list-none">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Icon className="w-4 h-4 text-primary" />
                              </div>
                              <span className="font-medium text-foreground flex-1">{source.name}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">{source.authType}</span>
                            </summary>
                            <div className="px-5 pb-5 pt-1 border-t border-border">
                              <div className="grid sm:grid-cols-2 gap-4 mt-3">
                                <div>
                                  <p className="text-xs font-medium text-foreground uppercase tracking-wide mb-1">OAuth Scopes</p>
                                  <div>
                                    {source.scopes.map(s => (
                                      <span key={s} className="text-xs font-mono bg-muted px-2 py-0.5 rounded inline-block mr-1 mb-1 text-foreground">{s}</span>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-foreground uppercase tracking-wide mb-1">Config Fields</p>
                                  <p className="text-sm text-muted-foreground">{source.configFields}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-foreground uppercase tracking-wide mb-1">Sync Frequency</p>
                                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                    {source.syncFrequency}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-foreground uppercase tracking-wide mb-1">Identity Signal</p>
                                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                    <GitMerge className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                    {source.identitySignal}
                                  </p>
                                </div>
                                <div className="sm:col-span-2">
                                  <p className="text-xs font-medium text-foreground uppercase tracking-wide mb-1">Data Fetched</p>
                                  <p className="text-sm text-muted-foreground">{source.dataFetched}</p>
                                </div>
                                <div className="sm:col-span-2 p-3 rounded-lg bg-muted/50 border border-border">
                                  <p className="text-xs font-medium text-foreground mb-0.5">Note</p>
                                  <p className="text-xs text-muted-foreground">{source.notes}</p>
                                </div>
                              </div>
                            </div>
                          </details>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-medium text-foreground mb-3">Sync Frequency & Scoping</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Evols polls all connected integrations every <strong className="text-foreground">5 minutes</strong>. Each sync is incremental — only content created or updated since the last successful pull is fetched.
                    </p>
                    <Callout type="warning">
                      Integration syncs consume tokens from your configured LLM API key at the same rate as manual document uploads — approximately 1–3 LLM calls per Slack message thread or email. For active teams with hundreds of daily messages, consider rate-limiting channel scope in the source config.
                    </Callout>
                    <div className="mt-4 rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            <th className="text-left py-2.5 px-4 font-medium text-foreground">Source</th>
                            <th className="text-left py-2.5 px-4 font-medium text-foreground">Config key</th>
                            <th className="text-left py-2.5 px-4 font-medium text-foreground">Example</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {[
                            ['Slack', 'channel_ids', 'C04ABCDEF, C04XYZABC'],
                            ['GitHub', 'repo', 'acme/backend'],
                            ['Zendesk', 'subdomain', 'acme (for acme.zendesk.com)'],
                          ].map(([source, key, example]) => (
                            <tr key={source}>
                              <td className="py-2.5 px-4 font-medium text-foreground">{source}</td>
                              <td className="py-2.5 px-4 font-mono text-xs text-muted-foreground">{key}</td>
                              <td className="py-2.5 px-4 text-muted-foreground">{example}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-medium text-foreground mb-3">Data Pipeline — Integration to Graph</h3>
                    <div className="space-y-2">
                      {[
                        { icon: RefreshCw, step: '1 · Incremental pull', desc: 'Scheduler fetches new items every 5 minutes. Each item (message thread, email, page, issue) is formatted as a plain-text document.' },
                        { icon: Database, step: '2 · LightRAG ingestion', desc: 'The text document is chunked and passed to LightRAG. One LLM call per chunk extracts entities and relationships into the PostgreSQL vector store and the graph.' },
                        { icon: GitMerge, step: '3 · Nightly deduplication', desc: 'A batch job merges duplicate entities and resolves conflicting descriptions using temporal precedence — newer sources win.' },
                        { icon: Shield, step: '4 · Confidence scoring', desc: 'Each entity\'s confidence score is recalculated nightly based on distinct sources, relationship density, and description completeness.' },
                      ].map(({ icon: Icon, step, desc }, i, arr) => (
                        <div key={step} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Icon className="w-4 h-4 text-primary" />
                            </div>
                            {i < arr.length - 1 && <div className="w-px flex-1 bg-border mt-1 mb-1" />}
                          </div>
                          <div className="pb-4">
                            <p className="text-sm font-medium text-foreground">{step}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-medium text-foreground mb-3">Identity Resolution</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      When multiple team members connect the same integration type, Evols correlates the same person across different tools via cross-source identity resolution.
                    </p>
                    <div className="rounded-xl border border-border p-4 bg-muted/30 font-mono text-xs text-muted-foreground space-y-1">
                      <p className="text-foreground font-medium text-sm mb-2">Example: same person, three sources</p>
                      <p>slack:U04ABCDEF  →  <span className="text-primary">alice@company.com</span></p>
                      <p>github:alicesmith →  <span className="text-primary">alice@company.com</span></p>
                      <p>outlook:alice@company.com →  <span className="text-primary">alice@company.com</span></p>
                      <p className="mt-2">↓  nightly dedup resolves to:</p>
                      <p className="text-foreground">Person entity: <span className="text-primary">&ldquo;Alice Smith&rdquo;</span>  confidence: 0.92  sources: [slack, github, outlook]</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-medium text-foreground mb-3">Privacy & Data Access</h3>
                    <p className="text-sm font-medium text-foreground mb-2">What Evols does NOT access:</p>
                    <ul className="space-y-1.5">
                      {[
                        'Slack direct messages (only public and private channels you\'re a member of)',
                        'Emails you have not received — only your own inbox is synced, not a shared mailbox',
                        'Salesforce records outside your profile\'s visibility',
                        'GitHub repositories the token is not scoped to',
                        'Notion pages not explicitly shared with the Evols integration',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="text-destructive mt-0.5 font-medium">✕</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <p className="text-sm text-muted-foreground mt-4">
                      OAuth tokens are encrypted with <strong className="text-foreground">AES-256-GCM</strong> before storage. Disconnecting an integration immediately wipes the stored tokens. All synced content is scoped to your <code className="bg-muted px-1 py-0.5 rounded text-xs">tenant_id</code> and never visible to other workspaces.
                    </p>
                    <Callout type="warning">
                      If your organisation has compliance requirements around which tools can connect to third-party software, check with your IT or legal team before connecting work email or CRM data.
                    </Callout>
                  </div>
                </div>
              </Section>

              {/* ── Developer Tools ────────────────────────────────── */}
              <Section id="developer-tools" title="Developer Tools">
                <div className="space-y-4">
                  <FeatureDoc
                    title="MCP Endpoint"
                    description="Evols exposes a Streamable-HTTP MCP (Model Context Protocol) server so AI tools can read your team's product knowledge directly."
                    features={[
                      'Connect Claude Desktop, Cursor, or any MCP-compatible client',
                      'MCP endpoint: https://your-instance/mcp/sse',
                      'Authenticate with an evols_... API key generated in Settings → Security',
                      'Exposes tools: get_context, get_work_context, query_knowledge_graph, get_team_context',
                    ]}
                  />
                  <FeatureDoc
                    title="Evols CLI"
                    description="The Evols CLI wires MCP and hooks into every coding agent on your machine. Claude Code, Cursor, Zed, Codex, and Antigravity are detected and configured automatically."
                    features={[
                      'Install: curl -fsSL https://api.evols.ai/api/v1/install/script | sh',
                      'Authenticate: evols login — enter your API key from Settings → Security',
                      'Wire all detected agents: evols install',
                      'The MCP server (evols mcp-server) is spawned automatically by agents — no manual process required',
                    ]}
                  />
                  <FeatureDoc
                    title="API Keys"
                    description="Generate API keys with the evols_... prefix for programmatic access to Evols data."
                    features={[
                      'Generate and revoke keys from Settings → Security',
                      'Scoped per tenant — keys only access data within your workspace',
                      'Use as Bearer tokens for the REST API or MCP endpoint',
                    ]}
                  />
                </div>
              </Section>

              {/* ── REST API ───────────────────────────────────────── */}
              <Section id="api" title="REST API">
                <div className="space-y-4 text-sm text-muted-foreground">
                  <h3 className="text-base font-medium text-foreground">Authentication</h3>
                  <p>Register and obtain a JWT token:</p>
                  <pre className="p-4 rounded-lg overflow-x-auto bg-muted text-foreground">
                    <code>{`curl -X POST http://localhost:8000/api/v1/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{"email":"pm@company.com","password":"...","full_name":"PM"}'`}</code>
                  </pre>
                  <p>Pass the token as a Bearer header on subsequent requests, or use an API key from Settings → Security.</p>
                  <h3 className="text-base font-medium text-foreground">OpenAPI Docs</h3>
                  <p>Interactive API docs are available at <code className="bg-muted px-1 py-0.5 rounded text-xs">http://localhost:8000/docs</code> when running locally.</p>
                </div>
              </Section>

              {/* ── Tenancy ────────────────────────────────────────── */}
              <Section id="tenancy" title="Tenancy & Workspaces">
                <div className="space-y-4">
                  <FeatureDoc
                    title="Workspace Isolation"
                    description="Every organisation in Evols is an isolated tenant. All data — knowledge sources, the knowledge graph, LLM configuration, skills, work context, and API keys — is scoped per workspace and never shared across tenants."
                    features={[
                      'Create your workspace at /register; each registration provisions a new isolated tenant',
                      'Invite team members from Settings → Team (TENANT_ADMIN only)',
                      'All knowledge, skills, and AI configuration are private to your workspace',
                    ]}
                  />
                  <FeatureDoc
                    title="User Roles"
                    description="Evols has three roles with distinct permissions."
                    features={[
                      'USER — regular team member; can use Workbench, Knowledge, Work Context, and Skills',
                      'TENANT_ADMIN — org administrator; everything a USER can do, plus: invite and remove users, configure the LLM provider (BYOK), and manage API keys',
                      'SUPER_ADMIN — platform-level administrator (Evols-internal); no tenant; manages all tenants via the Admin Panel',
                    ]}
                  />
                </div>
              </Section>

              {/* ── BYOK ───────────────────────────────────────────── */}
              <Section id="byok" title="BYOK — Bring Your Own Keys">
                <div className="space-y-6 text-sm text-muted-foreground">
                  <p>
                    Evols does not bundle an LLM API key. Each workspace connects its own LLM provider — keys are stored
                    AES-256-GCM encrypted per tenant and are never shared with other workspaces. Only a{' '}
                    <strong className="text-foreground">TENANT_ADMIN</strong> can configure or update the LLM settings
                    (Settings → LLM Settings). After saving, use <strong className="text-foreground">Test Connection</strong> to
                    verify the key and model are reachable before the team starts using the Workbench.
                  </p>

                  <div>
                    <h3 className="text-base font-medium text-foreground mb-3">Supported Providers</h3>
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            <th className="text-left py-2.5 px-4 font-medium text-foreground">Provider</th>
                            <th className="text-left py-2.5 px-4 font-medium text-foreground">Required fields</th>
                            <th className="text-left py-2.5 px-4 font-medium text-foreground">Embeddings</th>
                            <th className="text-left py-2.5 px-4 font-medium text-foreground">Get key</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {([
                            { name: 'OpenAI',        fields: 'API key, model, embedding model',             embed: true,  url: 'https://platform.openai.com/api-keys' },
                            { name: 'Azure OpenAI',  fields: 'API key, endpoint, deployment name',          embed: true,  url: 'https://portal.azure.com' },
                            { name: 'AWS Bedrock',   fields: 'Region, access key ID + secret (or API key)', embed: true,  url: 'https://aws.amazon.com/bedrock/' },
                            { name: 'Anthropic',     fields: 'API key, model',                              embed: false, url: 'https://console.anthropic.com/settings/keys' },
                            { name: 'Google Gemini', fields: 'API key, model',                              embed: false, url: 'https://aistudio.google.com/app/apikey' },
                            { name: 'Groq',          fields: 'API key, model',                              embed: false, url: 'https://console.groq.com/keys' },
                            { name: 'Mistral AI',    fields: 'API key, model',                              embed: false, url: 'https://console.mistral.ai/api-keys/' },
                            { name: 'Cohere',        fields: 'API key, model',                              embed: false, url: 'https://dashboard.cohere.com/api-keys' },
                            { name: 'Together AI',   fields: 'API key, model',                              embed: false, url: 'https://api.together.ai/settings/api-keys' },
                            { name: 'DeepSeek',      fields: 'API key, model',                              embed: false, url: 'https://platform.deepseek.com/api_keys' },
                            { name: 'xAI (Grok)',    fields: 'API key, model',                              embed: false, url: 'https://console.x.ai/' },
                            { name: 'OpenRouter',    fields: 'API key, model (free-text)',                  embed: false, url: 'https://openrouter.ai/keys' },
                            { name: 'Ollama',        fields: 'Base URL, model name (no API key)',           embed: false, url: 'https://ollama.ai' },
                          ] as const).map(({ name, fields, embed, url }) => (
                            <tr key={name} className="hover:bg-muted/30 transition-colors">
                              <td className="py-2.5 px-4 font-medium text-foreground">{name}</td>
                              <td className="py-2.5 px-4 text-muted-foreground">{fields}</td>
                              <td className="py-2.5 px-4">
                                {embed
                                  ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">Native</span>
                                  : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Fallback</span>
                                }
                              </td>
                              <td className="py-2.5 px-4">
                                <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">{new URL(url).hostname}</a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
                    <h3 className="text-sm font-medium text-foreground mb-2">⚠ Embedding caveat</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Only <strong className="text-foreground">OpenAI, Azure OpenAI, and AWS Bedrock</strong> have native embedding APIs.
                      All other providers fall back to a local <code className="bg-muted px-1 py-0.5 rounded text-xs">sentence-transformers</code> model (384-dimension vectors vs 1536 for OpenAI — incompatible).
                      If you switch between provider types, all existing semantic search will return wrong results until you re-index your knowledge base.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-base font-medium text-foreground">Provider notes</h3>
                    <ByokProviderNote name="OpenAI" keyFormat="sk-proj-... or sk-...">
                      Recommended default. Model list includes GPT-5.4, GPT-4o and others. Embedding models
                      (text-embedding-3-large recommended) are configured separately and enable full LightRAG support.
                    </ByokProviderNote>
                    <ByokProviderNote name="Azure OpenAI" keyFormat="32-character hex string">
                      For enterprise customers with Azure agreements or EU data residency requirements.
                      Requires a deployment name that matches what you created in the Azure Portal.
                    </ByokProviderNote>
                    <ByokProviderNote name="AWS Bedrock" keyFormat="Access key ID starts with AKIA">
                      Embeddings use Amazon Titan automatically — no extra configuration.
                      Request model access in the AWS Console under Bedrock → Model access before use.
                    </ByokProviderNote>
                    <ByokProviderNote name="Anthropic" keyFormat="sk-ant-...">
                      No embedding support — falls back to local sentence-transformers. Best for long-context
                      tasks; Claude Sonnet 4.6 is the recommended model.
                    </ByokProviderNote>
                    <ByokProviderNote name="Groq" keyFormat="gsk_...">
                      Fastest inference for Llama and Mixtral models. Tool calling supported on Llama 3.x models only.
                    </ByokProviderNote>
                    <ByokProviderNote name="Mistral AI" keyFormat="from console.mistral.ai">
                      Tool calling supported on mistral-large and mistral-medium; not on open-mistral-nemo.
                      European-based infrastructure if data residency matters.
                    </ByokProviderNote>
                    <ByokProviderNote name="Cohere" keyFormat="from dashboard.cohere.com">
                      Tool calling supported on command-r-plus only. No embedding support via the chat provider.
                    </ByokProviderNote>
                    <ByokProviderNote name="Together AI" keyFormat="from api.together.ai">
                      Wide selection of open-source models. Tool calling supported on Llama 3.x; not on older Mixtral models.
                    </ByokProviderNote>
                    <ByokProviderNote name="DeepSeek" keyFormat="sk-...">
                      Very competitive quality-to-cost ratio. Two model families:{' '}
                      <code className="bg-muted px-1 py-0.5 rounded text-xs">deepseek-v3.2</code> for general use and{' '}
                      <code className="bg-muted px-1 py-0.5 rounded text-xs">deepseek-r1</code> for complex reasoning tasks.
                    </ByokProviderNote>
                    <ByokProviderNote name="xAI (Grok)" keyFormat="xai-...">
                      Grok 4 and Grok 3 family. No embedding support.
                    </ByokProviderNote>
                    <ByokProviderNote name="OpenRouter" keyFormat="sk-or-...">
                      A single API key that routes to 200+ models. The model field is free-text: enter any model ID from{' '}
                      <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">openrouter.ai/models</a>{' '}
                      in the format <code className="bg-muted px-1 py-0.5 rounded text-xs">openrouter/&lt;provider&gt;/&lt;model-slug&gt;</code>.
                    </ByokProviderNote>
                    <ByokProviderNote name="Ollama (Local)" keyFormat="No API key — runs on your infrastructure">
                      The <strong className="text-foreground">Base URL must be reachable from the Evols backend container</strong>, not your browser.
                      Pull models with <code className="bg-muted px-1 py-0.5 rounded text-xs">ollama pull llama3.2</code> before configuring.
                    </ByokProviderNote>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-card">
                    <h3 className="text-sm font-medium text-foreground mb-2">Using a model not in the dropdown</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      For <strong className="text-foreground">OpenRouter</strong>, the model field already accepts any free-text model ID.
                      For all other providers, you can configure any valid model ID via the API — the backend passes it directly to the provider:
                    </p>
                    <pre className="mt-3 p-3 rounded-lg overflow-x-auto bg-muted text-foreground text-xs">
                      <code>{`curl -X POST /api/v1/llm-settings \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"provider":"groq","api_key":"gsk_...","model":"llama-3.3-70b-specdec"}'`}</code>
                    </pre>
                  </div>
                </div>
              </Section>

              {/* ── Support ────────────────────────────────────────── */}
              <Section id="support" title="Support">
                <div className="text-sm space-y-2 text-muted-foreground">
                  <p>Need help? Reach us at:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Email:</strong> support@evols.ai</li>
                    <li><strong>GitHub:</strong> <a href="https://github.com/evols-ai/evols/issues" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Report bugs or request features</a></li>
                  </ul>
                </div>
              </Section>

            </div>
          </main>


        </div>

        <Footer />
      </div>
    </>
  )
}

// ── Helper components ──────────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-2xl font-medium mb-6 pb-3 border-b border-border text-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)
  const { theme } = useTheme()
  const dark = theme === 'dark'
  return (
    <div className={`relative rounded-lg border border-border overflow-hidden my-3 ${dark ? 'bg-zinc-900' : 'bg-zinc-950'}`}>
      <button
        onClick={() => { navigator.clipboard.writeText(children.trim()); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
        className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
        aria-label="Copy"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
      </button>
      <pre className="p-4 pr-10 overflow-x-auto text-sm text-zinc-100"><code>{children.trim()}</code></pre>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold mt-0.5">
        {n}
      </div>
      <div className="flex-1 pb-8">
        <h3 className="text-base font-medium text-foreground mb-2">{title}</h3>
        <div className="text-sm text-muted-foreground space-y-2">{children}</div>
      </div>
    </div>
  )
}

function Callout({ type, children }: { type: 'tip' | 'warning' | 'info'; children: React.ReactNode }) {
  const styles = {
    tip:     { border: 'border-green-500/30',  bg: 'bg-green-500/5',  icon: CheckCircle2, color: 'text-green-500',  label: 'Tip' },
    warning: { border: 'border-amber-500/30',  bg: 'bg-amber-500/5',  icon: AlertCircle,  color: 'text-amber-500',  label: 'Important' },
    info:    { border: 'border-blue-500/30',   bg: 'bg-blue-500/5',   icon: Info,         color: 'text-blue-500',   label: 'Note' },
  }
  const { border, bg, icon: Icon, color, label } = styles[type]
  return (
    <div className={`p-3.5 rounded-lg border ${border} ${bg}`}>
      <div className={`flex items-center gap-2 mb-1 font-medium text-foreground text-sm`}>
        <Icon className={`w-4 h-4 ${color}`} />
        {label}
      </div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  )
}

function StepList({ steps }: { steps: { title: string; body: React.ReactNode }[] }) {
  return (
    <ol className="space-y-3 mt-2">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-4">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <div>
            <p className="text-sm font-medium text-foreground mb-0.5">{step.title}</p>
            <div className="text-sm text-muted-foreground">{step.body}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}

function ByokProviderNote({ name, keyFormat, children }: { name: string; keyFormat: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl border bg-card border-border">
      <div className="flex flex-wrap items-baseline gap-3 mb-1.5">
        <h4 className="text-sm font-medium text-foreground">{name}</h4>
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">{keyFormat}</span>
      </div>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

function FeatureDoc({ title, description, features, link, linkText }: {
  title: string; description: string; features: string[]; link?: string; linkText?: string
}) {
  return (
    <div className="p-5 rounded-xl border bg-card border-border">
      <h3 className="text-base font-medium mb-1.5 text-foreground">{title}</h3>
      <p className="text-sm mb-3 text-muted-foreground">{description}</p>
      <ul className="space-y-1.5">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-primary mt-0.5 leading-tight">•</span>
            <span className="text-sm text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>
      {link && linkText && (
        <div className="mt-4">
          <Link href={link} className="text-sm text-primary hover:underline transition-colors">{linkText}</Link>
        </div>
      )}
    </div>
  )
}
