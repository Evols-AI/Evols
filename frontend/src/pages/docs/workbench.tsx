import Head from 'next/head'
import Link from 'next/link'
import { ArrowLeft, Briefcase, Rocket, Target, Users, TrendingUp, BarChart3, Globe, Sparkles } from 'lucide-react'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-2xl mb-4 text-foreground">{title}</h2>
      <div className="prose dark:prose-invert max-w-none text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

export default function WorkbenchDocumentation() {
  return (
    <>
      <Head>
        <title>Decision Workbench Documentation - Evols</title>
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        {/* Header */}
        <header className="bg-card border-b border-border">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Link href="/docs" className="flex items-center">
                <span className="text-2xl text-primary">
                  Evols<span className="text-muted-foreground font-medium">.ai</span>
                </span>
                <span className="text-lg font-medium text-muted-foreground ml-2">Docs</span>
              </Link>
              <Link href="/docs" className="flex items-center space-x-2 text-muted-foreground hover:text-gray-900 dark:hover:text-primary-foreground">
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Docs</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-6 py-12 max-w-4xl">
          {/* Hero Illustration */}
          <svg viewBox="0 0 400 300" className="w-80 mx-auto mb-8 drop-shadow-lg">
            <defs>
              <linearGradient id="workbenchGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor:'#ec4899',stopOpacity:1}} />
                <stop offset="100%" style={{stopColor:'#9333ea',stopOpacity:1}} />
              </linearGradient>
            </defs>
            {/* PM icon */}
            <rect x="60" y="80" width="120" height="140" rx="8" fill="url(#workbenchGrad)" opacity="0.8"/>
            <circle cx="120" cy="130" r="15" fill="white" opacity="0.4"/>
            <rect x="90" y="155" width="60" height="8" rx="2" fill="white" opacity="0.3"/>
            <rect x="90" y="170" width="50" height="8" rx="2" fill="white" opacity="0.3"/>
            {/* Founder icon */}
            <rect x="220" y="80" width="120" height="140" rx="8" fill="url(#workbenchGrad)" opacity="0.8"/>
            <circle cx="280" cy="130" r="15" fill="white" opacity="0.4"/>
            <rect x="250" y="155" width="60" height="8" rx="2" fill="white" opacity="0.3"/>
            <rect x="250" y="170" width="50" height="8" rx="2" fill="white" opacity="0.3"/>
            {/* Arrows connecting */}
            <path d="M 180 150 L 220 150" stroke="white" strokeWidth="3" fill="none" opacity="0.3"/>
          </svg>

          <h1 className="text-4xl mb-4 text-foreground">Decision Workbench</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Make data-driven decisions with AI-powered analysis, customer insights, and persona validation — optimized for both Product Managers and Founders.
          </p>

          {/* Overview */}
          <Section title="Overview">
            <p>
              The Decision Workbench is Evols' core decision-making tool that helps you frame complex decisions,
              generate strategic options, and validate them with customer personas. It supports two distinct modes
              tailored to different decision contexts:
            </p>
            <div className="grid md:grid-cols-2 gap-4 mt-6 not-prose">
              <div className="bg-primary/5 dark:bg-primary/10 border border-primary/30 dark:border-primary/20 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Briefcase className="w-5 h-5 text-primary dark:text-primary" />
                  <h3 className="text-primary dark:text-primary">PM Mode</h3>
                </div>
                <p className="text-sm text-primary/85 dark:text-primary">
                  For product managers making roadmap decisions based on existing customer feedback and themes.
                </p>
              </div>
              <div className="bg-chart-1/10 border border-purple-200 dark:border-purple-800 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Rocket className="w-5 h-5 text-chart-1" />
                  <h3 className="text-purple-900 dark:text-purple-100">Founder Mode</h3>
                </div>
                <p className="text-sm text-purple-800 dark:text-purple-200">
                  For founders making strategic startup decisions using real-time market data from Reddit and other sources.
                </p>
              </div>
            </div>
          </Section>

          {/* PM Mode */}
          <Section title="PM Mode: Product Roadmap Decisions">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg text-foreground mb-3">When to Use PM Mode</h3>
                <p className="mb-3">Perfect for product managers working on established products with existing customer data:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Feature prioritization:</strong> "What should we build next for Enterprise customers?"</li>
                  <li><strong>Roadmap planning:</strong> "Should we focus on scalability or new features in Q3?"</li>
                  <li><strong>Segment decisions:</strong> "Which customer segment should we prioritize?"</li>
                  <li><strong>Trade-off analysis:</strong> "Should we invest in Feature X or Y?"</li>
                </ul>
              </div>

              <div className="bg-muted/30 rounded-lg p-5 border border-border">
                <h3 className="text-lg text-foreground mb-3 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  How PM Mode Works
                </h3>
                <ol className="space-y-4">
                  <li>
                    <strong className="text-foreground">1. Frame Your Decision</strong>
                    <p className="text-sm mt-1">Define your objective, target segments, time horizon, and constraints</p>
                  </li>
                  <li>
                    <strong className="text-foreground">2. Pull Context</strong>
                    <p className="text-sm mt-1">Auto-pull relevant themes and feedback from your VoC data</p>
                  </li>
                  <li>
                    <strong className="text-foreground">3. Generate Options</strong>
                    <p className="text-sm mt-1">AI generates 3 strategic roadmap options with pros/cons and ARR impact</p>
                  </li>
                  <li>
                    <strong className="text-foreground">4. Compare Options</strong>
                    <p className="text-sm mt-1">Review side-by-side comparison with segment impact and citations</p>
                  </li>
                  <li>
                    <strong className="text-foreground">5. Get Persona Votes</strong>
                    <p className="text-sm mt-1">Your customer personas vote on options based on their needs and priorities</p>
                  </li>
                </ol>
              </div>

              <div>
                <h3 className="text-lg text-foreground mb-3">Key Benefits</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-foreground">Data-Driven:</strong>
                      <p className="text-sm">Decisions grounded in actual customer feedback and ARR data</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Users className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-foreground">Customer-Validated:</strong>
                      <p className="text-sm">Personas represent real customer perspectives</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Target className="w-5 h-5 text-chart-1 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-foreground">Segment-Aware:</strong>
                      <p className="text-sm">Understand impact across different customer segments</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-foreground">AI-Powered:</strong>
                      <p className="text-sm">Strategic options generated from patterns in your data</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* Founder Mode */}
          <Section title="Founder Mode: Strategic Startup Decisions">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg text-foreground mb-3">When to Use Founder Mode</h3>
                <p className="mb-3">Ideal for founders making strategic decisions about their startup, especially pre-launch or early-stage:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Product direction:</strong> "Should we build a B2B SaaS or consumer app?"</li>
                  <li><strong>Market positioning:</strong> "Should we target enterprise or SMB first?"</li>
                  <li><strong>Strategic pivots:</strong> "Should we pivot to a different problem space?"</li>
                  <li><strong>Go-to-market strategy:</strong> "Sales-led or product-led growth?"</li>
                  <li><strong>Build vs buy:</strong> "Should we build our own infrastructure or use third-party?"</li>
                  <li><strong>Idea validation:</strong> "Is this problem worth solving?"</li>
                </ul>
              </div>

              <div className="bg-muted/30 rounded-lg p-5 border border-border">
                <h3 className="text-lg text-foreground mb-3 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-chart-1" />
                  How Founder Mode Works
                </h3>
                <ol className="space-y-4">
                  <li>
                    <strong className="text-foreground">1. Frame Your Decision</strong>
                    <p className="text-sm mt-1">Define your decision objective, target market, and product description (product name optional for pre-launch)</p>
                  </li>
                  <li>
                    <strong className="text-foreground">2. Pull Market Data</strong>
                    <p className="text-sm mt-1">Scrapes real market data from Reddit, including customer pain points, competitor mentions, and trends</p>
                  </li>
                  <li>
                    <strong className="text-foreground">3. Generate Personas (Optional)</strong>
                    <p className="text-sm mt-1">Create customer personas from market data, or use your existing personas</p>
                  </li>
                  <li>
                    <strong className="text-foreground">4. Generate Strategic Options</strong>
                    <p className="text-sm mt-1">AI generates startup-appropriate options (market positioning, GTM strategies, product direction)</p>
                  </li>
                  <li>
                    <strong className="text-foreground">5. Get Persona Votes</strong>
                    <p className="text-sm mt-1">Personas vote based on market validation and customer needs</p>
                  </li>
                </ol>
              </div>

              <div>
                <h3 className="text-lg text-foreground mb-3">Key Benefits</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <Globe className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-foreground">Real Market Data:</strong>
                      <p className="text-sm">Scrapes actual discussions from Reddit for market validation</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Rocket className="w-5 h-5 text-chart-1 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-foreground">Startup-Focused:</strong>
                      <p className="text-sm">Options tailored for strategic startup decisions</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-foreground">Market Validation:</strong>
                      <p className="text-sm">Understand customer pain points before building</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-foreground">Pre-Launch Ready:</strong>
                      <p className="text-sm">Works even without a product name (use description only)</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 dark:bg-primary/10 border border-primary/30 dark:border-primary/20 rounded-lg p-4">
                <h4 className="text-primary dark:text-primary mb-2 flex items-center gap-2">
                  💡 Pro Tip
                </h4>
                <p className="text-sm text-primary/85 dark:text-primary">
                  Don't have a product name yet? No problem! Founder Mode works with just a product description.
                  This is perfect for idea-stage validation when you're still exploring problem spaces.
                </p>
              </div>
            </div>
          </Section>

          {/* Comparison Table */}
          <Section title="PM vs Founder Mode Comparison">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Feature</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">PM Mode</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Founder Mode</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-gray-200 dark:divide-gray-700">
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">Best For</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">Established products with customer data</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">Pre-launch & early-stage startups</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">Data Source</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">Your VoC data (themes & feedback)</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">Real-time Reddit scraping</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">Decision Type</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">Product roadmap & features</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">Strategic startup direction</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">Options Generated</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">Feature sets & roadmap paths</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">Market positioning, GTM, pivots</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">Personas</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">Existing customer personas</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">Generate from market or use existing</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">Metrics Focus</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">ARR impact, segment coverage</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">Market validation, opportunity size</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">Product Name</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">Required</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">Optional (can use description only)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Getting Started */}
          <Section title="Getting Started">
            <div className="space-y-6">
              <div className="bg-primary/5 dark:bg-primary/10 border border-primary/30 dark:border-primary/20 rounded-lg p-5">
                <h3 className="text-primary dark:text-primary mb-3">🚀 First Time Using the Workbench?</h3>
                <ol className="space-y-2 text-sm text-primary/85 dark:text-primary">
                  <li>1. <strong>Choose your mode:</strong> PM Mode for roadmap decisions, Founder Mode for strategic startup decisions</li>
                  <li>2. <strong>Frame your decision:</strong> Be specific about what you're trying to decide</li>
                  <li>3. <strong>Pull context:</strong> Let the system gather relevant data automatically</li>
                  <li>4. <strong>Review options:</strong> Compare AI-generated strategic options side-by-side</li>
                  <li>5. <strong>Get validation:</strong> See how your customer personas vote on each option</li>
                  <li>6. <strong>Download brief:</strong> Export a decision brief to share with your team</li>
                </ol>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h4 className="text-yellow-900 dark:text-yellow-100 mb-2 flex items-center gap-2">
                  ⚡ Best Practices
                </h4>
                <ul className="space-y-2 text-sm text-yellow-800 dark:text-yellow-200">
                  <li>• <strong>Be specific in objectives:</strong> "What should we prioritize for Q3?" → "What should we prioritize for Q3 for Enterprise customers?"</li>
                  <li>• <strong>Use constraints field:</strong> Add team size, budget, or timeline constraints for more realistic options</li>
                  <li>• <strong>Review persona votes carefully:</strong> Understand WHY personas voted as they did, not just the final tally</li>
                  <li>• <strong>Save past decisions:</strong> Click on past decisions in the sidebar to review your decision history</li>
                </ul>
              </div>
            </div>
          </Section>

          {/* FAQ */}
          <Section title="Frequently Asked Questions">
            <div className="space-y-4">
              <div>
                <h4 className="text-foreground mb-2">Can I switch between PM and Founder mode?</h4>
                <p className="text-sm">
                  Yes! Use the mode toggle at the top of the workbench. Each mode maintains separate form state,
                  so you can switch without losing your work.
                </p>
              </div>

              <div>
                <h4 className="text-foreground mb-2">Do I need existing personas to use the workbench?</h4>
                <p className="text-sm">
                  <strong>PM Mode:</strong> Yes, you need existing customer personas from your VoC data.<br />
                  <strong>Founder Mode:</strong> No! You can generate personas from market data, or use existing ones if available.
                </p>
              </div>

              <div>
                <h4 className="text-foreground mb-2">How does Founder Mode pull market data?</h4>
                <p className="text-sm">
                  Founder Mode scrapes real discussions from Reddit using your product description and competitor names.
                  It extracts customer pain points, competitive insights, market trends, and opportunities from actual conversations.
                </p>
              </div>

              <div>
                <h4 className="text-foreground mb-2">What happens to past decisions?</h4>
                <p className="text-sm">
                  All decisions are automatically saved after persona voting. Access them anytime from the "Past Decisions"
                  section in the sidebar. Click any past decision to view its full decision brief.
                </p>
              </div>

              <div>
                <h4 className="text-foreground mb-2">Can I regenerate options if I don't like them?</h4>
                <p className="text-sm">
                  Yes! After viewing generated options, you can add additional constraints and regenerate to get different options.
                </p>
              </div>
            </div>
          </Section>

          {/* Footer CTA */}
          <div className="bg-primary/5 border border-primary/30 dark:border-primary/20 rounded-lg p-6 text-center">
            <h3 className="text-xl text-foreground mb-2">Ready to Make Better Decisions?</h3>
            <p className="text-muted-foreground mb-4">
              Start using the Decision Workbench to validate your product decisions with real data and customer insights.
            </p>
            <Link
              href="/workbench"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/85 text-primary-foreground rounded-lg font-medium transition-colors"
            >
              <Sparkles className="w-5 h-5" />
              Open Workbench
            </Link>
          </div>
        </main>
      </div>
    </>
  )
}
