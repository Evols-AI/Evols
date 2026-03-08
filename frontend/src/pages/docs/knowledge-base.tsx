import Head from 'next/head'
import Link from 'next/link'
import { ArrowLeft, Database, Sparkles, FileText, Brain } from 'lucide-react'
import { LogoIcon } from '@/components/Logo'

export default function KnowledgeBaseDocs() {
  return (
    <>
      <Head>
        <title>Knowledge Base Documentation - Evols</title>
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
              <div className="inline-flex items-center space-x-2 bg-purple-100 dark:bg-purple-900/30 px-4 py-2 rounded-full text-sm text-purple-600 dark:text-purple-400 mb-6">
                <Database className="w-4 h-4" />
                <span>Knowledge Base</span>
              </div>
              <h1 className="text-5xl font-bold mb-4 text-gray-900 dark:text-white">Product Knowledge Base</h1>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                AI-powered RAG (Retrieval Augmented Generation) system for product capabilities and knowledge management
              </p>
            </div>

            {/* Overview */}
            <Section title="Overview">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl">
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  The Knowledge Base feature provides a RAG-based system that lets you store and query your product
                  capabilities, documentation, and domain knowledge. It combines traditional data storage with AI-powered
                  semantic search and generation.
                </p>
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>💡 Use Case:</strong> When personas ask questions or when generating decision options,
                    the AI can reference your product capabilities to provide accurate, context-aware responses.
                  </p>
                </div>
              </div>
            </Section>

            {/* Capabilities */}
            <Section title="Product Capabilities">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl mb-6">
                <div className="flex items-start space-x-3 mb-4">
                  <Sparkles className="w-6 h-6 text-purple-600 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">What are Capabilities?</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Capabilities are structured descriptions of what your product can do. They serve as the foundation
                      for AI-powered features like persona responses and decision analysis.
                    </p>
                  </div>
                </div>

                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 mt-6">Capability Structure:</h4>
                <div className="space-y-3">
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded">
                    <strong className="text-gray-900 dark:text-white">Name:</strong>
                    <span className="text-gray-600 dark:text-gray-400 ml-2">Short, descriptive title</span>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Example: "Real-time Analytics Dashboard"
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded">
                    <strong className="text-gray-900 dark:text-white">Description:</strong>
                    <span className="text-gray-600 dark:text-gray-400 ml-2">Detailed explanation of functionality</span>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Include technical details, use cases, and limitations
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded">
                    <strong className="text-gray-900 dark:text-white">Category:</strong>
                    <span className="text-gray-600 dark:text-gray-400 ml-2">Organizational grouping</span>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Examples: Analytics, Integration, Security, Performance, UX
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded">
                    <strong className="text-gray-900 dark:text-white">Status:</strong>
                    <span className="text-gray-600 dark:text-gray-400 ml-2">Availability state</span>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded">AVAILABLE</span>
                      <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded">IN_DEVELOPMENT</span>
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded">PLANNED</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded">
                    <strong className="text-gray-900 dark:text-white">Product Association:</strong>
                    <span className="text-gray-600 dark:text-gray-400 ml-2">Link to specific product</span>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Capabilities are scoped to products for multi-product environments
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-6 rounded-xl border border-purple-200 dark:border-purple-800">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">💡 Best Practices:</h4>
                <ul className="space-y-2">
                  <li className="flex items-start space-x-2">
                    <span className="text-purple-600 mt-1">✓</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Be specific and detailed - AI responses are only as good as your capability descriptions
                    </span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-purple-600 mt-1">✓</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Include technical constraints and limitations
                    </span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-purple-600 mt-1">✓</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Keep capabilities updated as your product evolves
                    </span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-purple-600 mt-1">✓</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Use consistent categorization for easier searching
                    </span>
                  </li>
                </ul>
              </div>
            </Section>

            {/* RAG System */}
            <Section title="RAG (Retrieval Augmented Generation)">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl">
                <div className="flex items-start space-x-3 mb-4">
                  <Brain className="w-6 h-6 text-blue-500 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">How RAG Works</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      RAG enhances AI responses by retrieving relevant context from your knowledge base before generating
                      answers. This ensures responses are grounded in your actual product capabilities.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="border-l-4 border-blue-400 pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">1. Retrieval Phase</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      When a question is asked, the system uses semantic search to find the most relevant capabilities
                      from your knowledge base. This uses embeddings to understand meaning, not just keywords.
                    </p>
                  </div>

                  <div className="border-l-4 border-purple-500 pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">2. Augmentation Phase</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Retrieved capabilities are added to the AI prompt as context, giving the model accurate information
                      about what your product can actually do.
                    </p>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">3. Generation Phase</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      The AI generates a response using both its general knowledge and the specific context from your
                      capabilities, resulting in accurate, product-specific answers.
                    </p>
                  </div>
                </div>

                <div className="mt-6 bg-gradient-to-r from-blue-50 to-blue-50 dark:from-blue-900/20 dark:to-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Integration Points:</h4>
                  <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex items-center space-x-2">
                      <span className="text-blue-500">▶</span>
                      <span><strong>Ask Personas:</strong> Personas reference capabilities when answering questions</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="text-blue-500">▶</span>
                      <span><strong>Decision Workbench:</strong> Options are generated based on available capabilities</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="text-blue-500">▶</span>
                      <span><strong>Roadmap Planning:</strong> Initiatives can be validated against existing capabilities</span>
                    </li>
                  </ul>
                </div>
              </div>
            </Section>

            {/* Knowledge Sources */}
            <Section title="Knowledge Sources">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl">
                <div className="flex items-start space-x-3 mb-4">
                  <FileText className="w-6 h-6 text-green-600 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">External Documentation</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      In addition to manually entered capabilities, you can connect external knowledge sources like
                      technical documentation, API references, and product specifications.
                    </p>
                  </div>
                </div>

                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 mt-6">Supported Source Types:</h4>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                    <span className="text-2xl">📄</span>
                    <div>
                      <strong className="text-gray-900 dark:text-white">Documents</strong>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        PDF, Markdown, text files containing product documentation
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                    <span className="text-2xl">🔗</span>
                    <div>
                      <strong className="text-gray-900 dark:text-white">URLs</strong>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Web pages, API documentation, help centers
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                    <span className="text-2xl">📊</span>
                    <div>
                      <strong className="text-gray-900 dark:text-white">Structured Data</strong>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        CSV exports, API schemas, database schemas
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>⚠️ Note:</strong> External sources are chunked and embedded for efficient retrieval.
                    Large documents may take a few minutes to process initially.
                  </p>
                </div>
              </div>
            </Section>

            {/* Product Management */}
            <Section title="Product Management">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  The Knowledge Base page also includes product management functionality for multi-product workspaces.
                </p>

                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Product Features:</h4>
                <ul className="space-y-2">
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Create Products:</strong> Add new products to your workspace (admin only)
                    </span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Demo Product:</strong> Auto-created with sample data for onboarding
                    </span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Product Deletion:</strong> Archive products (cannot delete demo product)
                    </span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Capabilities per Product:</strong> Each product has its own capability set
                    </span>
                  </li>
                </ul>
              </div>
            </Section>

            {/* Back Link */}
            <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
              <Link href="/docs" className="inline-flex items-center text-blue-500 dark:text-blue-300 hover:text-blue-600">
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
