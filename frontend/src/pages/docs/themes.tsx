import Head from 'next/head'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, Users, BarChart3, RefreshCw } from 'lucide-react'
import { LogoIcon } from '@/components/Logo'

export default function ThemesDocumentation() {
  return (
    <>
      <Head>
        <title>Themes Documentation - Evols</title>
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Link href="/docs" className="flex items-center space-x-2">
                <LogoIcon size={32} />
                <span className="text-xl font-bold text-gray-900 dark:text-white">Evols Docs</span>
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
              <linearGradient id="themesGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor:'#6366f1',stopOpacity:1}} />
                <stop offset="100%" style={{stopColor:'#8b5cf6',stopOpacity:1}} />
              </linearGradient>
            </defs>
            <circle cx="90" cy="80" r="35" fill="#6366f1" opacity="0.7"/>
            <circle cx="180" cy="100" r="30" fill="#6366f1" opacity="0.7"/>
            <circle cx="260" cy="90" r="25" fill="#6366f1" opacity="0.7"/>
            <circle cx="120" cy="160" r="28" fill="#8b5cf6" opacity="0.7"/>
            <circle cx="210" cy="180" r="32" fill="#8b5cf6" opacity="0.7"/>
            <circle cx="150" cy="230" r="26" fill="#10b981" opacity="0.7"/>
            <line x1="90" y1="80" x2="180" y2="100" stroke="#6366f1" strokeWidth="1.5" opacity="0.4"/>
            <line x1="180" y1="100" x2="260" y2="90" stroke="#6366f1" strokeWidth="1.5" opacity="0.4"/>
            <line x1="120" y1="160" x2="210" y2="180" stroke="#8b5cf6" strokeWidth="1.5" opacity="0.4"/>
            <rect x="50" y="40" width="80" height="50" rx="6" fill="url(#themesGrad)" opacity="0.15"/>
            <rect x="140" y="130" width="80" height="50" rx="6" fill="url(#themesGrad)" opacity="0.15"/>
          </svg>
          <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">Feedback Themes</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Learn how Evols automatically clusters feedback into themes and calculates urgency and impact scores.
          </p>

          {/* Overview */}
          <Section title="Overview">
            <p>
              Themes are automatically generated from your VoC (Voice of Customer) data using semantic clustering.
              The system groups similar feedback items together and generates meaningful theme titles using AI.
            </p>
            <p className="mt-4">
              Each theme is scored for <strong>urgency</strong> and <strong>impact</strong> to help you prioritize
              which feedback clusters require immediate attention.
            </p>
          </Section>

          {/* Theme Generation */}
          <Section title="How Themes Are Generated">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">1. Semantic Clustering</h3>
              <p>
                Evols generates embeddings for each feedback item and groups similar feedback using cosine similarity.
                Feedback items with <strong>≥75% similarity</strong> are clustered together into the same theme.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">2. AI-Generated Titles</h3>
              <p>
                For each cluster, the system uses an LLM to analyze the feedback and generate:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>A concise theme title (2-4 words)</li>
                <li>A one-sentence summary describing what customers want</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6">3. Incremental Updates</h3>
              <p>
                When you refresh themes, the system only processes <strong>new feedback</strong> added since the last refresh.
                Similar themes are updated with new data using weighted averages rather than creating duplicates.
              </p>
            </div>
          </Section>

          {/* Urgency Score */}
          <Section title="Urgency Score Calculation">
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6 mb-6">
              <div className="flex items-start space-x-3">
                <TrendingUp className="w-6 h-6 text-orange-600 dark:text-orange-400 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-2">
                    Category-Based Weighting
                  </h3>
                  <p className="text-orange-800 dark:text-orange-200">
                    Urgency is calculated based on the distribution of feedback categories within the theme.
                  </p>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Category Weights</h3>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Weight
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Priority
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  <tr>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">Bug</td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">1.0</td>
                    <td className="px-6 py-4 text-sm text-red-600 dark:text-red-400 font-semibold">Highest</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">Complaint</td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">0.9</td>
                    <td className="px-6 py-4 text-sm text-orange-600 dark:text-orange-400 font-semibold">Very High</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">Feature Request</td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">0.6</td>
                    <td className="px-6 py-4 text-sm text-yellow-600 dark:text-yellow-400 font-semibold">Medium</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">Question</td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">0.4</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 font-semibold">Low</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">Other</td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">0.5</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 font-semibold">Medium-Low</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">Formula</h3>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm">
              <div>urgency_score = sum(weight × count for each category) / total_feedback_count</div>
              <div className="text-gray-500 mt-2">Result is capped at 1.0 (100%)</div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">Example</h3>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="mb-2">Theme with 10 feedback items:</p>
              <ul className="list-disc list-inside space-y-1 ml-4 mb-3">
                <li>7 bugs (7 × 1.0 = 7.0)</li>
                <li>2 complaints (2 × 0.9 = 1.8)</li>
                <li>1 feature request (1 × 0.6 = 0.6)</li>
              </ul>
              <p className="font-mono text-sm">
                <strong>Urgency Score:</strong> (7.0 + 1.8 + 0.6) / 10 = <strong className="text-red-600 dark:text-red-400">0.94 (94%)</strong>
              </p>
            </div>
          </Section>

          {/* Impact Score */}
          <Section title="Impact Score Calculation">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 mb-6">
              <div className="flex items-start space-x-3">
                <Users className="w-6 h-6 text-green-600 dark:text-green-400 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                    Account + Volume Based
                  </h3>
                  <p className="text-green-800 dark:text-green-200">
                    Impact measures how many customers are affected and how much feedback volume exists.
                  </p>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Two Components</h3>

            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">1. Account Impact (up to 60%)</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  Measures how many unique customers are affected by this theme.
                </p>
                <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-sm">
                  account_impact = min(unique_accounts / 10.0, 0.6)
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  10+ unique accounts = maximum 60% impact
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">2. Volume Impact (up to 40%)</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  Measures the total volume of feedback about this theme.
                </p>
                <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-sm">
                  volume_impact = min(feedback_count / 20.0, 0.4)
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  20+ feedback items = maximum 40% impact
                </p>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">Final Formula</h3>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm">
              <div>impact_score = account_impact + volume_impact</div>
              <div className="text-gray-500 mt-2">Result is capped at 1.0 (100%)</div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">Example</h3>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="mb-2">Theme with:</p>
              <ul className="list-disc list-inside space-y-1 ml-4 mb-3">
                <li>15 unique customer accounts</li>
                <li>25 total feedback items</li>
              </ul>
              <p className="font-mono text-sm space-y-1">
                <div>Account Impact: min(15/10, 0.6) = 0.6</div>
                <div>Volume Impact: min(25/20, 0.4) = 0.4</div>
                <div className="mt-2"><strong>Impact Score:</strong> 0.6 + 0.4 = <strong className="text-green-600 dark:text-green-400">1.0 (100%)</strong></div>
              </p>
            </div>
          </Section>

          {/* Incremental Updates */}
          <Section title="How Scores Update">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-6">
              <div className="flex items-start space-x-3">
                <RefreshCw className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-2">
                    Incremental Refresh
                  </h3>
                  <p className="text-indigo-800 dark:text-indigo-200 mb-3">
                    When new feedback arrives, theme scores are updated using weighted averages rather than full recalculation.
                  </p>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">Update Formula</h3>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm space-y-2">
              <div>existing_weight = old_feedback_count / (old_count + new_count)</div>
              <div>new_weight = new_feedback_count / (old_count + new_count)</div>
              <div className="mt-3 text-yellow-400">updated_score = (old_score × existing_weight) + (new_score × new_weight)</div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">Example</h3>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="mb-2">Existing theme:</p>
              <ul className="list-disc list-inside space-y-1 ml-4 mb-3">
                <li>Urgency: 0.8 (based on 100 feedback items)</li>
                <li>New feedback cluster: Urgency 0.6 (50 items)</li>
              </ul>
              <p className="font-mono text-sm space-y-1">
                <div>Existing Weight: 100 / (100 + 50) = 0.67</div>
                <div>New Weight: 50 / (100 + 50) = 0.33</div>
                <div className="mt-2">
                  <strong>Updated Urgency:</strong> (0.8 × 0.67) + (0.6 × 0.33) = <strong className="text-orange-600 dark:text-orange-400">0.73 (73%)</strong>
                </div>
              </p>
            </div>
          </Section>

          {/* Best Practices */}
          <Section title="Best Practices">
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">✅ Refresh themes regularly</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Click "Refresh Themes" after uploading new feedback to update scores with the latest data.
                  The system uses incremental refresh to only process new feedback.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">✅ Categorize feedback accurately</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Urgency scores depend on correct category classification. Make sure bugs are marked as "Bug"
                  and feature requests as "Feature-Request" for accurate scoring.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">✅ Track unique customer accounts</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Impact scores are more accurate when customer names are properly captured in feedback.
                  Use consistent customer naming across feedback items.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">⚡ High urgency + High impact = Top priority</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Themes with both high urgency (&gt;80%) and high impact (&gt;80%) should be addressed first.
                  These represent critical issues affecting many customers.
                </p>
              </div>
            </div>
          </Section>

          {/* Back Link */}
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <Link href="/docs" className="inline-flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700">
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
