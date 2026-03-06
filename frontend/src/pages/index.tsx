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
import { LogoIcon } from '@/components/Logo'
import { useTheme } from '@/contexts/ThemeContext'

export default function Home() {
  const { theme, toggleTheme } = useTheme()

  return (
    <>
      <Head>
        <title>Evols - Evolve your product roadmap</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
        {/* Header */}
        <header className="container mx-auto px-6 py-8">
          <nav className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <LogoIcon size={40} />
              <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                Evols
              </span>
            </div>
            <div className="flex items-center space-x-6">
              <button onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
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
                className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-2 rounded-lg hover:opacity-90 transition"
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
                <span>AI-Powered Roadmap Evolution</span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                Turn Data Into
                <br />
                Confident Decisions
              </h1>

              <p className="text-xl text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto lg:mx-0">
                Help senior PMs at B2B SaaS companies consolidate customer feedback,
                auto-cluster themes, and generate evidence-backed decision briefs —
                powered by AI digital twins.
              </p>

              <div className="flex items-center justify-center lg:justify-start space-x-4">
                <Link href="/book-demo"
                  className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:opacity-90 transition flex items-center space-x-2"
                >
                  <span>Book Demo</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link href="/docs"
                  className="border-2 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition"
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
              <svg viewBox="0 0 900 500" className="w-full max-w-4xl drop-shadow-2xl" style={{overflow: 'visible'}}>
                <defs>
                  <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:'#6366f1',stopOpacity:1}} />
                    <stop offset="100%" style={{stopColor:'#8b5cf6',stopOpacity:1}} />
                  </linearGradient>
                  <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{stopColor:'#10b981',stopOpacity:1}} />
                    <stop offset="100%" style={{stopColor:'#059669',stopOpacity:1}} />
                  </linearGradient>
                  <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:'#f59e0b',stopOpacity:1}} />
                    <stop offset="100%" style={{stopColor:'#d97706',stopOpacity:1}} />
                  </linearGradient>
                  <linearGradient id="grad4" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:'#ec4899',stopOpacity:1}} />
                    <stop offset="100%" style={{stopColor:'#be185d',stopOpacity:1}} />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  <filter id="pulse">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                {/* Background circles */}
                <circle cx="450" cy="250" r="280" fill="url(#grad1)" opacity="0.04"/>
                <circle cx="450" cy="250" r="180" fill="url(#grad1)" opacity="0.06"/>
                <circle cx="300" cy="250" r="120" fill="url(#grad1)" opacity="0.08"/>

                {/* Central AI Processor */}
                <rect x="220" y="200" width="160" height="100" rx="12" fill="url(#grad1)" opacity="0.9" filter="url(#glow)"/>
                {/* Processing bars */}
                <rect x="240" y="230" width="120" height="8" rx="3" fill="white" opacity="0.3">
                  <animate attributeName="width" from="40" to="120" dur="2s" repeatCount="indefinite"/>
                </rect>
                <rect x="240" y="245" width="100" height="8" rx="3" fill="white" opacity="0.25">
                  <animate attributeName="width" from="30" to="100" dur="1.8s" repeatCount="indefinite"/>
                </rect>
                <rect x="240" y="260" width="130" height="8" rx="3" fill="white" opacity="0.25">
                  <animate attributeName="width" from="50" to="130" dur="2.2s" repeatCount="indefinite"/>
                </rect>
                {/* Clustering indicator */}
                <circle cx="245" cy="280" r="4" fill="#10b981" opacity="0.8"/>
                <circle cx="258" cy="283" r="4" fill="#10b981" opacity="0.8"/>
                <circle cx="271" cy="280" r="4" fill="#10b981" opacity="0.8"/>
                {/* Status indicator */}
                <circle cx="355" cy="215" r="6" fill="#10b981">
                  <animate attributeName="opacity" from="0.4" to="1" dur="1s" repeatCount="indefinite" direction="alternate"/>
                </circle>

                {/* Input: Customer Feedback Bubbles */}
                <g opacity="0.85">
                  {/* Speech bubble shape */}
                  <path d="M 50 135 Q 50 115 70 115 L 105 115 Q 125 115 125 135 L 125 165 Q 125 185 105 185 L 85 185 L 75 195 L 75 185 L 70 185 Q 50 185 50 165 Z" fill="#6366f1"/>
                  <circle cx="70" cy="145" r="3" fill="white" opacity="0.5"/>
                  <circle cx="85" cy="145" r="3" fill="white" opacity="0.5"/>
                  <circle cx="100" cy="145" r="3" fill="white" opacity="0.5"/>
                  <rect x="65" y="160" width="50" height="5" rx="1.5" fill="white" opacity="0.3"/>
                  <rect x="65" y="170" width="40" height="4" rx="1" fill="white" opacity="0.3"/>
                  {/* Customer icon */}
                  <circle cx="110" cy="125" r="8" fill="#fbbf24" opacity="0.9"/>
                </g>

                <g opacity="0.85">
                  {/* Feature request card */}
                  <rect x="60" y="225" width="70" height="50" rx="6" fill="#6366f1"/>
                  <circle cx="75" cy="240" r="4" fill="#fbbf24" opacity="0.6"/>
                  <rect x="83" y="237" width="35" height="6" rx="2" fill="white" opacity="0.4"/>
                  <rect x="70" y="252" width="50" height="4" rx="1" fill="white" opacity="0.3"/>
                  <rect x="70" y="260" width="40" height="4" rx="1" fill="white" opacity="0.3"/>
                  {/* Priority badge */}
                  <circle cx="120" cy="235" r="10" fill="#ef4444"/>
                  <path d="M 120 229 L 120 238" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="120" cy="242" r="1" fill="white"/>
                </g>

                <g opacity="0.85">
                  {/* User feedback with rating */}
                  <rect x="55" y="325" width="75" height="50" rx="6" fill="#6366f1"/>
                  <circle cx="70" cy="340" r="5" fill="#fbbf24" opacity="0.8"/>
                  <rect x="80" y="337" width="40" height="6" rx="2" fill="white" opacity="0.4"/>
                  {/* Star rating */}
                  <text x="65" y="365" fontSize="12" fill="#fbbf24">★★★★</text>
                  {/* Money icon */}
                  <circle cx="110" cy="360" r="6" fill="#10b981" opacity="0.8"/>
                  <text x="107" y="364" fontSize="8" fill="white" fontWeight="bold">$</text>
                </g>

                {/* Connection lines from inputs to processor */}
                <path d="M 115 150 Q 170 160 220 220" stroke="#6366f1" strokeWidth="2.5" fill="none" strokeDasharray="5,5" opacity="0.6">
                  <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1s" repeatCount="indefinite"/>
                </path>
                <path d="M 130 250 L 220 250" stroke="#6366f1" strokeWidth="2.5" fill="none" strokeDasharray="5,5" opacity="0.6">
                  <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1s" repeatCount="indefinite"/>
                </path>
                <path d="M 120 345 Q 170 330 220 280" stroke="#6366f1" strokeWidth="2.5" fill="none" strokeDasharray="5,5" opacity="0.6">
                  <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1s" repeatCount="indefinite"/>
                </path>

                {/* Output: Priority #1 Decision */}
                <g opacity="0.9">
                  <rect x="450" y="120" width="95" height="65" rx="8" fill="url(#grad2)"/>
                  {/* Priority badge */}
                  <circle cx="465" cy="135" r="10" fill="white" opacity="0.9"/>
                  <text x="461" y="140" fontSize="11" fill="#10b981" fontWeight="bold">1</text>
                  {/* Decision bars */}
                  <rect x="480" y="133" width="50" height="7" rx="2" fill="white" opacity="0.4"/>
                  <rect x="460" y="150" width="70" height="6" rx="2" fill="white" opacity="0.35"/>
                  <rect x="460" y="162" width="65" height="6" rx="2" fill="white" opacity="0.3"/>
                  {/* Checkmark */}
                  <circle cx="530" cy="140" r="8" fill="white" opacity="0.3"/>
                  <path d="M 527 140 L 529 142 L 533 137" stroke="#10b981" strokeWidth="2" fill="none" strokeLinecap="round"/>
                </g>

                {/* Output: Theme Cluster */}
                <g opacity="0.9">
                  <rect x="460" y="215" width="90" height="60" rx="8" fill="url(#grad2)"/>
                  {/* Cluster icon */}
                  <circle cx="475" cy="233" r="5" fill="white" opacity="0.5"/>
                  <circle cx="485" cy="230" r="4" fill="white" opacity="0.5"/>
                  <circle cx="482" cy="240" r="4" fill="white" opacity="0.5"/>
                  <line x1="475" y1="233" x2="485" y2="230" stroke="white" strokeWidth="1" opacity="0.3"/>
                  <line x1="475" y1="233" x2="482" y2="240" stroke="white" strokeWidth="1" opacity="0.3"/>
                  <line x1="485" y1="230" x2="482" y2="240" stroke="white" strokeWidth="1" opacity="0.3"/>
                  {/* Theme bars */}
                  <rect x="495" y="230" width="45" height="6" rx="2" fill="white" opacity="0.4"/>
                  <rect x="470" y="250" width="65" height="5" rx="1.5" fill="white" opacity="0.3"/>
                  <rect x="470" y="260" width="55" height="5" rx="1.5" fill="white" opacity="0.3"/>
                </g>

                {/* Output: Persona Insight */}
                <g opacity="0.9">
                  <rect x="455" y="310" width="95" height="62" rx="8" fill="url(#grad2)"/>
                  {/* Persona icon */}
                  <circle cx="472" cy="330" r="10" fill="white" opacity="0.5"/>
                  <path d="M 465 343 Q 472 338 479 343" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5"/>
                  {/* Persona bars */}
                  <rect x="490" y="326" width="48" height="6" rx="2" fill="white" opacity="0.4"/>
                  <rect x="490" y="338" width="50" height="5" rx="1.5" fill="white" opacity="0.35"/>
                  <rect x="490" y="349" width="45" height="5" rx="1.5" fill="white" opacity="0.3"/>
                  {/* Money indicator */}
                  <circle cx="465" cy="357" r="5" fill="#fbbf24" opacity="0.8"/>
                  <text x="462" y="360" fontSize="7" fill="white" fontWeight="bold">$</text>
                  {/* Confidence */}
                  <circle cx="535" cy="330" r="6" fill="white" opacity="0.4"/>
                  <text x="531" y="334" fontSize="8" fill="#10b981" fontWeight="bold">✓</text>
                </g>

                {/* Connection lines from processor to outputs */}
                <path d="M 380 220 Q 420 160 450 150" stroke="#8b5cf6" strokeWidth="2.5" fill="none" strokeDasharray="5,5" opacity="0.7">
                  <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1s" repeatCount="indefinite"/>
                </path>
                <path d="M 380 250 Q 420 245 460 247" stroke="#8b5cf6" strokeWidth="2.5" fill="none" strokeDasharray="5,5" opacity="0.7">
                  <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1s" repeatCount="indefinite"/>
                </path>
                <path d="M 380 280 Q 420 300 455 340" stroke="#8b5cf6" strokeWidth="2.5" fill="none" strokeDasharray="5,5" opacity="0.7">
                  <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1s" repeatCount="indefinite"/>
                </path>

                {/* Artifact Generation Layer */}
                <g opacity="0.95">
                  {/* Document 1 */}
                  <rect x="610" y="115" width="75" height="55" rx="6" fill="url(#grad3)" opacity="0.9"/>
                  <rect x="620" y="125" width="55" height="5" rx="1.5" fill="white" opacity="0.5"/>
                  <rect x="620" y="135" width="50" height="3" rx="1" fill="white" opacity="0.4"/>
                  <rect x="620" y="142" width="45" height="3" rx="1" fill="white" opacity="0.4"/>
                  <rect x="620" y="149" width="52" height="3" rx="1" fill="white" opacity="0.4"/>
                  <rect x="620" y="156" width="48" height="3" rx="1" fill="white" opacity="0.3"/>
                  <circle cx="670" cy="145" r="5" fill="#10b981" opacity="0.9">
                    <animate attributeName="opacity" from="0.4" to="1" dur="1.5s" repeatCount="indefinite"/>
                  </circle>

                  {/* Document 2 */}
                  <rect x="610" y="190" width="75" height="55" rx="6" fill="url(#grad3)" opacity="0.9"/>
                  <rect x="620" y="200" width="25" height="25" rx="3" fill="white" opacity="0.3"/>
                  <circle cx="632" cy="212" r="4" fill="#6366f1" opacity="0.6"/>
                  <rect x="650" y="205" width="25" height="5" rx="1.5" fill="white" opacity="0.4"/>
                  <rect x="650" y="215" width="20" height="4" rx="1" fill="white" opacity="0.3"/>
                  <rect x="650" y="223" width="22" height="4" rx="1" fill="white" opacity="0.3"/>
                  <circle cx="670" cy="220" r="5" fill="#10b981" opacity="0.9">
                    <animate attributeName="opacity" from="0.5" to="1" dur="1.6s" repeatCount="indefinite"/>
                  </circle>

                  {/* Document 3 */}
                  <rect x="610" y="265" width="75" height="55" rx="6" fill="url(#grad3)" opacity="0.9"/>
                  <text x="620" y="282" fontSize="12" fill="white" opacity="0.6" fontFamily="monospace">&lt;/&gt;</text>
                  <rect x="640" y="278" width="35" height="4" rx="1" fill="white" opacity="0.4"/>
                  <rect x="620" y="290" width="55" height="3" rx="1" fill="white" opacity="0.3"/>
                  <rect x="620" y="297" width="50" height="3" rx="1" fill="white" opacity="0.3"/>
                  <rect x="620" y="304" width="45" height="3" rx="1" fill="white" opacity="0.3"/>
                  <circle cx="670" cy="295" r="5" fill="#10b981" opacity="0.9">
                    <animate attributeName="opacity" from="0.6" to="1" dur="1.7s" repeatCount="indefinite"/>
                  </circle>
                </g>

                {/* Connections from insights to artifacts */}
                <path d="M 545 152 Q 580 145 610 142" stroke="#f59e0b" strokeWidth="2" fill="none" strokeDasharray="4,4" opacity="0.6">
                  <animate attributeName="stroke-dashoffset" from="0" to="-8" dur="0.8s" repeatCount="indefinite"/>
                </path>
                <path d="M 550 245 Q 580 225 610 217" stroke="#f59e0b" strokeWidth="2" fill="none" strokeDasharray="4,4" opacity="0.6">
                  <animate attributeName="stroke-dashoffset" from="0" to="-8" dur="0.8s" repeatCount="indefinite"/>
                </path>
                <path d="M 550 340 Q 580 315 610 292" stroke="#f59e0b" strokeWidth="2" fill="none" strokeDasharray="4,4" opacity="0.6">
                  <animate attributeName="stroke-dashoffset" from="0" to="-8" dur="0.8s" repeatCount="indefinite"/>
                </path>

                {/* Vibecoding Agents Layer */}
                <g opacity="0.95">
                  {/* Agent 1 */}
                  <circle cx="755" cy="135" r="22" fill="url(#grad4)" opacity="0.9" filter="url(#pulse)">
                    <animate attributeName="r" from="22" to="25" dur="2s" repeatCount="indefinite" direction="alternate"/>
                  </circle>
                  <text x="747" y="141" fontSize="14" fill="white" fontWeight="bold">⚛️</text>

                  {/* Agent 2 */}
                  <circle cx="820" cy="180" r="22" fill="url(#grad4)" opacity="0.9" filter="url(#pulse)">
                    <animate attributeName="r" from="22" to="25" dur="2.1s" repeatCount="indefinite" direction="alternate"/>
                  </circle>
                  <text x="813" y="186" fontSize="14" fill="white" fontWeight="bold">⚙️</text>

                  {/* Agent 3 */}
                  <circle cx="755" cy="240" r="22" fill="url(#grad4)" opacity="0.9" filter="url(#pulse)">
                    <animate attributeName="r" from="22" to="25" dur="2.2s" repeatCount="indefinite" direction="alternate"/>
                  </circle>
                  <text x="748" y="246" fontSize="14" fill="white" fontWeight="bold">🗄️</text>

                  {/* Agent 4 */}
                  <circle cx="820" cy="280" r="22" fill="url(#grad4)" opacity="0.9" filter="url(#pulse)">
                    <animate attributeName="r" from="22" to="25" dur="2.3s" repeatCount="indefinite" direction="alternate"/>
                  </circle>
                  <text x="813" y="286" fontSize="14" fill="white" fontWeight="bold">🚀</text>

                  {/* Agent connections (collaboration) */}
                  <path d="M 777 135 L 798 165" stroke="#ec4899" strokeWidth="1.5" fill="none" opacity="0.4">
                    <animate attributeName="opacity" from="0.2" to="0.6" dur="1.5s" repeatCount="indefinite" direction="alternate"/>
                  </path>
                  <path d="M 820 202 L 777 218" stroke="#ec4899" strokeWidth="1.5" fill="none" opacity="0.4">
                    <animate attributeName="opacity" from="0.2" to="0.6" dur="1.6s" repeatCount="indefinite" direction="alternate"/>
                  </path>
                  <path d="M 777 240 L 798 260" stroke="#ec4899" strokeWidth="1.5" fill="none" opacity="0.4">
                    <animate attributeName="opacity" from="0.2" to="0.6" dur="1.7s" repeatCount="indefinite" direction="alternate"/>
                  </path>
                  <path d="M 755 157 L 755 218" stroke="#ec4899" strokeWidth="1.5" fill="none" opacity="0.3" strokeDasharray="3,3"/>
                  <path d="M 820 202 L 820 258" stroke="#ec4899" strokeWidth="1.5" fill="none" opacity="0.3" strokeDasharray="3,3"/>

                  {/* Working indicators */}
                  <circle cx="765" cy="145" r="3" fill="#fbbf24">
                    <animate attributeName="opacity" from="0.3" to="1" dur="0.6s" repeatCount="indefinite"/>
                  </circle>
                  <circle cx="830" cy="190" r="3" fill="#fbbf24">
                    <animate attributeName="opacity" from="0.3" to="1" dur="0.7s" repeatCount="indefinite"/>
                  </circle>
                  <circle cx="765" cy="250" r="3" fill="#fbbf24">
                    <animate attributeName="opacity" from="0.3" to="1" dur="0.8s" repeatCount="indefinite"/>
                  </circle>
                  <circle cx="830" cy="290" r="3" fill="#fbbf24">
                    <animate attributeName="opacity" from="0.3" to="1" dur="0.9s" repeatCount="indefinite"/>
                  </circle>
                </g>

                {/* Connections from artifacts to agents */}
                <path d="M 685 142 Q 720 138 733 135" stroke="#ec4899" strokeWidth="2" fill="none" strokeDasharray="4,4" opacity="0.6">
                  <animate attributeName="stroke-dashoffset" from="0" to="-8" dur="0.7s" repeatCount="indefinite"/>
                </path>
                <path d="M 685 217 Q 755 200 798 180" stroke="#ec4899" strokeWidth="2" fill="none" strokeDasharray="4,4" opacity="0.6">
                  <animate attributeName="stroke-dashoffset" from="0" to="-8" dur="0.7s" repeatCount="indefinite"/>
                </path>
                <path d="M 685 292 Q 720 270 733 253" stroke="#ec4899" strokeWidth="2" fill="none" strokeDasharray="4,4" opacity="0.6">
                  <animate attributeName="stroke-dashoffset" from="0" to="-8" dur="0.7s" repeatCount="indefinite"/>
                </path>

                {/* Final Delivery Layer */}
                <g opacity="0.95">
                  {/* Deployed Product */}
                  <rect x="870" y="190" width="90" height="80" rx="10" fill="url(#grad2)" opacity="0.95" filter="url(#glow)"/>
                  <circle cx="915" cy="218" r="18" fill="white" opacity="0.3"/>
                  <path d="M 907 218 L 912 223 L 923 209" stroke="#10b981" strokeWidth="4" fill="none" strokeLinecap="round"/>
                  <rect x="880" y="245" width="70" height="6" rx="2" fill="white" opacity="0.4"/>
                  <rect x="880" y="255" width="60" height="5" rx="1.5" fill="white" opacity="0.3"/>

                  {/* Status indicators */}
                  <circle cx="885" cy="262" r="4" fill="#10b981">
                    <animate attributeName="opacity" from="0.5" to="1" dur="1s" repeatCount="indefinite" direction="alternate"/>
                  </circle>
                  <circle cx="895" cy="262" r="4" fill="#10b981">
                    <animate attributeName="opacity" from="0.5" to="1" dur="1.2s" repeatCount="indefinite" direction="alternate"/>
                  </circle>
                  <circle cx="905" cy="262" r="4" fill="#10b981">
                    <animate attributeName="opacity" from="0.5" to="1" dur="1.4s" repeatCount="indefinite" direction="alternate"/>
                  </circle>

                  {/* Zero Human badge - simplified */}
                  <circle cx="935" cy="250" r="12" fill="#ef4444" opacity="0.2"/>
                  <circle cx="935" cy="250" r="9" stroke="#ef4444" strokeWidth="2" fill="none"/>
                  <line x1="930" y1="245" x2="940" y2="255" stroke="#ef4444" strokeWidth="2.5"/>
                </g>

                {/* Connections from agents to delivery */}
                <path d="M 777 145 Q 825 165 870 210" stroke="#10b981" strokeWidth="2.5" fill="none" strokeDasharray="5,5" opacity="0.7">
                  <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1s" repeatCount="indefinite"/>
                </path>
                <path d="M 842 200 L 870 215" stroke="#10b981" strokeWidth="2.5" fill="none" strokeDasharray="5,5" opacity="0.7">
                  <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1s" repeatCount="indefinite"/>
                </path>
                <path d="M 777 250 Q 825 240 870 228" stroke="#10b981" strokeWidth="2.5" fill="none" strokeDasharray="5,5" opacity="0.7">
                  <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1s" repeatCount="indefinite"/>
                </path>
                <path d="M 842 280 Q 858 265 870 248" stroke="#10b981" strokeWidth="2.5" fill="none" strokeDasharray="5,5" opacity="0.7">
                  <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1s" repeatCount="indefinite"/>
                </path>

                {/* Floating indicators */}
                <circle cx="250" cy="180" r="5" fill="#10b981" opacity="0.6">
                  <animate attributeName="opacity" from="0.3" to="0.8" dur="2s" repeatCount="indefinite" direction="alternate"/>
                  <animate attributeName="r" from="5" to="7" dur="2s" repeatCount="indefinite" direction="alternate"/>
                </circle>
                <circle cx="310" cy="185" r="6" fill="#fbbf24" opacity="0.5">
                  <animate attributeName="opacity" from="0.3" to="0.7" dur="1.8s" repeatCount="indefinite" direction="alternate"/>
                  <animate attributeName="r" from="6" to="8" dur="1.8s" repeatCount="indefinite" direction="alternate"/>
                </circle>
                <circle cx="280" cy="277" r="5" fill="#8b5cf6" opacity="0.6">
                  <animate attributeName="opacity" from="0.3" to="0.8" dur="2.2s" repeatCount="indefinite" direction="alternate"/>
                  <animate attributeName="r" from="5" to="7" dur="2.2s" repeatCount="indefinite" direction="alternate"/>
                </circle>
              </svg>
            </motion.div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="container mx-auto px-6 py-20">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard icon={<Sparkles className="w-8 h-8" />}
              title="AI Clustering"
              description="Auto-cluster feedback into themes with revenue impact and urgency scores"
            />
            <FeatureCard icon={<Users className="w-8 h-8" />}
              title="Digital Twins"
              description="Simulate persona responses for validation and trade-off decisions"
            />
            <FeatureCard icon={<GitBranch className="w-8 h-8" />}
              title="Decision Briefs"
              description="Generate evidence-backed briefs with citations and recommendations"
            />
            <FeatureCard icon={<TrendingUp className="w-8 h-8" />}
              title="Knowledge Graph"
              description="Visualize connections between feedback, themes, and roadmap"
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
                  <ValueProp text="Consolidate fragmented evidence from feedback tools, CRM, and analytics" />
                  <ValueProp text="Save weeks of manual synthesis with AI-powered clustering" />
                  <ValueProp text="Generate decision briefs in minutes, not days" />
                  <ValueProp text="Validate ideas with persona digital twins before building" />
                  <ValueProp text="Track decisions and outcomes to build institutional memory" />
                  <ValueProp text="Defend product bets with evidence-backed recommendations" />
                </div>
              </div>
              <div className="hidden md:flex items-center justify-center">
                <svg viewBox="0 0 400 400" className="w-full max-w-md drop-shadow-xl">
                  <defs>
                    <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style={{stopColor:'#6366f1',stopOpacity:1}} />
                      <stop offset="100%" style={{stopColor:'#8b5cf6',stopOpacity:1}} />
                    </linearGradient>
                  </defs>
                  <rect x="80" y="80" width="240" height="180" rx="12" fill="url(#grad2)" opacity="0.9"/>
                  <rect x="100" y="100" width="200" height="20" rx="4" fill="white" opacity="0.3"/>
                  <rect x="100" y="135" width="160" height="12" rx="3" fill="white" opacity="0.25"/>
                  <rect x="100" y="155" width="140" height="12" rx="3" fill="white" opacity="0.25"/>
                  <circle cx="320" cy="120" r="40" fill="#10b981" opacity="0.8"/>
                  <path d="M 310 120 L 318 128 L 335 108" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round"/>
                  <rect x="100" y="190" width="80" height="50" rx="8" fill="white" opacity="0.2"/>
                  <rect x="195" y="190" width="80" height="50" rx="8" fill="white" opacity="0.2"/>
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="container mx-auto px-6 py-12 text-center text-gray-600 dark:text-gray-400">
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
      <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-lg flex items-center justify-center text-white mb-4">
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
