import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  GitBranch,
  Users,
  TrendingUp,
  Sparkles,
  ArrowRight,
  CheckCircle,
  Moon,
  Sun
} from 'lucide-react'
import { LogoWordmark } from '@/components/Logo'
import { useTheme } from '@/contexts/ThemeContext'

export default function Home() {
  const { theme, toggleTheme } = useTheme()

  return (
    <>
      <Head>
        <title>Evols - Evolve your product roadmap</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-violet-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
        {/* Header */}
        <header className="container mx-auto px-6 py-8">
          <nav className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <LogoWordmark iconSize={60} />
            </div>
            <div className="flex items-center space-x-6">
              <button onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition transform hover:scale-110 active:scale-90 border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                aria-label="Toggle theme"
              >
                {theme === 'light' ? (
                  <Moon className="w-5 h-5 text-gray-600" />
                ) : (
                  <Sun className="w-5 h-5 text-gray-300" />
                )}
              </button>
              <Link href="/login" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                Login
              </Link>
              <Link href="/register"
                className="bg-gradient-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-purple-600 text-white py-3 px-6 rounded-full shadow-lg transform transition-all duration-500 ease-in-out hover:scale-110 hover:brightness-110 hover:animate-pulse active:animate-bounce"
              >
                Get Started
              </Link>
            </div>
          </nav>
        </header>

        {/* Hero Section */}
        <section className="container mx-auto px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center lg:text-left"
            >
              <div className="inline-flex items-center space-x-2 bg-blue-100 dark:bg-blue-900/30 px-4 py-2 rounded-full text-sm text-blue-600 dark:text-blue-400 mb-6">
                <Sparkles className="w-4 h-4" />
                <span>AI-Native Roadmap Evolution</span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl mb-6 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent leading-tight pb-2">
                Your AI-Powered
                <br />
                <span className="bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">PM Operating System.</span>
              </h1>

              <p className="text-xl text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto lg:mx-0">
                An intelligent copilot with 80+ PM skills that learns your work context, manages your tasks,
                extracts intelligence from documents, and helps you execute faster with conversational AI.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start space-y-4 sm:space-y-0 sm:space-x-4">
                <Link href="/book-demo"
                  className="w-full sm:w-auto bg-gradient-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-purple-600 text-white py-4 px-10 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105 hover:brightness-110 flex items-center justify-center space-x-2"
                >
                  <span>Book Demo</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link href="/docs"
                  className="w-full sm:w-auto border-2 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white px-10 py-4 rounded-full text-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition transform hover:scale-105 active:scale-95 flex items-center justify-center"
                >
                  Learn More
                </Link>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="hidden lg:flex justify-center"
            >
              <img
                src="/Innovation-amico.svg"
                alt="Innovation illustration"
                className="w-full max-w-lg drop-shadow-lg"
              />
            </motion.div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="container mx-auto px-6 py-20">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard icon={<Sparkles className="w-8 h-8" />}
              title="AI Workbench"
              description="Conversational copilot with 80+ PM skills for strategy, execution, and analysis"
            />
            <FeatureCard icon={<Users className="w-8 h-8" />}
              title="Auto Work Context"
              description="AI captures your role, capacity, projects, and relationships from conversations"
            />
            <FeatureCard icon={<GitBranch className="w-8 h-8" />}
              title="Smart Intelligence"
              description="Extract insights from documents, meeting notes, and feedback automatically"
            />
            <FeatureCard icon={<TrendingUp className="w-8 h-8" />}
              title="Task Management"
              description="Kanban board with AI-powered task creation from action items in conversations"
            />
          </div>
        </section>

        {/* Value Props */}
        <section className="container mx-auto px-6 py-20">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="grid md:grid-cols-2 gap-12 p-12">
              <div>
                <h2 className="text-4xl mb-8 text-gray-900 dark:text-white">
                  Why Evols?
                </h2>
                <div className="space-y-6">
                  <ValueProp text="Conversational AI that learns your context and remembers past work" />
                  <ValueProp text="80+ PM skills from strategy docs to meeting prep to weekly updates" />
                  <ValueProp text="Auto-capture work context from conversations - no manual forms" />
                  <ValueProp text="Extract intelligence from documents, meeting notes, and feedback" />
                  <ValueProp text="Manage tasks in kanban board with AI-detected action items" />
                  <ValueProp text="Product knowledge base with semantic search and RAG" />
                </div>
              </div>
              <div className="hidden md:flex items-center justify-center">
                <img
                  src="/Innovation-pana.svg"
                  alt="Innovation illustration"
                  className="w-full max-w-md drop-shadow-lg"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ROI Comparison Section */}
        <section className="container mx-auto px-6 py-20 pb-32">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl md:text-5xl mb-6 text-gray-900 dark:text-white">
              Replace Your Entire PM Stack. <br /><span className="bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">With One AI Copilot.</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Why pay for separate task managers, note-taking apps, document assistants, and workflow tools?
              Get an AI copilot that handles it all through conversation.
            </p>
          </div>

          <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-gray-700">
              {/* Other Tools Column */}
              <div className="p-8 md:col-span-2 bg-gray-50/50 dark:bg-gray-800/50">
                <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-6 uppercase tracking-wider">With Separate Tools (Per PM)</h3>
                <div className="space-y-6">
                  <ComparisonItem name="Task Management (Asana, Linear, ClickUp)" price="$1,200" />
                  <ComparisonItem name="Note Taking (Notion, Obsidian, Roam)" price="$600" />
                  <ComparisonItem name="AI Assistant (ChatGPT, Claude, custom wrappers)" price="$2,400" />
                  <ComparisonItem name="Document Intelligence (Multiple LLM tools)" price="$1,800" />
                  <ComparisonItem name="Workflow Automation (Zapier, Make)" price="$1,500" />
                  <div className="pt-6 mt-6 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center text-gray-900 dark:text-gray-100">
                    <span className="text-xl">Tool Stack Total</span>
                    <span className="text-2xl text-red-500 line-through">$7,500/yr</span>
                  </div>
                </div>
              </div>

              {/* Evols Column */}
              <div className="p-8 bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Sparkles className="w-32 h-32 text-blue-500" />
                </div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <h3 className="text-sm text-blue-600 dark:text-blue-400 mb-6 uppercase tracking-wider flex items-center gap-2">
                      With Evols
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 font-medium mb-8 leading-relaxed">
                      One unified OS for your entire product management workflow.
                    </p>
                  </div>
                  <div>
                    <div className="mb-4">
                      <span className="text-5xl text-gray-900 dark:text-white">$0</span>
                      <span className="text-gray-500 dark:text-gray-400 ml-2">extra cost</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                      Included in your simple, flat Evols subscription.
                    </p>
                    <Link href="/book-demo" className="block w-full text-center bg-gradient-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-purple-600 text-white py-4 px-6 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105 hover:brightness-110 active:scale-95">
                      Start Saving
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="container mx-auto px-6 py-12 flex flex-col items-center justify-center space-y-4 text-center text-gray-600 dark:text-gray-400">
          <div className="mb-4">
            <LogoWordmark iconSize={40} />
          </div>
          <div className="flex items-center space-x-6">
            <Link href="/docs" className="hover:text-blue-500 transition">Documentation</Link>
            <Link href="/support" className="hover:text-blue-500 transition">Contact Support</Link>
            <Link href="/register" className="hover:text-blue-500 transition">Sign Up</Link>
            <a
              href="https://storyset.com/innovation"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-500 transition"
            >
              Illustration by Storyset
            </a>
          </div>
          <p>© 2026 Evols. Evolve your product roadmap.</p>
        </footer>
      </div>
    </>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div whileHover={{ scale: 1.05 }}
      className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition"
    >
      <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-blue-500 rounded-lg flex items-center justify-center text-white mb-4">
        {icon}
      </div>
      <h3 className="text-xl mb-2 text-gray-900 dark:text-white">{title}</h3>
      <p className="text-gray-600 dark:text-gray-300">{description}</p>
    </motion.div>
  )
}

function ValueProp({ text }: { text: string }) {
  return (
    <div className="flex items-start space-x-3">
      <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
      <p className="text-gray-700 dark:text-gray-300">{text}</p>
    </div>
  )
}

function ComparisonItem({ name, price }: { name: string, price: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="w-2 h-2 bg-red-400 rounded-full" />
        <span className="text-gray-700 dark:text-gray-300 font-medium">{name}</span>
      </div>
      <span className="text-gray-900 dark:text-white">{price}</span>
    </div>
  )
}
