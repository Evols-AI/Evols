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

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-violet-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
        {/* Header */}
        <header className="container mx-auto px-6 py-8">
          <nav className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <LogoIcon size={60} />
              <span className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
                Evols
              </span>
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
                <span>AI-Powered Roadmap Evolution</span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent leading-tight pb-2">
                All Your Product Intel.
                <br />
                <span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">One Intelligent OS.</span>
              </h1>

              <p className="text-xl text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto lg:mx-0">
                Stop paying for scattered roadmapping, research, and analysis tools.
                Evols consolidates your entire product stack, automatically clusters feedback into actionable themes,
                and helps you make revenue-generating decisions with AI digital twins.
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
              <svg viewBox="0 0 900 500" className="w-full max-w-4xl drop-shadow-2xl" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#6366f1', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#8b5cf6', stopOpacity: 1 }} />
                  </linearGradient>
                  <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{ stopColor: '#10b981', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#059669', stopOpacity: 1 }} />
                  </linearGradient>
                  <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#f59e0b', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#d97706', stopOpacity: 1 }} />
                  </linearGradient>
                  <linearGradient id="grad4" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#ec4899', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#be185d', stopOpacity: 1 }} />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="pulse">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Background gears */}
                <g opacity="0.04">
                  {/* Large gear with 12 teeth */}
                  <path d="M 450,-30 L 465,-25 L 465,25 L 450,30 L 435,25 L 435,-25 Z
                           M 720,235 L 725,250 L 715,265 L 700,265 L 695,250 L 705,235 Z
                           M 450,530 L 465,525 L 465,475 L 450,470 L 435,475 L 435,525 Z
                           M 180,265 L 175,250 L 185,235 L 200,235 L 205,250 L 195,265 Z
                           M 636,96 L 647,103 L 643,118 L 628,123 L 617,116 L 621,101 Z
                           M 636,404 L 647,397 L 643,382 L 628,377 L 617,384 L 621,399 Z
                           M 264,96 L 253,103 L 257,118 L 272,123 L 283,116 L 279,101 Z
                           M 264,404 L 253,397 L 257,382 L 272,377 L 283,384 L 279,399 Z"
                    fill="url(#grad1)" />
                  <circle cx="450" cy="250" r="260" fill="url(#grad1)" />
                  <circle cx="450" cy="250" r="200" fill="none" stroke="none" />
                  <animateTransform attributeName="transform" type="rotate" from="0 450 250" to="360 450 250" dur="30s" repeatCount="indefinite" />
                </g>

                <g opacity="0.06">
                  {/* Medium gear with 8 teeth */}
                  <path d="M 450,75 L 460,78 L 460,92 L 450,95 L 440,92 L 440,78 Z
                           M 615,240 L 618,250 L 612,260 L 605,260 L 598,250 L 602,240 Z
                           M 450,425 L 460,422 L 460,408 L 450,405 L 440,408 L 440,422 Z
                           M 285,260 L 282,250 L 288,240 L 295,240 L 302,250 L 298,260 Z
                           M 577,113 L 584,119 L 581,129 L 571,132 L 564,126 L 567,116 Z
                           M 577,387 L 584,381 L 581,371 L 571,368 L 564,374 L 567,384 Z
                           M 323,113 L 316,119 L 319,129 L 329,132 L 336,126 L 333,116 Z
                           M 323,387 L 316,381 L 319,371 L 329,368 L 336,374 L 333,384 Z"
                    fill="url(#grad1)" />
                  <circle cx="450" cy="250" r="165" fill="url(#grad1)" />
                  <animateTransform attributeName="transform" type="rotate" from="360 450 250" to="0 450 250" dur="20s" repeatCount="indefinite" />
                </g>

                <g opacity="0.08">
                  {/* Small gear with 8 teeth */}
                  <path d="M 300,135 L 308,137 L 308,148 L 300,150 L 292,148 L 292,137 Z
                           M 410,242 L 412,250 L 408,258 L 403,258 L 398,250 L 401,242 Z
                           M 300,365 L 308,363 L 308,352 L 300,350 L 292,352 L 292,363 Z
                           M 190,258 L 188,250 L 192,242 L 197,242 L 202,250 L 199,258 Z
                           M 384,166 L 390,170 L 388,178 L 380,181 L 374,177 L 376,169 Z
                           M 384,334 L 390,330 L 388,322 L 380,319 L 374,323 L 376,331 Z
                           M 216,166 L 210,170 L 212,178 L 220,181 L 226,177 L 224,169 Z
                           M 216,334 L 210,330 L 212,322 L 220,319 L 226,323 L 224,331 Z"
                    fill="url(#grad1)" />
                  <circle cx="300" cy="250" r="110" fill="url(#grad1)" />
                  <animateTransform attributeName="transform" type="rotate" from="0 300 250" to="360 300 250" dur="15s" repeatCount="indefinite" />
                </g>

                {/* Central AI Processor */}
                <rect x="220" y="200" width="160" height="100" rx="12" fill="url(#grad1)" opacity="0.9" filter="url(#glow)" />
                {/* Processing bars */}
                <rect x="240" y="230" width="120" height="8" rx="3" fill="white" opacity="0.3">
                  <animate attributeName="width" from="40" to="120" dur="2s" repeatCount="indefinite" />
                </rect>
                <rect x="240" y="245" width="100" height="8" rx="3" fill="white" opacity="0.25">
                  <animate attributeName="width" from="30" to="100" dur="1.8s" repeatCount="indefinite" />
                </rect>
                <rect x="240" y="260" width="130" height="8" rx="3" fill="white" opacity="0.25">
                  <animate attributeName="width" from="50" to="130" dur="2.2s" repeatCount="indefinite" />
                </rect>
                {/* Clustering indicator */}
                <circle cx="245" cy="280" r="4" fill="#10b981" opacity="0.8" />
                <circle cx="258" cy="283" r="4" fill="#10b981" opacity="0.8" />
                <circle cx="271" cy="280" r="4" fill="#10b981" opacity="0.8" />
                {/* Status indicator */}
                <circle cx="355" cy="215" r="6" fill="#10b981">
                  <animate attributeName="opacity" from="0.4" to="1" dur="1s" repeatCount="indefinite" direction="alternate" />
                </circle>

                {/* Input: Customer Feedback Bubbles */}
                <g opacity="0.85">
                  {/* Speech bubble shape */}
                  <path d="M 50 135 Q 50 115 70 115 L 105 115 Q 125 115 125 135 L 125 165 Q 125 185 105 185 L 85 185 L 75 195 L 75 185 L 70 185 Q 50 185 50 165 Z" fill="#ec4899" />
                  <circle cx="70" cy="145" r="3" fill="white" opacity="0.5" />
                  <circle cx="85" cy="145" r="3" fill="white" opacity="0.5" />
                  <circle cx="100" cy="145" r="3" fill="white" opacity="0.5" />
                  <rect x="65" y="160" width="50" height="5" rx="1.5" fill="white" opacity="0.3" />
                  <rect x="65" y="170" width="40" height="4" rx="1" fill="white" opacity="0.3" />
                  {/* Customer icon */}
                  <circle cx="110" cy="125" r="8" fill="#fbbf24" opacity="0.9" />
                </g>

                <g opacity="0.85">
                  {/* Feature request card */}
                  <rect x="60" y="225" width="70" height="50" rx="6" fill="#ec4899" />
                  <circle cx="75" cy="240" r="4" fill="#fbbf24" opacity="0.6" />
                  <rect x="83" y="237" width="35" height="6" rx="2" fill="white" opacity="0.4" />
                  <rect x="70" y="252" width="50" height="4" rx="1" fill="white" opacity="0.3" />
                  <rect x="70" y="260" width="40" height="4" rx="1" fill="white" opacity="0.3" />
                  {/* Priority badge */}
                  <circle cx="120" cy="235" r="10" fill="#ef4444" />
                  <path d="M 120 229 L 120 238" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="120" cy="242" r="1" fill="white" />
                </g>

                <g opacity="0.85">
                  {/* User feedback with rating */}
                  <rect x="55" y="325" width="75" height="50" rx="6" fill="#ec4899" />
                  <circle cx="70" cy="340" r="5" fill="#fbbf24" opacity="0.8" />
                  <rect x="80" y="337" width="40" height="6" rx="2" fill="white" opacity="0.4" />
                  {/* Star rating */}
                  <text x="65" y="365" fontSize="12" fill="#fbbf24">★★★★</text>
                  {/* Money icon */}
                  <circle cx="110" cy="360" r="6" fill="#10b981" opacity="0.8" />
                  <text x="107" y="364" fontSize="8" fill="white" fontWeight="bold">$</text>
                </g>

                {/* Connection lines from inputs to processor */}
                <path d="M 115 150 Q 170 160 220 220" stroke="#ec4899" strokeWidth="2.5" fill="none" strokeDasharray="5,5" opacity="0.6">
                  <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1s" repeatCount="indefinite" />
                </path>
                <path d="M 130 250 L 220 250" stroke="#ec4899" strokeWidth="2.5" fill="none" strokeDasharray="5,5" opacity="0.6">
                  <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1s" repeatCount="indefinite" />
                </path>
                <path d="M 120 345 Q 170 330 220 280" stroke="#ec4899" strokeWidth="2.5" fill="none" strokeDasharray="5,5" opacity="0.6">
                  <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1s" repeatCount="indefinite" />
                </path>

                {/* Output: Priority #1 Decision */}
                <g opacity="0.9">
                  <rect x="450" y="120" width="95" height="65" rx="8" fill="url(#grad2)" />
                  {/* Priority badge */}
                  <circle cx="465" cy="135" r="10" fill="white" opacity="0.9" />
                  <text x="461" y="140" fontSize="11" fill="#10b981" fontWeight="bold">1</text>
                  {/* Decision bars */}
                  <rect x="480" y="133" width="50" height="7" rx="2" fill="white" opacity="0.4" />
                  <rect x="460" y="150" width="70" height="6" rx="2" fill="white" opacity="0.35" />
                  <rect x="460" y="162" width="65" height="6" rx="2" fill="white" opacity="0.3" />
                  {/* Checkmark */}
                  <circle cx="530" cy="140" r="8" fill="white" opacity="0.3" />
                  <path d="M 527 140 L 529 142 L 533 137" stroke="#10b981" strokeWidth="2" fill="none" strokeLinecap="round" />
                </g>

                {/* Output: Theme Cluster */}
                <g opacity="0.9">
                  <rect x="460" y="215" width="90" height="60" rx="8" fill="url(#grad2)" />
                  {/* Cluster icon */}
                  <circle cx="475" cy="233" r="5" fill="white" opacity="0.5" />
                  <circle cx="485" cy="230" r="4" fill="white" opacity="0.5" />
                  <circle cx="482" cy="240" r="4" fill="white" opacity="0.5" />
                  <line x1="475" y1="233" x2="485" y2="230" stroke="white" strokeWidth="1" opacity="0.3" />
                  <line x1="475" y1="233" x2="482" y2="240" stroke="white" strokeWidth="1" opacity="0.3" />
                  <line x1="485" y1="230" x2="482" y2="240" stroke="white" strokeWidth="1" opacity="0.3" />
                  {/* Theme bars */}
                  <rect x="495" y="230" width="45" height="6" rx="2" fill="white" opacity="0.4" />
                  <rect x="470" y="250" width="65" height="5" rx="1.5" fill="white" opacity="0.3" />
                  <rect x="470" y="260" width="55" height="5" rx="1.5" fill="white" opacity="0.3" />
                </g>

                {/* Output: Persona Insight */}
                <g opacity="0.9">
                  <rect x="455" y="310" width="95" height="62" rx="8" fill="url(#grad2)" />
                  {/* Persona icon */}
                  <circle cx="472" cy="330" r="10" fill="white" opacity="0.5" />
                  <path d="M 465 343 Q 472 338 479 343" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5" />
                  {/* Persona bars */}
                  <rect x="490" y="326" width="48" height="6" rx="2" fill="white" opacity="0.4" />
                  <rect x="490" y="338" width="50" height="5" rx="1.5" fill="white" opacity="0.35" />
                  <rect x="490" y="349" width="45" height="5" rx="1.5" fill="white" opacity="0.3" />
                  {/* Money indicator */}
                  <circle cx="465" cy="357" r="5" fill="#fbbf24" opacity="0.8" />
                  <text x="462" y="360" fontSize="7" fill="white" fontWeight="bold">$</text>
                  {/* Confidence */}
                  <circle cx="535" cy="330" r="6" fill="white" opacity="0.4" />
                  <text x="531" y="334" fontSize="8" fill="#10b981" fontWeight="bold">✓</text>
                </g>

                {/* Connection lines from processor to outputs */}
                <path d="M 380 220 Q 420 160 450 150" stroke="#8b5cf6" strokeWidth="2.5" fill="none" strokeDasharray="5,5" opacity="0.7">
                  <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1s" repeatCount="indefinite" />
                </path>
                <path d="M 380 250 Q 420 245 460 247" stroke="#8b5cf6" strokeWidth="2.5" fill="none" strokeDasharray="5,5" opacity="0.7">
                  <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1s" repeatCount="indefinite" />
                </path>
                <path d="M 380 280 Q 420 300 455 340" stroke="#8b5cf6" strokeWidth="2.5" fill="none" strokeDasharray="5,5" opacity="0.7">
                  <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1s" repeatCount="indefinite" />
                </path>

                {/* Rocket - Ready to Launch */}
                <g opacity="0.95">
                  {/* Exhaust flames (animated) */}
                  <ellipse cx="640" cy="360" rx="12" ry="8" fill="#ef4444" opacity="0.7">
                    <animate attributeName="ry" values="8;12;8" dur="0.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.7;0.4;0.7" dur="0.5s" repeatCount="indefinite" />
                  </ellipse>
                  <ellipse cx="640" cy="365" rx="10" ry="6" fill="#f59e0b" opacity="0.8">
                    <animate attributeName="ry" values="6;10;6" dur="0.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0.5;0.8" dur="0.4s" repeatCount="indefinite" />
                  </ellipse>
                  <ellipse cx="640" cy="368" rx="8" ry="5" fill="#fbbf24" opacity="0.9">
                    <animate attributeName="ry" values="5;8;5" dur="0.3s" repeatCount="indefinite" />
                  </ellipse>

                  {/* Rocket body */}
                  <rect x="620" y="200" width="40" height="140" rx="4" fill="url(#grad3)" filter="url(#glow)" />

                  {/* Nose cone */}
                  <path d="M 620 200 L 640 150 L 660 200 Z" fill="#fbbf24" filter="url(#glow)" />

                  {/* Window */}
                  <circle cx="640" cy="220" r="12" fill="#6366f1" opacity="0.6" />
                  <circle cx="640" cy="220" r="8" fill="white" opacity="0.8" />

                  {/* Fins */}
                  <path d="M 620 320 L 605 350 L 620 340 Z" fill="#d97706" />
                  <path d="M 660 320 L 675 350 L 660 340 Z" fill="#d97706" />

                  {/* Details/stripes */}
                  <rect x="620" y="260" width="40" height="3" fill="white" opacity="0.3" />
                  <rect x="620" y="280" width="40" height="3" fill="white" opacity="0.3" />
                  <rect x="620" y="300" width="40" height="3" fill="white" opacity="0.3" />

                  {/* Booster effect */}
                  <rect x="625" y="340" width="10" height="10" rx="2" fill="#ef4444" opacity="0.5">
                    <animate attributeName="opacity" values="0.5;0.2;0.5" dur="0.4s" repeatCount="indefinite" />
                  </rect>
                  <rect x="645" y="340" width="10" height="10" rx="2" fill="#ef4444" opacity="0.5">
                    <animate attributeName="opacity" values="0.5;0.2;0.5" dur="0.4s" repeatCount="indefinite" />
                  </rect>
                </g>

                {/* Connections from green cards to rocket */}
                <path d="M 545 152 Q 580 160 620 180" stroke="#fbbf24" strokeWidth="3" fill="none" strokeDasharray="6,6" opacity="0.7">
                  <animate attributeName="stroke-dashoffset" from="0" to="-12" dur="1s" repeatCount="indefinite" />
                </path>
                <path d="M 550 245 L 620 245" stroke="#fbbf24" strokeWidth="3" fill="none" strokeDasharray="6,6" opacity="0.7">
                  <animate attributeName="stroke-dashoffset" from="0" to="-12" dur="1s" repeatCount="indefinite" />
                </path>
                <path d="M 550 340 Q 580 330 620 310" stroke="#fbbf24" strokeWidth="3" fill="none" strokeDasharray="6,6" opacity="0.7">
                  <animate attributeName="stroke-dashoffset" from="0" to="-12" dur="1s" repeatCount="indefinite" />
                </path>

                {/* Floating indicators */}
                <circle cx="250" cy="180" r="5" fill="#10b981" opacity="0.6">
                  <animate attributeName="opacity" from="0.3" to="0.8" dur="2s" repeatCount="indefinite" direction="alternate" />
                  <animate attributeName="r" from="5" to="7" dur="2s" repeatCount="indefinite" direction="alternate" />
                </circle>
                <circle cx="310" cy="185" r="6" fill="#fbbf24" opacity="0.5">
                  <animate attributeName="opacity" from="0.3" to="0.7" dur="1.8s" repeatCount="indefinite" direction="alternate" />
                  <animate attributeName="r" from="6" to="8" dur="1.8s" repeatCount="indefinite" direction="alternate" />
                </circle>
                <circle cx="280" cy="277" r="5" fill="#8b5cf6" opacity="0.6">
                  <animate attributeName="opacity" from="0.3" to="0.8" dur="2.2s" repeatCount="indefinite" direction="alternate" />
                  <animate attributeName="r" from="5" to="7" dur="2.2s" repeatCount="indefinite" direction="alternate" />
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
                      <stop offset="0%" style={{ stopColor: '#6366f1', stopOpacity: 1 }} />
                      <stop offset="100%" style={{ stopColor: '#8b5cf6', stopOpacity: 1 }} />
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
              All-in-One Power. <br /><span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">None of the Extra Costs.</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Save thousands every year by replacing multiple fragmented tools with one simple platform.
              Consolidate your product stack and reclaim your time.
            </p>
          </div>

          <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-gray-700">
              {/* Other Tools Column */}
              <div className="p-8 md:col-span-2 bg-gray-50/50 dark:bg-gray-800/50">
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-6 uppercase tracking-wider">With Legacy Tools (Team of 5)</h3>
                <div className="space-y-6">
                  <ComparisonItem name="Roadmapping (Productboard, Roadmunk)" price="$3,000" />
                  <ComparisonItem name="Research Repository (Dovetail, EnjoyHQ)" price="$2,500" />
                  <ComparisonItem name="AI Synthesis & Analysis (LLM Wrappers)" price="$2,000" />
                  <ComparisonItem name="Workflow Integration (Unito, Zapier)" price="$1,500" />
                  <ComparisonItem name="Persona Generation (Delve.ai, SparkToro)" price="$2,000" />
                  <div className="pt-6 mt-6 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center font-bold text-gray-900 dark:text-gray-100">
                    <span className="text-xl">Legacy SaaS Total</span>
                    <span className="text-2xl text-red-500 line-through">$11,000/yr</span>
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
                    <Link href="/book-demo" className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-full shadow-lg transform transition-all hover:scale-105 active:scale-95">
                      Start Saving
                    </Link>
                  </div>
                </div>
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
