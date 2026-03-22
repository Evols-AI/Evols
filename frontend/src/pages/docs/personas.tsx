import Head from 'next/head'
import Link from 'next/link'
import { ArrowLeft, Users, RefreshCw, TrendingUp, DollarSign } from 'lucide-react'

export default function PersonasDocumentation() {
  return (
    <>
      <Head>
        <title>Personas Documentation - Evols</title>
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Link href="/docs" className="flex items-center">
                <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
                  Evols<span className="text-gray-400 dark:text-gray-500 font-medium">.ai</span>
                </span>
                <span className="text-lg font-medium text-gray-600 dark:text-gray-400 ml-2">Docs</span>
              </Link>
              <Link href="/docs" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Docs</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-6 py-12 max-w-4xl">
          <svg viewBox="0 0 350 300" className="w-72 mx-auto mb-8 drop-shadow-lg">
            <defs>
              <linearGradient id="personasGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor:'#ec4899',stopOpacity:1}} />
                <stop offset="100%" style={{stopColor:'#9333ea',stopOpacity:1}} />
              </linearGradient>
            </defs>
            <circle cx="100" cy="80" r="40" fill="url(#personasGrad)" opacity="0.8"/>
            <circle cx="100" cy="65" r="20" fill="white" opacity="0.4"/>
            <path d="M 70 95 Q 100 85 130 95" stroke="white" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.4"/>
            <circle cx="250" cy="80" r="40" fill="url(#personasGrad)" opacity="0.8"/>
            <circle cx="250" cy="65" r="20" fill="white" opacity="0.4"/>
            <path d="M 220 95 Q 250 85 280 95" stroke="white" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.4"/>
            <circle cx="175" cy="200" r="40" fill="url(#personasGrad)" opacity="0.8"/>
            <circle cx="175" cy="185" r="20" fill="white" opacity="0.4"/>
            <path d="M 145 215 Q 175 205 205 215" stroke="white" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.4"/>
          </svg>
          <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">Customer Personas</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Learn how Evols automatically generates customer personas from VoC data and calculates product metrics.
          </p>

          {/* Overview */}
          <Section title="Overview">
            <p>
              Personas are automatically generated from your customer feedback data by grouping customers with
              similar characteristics (segment, industry, role). Each persona represents a distinct customer archetype
              with specific needs, behaviors, and product usage patterns.
            </p>
            <p className="mt-4">
              Evols calculates dynamic metrics for each persona including <strong>revenue contribution</strong> and
              <strong> usage frequency</strong> from the VoC data.
            </p>
          </Section>

          {/* Persona Generation */}
          <Section title="How Personas Are Generated">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">1. Customer Segmentation</h3>
              <p>
                Personas are created by grouping feedback from customers with similar attributes:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Segment:</strong> Enterprise, Mid-Market, or SMB</li>
                <li><strong>Industry:</strong> SaaS, Healthcare, Finance, etc.</li>
                <li><strong>Job Role:</strong> Executive, Engineering, Management, etc.</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">2. Duplicate Detection</h3>
              <p>
                The system uses <strong>semantic similarity (85% threshold)</strong> to prevent creating duplicate personas.
                If a new persona is similar to an existing one, the existing persona is updated with new data instead.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">3. Incremental Updates</h3>
              <p>
                When you refresh personas, only <strong>new feedback since the last refresh</strong> is processed.
                This makes refreshes fast and cost-effective while keeping personas up-to-date.
              </p>
            </div>
          </Section>

          {/* Persona Lifecycle */}
          <Section title="Persona Lifecycle">
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">🆕 New</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Newly generated personas start with "New" status. These are available for review but not
                  used in voting or decision-making yet.
                </p>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">✅ Active</h4>
                <p className="text-sm text-green-800 dark:text-green-200">
                  Active personas used in trade-off voting, Ask Personas, and workbench. Only "Active" personas
                  participate in product decisions.
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">🚫 Inactive</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Hidden personas that are no longer relevant or accurate. These are excluded from all
                  platform features and won't be updated during refresh.
                </p>
              </div>
            </div>
          </Section>

          {/* Revenue Contribution */}
          <Section title="Revenue Contribution">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 mb-6">
              <div className="flex items-start space-x-3">
                <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                    Average Revenue Per Customer
                  </h3>
                  <p className="text-green-800 dark:text-green-200">
                    Calculated from revenue data in feedback extra_data fields.
                  </p>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Data Sources</h3>
            <p className="mb-3">
              Evols extracts revenue data from the following fields in your feedback data:
            </p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm mb-4">
              <div className="text-gray-400">// Feedback extra_data fields:</div>
              <div>"arr": 50000,           <span className="text-gray-500">// Annual Recurring Revenue</span></div>
              <div>"revenue": 50000,       <span className="text-gray-500">// Total Revenue</span></div>
              <div>"account_value": 50000  <span className="text-gray-500">// Account Value</span></div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Calculation</h3>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm">
              <div>revenue_contribution = sum(revenue_values) / count(revenue_values)</div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">Updates</h3>
            <p>
              When a persona is updated with new feedback, revenue contribution is recalculated using a
              <strong> weighted average</strong> based on feedback counts:
            </p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm mt-3">
              <div>new_revenue = (old_revenue × old_count + new_revenue × new_count) / total_count</div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mt-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> If revenue data is not available in your feedback, this field will show "N/A".
              </p>
            </div>
          </Section>

          {/* Usage Frequency */}
          <Section title="Usage Frequency">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
              <div className="flex items-start space-x-3">
                <TrendingUp className="w-6 h-6 text-blue-500 dark:text-blue-300 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Product Usage Pattern
                  </h3>
                  <p className="text-blue-800 dark:text-blue-200">
                    Extracted from usage frequency data in feedback extra_data fields.
                  </p>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Data Sources</h3>
            <p className="mb-3">
              Evols extracts usage patterns from these fields:
            </p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm mb-4">
              <div className="text-gray-400">// Feedback extra_data fields:</div>
              <div>"usage_frequency": "Daily",  <span className="text-gray-500">// Direct usage frequency</span></div>
              <div>"login_frequency": "Weekly", <span className="text-gray-500">// Login pattern</span></div>
              <div>"daily_active": true,        <span className="text-gray-500">// Daily active flag</span></div>
              <div>"weekly_active": true        <span className="text-gray-500">// Weekly active flag</span></div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Calculation</h3>
            <p>
              Usage frequency is determined by finding the <strong>most common pattern</strong> across all
              feedback items for that persona:
            </p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm mt-3">
              <div>usage_frequency = most_common(usage_patterns)</div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">Common Values</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Daily:</strong> Users who log in or use the product daily</li>
              <li><strong>Weekly:</strong> Users who engage with the product weekly</li>
              <li><strong>Monthly:</strong> Users who access monthly or occasionally</li>
              <li><strong>Seasonal:</strong> Users with periodic or seasonal usage</li>
            </ul>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mt-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> If usage data is not available in your feedback, this field will show "N/A".
              </p>
            </div>
          </Section>

          {/* Confidence Score */}
          <Section title="Confidence Score">
            <p>
              Each persona has a confidence score indicating how reliable the persona data is based on the
              amount of feedback:
            </p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm mt-3 mb-4">
              <div>confidence_score = min(0.5 + (feedback_count / 50), 0.95)</div>
            </div>

            <div className="space-y-3">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">≥ 25 feedback items</span>
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400">High (≥75%)</span>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">10-24 feedback items</span>
                  <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">Medium (60-74%)</span>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">&lt; 10 feedback items</span>
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">Low (&lt;60%)</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Best Practices */}
          <Section title="Best Practices">
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">✅ Review "New" personas regularly</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  New personas need to be reviewed and marked as "Active" to participate in decisions.
                  Filter by "New" status to see personas waiting for review.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">✅ Include revenue and usage data</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  For accurate metrics, include <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">extra_data</code> fields
                  in your feedback with revenue (arr, revenue, account_value) and usage (usage_frequency, login_frequency) information.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">✅ Merge similar personas</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  If you find similar personas, use the merge feature to combine them. This creates a
                  more accurate persona with higher confidence scores.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">✅ Refresh after major data uploads</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Click "Refresh Personas" after uploading significant new feedback to keep personas
                  current. The system will intelligently update existing personas rather than creating duplicates.
                </p>
              </div>
            </div>
          </Section>

          {/* Back Link */}
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <Link href="/docs" className="inline-flex items-center space-x-2 text-blue-500 dark:text-blue-300 hover:text-blue-600">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Documentation</span>
            </Link>
          </div>
        </main>
      </div>
    </>
  )
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
        {title}
      </h2>
      <div className="prose dark:prose-invert max-w-none">
        {children}
      </div>
    </section>
  )
}
