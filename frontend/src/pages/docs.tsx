import Head from 'next/head'
import Link from 'next/link'
import { useEffect } from 'react'
import { Sparkles, Book, Code, Zap, Server, Users, Briefcase, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { LogoWordmark } from '@/components/Logo'

export default function Docs() {
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'

  useEffect(() => {
    document.body.style.background = dark ? '#0A0A0B' : '#F7F7F8'
    document.body.style.backgroundImage = 'none'
  }, [dark])

  const textPrimary = dark ? 'text-[#FAFAFA]' : 'text-[#0A0A0B]'
  const textMuted = dark ? 'text-[#A1A1AA]' : 'text-[#52525B]'
  const borderColor = dark ? 'border-white/[0.06]' : 'border-black/[0.07]'

  return (
    <>
      <Head>
        <title>Documentation - Evols</title>
        <style>{`h1,h2,h3,h4,h5,h6{font-family:'Syne',system-ui,sans-serif!important}`}</style>
      </Head>

      <div className={`min-h-screen transition-colors ${dark ? 'bg-[#0A0A0B]' : 'bg-[#F7F7F8]'}`}>
        {/* Header */}
        <nav className={`fixed top-0 left-0 right-0 z-50 border-b ${borderColor} backdrop-blur-xl ${dark ? 'bg-[#0A0A0B]/80' : 'bg-white/80'} transition-colors duration-300`}>
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/">
              <LogoWordmark iconSize={36} />
            </Link>
            <div className="flex items-center space-x-4">
              <button onClick={toggleTheme} className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5" aria-label="Toggle theme">
                {theme === 'light' ? <Moon className="w-5 h-5 text-[#52525B]" /> : <Sun className="w-5 h-5 text-[#A1A1AA]" />}
              </button>
              <Link href="/login" className={`hidden md:block text-sm transition-colors ${textMuted} hover:text-[#A78BFA]`}>Login</Link>
              <Link href="/register" className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white py-2 px-5 rounded-lg text-sm font-medium transition-colors">
                Get Early Access
              </Link>
            </div>
          </div>
        </nav>
        <div className="h-16" />

        {/* Main Content */}
        <main className="container mx-auto px-6 py-12">
          {/* Hero */}
          <div className="text-center mb-12">
            <img src="/Project Stages-rafiki.svg" alt="Project stages illustration" className="w-80 mx-auto mb-10 drop-shadow-lg" />
            <div className="inline-flex items-center gap-2 bg-[#A78BFA]/10 px-4 py-2 rounded-full text-sm text-[#A78BFA] mb-6">
              <Book className="w-4 h-4" />
              <span>Documentation</span>
            </div>
            <h1 className={`text-5xl font-medium mb-4 ${textPrimary}`}>Evols Documentation</h1>
            <p className={`text-xl max-w-3xl mx-auto ${textMuted}`}>
              Everything you need to know about your AI-powered PM operating system
            </p>
          </div>

          {/* Quick Links Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            {[
              { icon: Sparkles, title: 'Workbench',      description: 'Conversational AI copilot with 80+ PM skills',            href: '/docs/workbench' },
              { icon: Briefcase, title: 'Work Context',   description: 'Auto-populated PM OS with role, tasks, and capacity',      href: '#features' },
              { icon: Book,      title: 'Skills',         description: 'Strategy, execution, and analysis skills library',         href: '#features' },
              { icon: Code,      title: 'Knowledge',      description: 'Document intelligence and semantic search',                href: '/docs/knowledge-base' },
              { icon: Users,     title: 'Personas',       description: 'Customer personas and feedback analysis',                  href: '/docs/personas' },
              { icon: Zap,       title: 'Getting Started',description: 'Quick start guide and setup instructions',                 href: '#getting-started' },
            ].map(({ icon: Icon, title, description, href }) => (
              <Link key={title} href={href} className={`block p-6 rounded-xl border transition-all hover:border-[#A78BFA]/30 ${dark ? 'bg-[#111113] border-white/[0.06]' : 'bg-white border-black/[0.07]'}`}>
                <div className="w-10 h-10 bg-[#8B5CF6] rounded-lg flex items-center justify-center text-white mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className={`text-base font-medium mb-1.5 ${textPrimary}`}>{title}</h3>
                <p className={`text-sm ${textMuted}`}>{description}</p>
              </Link>
            ))}
          </div>

          {/* Main Documentation Sections */}
          <div className="max-w-4xl mx-auto space-y-12">
            <Section id="getting-started" title="Getting Started" dark={dark}>
              <div className={`prose max-w-none text-sm space-y-4 ${textMuted}`}>
                <h3 className={`text-base font-medium ${textPrimary}`}>Installation</h3>
                <p>Evols can be run with Docker Compose for the easiest setup:</p>
                <pre className={`p-4 rounded-lg overflow-x-auto text-sm ${dark ? 'bg-white/[0.04] text-[#FAFAFA]' : 'bg-black/[0.04] text-[#0A0A0B]'}`}>
                  <code>{`cd /Users/akshay/Desktop/workspace/Evols/docker\ndocker-compose up -d`}</code>
                </pre>
                <h3 className={`text-base font-medium ${textPrimary}`}>First Steps</h3>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Create an account at <Link href="/register" className="text-[#A78BFA] hover:text-[#8B5CF6]">/register</Link></li>
                  <li>Configure your LLM API keys in Settings</li>
                  <li>Upload sample documents to Knowledge</li>
                  <li>Open Workbench and start chatting</li>
                </ol>
              </div>
            </Section>

            <Section id="features" title="Core Features" dark={dark}>
              <div className="space-y-4">
                {[
                  { title: 'AI Workbench',      description: 'Conversational AI copilot with 80+ PM skills for strategy, execution, and communication.', features: ['80+ skills from unified-pm-os and custom library','Conversational interface with memory of past work','Function calling for data access and actions','Skills include: PRD writer, OST generator, meeting prep, weekly updates'], link: '/docs/workbench', linkText: 'Learn more →' },
                  { title: 'Work Context',      description: 'Your personal PM operating system that auto-populates from conversations.', features: ['AI auto-captures role, team, manager, capacity from conversations','Project tracking with status and stakeholders','Task board with kanban swimlanes','Priority tiers: Critical, High Leverage, Stakeholder, Sweep, Backlog'] },
                  { title: 'Skills Library',    description: 'Extensive library of PM skills for every workflow stage.', features: ['Strategy: Product strategy docs, competitive analysis','Discovery: OST generator, assumption testing','Execution: PRD writer, technical specs','Communication: Stakeholder updates, meeting prep, feedback synthesis'] },
                  { title: 'Knowledge',         description: 'Extract intelligence from documents and enable semantic search across your product knowledge.', features: ['Upload documents, meeting notes, PDFs, CSVs','AI extraction of entities: personas, features, pain points','Semantic search with embeddings','RAG integration with Workbench for context-aware responses'], link: '/docs/knowledge-base', linkText: 'Learn more →' },
                  { title: 'Personas & Feedback',description: 'Customer personas with feedback analysis and persona-based feature voting.', features: ['Create customer personas manually or from feedback','Feedback themes with clustering','Persona voting for features and initiatives','Feedback sentiment analysis'], link: '/docs/personas', linkText: 'Learn more →' },
                ].map((f) => (
                  <FeatureDoc key={f.title} dark={dark} {...f} />
                ))}
              </div>
            </Section>

            <Section id="api" title="API & Authentication" dark={dark}>
              <div className={`space-y-4 text-sm ${textMuted}`}>
                <h3 className={`text-base font-medium ${textPrimary}`}>Authentication</h3>
                <p>Register a new user and get an access token:</p>
                <pre className={`p-4 rounded-lg overflow-x-auto ${dark ? 'bg-white/[0.04] text-[#FAFAFA]' : 'bg-black/[0.04] text-[#0A0A0B]'}`}>
                  <code>{`curl -X POST http://localhost:8000/api/v1/auth/register \\\n  -H "Content-Type: application/json" \\\n  -d '{"email":"pm@company.com","password":"...","full_name":"PM"}'`}</code>
                </pre>
              </div>
            </Section>

            <Section id="support" title="Support" dark={dark}>
              <div className={`text-sm space-y-2 ${textMuted}`}>
                <p>Need help? Reach us at:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Email:</strong> support@evols.ai</li>
                  <li><strong>GitHub:</strong> <a href="https://github.com/evols/issues" target="_blank" rel="noopener" className="text-[#A78BFA] hover:text-[#8B5CF6]">Report bugs or request features</a></li>
                </ul>
              </div>
            </Section>
          </div>
        </main>

        <footer className={`border-t ${borderColor} py-12 transition-colors duration-300`}>
          <div className={`max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 ${dark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>
            <LogoWordmark iconSize={32} />
            <div className="flex items-center gap-6 flex-wrap justify-center">
              <Link href="/docs" className="text-sm transition-colors duration-150 hover:text-[#A78BFA]">Docs</Link>
              <Link href="/support" className="text-sm transition-colors duration-150 hover:text-[#A78BFA]">Support</Link>
              <Link href="/login" className="text-sm transition-colors duration-150 hover:text-[#A78BFA]">Login</Link>
            </div>
            <p className="text-xs">© 2026 Evols AI</p>
          </div>
        </footer>
      </div>
    </>
  )
}

function Section({ id, title, children, dark }: { id: string; title: string; children: React.ReactNode; dark: boolean }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className={`text-2xl font-medium mb-6 pb-3 border-b ${dark ? 'border-white/[0.06] text-[#FAFAFA]' : 'border-black/[0.07] text-[#0A0A0B]'}`}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function FeatureDoc({ title, description, features, link, linkText, dark }: {
  title: string; description: string; features: string[]; link?: string; linkText?: string; dark: boolean
}) {
  return (
    <div className={`p-5 rounded-xl border ${dark ? 'bg-[#111113] border-white/[0.06]' : 'bg-white border-black/[0.07]'}`}>
      <h3 className={`text-base font-medium mb-1.5 ${dark ? 'text-[#FAFAFA]' : 'text-[#0A0A0B]'}`}>{title}</h3>
      <p className={`text-sm mb-3 ${dark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>{description}</p>
      <ul className="space-y-1.5">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-[#A78BFA] mt-0.5 leading-tight">•</span>
            <span className={`text-sm ${dark ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>{feature}</span>
          </li>
        ))}
      </ul>
      {link && linkText && (
        <div className="mt-4">
          <Link href={link} className="text-sm text-[#A78BFA] hover:text-[#8B5CF6] transition-colors">{linkText}</Link>
        </div>
      )}
    </div>
  )
}
