import { useState, useEffect } from 'react'
import { Save, Loader2, CheckCircle } from 'lucide-react'
import { api } from '@/services/api'
import { Card, Loading } from '@/components/PageContainer'

const KNOWLEDGE_TABS = [
  { id: 'strategy', name: 'Product Strategy', description: 'Vision, mission, and strategic pillars' },
  { id: 'customer_segments', name: 'Customer Segments', description: 'Target personas and market segments' },
  { id: 'competitive_landscape', name: 'Competitive Landscape', description: 'Competitors and market positioning' },
  { id: 'value_proposition', name: 'Value Proposition', description: 'Unique value and differentiation' },
  { id: 'metrics_and_targets', name: 'Metrics & Targets', description: 'KPIs, goals, and success metrics' }
]

export default function StrategyTab() {
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
    loadKnowledge()
  }, [])

  const loadKnowledge = async () => {
    try {
      const response = await api.get('/knowledge')
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
      await api.put('/knowledge', {
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

  if (loading) {
    return <Loading text="Loading strategy..." />
  }

  return (
    <div>
      {/* Info Banner */}
      <div className="mb-6 p-4 bg-primary/5 dark:bg-primary/10 border border-primary/30 dark:border-primary/20 rounded-lg">
        <p className="text-sm text-primary/85 dark:text-primary">
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
                ? 'bg-secondary text-secondary-foreground border border-primary/30 shadow-sm'
                : 'bg-card text-muted-foreground hover:bg-muted border border-border'
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
              <h3 className="text-lg text-foreground mb-1">
                {KNOWLEDGE_TABS.find(t => t.id === activeTab)?.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {KNOWLEDGE_TABS.find(t => t.id === activeTab)?.description}
              </p>
            </div>

            {saved && (
              <div className="flex items-center gap-2 text-chart-3 text-sm">
                <CheckCircle className="w-4 h-4" />
                Saved
              </div>
            )}
          </div>

          <textarea
            value={content[activeTab] || ''}
            onChange={(e) => setContent({ ...content, [activeTab]: e.target.value })}
            className="w-full h-96 p-4 border border-border rounded-lg bg-input text-foreground font-mono text-sm focus:ring-2 focus:ring-ring/50 focus:border-transparent resize-y"
            placeholder={`Enter your ${KNOWLEDGE_TABS.find(t => t.id === activeTab)?.name.toLowerCase()} here...\n\nSupports Markdown formatting:\n- # Heading\n- **Bold** and *Italic*\n- - Bullet lists\n- 1. Numbered lists\n- [Links](url)`}
          />

          <div className="flex justify-between items-center mt-4">
            <p className="text-xs text-muted-foreground">
              {content[activeTab]?.length || 0} characters
            </p>

            <button
              onClick={saveKnowledge}
              disabled={saving}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
      <div className="mt-6 p-6 bg-muted/30 border border-border rounded-lg">
        <h4 className="text-foreground mb-3">
          💡 Tips for Each Section
        </h4>

        <div className="space-y-3 text-sm text-muted-foreground">
          <div>
            <strong className="text-foreground">Product Strategy:</strong> What are your strategic pillars?
            What&apos;s your vision and mission? What are you optimizing for?
          </div>

          <div>
            <strong className="text-foreground">Customer Segments:</strong> Who are your target customers?
            What are their characteristics, pain points, and goals?
          </div>

          <div>
            <strong className="text-foreground">Competitive Landscape:</strong> Who are your main competitors?
            How do you differentiate? What&apos;s your positioning?
          </div>

          <div>
            <strong className="text-foreground">Value Proposition:</strong> What unique value do you provide?
            Why should customers choose you?
          </div>

          <div>
            <strong className="text-foreground">Metrics & Targets:</strong> What are your key KPIs?
            What are your goals for the next quarter/year?
          </div>
        </div>
      </div>
    </div>
  )
}
