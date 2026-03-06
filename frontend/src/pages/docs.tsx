import Head from 'next/head'
import Link from 'next/link'
import { Sparkles, Book, Code, Zap, Server, Users, ArrowLeft } from 'lucide-react'
import { LogoIcon } from '@/components/Logo'

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
              <Link href="/" className="flex items-center space-x-2">
                <LogoIcon size={48} />
                <span className="text-2xl font-bold text-gray-900 dark:text-white">Evols</span>
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
            <svg viewBox="0 0 400 300" className="w-80 mx-auto mb-8 drop-shadow-lg">
              <defs>
                <linearGradient id="docsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#6366f1', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#8b5cf6', stopOpacity: 1 }} />
                </linearGradient>
              </defs>
              <rect x="80" y="60" width="240" height="180" rx="8" fill="url(#docsGrad)" opacity="0.9" />
              <rect x="100" y="90" width="200" height="12" rx="3" fill="white" opacity="0.3" />
              <rect x="100" y="115" width="180" height="8" rx="2" fill="white" opacity="0.25" />
              <rect x="100" y="130" width="190" height="8" rx="2" fill="white" opacity="0.25" />
              <rect x="100" y="145" width="170" height="8" rx="2" fill="white" opacity="0.25" />
              <rect x="100" y="170" width="200" height="12" rx="3" fill="white" opacity="0.3" />
              <rect x="100" y="195" width="160" height="8" rx="2" fill="white" opacity="0.25" />
              <rect x="100" y="210" width="180" height="8" rx="2" fill="white" opacity="0.25" />
              <circle cx="340" cy="100" r="35" fill="#10b981" opacity="0.8" />
              <path d="M 330 100 L 337 107 L 350 92" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
            <div className="inline-flex items-center space-x-2 bg-blue-100 dark:bg-blue-900/30 px-4 py-2 rounded-full text-sm text-blue-600 dark:text-blue-400 mb-6">
              <Book className="w-4 h-4" />
              <span>Documentation</span>
            </div>
            <h1 className="text-5xl font-bold mb-4 text-gray-900 dark:text-white">Evols Documentation</h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Everything you need to know to get started with Evols
            </p>
          </div>

          {/* Quick Links Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <DocCard icon={<Sparkles className="w-6 h-6" />}
              title="Themes"
              description="How urgency and impact scores are calculated"
              href="/docs/themes"
            />
            <DocCard icon={<Users className="w-6 h-6" />}
              title="Personas"
              description="Learn about digital twin personas and metrics"
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
            <DocCard icon={<Code className="w-6 h-6" />}
              title="Core Features"
              description="VoC clustering, personas, and decisions"
              href="#features"
            />
            <DocCard icon={<Book className="w-6 h-6" />}
              title="API Usage"
              description="Authentication and API examples"
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
                <FeatureDoc title="AI-Powered VoC Clustering"
                  description="Automatically categorize and cluster voice of customer data into themes with dynamic urgency and impact scoring."
                  features={[
                    'Auto-categorization (features, bugs, tech debt)',
                    'Theme clustering using embeddings (75% similarity threshold)',
                    'Dynamic urgency scores based on category distribution',
                    'Dynamic impact scores from account count + feedback volume',
                    'Incremental refresh - only processes new feedback'
                  ]}
                  link="/docs/themes"
                  linkText="Learn how scores are calculated →"
                />
                <FeatureDoc title="Persona Digital Twins"
                  description="Generate and simulate customer personas with dynamic revenue and usage metrics from VoC data."
                  features={[
                    'Auto-generate personas from customer segments',
                    'Revenue contribution calculated from feedback data',
                    'Usage frequency extracted from activity patterns',
                    'Persona lifecycle (New → Advisor → Dismissed)',
                    'Incremental updates with duplicate prevention (85% similarity)',
                    'Chat interface and trade-off voting'
                  ]}
                  link="/docs/personas"
                  linkText="Learn about persona metrics →"
                />
                <FeatureDoc title="Decision Brief Generator"
                  description="AI-generated evidence-backed decision briefs with options and recommendations."
                  features={[
                    'Multiple roadmap options with pros/cons',
                    'Segment impact analysis',
                    'Citations to VoC and accounts',
                    'Markdown/PDF export'
                  ]}
                />
              </div>
            </Section>

            {/* API Usage */}
            <Section id="api" title="API Usage">
              <div className="prose dark:prose-invert max-w-none">
                <h3>Authentication</h3>
                <p>Register a new user and get an access token:</p>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`curl -X POST http://localhost:8000/api/v1/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "admin@company.com",
    "password": "SecurePassword123!",
    "full_name": "Admin User",
    "tenant_slug": "my-company"
  }'`}</code>
                </pre>

                <h3>Upload VoC</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`curl -X POST http://localhost:8000/api/v1/feedback/ \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "source": "manual_upload",
    "content": "We need better onboarding",
    "customer_segment": "Enterprise"
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
          <Link href={link} className="inline-flex items-center text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700">
            {linkText}
          </Link>
        </div>
      )}
    </div>
  )
}
