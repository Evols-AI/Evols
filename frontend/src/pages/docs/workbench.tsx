import Head from 'next/head'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Search, Brain, Zap, MessageSquare, BookOpen } from 'lucide-react'
import Header from '@/components/Header'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-medium mb-4 pb-3 border-b border-border text-foreground">{title}</h2>
      <div className="space-y-4 text-sm text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

export default function WorkbenchDocumentation() {
  return (
    <>
      <Head>
        <title>AI Workbench Documentation - Evols</title>
        <style>{`h1,h2,h3,h4,h5,h6{font-family:'Syne',system-ui,sans-serif!important}`}</style>
      </Head>

      <div className="min-h-screen bg-background">
        <Header variant="landing" />

        <main className="container mx-auto px-6 pt-28 pb-12 max-w-4xl">

          <div className="mb-8">
            <Link href="/docs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
              <ArrowLeft className="w-4 h-4" />
              Back to Docs
            </Link>
            <div className="inline-flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full text-sm text-primary mb-4 ml-4">
              <Sparkles className="w-4 h-4" />
              <span>AI Workbench</span>
            </div>
            <h1 className="text-4xl font-medium mb-3 text-foreground">AI Workbench</h1>
            <p className="text-xl text-muted-foreground">
              Your team's AI brain — 80+ skills, knowledge-grounded responses, and real-time internet search.
            </p>
          </div>

          <Section title="Overview">
            <p>
              The Workbench is a conversational AI interface pre-configured for team collaboration and coordination work.
              It connects to your uploaded knowledge (via LightRAG), your Work Context, and optionally the web (via Tavily/Serper)
              to produce responses grounded in your actual product situation.
            </p>
            <p>
              Unlike generic chat UIs, the Workbench ships with a curated skill library — each skill is a system-prompt-level
              instruction that focuses the AI on a specific task like writing a PRD, drafting OKRs, or running a pre-mortem.
            </p>
            <div className="grid md:grid-cols-2 gap-4 mt-2">
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
          </Section>

          <Section title="Skills Library">
            <p>Skills are selected from the sidebar or via the skills menu in the chat. Each skill loads a focused PM prompt context.</p>
            <div className="space-y-3 mt-2">
              {[
                {
                  category: 'Strategy',
                  skills: ['Product strategy document', 'Competitive analysis', 'Opportunity sizing', 'Market positioning', 'Roadmap planning'],
                },
                {
                  category: 'Discovery',
                  skills: ['Assumption mapping', 'Jobs-to-be-done analysis', 'User story generation', 'Problem statement framing', 'Research plan'],
                },
                {
                  category: 'Execution',
                  skills: ['PRD writer', 'Technical spec', 'Sprint planning', 'Acceptance criteria', 'Definition of done'],
                },
                {
                  category: 'Communication',
                  skills: ['Stakeholder update', 'Executive briefing', 'Meeting prep', 'Weekly update', 'Decision brief', 'Retrospective summary'],
                },
                {
                  category: 'Analysis',
                  skills: ['RICE scoring', 'OKR drafting', 'Pre-mortem', 'Feedback synthesis', 'Win/loss analysis'],
                },
              ].map(({ category, skills }) => (
                <div key={category} className="p-4 rounded-xl border bg-card border-border">
                  <h3 className="text-sm font-medium text-foreground mb-2">{category}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map(s => (
                      <span key={s} className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border">{s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Using Internet Search">
            <p>
              When internet search is enabled (configured via Tavily or Serper API key in Settings), the AI can pull
              real-time information from the web. This is useful for:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Competitor feature research</li>
              <li>Market sizing and trends</li>
              <li>Industry benchmarks</li>
              <li>Recent product announcements</li>
            </ul>
            <p>Internet search is triggered automatically when the AI determines external data would improve the response.</p>
          </Section>

          <Section title="Knowledge Integration">
            <p>
              The Workbench uses your team's knowledge context automatically. When you ask a question, it retrieves
              relevant content from your uploaded sources and the Knowledge Graph using hybrid RAG (local + global search modes).
            </p>
            <p>
              To ensure good grounding: add sources via the Knowledge page, then use the Sync Data button on the
              Knowledge Graph tab to populate the LightRAG index. The Workbench will then cite from those sources.
            </p>
          </Section>

          <Section title="Configuration">
            <h3 className="text-base font-medium text-foreground">LLM Provider</h3>
            <p>
              Configure your LLM in Settings → AI Configuration. Evols supports any OpenAI-compatible provider:
              Anthropic Claude (via Bedrock or direct API), OpenAI, Azure OpenAI, or a local model via an OpenAI-compatible proxy.
            </p>
            <p>Recommended models as of April 2026: <code className="bg-muted px-1 py-0.5 rounded text-xs">claude-sonnet-4-6</code> for quality, <code className="bg-muted px-1 py-0.5 rounded text-xs">claude-haiku-4-5-20251001</code> for cost efficiency.</p>

            <h3 className="text-base font-medium text-foreground mt-4">Internet Search</h3>
            <p>Add a Tavily or Serper API key in Settings → Integrations to enable web search.</p>
          </Section>

          <Section title="Tips">
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong className="text-foreground">Be specific:</strong> "Write a PRD for mobile offline sync targeting Enterprise customers in Q3" beats "write a PRD"</li>
              <li><strong className="text-foreground">Use constraints:</strong> Include team size, timeline, and tech constraints for more realistic outputs</li>
              <li><strong className="text-foreground">Reference personas:</strong> Ask the AI to frame recommendations from the perspective of a specific persona — they're extracted automatically from your knowledge sources</li>
              <li><strong className="text-foreground">Iterate:</strong> Skills work best as a starting point — refine the output in follow-up messages</li>
            </ul>
          </Section>

          <div className="mt-12 pt-8 border-t border-border flex items-center justify-between">
            <Link href="/docs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Documentation
            </Link>
            <Link href="/workbench" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary/85 text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary transition-colors">
              <Sparkles className="w-4 h-4" />
              Open Workbench
            </Link>
          </div>
        </main>
      </div>
    </>
  )
}
