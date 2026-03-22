import Head from 'next/head'
import Link from 'next/link'
import { Sparkles, Book, Code, Zap, Server, Users, ArrowLeft, Briefcase } from 'lucide-react'

export default function Docs() {
  return (
    <>
      <Head>
        <title>Documentation - Evols</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center">
                <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
                  Evols<span className="text-gray-400 dark:text-gray-500 font-medium">.ai</span>
                </span>
              </Link>
              <div className="flex items-center space-x-4">
                <Link href="/" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Home</span>
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-6 py-12">
          {/* Hero */}
          <div className="text-center mb-12">
            <svg viewBox="0 0 400 300" className="w-80 mx-auto mb-10 drop-shadow-lg">
              <defs>
                <linearGradient id="docsPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
                <linearGradient id="docsSecondary" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#2dd4bf" />
                </linearGradient>
                <filter id="docsGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Background Glow */}
              <circle cx="200" cy="150" r="100" fill="url(#docsPrimary)" opacity="0.1" filter="url(#docsGlow)">
                <animate attributeName="r" values="95;105;95" dur="4s" repeatCount="indefinite" />
              </circle>

              {/* Floating Folders (Background) */}
              <g opacity="0.6">
                <rect x="60" y="80" width="80" height="100" rx="8" fill="url(#docsSecondary)" opacity="0.4" transform="rotate(-15 100 130)">
                  <animateTransform attributeName="transform" type="translate" values="0,0; -5,-10; 0,0" dur="5s" repeatCount="indefinite" additive="sum" />
                </rect>
                <rect x="260" y="60" width="70" height="90" rx="8" fill="#ec4899" opacity="0.3" transform="rotate(20 295 105)">
                  <animateTransform attributeName="transform" type="translate" values="0,0; 5,-10; 0,0" dur="4s" repeatCount="indefinite" additive="sum" />
                </rect>
              </g>

              {/* Main Document Base */}
              <path d="M 120 100 L 280 100 C 291 100 300 109 300 120 L 300 240 C 300 251 291 260 280 260 L 120 260 C 109 260 100 251 100 240 L 100 120 C 100 109 109 100 120 100 Z" fill="white" className="dark:fill-gray-800" stroke="url(#docsPrimary)" strokeWidth="4" />

              {/* Document Header */}
              <path d="M 100 120 C 100 109 109 100 120 100 L 280 100 C 291 100 300 109 300 120 L 300 140 L 100 140 Z" fill="url(#docsPrimary)" />

              {/* Document Lines */}
              <g opacity="0.3" className="dark:opacity-50 text-gray-900 dark:text-gray-100" fill="currentColor">
                <rect x="130" y="160" width="140" height="8" rx="4" />
                <rect x="130" y="180" width="100" height="8" rx="4" />
                <rect x="130" y="200" width="120" height="8" rx="4" />
                <rect x="130" y="220" width="80" height="8" rx="4" />
              </g>

              {/* Magnifying Glass Overlay */}
              <g filter="url(#docsGlow)" transform="translate(180, 150)">
                <circle cx="30" cy="30" r="24" fill="url(#docsSecondary)" opacity="0.9" />
                <circle cx="30" cy="30" r="14" fill="white" opacity="0.3" />
                <circle cx="26" cy="26" r="4" fill="white" opacity="0.8" />
                <path d="M 46 46 L 60 60" stroke="url(#docsSecondary)" strokeWidth="8" strokeLinecap="round" />
                <animateTransform attributeName="transform" type="translate" values="180,150; 185,145; 180,150" dur="6s" repeatCount="indefinite" />
              </g>

              {/* Code Brackets Badge */}
              <g transform="translate(90, 80)">
                <circle cx="20" cy="20" r="20" fill="#10b981" filter="url(#docsGlow)" />
                <path d="M 14 12 L 8 20 L 14 28 M 26 12 L 32 20 L 26 28" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <animateTransform attributeName="transform" type="translate" values="90,80; 90,75; 90,80" dur="3s" repeatCount="indefinite" />
              </g>
            </svg>
            <div className="inline-flex items-center space-x-2 bg-blue-100 dark:bg-blue-900/30 px-4 py-2 rounded-full text-sm text-blue-600 dark:text-blue-400 mb-6">
              <Book className="w-4 h-4" />
              <span>Documentation</span>
            </div>
            <h1 className="text-5xl font-bold mb-4 text-gray-900 dark:text-white">Evols Documentation</h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Everything you need to know about your AI-powered PM operating system
            </p>
          </div>

          {/* Quick Links Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <DocCard icon={<Sparkles className="w-6 h-6" />}
              title="Workbench"
              description="Conversational AI copilot with 80+ PM skills"
              href="/docs/workbench"
            />
            <DocCard icon={<Briefcase className="w-6 h-6" />}
              title="Work Context"
              description="Auto-populated PM OS with role, tasks, and capacity"
              href="#features"
            />
            <DocCard icon={<Book className="w-6 h-6" />}
              title="Skills"
              description="Strategy, execution, and analysis skills library"
              href="#features"
            />
            <DocCard icon={<Code className="w-6 h-6" />}
              title="Knowledge"
              description="Document intelligence and semantic search"
              href="/docs/knowledge-base"
            />
            <DocCard icon={<Users className="w-6 h-6" />}
              title="Personas"
              description="Customer personas and feedback analysis"
              href="/docs/personas"
            />
            <DocCard icon={<Server className="w-6 h-6" />}
              title="API Reference"
              description="Complete API documentation with examples"
              href="http://localhost:8000/api/v1/docs"
              external
            />
            <DocCard icon={<Zap className="w-6 h-6" />}
              title="Getting Started"
              description="Quick start guide and setup instructions"
              href="#getting-started"
            />
            <DocCard icon={<Book className="w-6 h-6" />}
              title="Authentication"
              description="API authentication and examples"
              href="#api"
            />
          </div>

          {/* Main Documentation Sections */}
          <div className="max-w-4xl mx-auto space-y-12">
            {/* Getting Started */}
            <Section id="getting-started" title="Getting Started">
              <div className="prose dark:prose-invert max-w-none">
                <h3>Installation</h3>
                <p>Evols can be run with Docker Compose for the easiest setup:</p>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <code>{`cd /Users/akshay/Desktop/workspace/Evols/docker
docker-compose up -d`}</code>
                </pre>

                <h3>Access Points</h3>
                <ul>
                  <li><strong>Frontend:</strong> <a href="http://localhost:3000" target="_blank" rel="noopener">http://localhost:3000</a></li>
                  <li><strong>Backend API:</strong> <a href="http://localhost:8000" target="_blank" rel="noopener">http://localhost:8000</a></li>
                  <li><strong>API Docs:</strong> <a href="http://localhost:8000/api/v1/docs" target="_blank" rel="noopener">http://localhost:8000/api/v1/docs</a></li>
                </ul>

                <h3>First Steps</h3>
                <ol>
                  <li>Create an account at <Link href="/register">http://localhost:3000/register</Link></li>
                  <li>Configure your LLM API keys in <code>backend/.env</code></li>
                  <li>Upload sample VoC data</li>
                  <li>Explore the dashboard</li>
                </ol>
              </div>
            </Section>

            {/* Core Features */}
            <Section id="features" title="Core Features">
              <div className="space-y-6">
                <FeatureDoc title="AI Workbench"
                  description="Conversational AI copilot with 80+ PM skills for strategy, execution, and communication."
                  features={[
                    '80+ skills from unified-pm-os and custom library',
                    'Conversational interface with memory of past work',
                    'Function calling for data access and actions',
                    'Skills include: PRD writer, OST generator, meeting prep, weekly updates',
                    'Custom skill creation with tool access',
                    'Multi-product context support'
                  ]}
                  link="/docs/workbench"
                  linkText="Learn more about Workbench →"
                />
                <FeatureDoc title="Work Context (PM OS)"
                  description="Your personal PM operating system that auto-populates from conversations."
                  features={[
                    'AI auto-captures role, team, manager, capacity from conversations',
                    'Project tracking with status and stakeholders',
                    'Relationship management (peers, stakeholders, reports)',
                    'Task board with kanban swimlanes (TODO, In Progress, Done)',
                    'Priority tiers: Critical, High Leverage, Stakeholder, Sweep, Backlog',
                    'PM decision log with options analysis'
                  ]}
                />
                <FeatureDoc title="Skills Library"
                  description="Extensive library of PM skills for every workflow stage."
                  features={[
                    'Strategy: Product strategy docs, competitive analysis, market research',
                    'Discovery: OST generator, assumption testing, validation frameworks',
                    'Execution: PRD writer, technical specs, API documentation',
                    'Communication: Stakeholder updates, meeting prep, feedback synthesis',
                    'Daily Discipline: Calendar review, action item harvester, say-no playbook',
                    'Browse 80+ skills or create custom ones'
                  ]}
                />
                <FeatureDoc title="Knowledge Management"
                  description="Extract intelligence from documents and enable semantic search across your product knowledge."
                  features={[
                    'Upload documents, meeting notes, PDFs, CSVs',
                    'AI extraction of entities: personas, features, pain points, use cases',
                    'Semantic search with embeddings',
                    'Source grouping by date and type',
                    'Product knowledge base with strategy docs',
                    'RAG integration with Workbench for context-aware responses'
                  ]}
                  link="/docs/knowledge-base"
                  linkText="Learn more about Knowledge Base →"
                />
                <FeatureDoc title="Personas & Feedback"
                  description="Customer personas with feedback analysis and persona-based feature voting."
                  features={[
                    'Create customer personas manually or from feedback',
                    'Feedback themes with clustering',
                    'Persona voting for features and initiatives',
                    'Feedback sentiment analysis',
                    'Customer segment tracking',
                    'Entity extraction from feedback'
                  ]}
                  link="/docs/personas"
                  linkText="Learn more about Personas →"
                />
              </div>
            </Section>

            {/* API Usage */}
            <Section id="api" title="API & Authentication">
              <div className="prose dark:prose-invert max-w-none">
                <h3>Authentication</h3>
                <p>Register a new user and get an access token:</p>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`curl -X POST http://localhost:8000/api/v1/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "pm@company.com",
    "password": "SecurePassword123!",
    "full_name": "Product Manager",
    "tenant_slug": "my-company"
  }'`}</code>
                </pre>

                <h3>Upload Documents</h3>
                <p>Upload documents for knowledge extraction:</p>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`curl -X POST http://localhost:8000/api/v1/context/upload \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -F "file=@meeting_notes.pdf" \\
  -F "source_type=meeting_notes" \\
  -F "source_name=Q1 Strategy Meeting"`}</code>
                </pre>

                <h3>Chat with Workbench</h3>
                <p>Start a conversation with AI skills:</p>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`curl -X POST http://localhost:8000/api/v1/copilot/chat \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "message": "@prd-writer Create a PRD for mobile app notifications",
    "conversation_id": null
  }'`}</code>
                </pre>

                <p>
                  For complete API documentation, visit{' '}
                  <a href="http://localhost:8000/api/v1/docs" target="_blank" rel="noopener">
                    http://localhost:8000/api/v1/docs
                  </a>
                </p>
              </div>
            </Section>

            {/* Support */}
            <Section id="support" title="Support">
              <div className="prose dark:prose-invert max-w-none">
                <p>Need help? We're here for you:</p>
                <ul>
                  <li><strong>GitHub Issues:</strong> <a href="https://github.com/evols/issues" target="_blank" rel="noopener">Report bugs or request features</a></li>
                  <li><strong>Email:</strong> support@evols.ai</li>
                  <li><strong>Documentation:</strong> Read our comprehensive guides in the repository</li>
                </ul>
              </div>
            </Section>
          </div>
        </main>

        {/* Footer */}
        <footer className="container mx-auto px-6 py-12 text-center text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 mt-12">
          <p>© 2026 Evols. All rights reserved.</p>
        </footer>
      </div>
    </>
  )
}

function DocCard({ icon, title, description, href, external = false }: {
  icon: React.ReactNode, title: string, description: string, href: string, external?: boolean
}) {
  const content = (
    <>
      <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-blue-500 rounded-lg flex items-center justify-center text-white mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
    </>
  )

  if (external) {
    return (
      <a href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm hover:shadow-lg transition"
      >
        {content}
      </a>
    )
  }

  return (
    <Link href={href} className="block bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm hover:shadow-lg transition">
      {content}
    </Link>
  )
}

function Section({ id, title, children }: { id: string, title: string, children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-3xl font-bold mb-6 pb-2 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
        {title}
      </h2>
      {children}
    </section>
  )
}

function FeatureDoc({ title, description, features, link, linkText }: {
  title: string, description: string, features: string[], link?: string, linkText?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl">
      <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">{title}</h3>
      <p className="text-gray-600 dark:text-gray-300 mb-4">{description}</p>
      <ul className="space-y-2">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start space-x-2">
            <span className="text-blue-600 mt-1">•</span>
            <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
          </li>
        ))}
      </ul>
      {link && linkText && (
        <div className="mt-4">
          <Link href={link} className="inline-flex items-center text-sm text-blue-500 dark:text-blue-300 hover:text-blue-600">
            {linkText}
          </Link>
        </div>
      )}
    </div>
  )
}
