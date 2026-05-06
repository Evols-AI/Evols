import Head from 'next/head'
import Link from 'next/link'
import {
  ArrowLeft, Plug, RefreshCw, Shield, Database, GitMerge,
  MessageSquare, Mail, Users, BookOpen, BarChart2, HelpCircle, Github,
  Clock, AlertCircle, CheckCircle2, Info,
} from 'lucide-react'
import Header from '@/components/Header'

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12 scroll-mt-24">
      <h2 className="text-2xl font-medium mb-5 pb-3 border-b border-border text-foreground">{title}</h2>
      <div className="space-y-4 text-sm text-muted-foreground">{children}</div>
    </section>
  )
}

function Callout({ type, children }: { type: 'info' | 'warning' | 'tip'; children: React.ReactNode }) {
  const styles = {
    info:    { border: 'border-blue-500/30',   bg: 'bg-blue-500/5',   icon: Info,         iconColor: 'text-blue-500',   label: 'Note' },
    warning: { border: 'border-amber-500/30',  bg: 'bg-amber-500/5',  icon: AlertCircle,  iconColor: 'text-amber-500',  label: 'Important' },
    tip:     { border: 'border-green-500/30',  bg: 'bg-green-500/5',  icon: CheckCircle2, iconColor: 'text-green-500',  label: 'Tip' },
  }
  const { border, bg, icon: Icon, iconColor, label } = styles[type]
  return (
    <div className={`p-4 rounded-xl border ${border} ${bg}`}>
      <div className={`flex items-center gap-2 mb-1.5 font-medium text-foreground text-sm`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
        {label}
      </div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-5 rounded-xl border bg-card border-border ${className}`}>
      {children}
    </div>
  )
}

function StepList({ steps }: { steps: { title: string; body: React.ReactNode }[] }) {
  return (
    <ol className="space-y-4">
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

// ─── Source config reference ──────────────────────────────────────────────────

const SOURCES = [
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntegrationsDocumentation() {
  return (
    <>
      <Head>
        <title>Integrations Documentation - Evols</title>
        <style>{`h1,h2,h3,h4,h5,h6{font-family:'Syne',system-ui,sans-serif!important}`}</style>
      </Head>

      <div className="min-h-screen bg-background">
        <Header variant="landing" />

        <main className="container mx-auto px-6 pt-28 pb-16 max-w-4xl">

          {/* Breadcrumb + header */}
          <div className="mb-10">
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Docs
            </Link>
            <div className="inline-flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full text-sm text-primary mb-4 ml-4">
              <Plug className="w-4 h-4" />
              <span>Data Connectors</span>
            </div>
            <h1 className="text-4xl font-medium mb-3 text-foreground">Data Source Integrations</h1>
            <p className="text-xl text-muted-foreground">
              Connect Slack, Outlook, Teams, Notion, Salesforce, Zendesk, and GitHub to build a living knowledge graph from your team's daily work.
            </p>
          </div>

          {/* On-page nav */}
          <Card className="mb-10">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">On this page</p>
            <div className="grid sm:grid-cols-2 gap-1 text-sm">
              {[
                ['#where-to-find', 'Where to find integrations'],
                ['#how-to-connect', 'How to connect a source'],
                ['#source-reference', 'Source-by-source reference'],
                ['#sync-behaviour', 'Sync frequency & scoping'],
                ['#knowledge-graph', 'How the knowledge graph uses this data'],
                ['#identity-resolution', 'Identity resolution across sources'],
                ['#privacy', 'Privacy and data access'],
              ].map(([href, label]) => (
                <a key={href} href={href} className="text-primary hover:underline py-0.5">{label as string}</a>
              ))}
            </div>
          </Card>

          {/* ── 1. Where to find ── */}
          <Section id="where-to-find" title="Where to Find Integrations">
            <p>
              Integrations live inside the <strong className="text-foreground">Context</strong> page — the same place you upload documents, PDFs, and meeting notes.
            </p>
            <StepList steps={[
              {
                title: 'Open Context',
                body: 'Click Context in the left sidebar (the database icon). This opens the unified source management panel.',
              },
              {
                title: 'Switch to the Integrations tab',
                body: 'At the top of the panel, click the Integrations tab. You will see two sections: Connected sources (active) and Available sources (not yet connected).',
              },
              {
                title: 'Pick a source and connect',
                body: 'Click Connect on any available source card. The card expands to show auth instructions specific to that source.',
              },
            ]} />
            <Callout type="info">
              The Integrations tab is separate from the Sources tab. Sources = files you upload manually. Integrations = live connections that pull data automatically.
            </Callout>
          </Section>

          {/* ── 2. How to connect ── */}
          <Section id="how-to-connect" title="How to Connect a Source">

            <h3 className="text-base font-medium text-foreground">OAuth sources (Slack, Outlook, Teams, Notion, Salesforce)</h3>
            <StepList steps={[
              {
                title: 'Click Connect on the source card',
                body: 'A popup window opens taking you to the provider\'s login page.',
              },
              {
                title: 'Authorise the Evols application',
                body: 'Sign in with the account you use for that service. Review the permission scopes — Evols requests read-only access only.',
              },
              {
                title: 'Window closes automatically',
                body: 'After approval the popup closes and the source card updates to show a green Connected status. The first sync starts within 5 minutes.',
              },
            ]} />

            <h3 className="text-base font-medium text-foreground mt-5">Token-based sources (Zendesk, GitHub)</h3>
            <StepList steps={[
              {
                title: 'Click Connect on the source card',
                body: 'The card expands to show a token input field.',
              },
              {
                title: 'Generate an API token in the provider\'s settings',
                body: (
                  <span>
                    <strong className="text-foreground">Zendesk:</strong> Profile → Security → API Tokens → Add Token.
                    {' '}<strong className="text-foreground">GitHub:</strong> Settings → Developer Settings → Personal Access Tokens → Fine-grained token. Scope to the specific repositories you want Evols to read.
                  </span>
                ),
              },
              {
                title: 'Paste the token and save any config fields',
                body: 'Enter the token and any required config (e.g. Zendesk subdomain, GitHub repo slug), then click Save.',
              },
            ]} />

            <Callout type="tip">
              Each team member connects their own account. This is intentional — it lets Evols resolve who is who across different tools (your Slack @name, your GitHub username, and your Outlook email are all the same person). See Identity Resolution below.
            </Callout>

            <h3 className="text-base font-medium text-foreground mt-5">Managing an active connection</h3>
            <p>From the source card you can:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-foreground">Sync Now</strong> — trigger an immediate pull without waiting for the 5-minute interval</li>
              <li><strong className="text-foreground">Configure</strong> — update channel IDs, repo names, or other scope settings</li>
              <li><strong className="text-foreground">Disconnect</strong> — wipes the stored token immediately; no further data is pulled and no existing data is deleted from the knowledge graph</li>
            </ul>
          </Section>

          {/* ── 3. Source reference ── */}
          <Section id="source-reference" title="Source-by-Source Reference">
            <p>Click any source to expand its details.</p>
            <div className="space-y-3 mt-2">
              {SOURCES.map(source => {
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
                          <p className="text-xs font-medium text-foreground uppercase tracking-wide mb-1">OAuth Scopes Requested</p>
                          <ul className="space-y-0.5">
                            {source.scopes.map(s => (
                              <li key={s} className="text-xs font-mono bg-muted px-2 py-0.5 rounded inline-block mr-1 mb-1 text-foreground">{s}</li>
                            ))}
                          </ul>
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
          </Section>

          {/* ── 4. Sync behaviour ── */}
          <Section id="sync-behaviour" title="Sync Frequency & Scoping">

            <h3 className="text-base font-medium text-foreground">Pull cadence</h3>
            <p>
              Evols polls all connected integrations every <strong className="text-foreground">5 minutes</strong>. Each sync is incremental — only content created or updated since the last successful pull is fetched. This uses provider-native mechanisms:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-foreground">Outlook / Teams:</strong> Microsoft Graph delta API with a stored deltaToken — only changed items are returned</li>
              <li><strong className="text-foreground">Slack, Notion, GitHub, Zendesk, Salesforce:</strong> dlt pipeline state tracks the last cursor/timestamp</li>
            </ul>

            <h3 className="text-base font-medium text-foreground mt-4">What gets sent to the knowledge graph</h3>
            <p>
              Each item pulled from a source is formatted into a plain-text document and passed to LightRAG for entity extraction. LightRAG makes one LLM call per chunk (using your configured BYOK key) and extracts entities and relationships — people, decisions, product features, pain points, competitors — into the knowledge graph.
            </p>
            <Callout type="warning">
              Integration syncs consume tokens from your configured LLM API key at the same rate as manual document uploads — approximately 1–3 LLM calls per Slack message thread or email. For active teams with hundreds of daily messages, monitor your provider usage and consider rate-limiting channel scope in the source config.
            </Callout>

            <h3 className="text-base font-medium text-foreground mt-4">Sync status indicators</h3>
            <div className="grid sm:grid-cols-3 gap-3 mt-2">
              {[
                { color: 'bg-green-500', label: 'Connected', desc: 'Syncing normally' },
                { color: 'bg-amber-500', label: 'Error', desc: 'Last sync failed — hover the card to see the error message' },
                { color: 'bg-muted-foreground', label: 'Disconnected', desc: 'Token revoked or manually disconnected' },
              ].map(({ color, label, desc }) => (
                <Card key={label}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                    <span className="text-sm font-medium text-foreground">{label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </Card>
              ))}
            </div>

            <h3 className="text-base font-medium text-foreground mt-5">Controlling scope with config fields</h3>
            <p>
              Some sources let you restrict what is pulled. Narrowing the scope reduces token consumption and keeps the knowledge graph focused on relevant signal:
            </p>
            <div className="rounded-xl border border-border overflow-hidden mt-2">
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
          </Section>

          {/* ── 5. Knowledge graph ── */}
          <Section id="knowledge-graph" title="How the Knowledge Graph Uses This Data">

            <p>
              Integration data flows through the same pipeline as manually uploaded documents. Here is the full path from a Slack message to a knowledge graph node:
            </p>

            {/* Pipeline diagram */}
            <div className="relative mt-4">
              <div className="space-y-2">
                {[
                  {
                    icon: RefreshCw,
                    step: '1 · Incremental pull',
                    desc: 'Scheduler fetches new items every 5 minutes. Each item (message thread, email, page, issue) is formatted as a plain-text document.',
                  },
                  {
                    icon: Database,
                    step: '2 · LightRAG ingestion',
                    desc: 'The text document is chunked and passed to LightRAG. One LLM call per chunk extracts entities and relationships. Entities are stored in the PostgreSQL vector store and the Neo4j graph.',
                  },
                  {
                    icon: GitMerge,
                    step: '3 · Nightly deduplication',
                    desc: 'A batch job runs nightly to merge duplicate entities (e.g. "John Smith" and "J. Smith" from two different sources) and resolve conflicting entity descriptions using temporal precedence — newer sources win.',
                  },
                  {
                    icon: Shield,
                    step: '4 · Confidence scoring',
                    desc: 'Each entity\'s confidence score is recalculated nightly based on how many distinct sources mention it, relationship density, and description completeness.',
                  },
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

            <h3 className="text-base font-medium text-foreground mt-2">What entities are extracted from integration data</h3>
            <div className="grid sm:grid-cols-2 gap-3 mt-2">
              {[
                { source: 'Slack', entities: 'Decisions ("we decided to drop the feature"), pain points ("users keep complaining about…"), product features, people mentioned, competing tools named' },
                { source: 'Outlook / Teams', entities: 'Meeting decisions, action items, stakeholders, project names, deadlines, escalations' },
                { source: 'Notion', entities: 'Product specs, feature descriptions, OKRs, team members, decisions recorded in pages' },
                { source: 'GitHub', entities: 'Features being built (issue titles), technical decisions (PR descriptions), bugs and pain points, contributors' },
                { source: 'Salesforce', entities: 'Customer organisations, contacts (personas), deal stages, pain points from opportunity notes' },
                { source: 'Zendesk', entities: 'Customer pain points, feature requests, bug reports, personas derived from ticket submitters' },
              ].map(({ source, entities }) => (
                <Card key={source}>
                  <p className="text-sm font-medium text-foreground mb-1">{source}</p>
                  <p className="text-xs text-muted-foreground">{entities}</p>
                </Card>
              ))}
            </div>

            <Callout type="info">
              Entities extracted from integrations appear in the same Knowledge Graph view as manually uploaded documents. You can filter by source type in the Entity List to see which nodes came from which integration.
            </Callout>

            <h3 className="text-base font-medium text-foreground mt-4">Using integration data in Workbench</h3>
            <p>
              The Workbench automatically pulls relevant entities from the knowledge graph when generating responses. Because integration data is in the graph, queries like <em>"What pain points have customers reported in Zendesk this quarter?"</em> or <em>"Summarise what decisions were made in Slack last week about the mobile app"</em> will surface real extracted content — not hallucinations.
            </p>
          </Section>

          {/* ── 6. Identity resolution ── */}
          <Section id="identity-resolution" title="Identity Resolution Across Sources">
            <p>
              When multiple team members connect the same type of integration (e.g. everyone connects their own Slack account), Evols can correlate the same person across different tools. This is called cross-source identity resolution.
            </p>

            <h3 className="text-base font-medium text-foreground mt-2">How it works</h3>
            <p>
              Each integration connection is per-user. When Evols ingests data, it stamps each extracted entity with the source identity (Slack user ID, GitHub username, Microsoft UPN). The nightly batch job then resolves these into a single <em>Person</em> entity in the knowledge graph — linking the same individual across tools.
            </p>

            <div className="rounded-xl border border-border p-4 bg-muted/30 mt-3 font-mono text-xs text-muted-foreground space-y-1">
              <p className="text-foreground font-medium text-sm mb-2">Example: same person, three sources</p>
              <p>slack:U04ABCDEF  →  <span className="text-primary">alice@company.com</span></p>
              <p>github:alicesmith →  <span className="text-primary">alice@company.com</span></p>
              <p>outlook:alice@company.com →  <span className="text-primary">alice@company.com</span></p>
              <p className="mt-2 text-muted-foreground">↓  nightly dedup resolves to:</p>
              <p className="text-foreground">Person entity: <span className="text-primary">"Alice Smith"</span>  confidence: 0.92  sources: [slack, github, outlook]</p>
            </div>

            <Callout type="tip">
              The more sources your team members connect, the richer the identity graph becomes. A person mentioned in a Zendesk ticket, a GitHub PR, and a Slack thread will have much higher confidence and more complete entity data than one seen only in a single source.
            </Callout>

            <h3 className="text-base font-medium text-foreground mt-4">Why individual auth instead of admin auth</h3>
            <p>
              Many integration platforms (especially Slack and Microsoft) allow tenant-admin OAuth that would pull all data without individual consent. Evols deliberately avoids this for two reasons:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Individual consent means each user explicitly authorises access to their own data — important for trust</li>
              <li>Per-user credentials allow accurate identity attribution, enabling the cross-source resolution above</li>
            </ul>
          </Section>

          {/* ── 7. Privacy ── */}
          <Section id="privacy" title="Privacy & Data Access">

            <h3 className="text-base font-medium text-foreground">What Evols does NOT access</h3>
            <ul className="space-y-1.5 mt-1">
              {[
                'Slack direct messages (only public and private channels you\'re a member of)',
                'Emails you have not received — only your own inbox is synced, not a shared mailbox or other users\' mail',
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

            <h3 className="text-base font-medium text-foreground mt-5">Token storage</h3>
            <p>
              OAuth access tokens and refresh tokens are encrypted with <strong className="text-foreground">AES-256-GCM</strong> before being stored in the database. The encryption key is derived per integration record — a breach of the database alone is insufficient to recover tokens. Only the Evols backend process can decrypt them at sync time.
            </p>
            <p>
              Disconnecting an integration immediately wipes the stored tokens — they are set to NULL in the database, not soft-deleted.
            </p>

            <h3 className="text-base font-medium text-foreground mt-4">Workspace isolation</h3>
            <p>
              All synced content is tagged with <code className="bg-muted px-1 py-0.5 rounded text-xs">tenant_id</code>. Knowledge graph entities extracted from your integrations are never visible to other Evols workspaces, even on a shared self-hosted deployment.
            </p>

            <Callout type="warning">
              If your organisation has compliance requirements around which tools can connect to third-party software, check with your IT or legal team before connecting work email or CRM data. Evols stores extracted text (summaries, entity names, decisions) derived from your data — not raw message bodies verbatim for most sources.
            </Callout>
          </Section>

          {/* Footer nav */}
          <div className="mt-12 pt-8 border-t border-border flex items-center justify-between">
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Documentation
            </Link>
            <Link
              href="/context"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary/85 text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary transition-colors"
            >
              <Plug className="w-4 h-4" />
              Open Integrations
            </Link>
          </div>

        </main>
      </div>
    </>
  )
}
