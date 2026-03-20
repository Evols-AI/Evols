import { useState, useEffect } from 'react'
import { Save, Loader2, CheckCircle } from 'lucide-react'
import { api } from '@/services/api'
import { Card } from '@/components/PageContainer'

const KNOWLEDGE_TABS = [
  { id: 'strategy', name: 'Product Strategy', description: 'Vision, mission, and strategic pillars' },
  { id: 'customer_segments', name: 'Customer Segments', description: 'Target personas and market segments' },
  { id: 'competitive_landscape', name: 'Competitive Landscape', description: 'Competitors and market positioning' },
  { id: 'value_proposition', name: 'Value Proposition', description: 'Unique value and differentiation' },
  { id: 'metrics_and_targets', name: 'Metrics & Targets', description: 'KPIs, goals, and success metrics' }
]

interface StrategyTabProps {
  productId: number | undefined
}

export default function StrategyTab({ productId }: StrategyTabProps) {
  const [activeTab, setActiveTab] = useState('strategy')
  const [content, setContent] = useState<Record<string, string>>({
    strategy: '',
    customer_segments: '',
    competitive_landscape: '',
    value_proposition: '',
    metrics_and_targets: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (productId) {
      loadKnowledge()
    } else {
      setLoading(false)
    }
  }, [productId])

  const loadKnowledge = async () => {
    try {
      const response = await api.get(`/knowledge/products/${productId}/knowledge`)
      setContent({
        strategy: response.data.strategy_doc || '',
        customer_segments: response.data.customer_segments_doc || '',
        competitive_landscape: response.data.competitive_landscape_doc || '',
        value_proposition: response.data.value_proposition_doc || '',
        metrics_and_targets: response.data.metrics_and_targets_doc || ''
      })
    } catch (err) {
      console.error('Failed to load knowledge', err)
    } finally {
      setLoading(false)
    }
  }

  const saveKnowledge = async () => {
    setSaving(true)
    setSaved(false)

    try {
      await api.put(`/knowledge/products/${productId}/knowledge`, {
        doc_type: activeTab,
        content: content[activeTab] || ''
      })

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Failed to save', err)
      alert('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!productId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Please select a product first</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div>
      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          💡 <strong>Document your product context</strong> - AI skills will reference this information to provide personalized,
          context-aware recommendations instead of generic advice.
        </p>
      </div>

      {/* Strategy Doc Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {KNOWLEDGE_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Editor Card */}
      <Card>
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                {KNOWLEDGE_TABS.find(t => t.id === activeTab)?.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {KNOWLEDGE_TABS.find(t => t.id === activeTab)?.description}
              </p>
            </div>

            {saved && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                <CheckCircle className="w-4 h-4" />
                Saved
              </div>
            )}
          </div>

          <textarea
            value={content[activeTab] || ''}
            onChange={(e) => setContent({ ...content, [activeTab]: e.target.value })}
            className="w-full h-96 p-4 border border-gray-300 dark:border-gray-700 rounded-lg
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                       font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       resize-y"
            placeholder={`Enter your ${KNOWLEDGE_TABS.find(t => t.id === activeTab)?.name.toLowerCase()} here...\n\nSupports Markdown formatting:\n- # Heading\n- **Bold** and *Italic*\n- - Bullet lists\n- 1. Numbered lists\n- [Links](url)`}
          />

          <div className="flex justify-between items-center mt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {content[activeTab]?.length || 0} characters
            </p>

            <button
              onClick={saveKnowledge}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400
                         disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg
                         font-medium transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </Card>

      {/* Help Section */}
      <div className="mt-6 p-6 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
          💡 Tips for Each Section
        </h4>

        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <strong className="text-gray-900 dark:text-white">Product Strategy:</strong> What are your strategic pillars?
            What's your vision and mission? What are you optimizing for?
          </div>

          <div>
            <strong className="text-gray-900 dark:text-white">Customer Segments:</strong> Who are your target customers?
            What are their characteristics, pain points, and goals?
          </div>

          <div>
            <strong className="text-gray-900 dark:text-white">Competitive Landscape:</strong> Who are your main competitors?
            How do you differentiate? What's your positioning?
          </div>

          <div>
            <strong className="text-gray-900 dark:text-white">Value Proposition:</strong> What unique value do you provide?
            Why should customers choose you?
          </div>

          <div>
            <strong className="text-gray-900 dark:text-white">Metrics & Targets:</strong> What are your key KPIs?
            What are your goals for the next quarter/year?
          </div>
        </div>
      </div>
    </div>
  )
}
