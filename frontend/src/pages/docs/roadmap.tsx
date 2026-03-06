import Head from 'next/head'
import Link from 'next/link'
import { ArrowLeft, Map, Target, Radar } from 'lucide-react'
import { LogoIcon } from '@/components/Logo'

export default function RoadmapDocs() {
  return (
    <>
      <Head>
        <title>Roadmap Documentation - Evols</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Link href="/docs" className="flex items-center space-x-2">
                <LogoIcon size={48} />
                <span className="text-2xl font-bold text-gray-900 dark:text-white">Evols</span>
              </Link>
              <div className="flex items-center space-x-4">
                <Link href="/docs" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Docs</span>
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-6 py-12">
          <div className="max-w-4xl mx-auto">
            {/* Hero */}
            <div className="mb-12">
              <div className="inline-flex items-center space-x-2 bg-blue-100 dark:bg-blue-900/30 px-4 py-2 rounded-full text-sm text-blue-600 dark:text-blue-400 mb-6">
                <Map className="w-4 h-4" />
                <span>Roadmap</span>
              </div>
              <h1 className="text-5xl font-bold mb-4 text-gray-900 dark:text-white">Roadmap Management</h1>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                Strategic roadmap planning with initiatives, projects, and AI-powered strategic allocation analysis
              </p>
            </div>

            {/* Overview */}
            <Section title="Overview">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                The Roadmap feature helps you plan and visualize your product strategy through a hierarchical
                structure of initiatives and projects. It provides three complementary views to understand your
                strategic direction and project priorities.
              </p>
            </Section>

            {/* Initiative Roadmap */}
            <Section title="Initiative Roadmap">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl mb-6">
                <div className="flex items-start space-x-3 mb-4">
                  <Target className="w-6 h-6 text-indigo-600 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Initiatives</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      High-level strategic objectives that group related projects together. Each initiative represents
                      a major business goal or strategic direction.
                    </p>
                  </div>
                </div>

                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Key Metrics:</h4>
                <ul className="space-y-2 mb-4">
                  <li className="flex items-start space-x-2">
                    <span className="text-indigo-600 mt-1">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Expected ARR Impact:</strong> Projected annual recurring revenue increase
                    </span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-indigo-600 mt-1">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Expected Retention Impact:</strong> Projected improvement in customer retention (%)
                    </span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-indigo-600 mt-1">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Linked Themes:</strong> Connected customer feedback themes and requests
                    </span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-indigo-600 mt-1">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Project Count:</strong> Number of projects grouped under this initiative
                    </span>
                  </li>
                </ul>

                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Status Tracking:</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">PLANNED</span>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Not yet started</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">IN_PROGRESS</span>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Active development</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">COMPLETED</span>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Finished and deployed</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">ON_HOLD</span>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Paused temporarily</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Projects</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Specific deliverables and work items that implement an initiative. Projects are the tactical
                  execution layer that brings strategic initiatives to life.
                </p>

                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Project Attributes:</h4>
                <ul className="space-y-2">
                  <li className="flex items-start space-x-2">
                    <span className="text-indigo-600 mt-1">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Effort:</strong> Estimated development effort (Small/Medium/Large/XL)
                    </span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-indigo-600 mt-1">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Difficulty:</strong> Technical complexity and risk level
                    </span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-indigo-600 mt-1">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Business Value:</strong> Expected impact on business metrics (1-10)
                    </span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-indigo-600 mt-1">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Status:</strong> Same lifecycle as initiatives (Planned → In Progress → Completed)
                    </span>
                  </li>
                </ul>
              </div>
            </Section>

            {/* Priority Matrix */}
            <Section title="Priority Matrix">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  A 2x2 matrix visualization that helps prioritize initiatives based on two dimensions:
                </p>

                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Expected ARR Impact (Y-axis)</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Revenue potential - higher initiatives appear at the top
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Project Count (X-axis)</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Complexity/effort - more projects means more implementation work
                    </p>
                  </div>
                </div>

                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Quadrant Interpretation:</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-200 dark:border-green-800">
                    <span className="text-xs font-medium text-green-700 dark:text-green-400">HIGH VALUE / LOW EFFORT</span>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Quick wins - prioritize these</p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-800">
                    <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">HIGH VALUE / HIGH EFFORT</span>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Major projects - plan carefully</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800">
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-400">LOW VALUE / LOW EFFORT</span>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Fill-ins - do when available</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800">
                    <span className="text-xs font-medium text-red-700 dark:text-red-400">LOW VALUE / HIGH EFFORT</span>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Avoid - low ROI</p>
                  </div>
                </div>
              </div>
            </Section>

            {/* Strategy Radar */}
            <Section title="Strategy Radar">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl">
                <div className="flex items-start space-x-3 mb-4">
                  <Radar className="w-6 h-6 text-indigo-600 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Strategic Allocation</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      AI-powered analysis that categorizes initiatives into three strategic buckets based on their
                      expected business impact:
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2">🔄 Retention</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      Initiatives focused on keeping existing customers happy and reducing churn
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      <strong>Criteria:</strong> Has positive expected_retention_impact value
                    </p>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">📈 Growth</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      Initiatives aimed at acquiring new customers and expanding revenue
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      <strong>Criteria:</strong> Has positive expected_arr_impact (but not retention-focused)
                    </p>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <h4 className="font-semibold text-purple-700 dark:text-purple-400 mb-2">🏗️ Infrastructure</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      Technical debt, platform improvements, and foundational work
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      <strong>Criteria:</strong> No direct ARR or retention impact metrics
                    </p>
                  </div>
                </div>

                <div className="mt-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">View Options:</h4>
                  <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex items-center space-x-2">
                      <span className="text-indigo-600">▶</span>
                      <span><strong>By Initiatives:</strong> Shows initiative count in each category</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="text-indigo-600">▶</span>
                      <span><strong>By Projects:</strong> Shows total project count per category</span>
                    </li>
                  </ul>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-3">
                    💡 <strong>Tip:</strong> A balanced portfolio typically invests in all three areas.
                    Too much infrastructure may slow growth, while too little can create technical debt.
                  </p>
                </div>
              </div>
            </Section>

            {/* Filtering & Sorting */}
            <Section title="Filtering & Sorting">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Available Options:</h4>

                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <span className="text-indigo-600 mt-1">•</span>
                    <div>
                      <strong className="text-gray-900 dark:text-white">Product Filter:</strong>
                      <span className="text-gray-600 dark:text-gray-400 ml-2">
                        Multi-select filter to view initiatives for specific products
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-indigo-600 mt-1">•</span>
                    <div>
                      <strong className="text-gray-900 dark:text-white">Sort By:</strong>
                      <span className="text-gray-600 dark:text-gray-400 ml-2">
                        ARR Impact, Retention Impact, Project Count, Status
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-indigo-600 mt-1">•</span>
                    <div>
                      <strong className="text-gray-900 dark:text-white">Status Filter:</strong>
                      <span className="text-gray-600 dark:text-gray-400 ml-2">
                        Filter by lifecycle stage (All, Planned, In Progress, Completed, On Hold)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            {/* Back Link */}
            <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
              <Link href="/docs" className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Documentation
              </Link>
            </div>
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

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-3xl font-bold mb-6 pb-2 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
        {title}
      </h2>
      {children}
    </section>
  )
}
