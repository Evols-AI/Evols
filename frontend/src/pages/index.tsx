import Head from 'next/head'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  GitBranch,
  Users,
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
        <title>Evols - Stop Wasting Your Team's AI Conversations</title>
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
                <span>Team AI Intelligence Platform</span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl mb-6 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent leading-tight pb-2">
                Stop Wasting Your Team's
                <br />
                <span className="bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">AI Conversations</span>
              </h1>

              <p className="text-xl text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto lg:mx-0">
                Turn your isolated Claude Code and Copilot sessions into collaborative team intelligence.
                Share insights, build on each other's work, and create institutional memory with 80+ specialized PM frameworks.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start space-y-4 sm:space-y-0 sm:space-x-4">
                <Link href="/book-demo"
                  className="w-full sm:w-auto bg-gradient-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-purple-600 text-white py-4 px-10 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105 hover:brightness-110 flex items-center justify-center space-x-2 text-lg h-[56px]"
                >
                  <span>Book a 15-Minute Demo</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link href="/register"
                  className="w-full sm:w-auto border-2 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white px-10 py-4 rounded-full text-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition transform hover:scale-105 active:scale-95 flex items-center justify-center h-[56px]"
                >
                  Start Free Trial
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

        {/* Problems We Solve */}
        <section className="container mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl mb-6 text-gray-900 dark:text-white">
              The Problems We Solve
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard icon={<Sparkles className="w-8 h-8" />}
              title="Stop Duplicating AI Work"
              description="Your PMs are asking AI the same questions teammates solved last week. That's wasted time and missed opportunities."
            />
            <FeatureCard icon={<Users className="w-8 h-8" />}
              title="Keep Team Intelligence"
              description="When Sarah leaves, all her successful AI patterns disappear. Your team starts over instead of building on proven approaches."
            />
            <FeatureCard icon={<GitBranch className="w-8 h-8" />}
              title="Get PM-Specific Results"
              description="Claude Code gives engineering advice. ChatGPT gives generic advice. You need specialized PM frameworks that work."
            />
          </div>
        </section>

        {/* Benefits & Features */}
        <section className="container mx-auto px-6 py-20">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="grid md:grid-cols-2 gap-12 p-12">
              <div>
                <h2 className="text-4xl mb-8 text-gray-900 dark:text-white">
                  How Evols Transforms Your Team
                </h2>
                <div className="space-y-6">
                  <ValueProp text="Team Knowledge Sharing: Your PMs see what frameworks teammates used successfully and build on existing work instead of reinventing solutions" />
                  <ValueProp text="80+ Specialized PM Frameworks: Skip generic AI advice. Get battle-tested frameworks for discovery, competitive analysis, and prioritization" />
                  <ValueProp text="Works With Your Existing AI Tools: Keep using Claude Code, Copilot, or ChatGPT. Evols enhances them with team context and PM expertise" />
                  <ValueProp text="Institutional Memory That Grows: Every AI conversation builds your team's shared knowledge base automatically" />
                  <ValueProp text="Smart Collaboration Suggestions: Get proactive suggestions like 'Your teammate solved this last month' before you duplicate work" />
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

        {/* Comparison Section */}
        <section className="container mx-auto px-6 py-20 pb-32">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl md:text-5xl mb-6 text-gray-900 dark:text-white">
              Why Evols vs <br /><span className="bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">Generic AI Assistants?</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Stop adapting your PM workflow to generic AI tools. Get AI that understands how product teams actually work.
            </p>
          </div>

          <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-gray-700">
              {/* Generic AI Tools Column */}
              <div className="p-8 bg-gray-50/50 dark:bg-gray-800/50">
                <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-6 uppercase tracking-wider">Generic AI Assistants</h3>
                <div className="space-y-6">
                  <ComparisonItem name="❌ Generic business advice" price="" />
                  <ComparisonItem name="❌ Each conversation starts from zero" price="" />
                  <ComparisonItem name="❌ Individual work, no sharing" price="" />
                  <ComparisonItem name="❌ Insights disappear after conversation" price="" />
                  <ComparisonItem name="❌ Everyone duplicates the same work" price="" />
                  <div className="pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                      Result: Isolated AI work that doesn't build team intelligence
                    </p>
                  </div>
                </div>
              </div>

              {/* Evols Column */}
              <div className="p-8 bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Sparkles className="w-32 h-32 text-blue-500" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-sm text-blue-600 dark:text-blue-400 mb-6 uppercase tracking-wider">
                    Evols Team Intelligence
                  </h3>
                  <div className="space-y-6">
                    <ComparisonItem name="✅ 80+ specialized PM frameworks" price="" />
                    <ComparisonItem name="✅ Builds on team's successful patterns" price="" />
                    <ComparisonItem name="✅ Automatic team knowledge sharing" price="" />
                    <ComparisonItem name="✅ Institutional memory that grows" price="" />
                    <ComparisonItem name="✅ 'Your teammate already solved this'" price="" />
                  </div>
                  <div className="pt-6 mt-6 border-t border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-6">
                      Result: Collaborative AI that makes your entire team smarter
                    </p>
                    <Link href="/book-demo" className="block w-full text-center bg-gradient-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-purple-600 text-white py-4 px-6 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105 hover:brightness-110 active:scale-95">
                      See How It Works
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ROI Calculator */}
          <div className="max-w-2xl mx-auto mt-16 text-center bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-8 rounded-2xl">
            <h3 className="text-2xl mb-4 text-gray-900 dark:text-white">Calculate Your Team's Time Savings</h3>
            <div className="space-y-3 text-gray-600 dark:text-gray-300">
              <p>Average PM spends 8 hours/week on research and analysis</p>
              <p>40% of that research duplicates teammate's work</p>
              <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">With Evols: Save 3.2 hours/week per PM</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">For a 10-person team: 32 hours saved weekly = $64K annually</p>
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="container mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl mb-6 text-gray-900 dark:text-white">
              Trusted by Product Teams
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
              <div className="mb-6">
                <p className="text-gray-700 dark:text-gray-300 italic text-lg">
                  "Evols cut our discovery phase from 3 weeks to 1 week. Instead of each PM doing separate competitive research, we build on each other's insights."
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                  S
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Senior PM at FAANG</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
              <div className="mb-6">
                <p className="text-gray-700 dark:text-gray-300 italic text-lg">
                  "Finally, an AI that speaks product manager. The frameworks are exactly what we need, and team sharing means our junior PMs learn automatically."
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                  M
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">VP Product at early stage startup</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="container mx-auto px-6 py-20">
          <div className="text-center max-w-2xl mx-auto bg-gradient-to-r from-purple-400 to-blue-500 p-12 rounded-3xl text-white">
            <h2 className="text-4xl mb-6">Ready to Transform Your PM Team's AI?</h2>
            <p className="text-xl mb-8 opacity-90">
              See how your individual AI conversations become collaborative team intelligence
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Link href="/book-demo"
                className="w-full sm:w-auto bg-white text-purple-600 py-4 px-10 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105 font-semibold flex items-center justify-center space-x-2 h-[56px]"
              >
                <span>Book Demo Now</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/register"
                className="w-full sm:w-auto border-2 border-white text-white px-10 py-4 rounded-full hover:bg-white hover:text-purple-600 transition transform hover:scale-105 active:scale-95 flex items-center justify-center h-[56px]"
              >
                Start Free Trial
              </Link>
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
    <div className="flex items-start justify-between">
      <div className="flex items-start space-x-3 flex-1">
        {!name.startsWith('✅') && !name.startsWith('❌') && (
          <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0" />
        )}
        <span className="text-gray-700 dark:text-gray-300 font-medium leading-relaxed">{name}</span>
      </div>
      {price && <span className="text-gray-900 dark:text-white ml-4">{price}</span>}
    </div>
  )
}
