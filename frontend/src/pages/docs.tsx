import Head from 'next/head'
import Link from 'next/link'
import { useEffect } from 'react'
import { Sparkles, Book, Code, Zap, Server, Briefcase, Brain, Network, Key, Building2, Lock } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import SpotlightCard from '@/components/SpotlightCard'

export default function Docs() {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  useEffect(() => {
    document.body.style.background = ''
    document.body.style.backgroundImage = 'none'
  }, [dark])

  return (
    <>
      <Head>
        <title>Documentation · Evols</title>
      </Head>

      <div className="min-h-screen bg-background">
        <Header variant="landing" />

        <main className="container mx-auto px-6 pt-28 pb-12">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full text-sm text-primary mb-6">
              <Book className="w-4 h-4" />
              <span>Documentation</span>
            </div>
            <h1 className="text-5xl font-medium mb-4 text-foreground">Evols Documentation</h1>
            <p className="text-xl max-w-3xl mx-auto text-muted-foreground">
              Everything you need to know about your team's AI brain
            </p>
          </div>

          {/* Quick Links Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            {[
              { icon: Sparkles,   title: 'AI Workbench',    description: 'Conversational AI with 80+ skills, RAG, and internet search', href: '/docs/workbench' },
              { icon: Briefcase, title: 'Work Context',    description: 'Role, projects, tasks, and capacity — your AI work hub', href: '#work-context' },
              { icon: Brain,     title: 'Knowledge',       description: 'Document intelligence and LightRAG entity extraction', href: '#knowledge' },
              { icon: Network,   title: 'Knowledge Graph', description: 'Visual graph of entities, relationships, and confidence scores', href: '#knowledge' },
              { icon: Key,       title: 'Developer Tools', description: 'MCP endpoint, API keys, Claude Code plugin', href: '#developer-tools' },
              { icon: Building2, title: 'Tenancy & BYOK',  description: 'Workspace isolation, user roles, and bring-your-own LLM keys', href: '#tenancy' },
            ].map(({ icon: Icon, title, description, href }) => (
              <SpotlightCard key={title}>
                <Link href={href} className="block p-6 h-full">
                  <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-medium mb-1.5 text-foreground">{title}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </Link>
              </SpotlightCard>
            ))}
          </div>

          {/* Documentation Sections */}
          <div className="max-w-4xl mx-auto space-y-12">

            <Section id="getting-started" title="Getting Started">
              <div className="space-y-4 text-sm text-muted-foreground">
                <h3 className="text-base font-medium text-foreground">Self-hosted Installation</h3>
                <p>Run Evols locally with Docker Compose:</p>
                <pre className="p-4 rounded-lg overflow-x-auto text-sm bg-muted text-foreground">
                  <code>{`cd docker\ndocker-compose up -d`}</code>
                </pre>
                <h3 className="text-base font-medium text-foreground">First Steps</h3>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Create an account at <Link href="/register" className="text-primary hover:underline">/register</Link></li>
                  <li>Configure your LLM provider in Settings (Claude, GPT-4, or any OpenAI-compatible model)</li>
                  <li>Add sources to Knowledge (documents, meeting notes, PDFs)</li>
                  <li>Open Workbench and start chatting with your team's AI brain</li>
                </ol>
              </div>
            </Section>

            <Section id="workbench" title="AI Workbench">
              <FeatureDoc
                title="Conversational AI for Teams"
                description="The Workbench is an AI chat interface pre-configured with 80+ skills. It uses your uploaded knowledge for context-aware responses and supports internet search via Tavily/Serper."
                features={[
                  'Strategy skills: product strategy docs, competitive analysis, opportunity sizing, roadmap planning',
                  'Execution skills: PRD writer, technical specs, sprint planning, acceptance criteria',
                  'Communication skills: stakeholder updates, meeting prep, weekly updates, decision briefs',
                  'Discovery skills: assumption mapping, user story generation, OKR drafting',
                  'Internet search for real-time market data and competitor research',
                  'RAG integration — responses use your uploaded documents and extracted knowledge',
                ]}
                link="/docs/workbench"
                linkText="Full Workbench documentation →"
              />
            </Section>

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
                    Each extracted entity is tagged with three signal attributes — <strong>sentiment</strong>, <strong>urgency</strong>, and <strong>business impact</strong> — inferred from the source text. Their meaning varies by entity type.
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
                    Values are inferred by the LLM from source text and should be treated as directional signals, not precise measurements. Attributes are most reliable for PainPoint, FeatureRequest, and Decision entity types.
                  </p>
                </div>
              </div>
            </Section>

            <Section id="developer-tools" title="Developer Tools">
              <div className="space-y-4">
                <FeatureDoc
                  title="MCP Endpoint"
                  description="Evols exposes a Streamable-HTTP MCP (Model Context Protocol) server so AI tools can read your team's product knowledge directly."
                  features={[
                    'Connect Claude Desktop, Cursor, or any MCP-compatible client',
                    'MCP endpoint: https://your-instance/mcp/sse',
                    'Authenticate with an evols_... API key generated in Settings → API Keys',
                    'Exposes tools: get_context, get_work_context, query_knowledge_graph, get_team_context',
                  ]}
                />
                <FeatureDoc
                  title="Claude Code Plugin"
                  description="Share team product context with Claude Code during engineering sessions. Surfaces knowledge graph entities, team knowledge, and decisions inside Claude Code — useful for engineers who need PM context while building features."
                  features={[
                    'CLI install: claude mcp add evols -- npx @evols-ai/claude-code-plugin (set EVOLS_API_KEY env var to your key from Settings → API Keys)',
                    'VSCode UI: open the Claude Code extension → click "MCP" in the sidebar → "Add Server" → set command to npx @evols-ai/claude-code-plugin → add EVOLS_API_KEY environment variable → save',
                    'Cursor / other editors: add to your mcp.json with command npx @evols-ai/claude-code-plugin and env EVOLS_API_KEY set to your API key',
                  ]}
                />
                <FeatureDoc
                  title="API Keys"
                  description="Generate API keys with the evols_... prefix for programmatic access to Evols data."
                  features={[
                    'Generate and revoke keys from Settings → API Keys',
                    'Scoped per tenant — keys only access data within your workspace',
                    'Use as Bearer tokens for the REST API or MCP endpoint',
                  ]}
                />
              </div>
            </Section>

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

            <Section id="byok" title="BYOK — Bring Your Own Keys">
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>
                  Evols does not bundle an LLM API key. Each workspace connects its own LLM provider — keys are stored
                  AES-encrypted per tenant and are never shared with other workspaces. Only a <strong className="text-foreground">TENANT_ADMIN</strong> can
                  configure or update the LLM settings (Settings → AI Configuration).
                </p>
                <div className="space-y-3">
                  {[
                    {
                      provider: 'Anthropic Claude',
                      fields: ['API key', 'Model (e.g. claude-sonnet-4-6)'],
                      note: 'Recommended for highest quality PM outputs.',
                    },
                    {
                      provider: 'OpenAI',
                      fields: ['API key', 'Model (e.g. gpt-4o)'],
                      note: 'Model list refreshes dynamically from the OpenAI API.',
                    },
                    {
                      provider: 'Azure OpenAI',
                      fields: ['API key', 'Endpoint URL', 'Deployment name', 'API version'],
                      note: 'Useful for organisations with Azure enterprise agreements.',
                    },
                    {
                      provider: 'AWS Bedrock',
                      fields: ['AWS region', 'Access key ID', 'Secret access key', 'Model ID'],
                      note: 'Model list refreshes dynamically from Bedrock. Supports Claude on Bedrock.',
                    },
                  ].map(({ provider, fields, note }) => (
                    <div key={provider} className="p-4 rounded-xl border bg-card border-border">
                      <h3 className="text-sm font-medium text-foreground mb-1">{provider}</h3>
                      <p className="text-xs text-muted-foreground mb-2">{note}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {fields.map(f => (
                          <span key={f} className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border">{f}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs">
                  After saving, use <strong className="text-foreground">Test Connection</strong> to verify the key and model are reachable before the team starts using the Workbench.
                </p>
              </div>
            </Section>

            <Section id="api" title="REST API">
              <div className="space-y-4 text-sm text-muted-foreground">
                <h3 className="text-base font-medium text-foreground">Authentication</h3>
                <p>Register and obtain a JWT token:</p>
                <pre className="p-4 rounded-lg overflow-x-auto bg-muted text-foreground">
                  <code>{`curl -X POST http://localhost:8000/api/v1/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{"email":"pm@company.com","password":"...","full_name":"PM"}'`}</code>
                </pre>
                <p>Pass the token as a Bearer header on subsequent requests, or use an API key from Settings.</p>
                <h3 className="text-base font-medium text-foreground">OpenAPI Docs</h3>
                <p>Interactive API docs are available at <code className="bg-muted px-1 py-0.5 rounded text-xs">http://localhost:8000/docs</code> when running locally.</p>
              </div>
            </Section>

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

        <Footer />
      </div>
    </>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-2xl font-medium mb-6 pb-3 border-b border-border text-foreground">
        {title}
      </h2>
      {children}
    </section>
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
