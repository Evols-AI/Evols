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
              <a href="https://github.com/akshay-saraswat/evols"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 px-6 py-2 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-gray-700 dark:text-gray-300 transform hover:scale-105 active:scale-95"
                aria-label="View on GitHub"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">GitHub</span>
              </a>
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
                className="bg-gradient-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-purple-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transform transition-all duration-500 ease-in-out hover:scale-110 hover:brightness-110 hover:animate-pulse active:animate-bounce"
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

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent leading-tight pb-2">
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
                  className="w-full sm:w-auto bg-gradient-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-purple-600 text-white font-bold py-4 px-10 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105 hover:brightness-110 flex items-center justify-center space-x-2"
                >
                  <span>Book Demo</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link href="/docs"
                  className="w-full sm:w-auto border-2 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white px-10 py-4 rounded-full text-lg font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition transform hover:scale-105 active:scale-95 flex items-center justify-center"
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
              <svg viewBox="0 0 900 500" className="w-full max-w-4xl drop-shadow-lg overflow-visible">
                <defs>
                  <linearGradient id="heroPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ec4899" />
                    <stop offset="100%" stopColor="#9333ea" />
                  </linearGradient>
                  <linearGradient id="heroSecondary" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#2dd4bf" />
                  </linearGradient>
                  <linearGradient id="heroAccent" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                  <filter id="heroGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="15" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="heroDropShadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="6" stdDeviation="6" floodOpacity="0.08" />
                  </filter>
                </defs>

                {/* Base Holographic Rings */}
                <g filter="url(#heroGlow)" opacity="0.15">
                  <circle cx="450" cy="250" r="220" fill="none" stroke="url(#heroPrimary)" strokeWidth="2">
                    <animateTransform attributeName="transform" type="rotate" values="0 450 250; 360 450 250" dur="40s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="450" cy="250" r="180" fill="none" stroke="url(#heroSecondary)" strokeWidth="4" strokeDasharray="10 20">
                    <animateTransform attributeName="transform" type="rotate" values="360 450 250; 0 450 250" dur="30s" repeatCount="indefinite" />
                  </circle>
                </g>

                {/* Floating Elements / Particles */}
                <g opacity="0.6" filter="url(#heroGlow)">
                  <circle cx="200" cy="100" r="12" fill="url(#heroAccent)">
                    <animateTransform attributeName="transform" type="translate" values="0,0; -10,20; 0,0" dur="6s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="750" cy="150" r="8" fill="url(#heroSecondary)">
                    <animateTransform attributeName="transform" type="translate" values="0,0; -20,-10; 0,0" dur="5s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="150" cy="400" r="15" fill="url(#heroPrimary)">
                    <animateTransform attributeName="transform" type="translate" values="0,0; 15,-15; 0,0" dur="7s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="800" cy="350" r="20" fill="url(#heroAccent)" opacity="0.3">
                    <animateTransform attributeName="transform" type="translate" values="0,0; -15,15; 0,0" dur="8s" repeatCount="indefinite" />
                  </circle>
                </g>

                {/* Connection Lines Matrix */}
                <g opacity="0.2" stroke="currentColor" strokeWidth="1.5" className="text-gray-400 dark:text-gray-600">
                  <path d="M 250 250 L 350 180 L 450 150 L 550 180 L 650 250 L 550 320 L 450 350 L 350 320 Z" fill="none" />
                  <path d="M 350 180 L 450 250 L 550 180" fill="none" />
                  <path d="M 350 320 L 450 250 L 550 320" fill="none" />
                  <circle cx="250" cy="250" r="4" fill="currentColor" />
                  <circle cx="350" cy="180" r="4" fill="currentColor" />
                  <circle cx="450" cy="150" r="4" fill="currentColor" />
                  <circle cx="550" cy="180" r="4" fill="currentColor" />
                  <circle cx="650" cy="250" r="4" fill="currentColor" />
                  <circle cx="550" cy="320" r="4" fill="currentColor" />
                  <circle cx="450" cy="350" r="4" fill="currentColor" />
                  <circle cx="350" cy="320" r="4" fill="currentColor" />
                </g>

                {/* Central Brain / OS Hub */}
                <g transform="translate(370, 170)" filter="url(#heroDropShadow)">
                  <rect x="0" y="0" width="160" height="160" rx="30" fill="white" className="dark:fill-gray-800" stroke="url(#heroPrimary)" strokeWidth="4" />
                  {/* Inner glowing core */}
                  <rect x="20" y="20" width="120" height="120" rx="20" fill="url(#heroPrimary)" opacity="0.1" filter="url(#heroGlow)" />
                  <circle cx="80" cy="80" r="30" fill="url(#heroPrimary)">
                    <animate attributeName="r" values="28;32;28" dur="3s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="80" cy="80" r="15" fill="white" opacity="0.9" />
                </g>

                {/* Data Packets Orbiting Central Hub */}
                <g>
                  <circle cx="450" cy="80" r="6" fill="#10b981" filter="url(#heroGlow)">
                    <animateTransform attributeName="transform" type="rotate" values="0 450 250; 360 450 250" dur="10s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="450" cy="420" r="6" fill="#f59e0b" filter="url(#heroGlow)">
                    <animateTransform attributeName="transform" type="rotate" values="180 450 250; 540 450 250" dur="15s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="280" cy="250" r="6" fill="#ec4899" filter="url(#heroGlow)">
                    <animateTransform attributeName="transform" type="rotate" values="90 450 250; 450 450 250" dur="12s" repeatCount="indefinite" />
                  </circle>
                </g>

                {/* Left Cards: VoC & Feedback */}
                <g transform="translate(180, 120)" filter="url(#heroDropShadow)">
                  <rect x="0" y="0" width="140" height="80" rx="12" fill="white" className="dark:fill-gray-800" stroke="url(#heroSecondary)" strokeWidth="2" />
                  <rect x="20" y="20" width="40" height="40" rx="8" fill="url(#heroSecondary)" opacity="0.2" />
                  {/* Chat Icon */}
                  <path d="M 30 35 Q 30 25 40 25 L 50 25 Q 60 25 60 35 L 60 45 Q 60 55 50 55 L 45 55 L 35 60 L 38 52 Q 30 48 30 40 Z" fill="url(#heroSecondary)" />
                  <rect x="75" y="30" width="45" height="8" rx="4" fill="#9ca3af" opacity="0.5" />
                  <rect x="75" y="45" width="30" height="8" rx="4" fill="#9ca3af" opacity="0.3" />
                  <animateTransform attributeName="transform" type="translate" values="180,120; 180,115; 180,120" dur="4s" repeatCount="indefinite" />
                </g>

                <g transform="translate(140, 240)" filter="url(#heroDropShadow)">
                  <rect x="0" y="0" width="160" height="90" rx="12" fill="white" className="dark:fill-gray-800" />
                  <rect x="20" y="20" width="120" height="8" rx="4" fill="url(#heroAccent)" opacity="0.8" />
                  <rect x="20" y="40" width="80" height="8" rx="4" fill="#9ca3af" opacity="0.3" />
                  <rect x="20" y="60" width="60" height="8" rx="4" fill="#9ca3af" opacity="0.3" />
                  <circle cx="120" cy="55" r="15" fill="#f59e0b" opacity="0.2" />
                  <circle cx="120" cy="55" r="5" fill="#f59e0b" />
                  <animateTransform attributeName="transform" type="translate" values="140,240; 140,245; 140,240" dur="5s" repeatCount="indefinite" />
                </g>

                {/* Right Cards: Roadmap & Personas */}
                <g transform="translate(580, 140)" filter="url(#heroDropShadow)">
                  <rect x="0" y="0" width="150" height="100" rx="12" fill="white" className="dark:fill-gray-800" stroke="url(#heroPrimary)" strokeWidth="2" />
                  {/* Roadmap Timeline */}
                  <rect x="20" y="25" width="10" height="50" rx="5" fill="#e5e7eb" className="dark:fill-gray-700" />
                  <circle cx="25" cy="35" r="8" fill="#10b981" />
                  <circle cx="25" cy="65" r="8" fill="url(#heroPrimary)" />
                  <rect x="45" y="31" width="80" height="8" rx="4" fill="#10b981" opacity="0.8" />
                  <rect x="45" y="61" width="60" height="8" rx="4" fill="url(#heroPrimary)" />
                  <animateTransform attributeName="transform" type="translate" values="580,140; 580,135; 580,140" dur="6s" repeatCount="indefinite" />
                </g>

                <g transform="translate(600, 280)" filter="url(#heroDropShadow)">
                  <rect x="0" y="0" width="140" height="80" rx="12" fill="white" className="dark:fill-gray-800" />
                  {/* Persona Profile */}
                  <circle cx="40" cy="40" r="20" fill="url(#heroSecondary)" opacity="0.2" />
                  <circle cx="40" cy="36" r="8" fill="url(#heroSecondary)" />
                  <path d="M 28 50 Q 40 42 52 50 A 10 10 0 0 1 40 60 Z" fill="url(#heroSecondary)" />
                  <rect x="75" y="30" width="45" height="8" rx="4" fill="url(#heroSecondary)" opacity="0.8" />
                  <rect x="75" y="45" width="25" height="8" rx="4" fill="#10b981" />
                  <animateTransform attributeName="transform" type="translate" values="600,280; 600,285; 600,280" dur="4.5s" repeatCount="indefinite" />
                </g>

                {/* Data Flow Beams (Animated) */}
                <g opacity="0.7">
                  <path d="M 320 160 L 370 200" stroke="url(#heroSecondary)" strokeWidth="4" strokeLinecap="round" strokeDasharray="10, 10">
                    <animate attributeName="stroke-dashoffset" values="20;0" dur="1s" repeatCount="indefinite" />
                  </path>
                  <path d="M 300 280 L 370 250" stroke="url(#heroAccent)" strokeWidth="4" strokeLinecap="round" strokeDasharray="10, 10">
                    <animate attributeName="stroke-dashoffset" values="20;0" dur="1s" repeatCount="indefinite" />
                  </path>
                  <path d="M 530 200 L 580 170" stroke="url(#heroPrimary)" strokeWidth="4" strokeLinecap="round" strokeDasharray="10, 10">
                    <animate attributeName="stroke-dashoffset" values="0;20" dur="1s" repeatCount="indefinite" />
                  </path>
                  <path d="M 530 250 L 600 300" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeDasharray="10, 10">
                    <animate attributeName="stroke-dashoffset" values="0;20" dur="1s" repeatCount="indefinite" />
                  </path>
                </g>
              </svg>
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
                <h2 className="text-4xl font-bold mb-8 text-gray-900 dark:text-white">
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
                <svg viewBox="0 0 400 400" className="w-full max-w-md drop-shadow-lg">
                  <defs>
                    <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style={{ stopColor: '#ec4899', stopOpacity: 1 }} />
                      <stop offset="100%" style={{ stopColor: '#9333ea', stopOpacity: 1 }} />
                    </linearGradient>
                  </defs>
                  <rect x="80" y="80" width="240" height="180" rx="12" fill="url(#grad2)" opacity="0.9" />
                  <rect x="100" y="100" width="200" height="20" rx="4" fill="white" opacity="0.3" />
                  <rect x="100" y="135" width="160" height="12" rx="3" fill="white" opacity="0.25" />
                  <rect x="100" y="155" width="140" height="12" rx="3" fill="white" opacity="0.25" />
                  <circle cx="320" cy="120" r="40" fill="#10b981" opacity="0.8" />
                  <path d="M 310 120 L 318 128 L 335 108" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" />
                  <rect x="100" y="190" width="80" height="50" rx="8" fill="white" opacity="0.2" />
                  <rect x="195" y="190" width="80" height="50" rx="8" fill="white" opacity="0.2" />
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* ROI Comparison Section */}
        <section className="container mx-auto px-6 py-20 pb-32">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">
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
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-6 uppercase tracking-wider">With Separate Tools (Per PM)</h3>
                <div className="space-y-6">
                  <ComparisonItem name="Task Management (Asana, Linear, ClickUp)" price="$1,200" />
                  <ComparisonItem name="Note Taking (Notion, Obsidian, Roam)" price="$600" />
                  <ComparisonItem name="AI Assistant (ChatGPT, Claude, custom wrappers)" price="$2,400" />
                  <ComparisonItem name="Document Intelligence (Multiple LLM tools)" price="$1,800" />
                  <ComparisonItem name="Workflow Automation (Zapier, Make)" price="$1,500" />
                  <div className="pt-6 mt-6 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center font-bold text-gray-900 dark:text-gray-100">
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
                    <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-6 uppercase tracking-wider flex items-center gap-2">
                      With Evols
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 font-medium mb-8 leading-relaxed">
                      One unified OS for your entire product management workflow.
                    </p>
                  </div>
                  <div>
                    <div className="mb-4">
                      <span className="text-5xl font-extrabold text-gray-900 dark:text-white">$0</span>
                      <span className="text-gray-500 dark:text-gray-400 ml-2">extra cost</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                      Included in your simple, flat Evols subscription.
                    </p>
                    <Link href="/book-demo" className="block w-full text-center bg-gradient-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-purple-600 text-white font-semibold py-4 px-6 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105 hover:brightness-110 active:scale-95">
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
      <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">{title}</h3>
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
      <span className="text-gray-900 dark:text-white font-semibold">{price}</span>
    </div>
  )
}
