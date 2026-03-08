import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
  BookOpen, Plus, Link as LinkIcon, FileText, Github, Server,
  Upload, X, Loader2, Network, Search, MessageSquare, ExternalLink, Trash2, RefreshCw, Package
} from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, Card, EmptyState, Loading } from '@/components/PageContainer'
import { useProducts } from '@/hooks/useProducts'
import { confirmDemoOperation } from '@/utils/demoWarning'

export default function KnowledgeBase() {
  const router = useRouter()
  const { selectedProductIds } = useProducts()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sources, setSources] = useState<any[]>([])
  const [capabilities, setCapabilities] = useState<any[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedView, setSelectedView] = useState<'sources' | 'graph' | 'products'>('products')
  const [selectedCapability, setSelectedCapability] = useState<any>(null)
  const [copilotQuestion, setCopilotQuestion] = useState('')
  const [copilotAnswer, setCopilotAnswer] = useState<any>(null)
  const [askingCopilot, setAskingCopilot] = useState(false)
  const [deduplicating, setDeduplicating] = useState(false)

  // Product management state
  const [products, setProducts] = useState<any[]>([])
  const [showCreateProduct, setShowCreateProduct] = useState(false)
  const [newProductName, setNewProductName] = useState('')
  const [newProductDescription, setNewProductDescription] = useState('')
  const [creatingProduct, setCreatingProduct] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    const currentUser = getCurrentUser()
    setUser(currentUser)

    if (selectedProductIds.length > 0) {
      loadKnowledgeBase()
    } else {
      setLoading(false)
    }
  }, [router, selectedProductIds])

  const loadKnowledgeBase = async () => {
    try {
      setLoading(true)
      const productIdsParam = selectedProductIds.join(',')

      const [sourcesRes, capabilitiesRes, productsRes] = await Promise.all([
        api.getKnowledgeSources({ product_ids: productIdsParam }), // Sources are product-specific
        api.getCapabilities({ product_ids: productIdsParam }), // Capabilities are product-specific
        api.products.list()
      ])
      // API returns AxiosResponse, so extract .data which contains the array
      setSources(Array.isArray(sourcesRes?.data) ? sourcesRes.data : [])
      setCapabilities(Array.isArray(capabilitiesRes?.data) ? capabilitiesRes.data : [])
      setProducts(productsRes || [])
    } catch (error) {
      console.error('Error loading Product RAG:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAskCopilot = async () => {
    if (!copilotQuestion.trim()) return

    setAskingCopilot(true)
    try {
      const response = await api.post('/knowledge-base/ask', {
        question: copilotQuestion
      })
      setCopilotAnswer(response.data)
    } catch (error) {
      console.error('Error asking copilot:', error)
      setCopilotAnswer({
        answer: 'Sorry, I couldn\'t process your question. Please try again.',
        citations: []
      })
    } finally {
      setAskingCopilot(false)
    }
  }

  const handleDeduplicateCapabilities = async () => {
    if (!confirm('Remove duplicate capabilities? This will keep only the oldest version of each capability.')) {
      return
    }

    setDeduplicating(true)
    try {
      const response = await api.deduplicateCapabilities()
      alert(response.data.message || 'Duplicates removed successfully!')
      await loadKnowledgeBase()
    } catch (error) {
      console.error('Error deduplicating capabilities:', error)
      alert('Failed to remove duplicates. Please try again.')
    } finally {
      setDeduplicating(false)
    }
  }

  const handleCreateProduct = async () => {
    if (!newProductName.trim()) {
      alert('Please enter a product name')
      return
    }

    setCreatingProduct(true)
    try {
      await api.products.create({
        name: newProductName,
        description: newProductDescription || null,
        is_demo: false
      })
      setNewProductName('')
      setNewProductDescription('')
      setShowCreateProduct(false)
      await loadKnowledgeBase()
    } catch (error: any) {
      console.error('Error creating product:', error)
      alert(error.response?.data?.detail || 'Failed to create product. You may need admin permissions.')
    } finally {
      setCreatingProduct(false)
    }
  }

  const handleDeleteProduct = async (productId: number, productName: string) => {
    if (!confirm(`Delete product "${productName}"? This will soft-delete the product.`)) {
      return
    }

    try {
      await api.products.delete(productId)
      await loadKnowledgeBase()
    } catch (error: any) {
      console.error('Error deleting product:', error)
      alert(error.response?.data?.detail || 'Failed to delete product.')
    }
  }

  return (
    <>
      <Head>
        <title>Product RAG - Evols</title>
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Header user={user} currentPage="knowledge-base" />

        <PageContainer>
          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Product RAG
              </h1>
              {!showCreateProduct && (
                <button
                  onClick={() => {
                    setSelectedView('products')
                    setShowCreateProduct(true)
                  }}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </button>
              )}
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Build a Retrieval-Augmented Generation (RAG) system of your product's capabilities, documentation, and architecture
            </p>
          </div>

          {selectedProductIds.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-body mb-2">No product selected</p>
              <p className="text-sm text-muted">
                Please select a product from the dropdown above to view knowledge sources.
              </p>
            </Card>
          ) : loading ? (
            <Card>
              <Loading text="Loading Product RAG..." />
            </Card>
          ) : (
            <>
              {/* View Toggle */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSelectedView('products')}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      selectedView === 'products'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Package className="w-4 h-4 inline mr-2" />
                    Products
                  </button>
                  <button
                    onClick={() => setSelectedView('sources')}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      selectedView === 'sources'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <FileText className="w-4 h-4 inline mr-2" />
                    Sources
                  </button>
                  <button
                    onClick={() => setSelectedView('graph')}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      selectedView === 'graph'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Network className="w-4 h-4 inline mr-2" />
                    Capability Graph
                  </button>
                </div>

                {selectedView === 'sources' && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Source
                  </button>
                )}

                {selectedView === 'graph' && capabilities.length > 0 && (
                  <button
                    onClick={handleDeduplicateCapabilities}
                    disabled={deduplicating}
                    className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                  >
                    {deduplicating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Remove Duplicates
                  </button>
                )}
              </div>

              {selectedView === 'sources' ? (
                <div className="space-y-6">
                  {sources.length === 0 ? (
                    <Card>
                      <EmptyState
                        icon={<BookOpen className="w-16 h-16" />}
                        title="No knowledge sources yet"
                        description="Start building your Product RAG by adding documentation, code repositories, or connecting data sources"
                        action={
                          <button
                            onClick={() => setShowAddModal(true)}
                            className="btn-primary inline-flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Add First Source
                          </button>
                        }
                      />
                    </Card>
                  ) : (
                    <>
                      {/* Sources List */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {sources.map((source) => (
                          <SourceCard key={source.id} source={source} onRefresh={loadKnowledgeBase} />
                        ))}
                      </div>

                  {/* AI Copilot Q&A Section */}
                  <Card>
                    <div className="p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        <h2 className="text-xl font-bold text-heading">Ask about your product</h2>
                      </div>

                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={copilotQuestion}
                            onChange={(e) => setCopilotQuestion(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleAskCopilot()
                              }
                            }}
                            placeholder="Ask anything about your product capabilities, architecture, or documentation..."
                            className="input flex-1"
                          />
                          <button
                            onClick={handleAskCopilot}
                            disabled={askingCopilot || !copilotQuestion.trim()}
                            className="btn-primary disabled:opacity-50 flex items-center gap-2"
                          >
                            {askingCopilot ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Search className="w-4 h-4" />
                            )}
                            Ask
                          </button>
                        </div>

                        {copilotAnswer && (
                          <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-5">
                            <div className="prose dark:prose-invert max-w-none">
                              <p className="text-sm text-gray-900 dark:text-white mb-4">
                                {copilotAnswer.answer}
                              </p>
                            </div>

                            {copilotAnswer.citations && copilotAnswer.citations.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-700">
                                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                  Sources:
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {copilotAnswer.citations.map((citation: any, idx: number) => (
                                    <a
                                      key={idx}
                                      href={citation.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                    >
                                      <FileText className="w-3 h-3" />
                                      {citation.title}
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                    </>
                  )}
                </div>
              ) : selectedView === 'graph' ? (
                <CapabilityGraph
                  capabilities={capabilities}
                  onSelectCapability={setSelectedCapability}
                />
              ) : (
                /* Products View */
                <div className="space-y-6">
                  {/* Add Product Form */}
                  {showCreateProduct && (
                    <Card>
                      <div className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Create New Product</h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Product Name *
                            </label>
                            <input
                              type="text"
                              value={newProductName}
                              onChange={(e) => setNewProductName(e.target.value)}
                              placeholder="e.g., My Product"
                              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Description (Optional)
                            </label>
                            <textarea
                              value={newProductDescription}
                              onChange={(e) => setNewProductDescription(e.target.value)}
                              placeholder="Product description..."
                              rows={3}
                              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div className="flex gap-3 justify-end">
                            <button
                              onClick={() => {
                                setShowCreateProduct(false)
                                setNewProductName('')
                                setNewProductDescription('')
                              }}
                              className="btn-secondary"
                              disabled={creatingProduct}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleCreateProduct}
                              disabled={creatingProduct || !newProductName.trim()}
                              className="btn-primary flex items-center gap-2 disabled:opacity-50"
                            >
                              {creatingProduct ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Creating...
                                </>
                              ) : (
                                <>
                                  <Plus className="w-4 h-4" />
                                  Add Product
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Products List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((product) => (
                      <Card key={product.id}>
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Package className="w-5 h-5 text-blue-500 dark:text-blue-300" />
                              <h3 className="text-lg font-semibold">{product.name}</h3>
                            </div>
                            {!product.is_demo && (
                              <button
                                onClick={() => handleDeleteProduct(product.id, product.name)}
                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                title="Delete product"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {product.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                              {product.description}
                            </p>
                          )}

                          <div className="flex items-center gap-2 text-xs">
                            {product.is_demo && (
                              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                                Demo
                              </span>
                            )}
                            <span className="text-gray-500 dark:text-gray-400">
                              ID: {product.id}
                            </span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {products.length === 0 && (
                    <Card>
                      <EmptyState
                        icon={<Package className="w-16 h-16" />}
                        title="No products yet"
                        description="Create your first product to organize your data"
                        action={
                          <button
                            onClick={() => setShowCreateProduct(true)}
                            className="btn-primary inline-flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Create First Product
                          </button>
                        }
                      />
                    </Card>
                  )}
                </div>
              )}
            </>
          )}
        </PageContainer>

        {/* Add Source Modal */}
        {showAddModal && (
          <AddSourceModal
            selectedProductIds={selectedProductIds}
            products={products}
            onClose={() => setShowAddModal(false)}
            onSuccess={() => {
              setShowAddModal(false)
              loadKnowledgeBase()
            }}
          />
        )}

        {/* Capability Detail Modal */}
        {selectedCapability && (
          <CapabilityDetailModal
            capability={selectedCapability}
            onClose={() => setSelectedCapability(null)}
          />
        )}
      </div>
    </>
  )
}

function SourceCard({ source, onRefresh }: { source: any; onRefresh: () => void }) {
  const [deleting, setDeleting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'url': return <LinkIcon className="w-5 h-5" />
      case 'pdf': return <FileText className="w-5 h-5" />
      case 'github': return <Github className="w-5 h-5" />
      case 'mcp': return <Server className="w-5 h-5" />
      default: return <BookOpen className="w-5 h-5" />
    }
  }

  const getSourceColor = (type: string) => {
    switch (type) {
      case 'url': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
      case 'pdf': return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
      case 'github': return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
      case 'mcp': return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
      default: return 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${source.name}"? This will also delete all associated capabilities.`)) {
      return
    }

    setDeleting(true)
    try {
      await api.deleteKnowledgeSource(source.id)
      onRefresh()
    } catch (error) {
      console.error('Error deleting source:', error)
      alert('Failed to delete source. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleRefreshSource = async () => {
    if (!confirm(`Refresh "${source.name}"? This will re-extract capabilities from the source.`)) {
      return
    }

    setRefreshing(true)
    try {
      await api.refreshKnowledgeSource(source.id)
      onRefresh()
    } catch (error) {
      console.error('Error refreshing source:', error)
      alert('Failed to refresh source. Please try again.')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="card-hover p-6">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg ${getSourceColor(source.type)}`}>
          {getSourceIcon(source.type)}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-heading mb-1">{source.name}</h3>
          <p className="text-sm text-body mb-3 line-clamp-2">{source.description || 'No description'}</p>

          <div className="flex items-center gap-4 text-xs text-muted">
            <span>Type: {source.type.toUpperCase()}</span>
            <span>•</span>
            <span>Added {new Date(source.created_at).toLocaleDateString()}</span>
            <span>•</span>
            <span className={`font-medium ${source.capabilities_extracted > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {source.capabilities_extracted || 0} {source.capabilities_extracted === 1 ? 'capability' : 'capabilities'}
            </span>
          </div>

          {source.status === 'processing' && (
            <div className="mt-3 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshSource}
            disabled={refreshing || source.status === 'processing'}
            className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400 transition disabled:opacity-50"
            title="Refresh source"
          >
            {refreshing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400 transition disabled:opacity-50"
            title="Delete source"
          >
            {deleting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Trash2 className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddSourceModal({
  selectedProductIds,
  products,
  onClose,
  onSuccess
}: {
  selectedProductIds: number[]
  products: any[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [sourceType, setSourceType] = useState<'url' | 'pdf' | 'github' | 'mcp'>('url')
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    github_repo: '',
    mcp_endpoint: '',
    description: ''
  })
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Check if user is operating on demo products and show warning
    const confirmed = await confirmDemoOperation(
      selectedProductIds,
      products,
      'add knowledge source (includes AI capability extraction)'
    )

    if (!confirmed) {
      return // User cancelled
    }

    setUploading(true)

    try {
      if (sourceType === 'pdf' && file) {
        const formDataObj = new FormData()
        formDataObj.append('file', file)
        formDataObj.append('name', formData.name)
        formDataObj.append('description', formData.description)
        await api.uploadKnowledgeSource(formDataObj)
      } else {
        await api.addKnowledgeSource({
          type: sourceType,
          name: formData.name,
          url: sourceType === 'url' ? formData.url : undefined,
          github_repo: sourceType === 'github' ? formData.github_repo : undefined,
          mcp_endpoint: sourceType === 'mcp' ? formData.mcp_endpoint : undefined,
          description: formData.description
        })
      }
      onSuccess()
    } catch (error) {
      console.error('Error adding source:', error)
      alert('Failed to add source. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Add Knowledge Source</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Source Type Selection */}
          <div>
            <label className="block text-sm font-medium mb-3">Source Type</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { type: 'url', icon: LinkIcon, label: 'Documentation URL' },
                { type: 'pdf', icon: FileText, label: 'PDF Upload' },
                { type: 'github', icon: Github, label: 'GitHub Repo' },
                { type: 'mcp', icon: Server, label: 'MCP Server' }
              ].map((option) => (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => setSourceType(option.type as any)}
                  className={`p-4 rounded-lg border-2 transition ${
                    sourceType === option.type
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <option.icon className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-xs font-medium">{option.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., API Documentation, Architecture Guide"
              className="input"
              required
            />
          </div>

          {/* Type-specific fields */}
          {sourceType === 'url' && (
            <div>
              <label className="block text-sm font-medium mb-2">Documentation URL</label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://docs.example.com"
                className="input"
                required
              />
            </div>
          )}

          {sourceType === 'pdf' && (
            <div>
              <label className="block text-sm font-medium mb-2">Upload PDF</label>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="pdf-upload"
                  required
                />
                <label htmlFor="pdf-upload" className="cursor-pointer">
                  <span className="text-sm text-blue-500 dark:text-blue-300 font-medium">
                    Choose file
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400"> or drag and drop</span>
                </label>
                {file && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{file.name}</p>
                )}
              </div>
            </div>
          )}

          {sourceType === 'github' && (
            <div>
              <label className="block text-sm font-medium mb-2">GitHub Repository</label>
              <input
                type="text"
                value={formData.github_repo}
                onChange={(e) => setFormData({ ...formData, github_repo: e.target.value })}
                placeholder="owner/repo (e.g., vercel/next.js)"
                className="input"
                required
              />
            </div>
          )}

          {sourceType === 'mcp' && (
            <div>
              <label className="block text-sm font-medium mb-2">MCP Server Endpoint</label>
              <input
                type="url"
                value={formData.mcp_endpoint}
                onChange={(e) => setFormData({ ...formData, mcp_endpoint: e.target.value })}
                placeholder="https://mcp-server.example.com"
                className="input"
                required
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Description (optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of what this source contains..."
              className="input"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={uploading} className="btn-primary flex-1 disabled:opacity-50">
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  Adding...
                </>
              ) : (
                'Add Source'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CapabilityGraph({ capabilities, onSelectCapability }: {
  capabilities: any[]
  onSelectCapability: (capability: any) => void
}) {
  return (
    <Card>
      <div className="p-6">
        <h2 className="text-xl font-bold text-heading mb-4">Capability Architecture</h2>

        {capabilities.length === 0 ? (
          <div className="text-center py-12">
            <Network className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No capabilities extracted yet
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Add documentation sources to automatically extract and visualize your product capabilities
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Simple list view for now - can be enhanced with actual graph visualization */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {capabilities.map((capability) => (
                <button
                  key={capability.id}
                  onClick={() => onSelectCapability(capability)}
                  className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-300 transition text-left"
                >
                  <h3 className="font-semibold text-heading mb-1">{capability.name}</h3>
                  <p className="text-sm text-body line-clamp-2">{capability.description}</p>
                  {capability.dependencies && capability.dependencies.length > 0 && (
                    <div className="mt-2 text-xs text-muted">
                      Depends on: {capability.dependencies.length} capabilities
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

function CapabilityDetailModal({ capability, onClose }: {
  capability: any
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold">{capability.name}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</h3>
            <p className="text-sm text-body">{capability.description}</p>
          </div>

          {capability.dependencies && capability.dependencies.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Dependencies</h3>
              <div className="flex flex-wrap gap-2">
                {capability.dependencies.map((dep: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-sm"
                  >
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          )}

          {capability.endpoints && capability.endpoints.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">API Endpoints</h3>
              <div className="space-y-2">
                {capability.endpoints.map((endpoint: any, idx: number) => (
                  <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <code className="text-sm">
                      <span className="text-green-600 dark:text-green-400 font-semibold">{endpoint.method}</span>
                      {' '}
                      <span className="text-gray-900 dark:text-white">{endpoint.path}</span>
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {capability.source && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Source</h3>
              <a
                href={capability.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-500 dark:text-blue-300 hover:underline"
              >
                {capability.source.name}
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
