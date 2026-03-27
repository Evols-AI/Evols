import Head from 'next/head'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
  Database, Plus, Upload, FileText, MessageSquare, Mail, Slack,
  Github, BookOpen, Cloud, X, Loader2, Filter, Search, Calendar,
  Building2, User, Lightbulb, AlertCircle, Zap, Users, Target, Trash2, Sparkles, Check, RefreshCw, Book
} from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, Card, EmptyState, Loading } from '@/components/PageContainer'
import { useProducts } from '@/hooks/useProducts'
import { confirmDemoOperation } from '@/utils/demoWarning'
import StrategyTab from '@/components/context/StrategyTab'

type ViewType = 'sources' | 'entities' | 'insights' | 'strategy'

export default function Context() {
  const router = useRouter()
  const { selectedProductIds } = useProducts()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedView, setSelectedView] = useState<ViewType>('sources')
  const [contextSources, setContextSources] = useState<any[]>([])
  const [sourceGroups, setSourceGroups] = useState<any[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())
  const [extractedEntities, setExtractedEntities] = useState<any[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedEntityType, setSelectedEntityType] = useState<string>('all')

  const productId = selectedProductIds[0]

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    const currentUser = getCurrentUser()
    setUser(currentUser)

    // Check URL params for tab
    const { tab } = router.query
    if (tab && ['sources', 'entities', 'insights', 'strategy'].includes(tab as string)) {
      setSelectedView(tab as ViewType)
    }

    if (selectedProductIds.length > 0) {
      loadContext()
    } else {
      setLoading(false)
    }
  }, [router, selectedProductIds])

  const handleTabChange = (view: ViewType) => {
    setSelectedView(view)
    router.push(`/context?tab=${view}`, undefined, { shallow: true })
  }

  const loadContext = async () => {
    try {
      setLoading(true)
      const productIdsParam = selectedProductIds.join(',')

      const [sourcesRes, groupsRes, entitiesRes, personasRes] = await Promise.all([
        api.context.getSources({ product_ids: productIdsParam }),
        api.context.getSourceGroups({ product_ids: productIdsParam }),
        api.context.getEntities({ product_ids: productIdsParam }),
        api.getPersonas(productIdsParam, { status_filter: 'new,active,inactive' })
      ])

      const allSources = Array.isArray(sourcesRes.data) ? sourcesRes.data : []
      const groups = Array.isArray(groupsRes.data) ? groupsRes.data : []

      // Separate ungrouped sources (sources without source_group_id)
      const ungroupedSources = allSources.filter((s: any) => !s.source_group_id)

      setContextSources(ungroupedSources)
      setSourceGroups(groups)

      // Get list of already promoted entity IDs
      const personas = personasRes.data.items || personasRes.data || []
      const promotedEntityIds = new Set(
        personas
          .filter((p: any) => p.extra_data?.promoted_from_entity_id)
          .map((p: any) => p.extra_data.promoted_from_entity_id)
      )

      // Mark entities as promoted if they exist in managed personas
      const entities = Array.isArray(entitiesRes.data) ? entitiesRes.data : []
      const entitiesWithPromotedFlag = entities.map((entity: any) => ({
        ...entity,
        isPromoted: promotedEntityIds.has(entity.id)
      }))

      setExtractedEntities(entitiesWithPromotedFlag)
    } catch (error) {
      console.error('Error loading context:', error)
      setContextSources([])
      setExtractedEntities([])
    } finally {
      setLoading(false)
    }
  }

  const handleAddContext = async () => {
    // Check if LLM is configured before allowing context upload
    try {
      const settingsResponse = await api.getLLMSettings()
      const hasConfig = settingsResponse.data && settingsResponse.data.provider

      if (!hasConfig) {
        alert(
          'LLM Configuration Required\n\n' +
          'AI-powered entity extraction requires LLM credentials to be configured.\n\n' +
          'Please go to Settings → LLM Settings to configure your LLM provider before adding context sources.'
        )
        return
      }

      // LLM is configured, show the modal
      setShowAddModal(true)
    } catch (error) {
      console.error('Error checking LLM settings:', error)
      // If we can't check settings, still allow them to try (they'll get error on upload)
      setShowAddModal(true)
    }
  }

  const handleRefreshContext = async () => {
    if (contextSources.length === 0) {
      alert('No context sources to refresh. Please add context sources first.')
      return
    }

    // Check if LLM is configured
    try {
      const settingsResponse = await api.getLLMSettings()
      const hasConfig = settingsResponse.data && settingsResponse.data.provider

      if (!hasConfig) {
        alert(
          'LLM Configuration Required\n\n' +
          'Entity extraction requires LLM credentials to be configured.\n\n' +
          'Please go to Settings → LLM Settings to configure your LLM provider.'
        )
        return
      }
    } catch (error) {
      console.error('Error checking LLM settings:', error)
      // Continue anyway if we can't check
    }

    if (!confirm('This will re-extract entities from all context sources. Continue?')) {
      return
    }

    setIsRefreshing(true)
    try {
      // Trigger re-extraction for all sources
      await Promise.all(
        contextSources.map(source => api.context.extractEntities(source.id))
      )

      // Reload context to show updated entities
      await loadContext()
      alert('✓ Context refresh completed successfully!')
    } catch (error: any) {
      console.error('Error refreshing context:', error)
      alert(`Failed to refresh context: ${error.response?.data?.detail || error.message}`)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleDeleteSourceGroup = async (groupId: number, groupName: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent expanding/collapsing the group

    if (!confirm(`Delete source group "${groupName}" and all its sources? This will also delete all extracted entities.`)) {
      return
    }

    try {
      await api.context.deleteSourceGroup(groupId)
      await loadContext() // Reload to show updated list
    } catch (error: any) {
      console.error('Error deleting source group:', error)
      alert(`Failed to delete source group: ${error.response?.data?.detail || error.message}`)
    }
  }

  const filteredSources = contextSources.filter(source => {
    const matchesSearch = source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (source.description && source.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesType = filterType === 'all' || source.source_type === filterType
    const matchesStatus = filterStatus === 'all' || source.status === filterStatus
    return matchesSearch && matchesType && matchesStatus
  })

  const filteredEntities = extractedEntities.filter(entity => {
    const matchesSearch = entity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (entity.description && entity.description.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesSearch
  })

  return (
    <>
      <Head>
        <title>Knowledge - Evols</title>
      </Head>

      <div className="min-h-screen">
        <Header user={user} currentPage="context" />

        <PageContainer>
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Database className="w-8 h-8" style={{ color: 'hsl(var(--primary))' }} />
                  <h1 className="page-title mb-0">
                    Knowledge
                  </h1>
                </div>
                <p className="page-subtitle mt-2">
                  Product strategy, customer intelligence, and extracted insights from all sources
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefreshContext}
                  disabled={isRefreshing}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                  title="Re-extract entities from all sources"
                >
                  {isRefreshing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {isRefreshing ? 'Refreshing...' : 'Refresh Intelligence'}
                </button>
                <button
                  onClick={handleAddContext}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Source
                </button>
              </div>
            </div>
          </div>

          {selectedProductIds.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-body mb-2">No product selected</p>
              <p className="text-sm text-muted">
                Please select a product from the dropdown above to view context sources.
              </p>
            </Card>
          ) : loading ? (
            <Card>
              <Loading text="Loading context..." />
            </Card>
          ) : (
            <>
              {/* Primary Tabs */}
              <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleTabChange('strategy')}
                      className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
                        selectedView === 'strategy'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <Book className="w-4 h-4 inline mr-2" />
                      Strategy Docs
                    </button>
                    <button
                      onClick={() => handleTabChange('sources')}
                      className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
                        selectedView === 'sources'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <Database className="w-4 h-4 inline mr-2" />
                      Feedback Sources ({sourceGroups.length + contextSources.length})
                    </button>
                    <button
                      onClick={() => {
                        handleTabChange('entities')
                        setSelectedEntityType('all')
                      }}
                      className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
                        selectedView === 'entities'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <Lightbulb className="w-4 h-4 inline mr-2" />
                      Extracted Intelligence ({extractedEntities.length})
                    </button>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search..."
                      className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Secondary Tabs (Entity Type Filter) - Only show for Extracted Intelligence */}
              {selectedView === 'entities' && (
                <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedEntityType('all')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                        selectedEntityType === 'all'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <Target className="w-4 h-4" />
                      All
                    </button>
                    <button
                      onClick={() => setSelectedEntityType('persona')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                        selectedEntityType === 'persona'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      Personas
                    </button>
                    <button
                      onClick={() => setSelectedEntityType('pain_point')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                        selectedEntityType === 'pain_point'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <AlertCircle className="w-4 h-4" />
                      Pain Points
                    </button>
                    <button
                      onClick={() => setSelectedEntityType('feature_request')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                        selectedEntityType === 'feature_request'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <Lightbulb className="w-4 h-4" />
                      Feature Requests
                    </button>
                    <button
                      onClick={() => setSelectedEntityType('use_case')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                        selectedEntityType === 'use_case'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <Target className="w-4 h-4" />
                      Use Cases
                    </button>
                    <button
                      onClick={() => setSelectedEntityType('product_capability')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                        selectedEntityType === 'product_capability'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <Zap className="w-4 h-4" />
                      Capabilities
                    </button>
                    <button
                      onClick={() => setSelectedEntityType('competitor')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                        selectedEntityType === 'competitor'
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      Competitors
                    </button>
                  </div>
                </div>
              )}

              {/* Content Views */}
              {selectedView === 'strategy' ? (
                <StrategyTab productId={productId} />
              ) : selectedView === 'sources' ? (
                <SourcesView
                  sources={filteredSources}
                  groups={sourceGroups}
                  expandedGroups={expandedGroups}
                  onToggleGroup={(groupId) => {
                    const newExpanded = new Set(expandedGroups)
                    if (newExpanded.has(groupId)) {
                      newExpanded.delete(groupId)
                    } else {
                      newExpanded.add(groupId)
                    }
                    setExpandedGroups(newExpanded)
                  }}
                  onRefresh={loadContext}
                  onDeleteGroup={handleDeleteSourceGroup}
                />
              ) : selectedView === 'entities' ? (
                <EntitiesView
                  entities={filteredEntities}
                  selectedEntityType={selectedEntityType}
                  onRefresh={loadContext}
                  setEntities={setExtractedEntities}
                  selectedProductIds={selectedProductIds}
                />
              ) : (
                <InsightsView sources={contextSources} entities={extractedEntities} />
              )}
            </>
          )}
        </PageContainer>

        {/* Add Context Modal */}
        {showAddModal && (
          <AddContextModal
            selectedProductIds={selectedProductIds}
            onClose={() => setShowAddModal(false)}
            onSuccess={() => {
              setShowAddModal(false)
              loadContext()
            }}
          />
        )}
      </div>
    </>
  )
}

function SourcesView({
  sources,
  groups,
  expandedGroups,
  onToggleGroup,
  onRefresh,
  onDeleteGroup
}: {
  sources: any[]
  groups: any[]
  expandedGroups: Set<number>
  onToggleGroup: (groupId: number) => void
  onRefresh: () => void
  onDeleteGroup: (groupId: number, groupName: string, e: React.MouseEvent) => void
}) {
  const [groupSources, setGroupSources] = React.useState<Record<number, any[]>>({})
  const [loadingGroupId, setLoadingGroupId] = React.useState<number | null>(null)

  const loadGroupSources = async (groupId: number) => {
    if (groupSources[groupId]) return // Already loaded

    setLoadingGroupId(groupId)
    try {
      const response = await api.context.getSourceGroupSources(groupId)
      setGroupSources(prev => ({ ...prev, [groupId]: response.data }))
    } catch (error) {
      console.error('Error loading group sources:', error)
    } finally {
      setLoadingGroupId(null)
    }
  }

  const handleToggleGroup = async (groupId: number) => {
    if (!expandedGroups.has(groupId)) {
      await loadGroupSources(groupId)
    }
    onToggleGroup(groupId)
  }

  if (sources.length === 0 && groups.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Database}
          title="No context sources yet"
          description="Start building your context by adding customer feedback, product docs, meeting transcripts, or any other relevant data"
          action={null}
        />
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Source Groups */}
      {groups.map((group) => (
        <div key={`group-${group.id}`}>
          <button
            onClick={() => handleToggleGroup(group.id)}
            className="w-full text-left text-gray-900 dark:text-white"
          >
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database className="w-6 h-6 text-blue-500" />
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{group.name}</h3>
                      {group.description && (
                        <p className="text-sm text-gray-700 dark:text-gray-400 mt-1">{group.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm text-gray-700 dark:text-gray-400">
                        {group.sources_count} sources
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-400">
                        {group.total_entities} entities
                      </div>
                    </div>
                    <button
                      onClick={(e) => onDeleteGroup(group.id, group.name, e)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                      title="Delete source group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <svg
                      className={`w-5 h-5 text-gray-700 dark:text-gray-400 transition-transform ${
                        expandedGroups.has(group.id) ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </div>
                </div>
              </div>
            </Card>
          </button>

          {/* Expanded Group Sources */}
          {expandedGroups.has(group.id) && (
            <div className="mt-4 ml-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {loadingGroupId === group.id ? (
                <div className="col-span-2 text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                </div>
              ) : (
                groupSources[group.id]?.map((source: any) => (
                  <ContextSourceCard key={source.id} source={source} onRefresh={onRefresh} />
                ))
              )}
            </div>
          )}
        </div>
      ))}

      {/* Ungrouped Sources */}
      {sources.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sources.map((source) => (
            <ContextSourceCard key={source.id} source={source} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </div>
  )
}

function EntitiesView({
  entities,
  selectedEntityType,
  onRefresh,
  setEntities,
  selectedProductIds
}: {
  entities: any[]
  selectedEntityType: string
  onRefresh: () => void
  setEntities: (entities: any[]) => void
  selectedProductIds: number[]
}) {
  const filteredByType = selectedEntityType === 'all'
    ? entities
    : entities.filter(e => e.entity_type === selectedEntityType)

  const handlePromotePersona = async (entity: any) => {
    try {
      const promoteData = {
        name: entity.name,
        persona_summary: entity.description,
        segment: entity.category || 'Mid-Market',
        key_pain_points: entity.attributes?.pain_points || [],
        feature_priorities: entity.attributes?.priorities || [],
        confidence_score: entity.confidence_score || 0.7, // Ensure we have a value
        status: 'active',
        product_id: selectedProductIds[0] || null,
        extra_data: {
          promoted_from_entity_id: entity.id,
          original_source: 'extracted_entity',
          original_confidence_score: entity.confidence_score // Store original for reference
        }
      }

      await api.createPersona(promoteData)

      // Reload only entities data to update the promoted flag (without changing tab)
      const productIdsParam = selectedProductIds.join(',')
      const [entitiesRes, personasRes] = await Promise.all([
        api.context.getEntities({ product_ids: productIdsParam }),
        api.getPersonas(productIdsParam, { status_filter: 'new,active,inactive' })
      ])

      // Get list of already promoted entity IDs
      const personas = personasRes.data.items || personasRes.data || []
      const promotedEntityIds = new Set(
        personas
          .filter((p: any) => p.extra_data?.promoted_from_entity_id)
          .map((p: any) => p.extra_data.promoted_from_entity_id)
      )

      // Mark entities as promoted if they exist in managed personas
      const entitiesData = Array.isArray(entitiesRes.data) ? entitiesRes.data : []
      const entitiesWithPromotedFlag = entitiesData.map((e: any) => ({
        ...e,
        isPromoted: promotedEntityIds.has(e.id)
      }))

      // Update entities in parent component without changing tab
      setEntities(entitiesWithPromotedFlag)

      alert('✓ Persona promoted to managed successfully!')
    } catch (error: any) {
      console.error('Error promoting persona:', error)
      alert(`Failed to promote persona: ${error.response?.data?.detail || error.message}`)
    }
  }

  return (
    <>
      {/* Entities Grid */}
      {filteredByType.length === 0 ? (
        <Card>
          <EmptyState
            icon={Lightbulb}
            title="No extracted entities yet"
            description="Add context sources and our AI will automatically extract personas, pain points, capabilities, and more"
            action={null}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredByType.map((entity) => (
            <EntityCard key={entity.id} entity={entity} onPromote={handlePromotePersona} />
          ))}
        </div>
      )}
    </>
  )
}

function InsightsView({ sources, entities }: { sources: any[]; entities: any[] }) {
  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Database className="w-8 h-8 text-blue-500" />
              <span className="text-3xl font-bold">{sources.length}</span>
            </div>
            <p className="text-sm text-muted">Context Sources</p>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-purple-500" />
              <span className="text-3xl font-bold">
                {entities.filter(e => e.entity_type === 'persona').length}
              </span>
            </div>
            <p className="text-sm text-muted">Personas</p>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <span className="text-3xl font-bold">
                {entities.filter(e => e.entity_type === 'pain_point').length}
              </span>
            </div>
            <p className="text-sm text-muted">Pain Points</p>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Zap className="w-8 h-8 text-yellow-500" />
              <span className="text-3xl font-bold">
                {entities.filter(e => e.entity_type === 'product_capability').length}
              </span>
            </div>
            <p className="text-sm text-muted">Capabilities</p>
          </div>
        </Card>
      </div>

      {/* Coming Soon */}
      <Card>
        <div className="p-12 text-center">
          <Zap className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
          <h3 className="text-xl font-semibold mb-2">AI-Powered Insights Coming Soon</h3>
          <p className="text-muted max-w-2xl mx-auto">
            Get automatic trend analysis, sentiment tracking, opportunity identification, and strategic recommendations based on your context data
          </p>
        </div>
      </Card>
    </div>
  )
}

function ContextSourceCard({ source, onRefresh }: { source: any; onRefresh: () => void }) {
  const [deleting, setDeleting] = React.useState(false)
  const [extracting, setExtracting] = React.useState(false)

  const getSourceIcon = (type: string) => {
    const iconMap: Record<string, any> = {
      'csv_survey': FileText,
      'meeting_transcript': MessageSquare,
      'email': Mail,
      'slack_conversation': Slack,
      'document_pdf': FileText,
      'web_page': BookOpen,
      'github_repo': Github,
      'intercom': MessageSquare,
      'support_ticket': AlertCircle,
    }
    const Icon = iconMap[type] || Database
    return <Icon className="w-5 h-5" />
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'processing': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      case 'failed': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      case 'pending': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${source.name}"?`)) return

    setDeleting(true)
    try {
      await api.context.deleteSource(source.id)
      onRefresh()
    } catch (err) {
      console.error('Failed to delete source:', err)
      alert('Failed to delete source')
    } finally {
      setDeleting(false)
    }
  }

  const handleExtract = async () => {
    setExtracting(true)
    try {
      await api.context.extractEntities(source.id)
      onRefresh()
    } catch (err) {
      console.error('Failed to extract entities:', err)
      alert('Failed to extract entities')
    } finally {
      setExtracting(false)
    }
  }

  return (
    <Card className="relative">
      <div className="p-6">
        {/* Delete button in top right */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition disabled:opacity-50"
          title="Delete source"
        >
          {deleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>

        <div className="flex items-start gap-4 pr-8">
          <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            {getSourceIcon(source.source_type)}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{source.name}</h3>
            {source.description && (
              <p className="text-sm text-gray-700 dark:text-gray-400 mb-2 line-clamp-2">{source.description}</p>
            )}
            {source.content_summary && (
              <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 mb-3">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>Content deleted:</strong> {source.content_summary}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(source.status)}`}>
                {source.status}
              </span>
              {source.entities_extracted_count > 0 && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  {source.entities_extracted_count} entities
                </span>
              )}
              {source.content_deleted_at && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" title={`Content deleted on ${new Date(source.content_deleted_at).toLocaleDateString()}`}>
                  🔒 Content deleted
                </span>
              )}
              {source.is_encrypted && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" title="Content encrypted">
                  🔐 Encrypted
                </span>
              )}
              {source.deletion_scheduled_for && !source.content_deleted_at && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" title={`Scheduled for deletion on ${new Date(source.deletion_scheduled_for).toLocaleDateString()}`}>
                  ⏱️ Scheduled: {new Date(source.deletion_scheduled_for).toLocaleDateString()}
                </span>
              )}
              <span className="text-xs text-gray-700 dark:text-gray-400">
                {new Date(source.created_at).toLocaleDateString()}
              </span>
            </div>

            {(source.status === 'pending' || source.status === 'failed') && (
              <button
                onClick={handleExtract}
                disabled={extracting}
                className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
              >
                {extracting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  'Extract Entities'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

function EntityCard({ entity, onPromote }: { entity: any; onPromote: (entity: any) => void }) {
  const getEntityIcon = (type: string) => {
    const iconMap: Record<string, any> = {
      'persona': Users,
      'pain_point': AlertCircle,
      'use_case': Target,
      'feature_request': Lightbulb,
      'product_capability': Zap,
      'stakeholder': User,
      'competitor': Building2,
    }
    const Icon = iconMap[type] || Target
    return <Icon className="w-5 h-5" />
  }

  const getEntityColor = (type: string) => {
    const colorMap: Record<string, string> = {
      'persona': 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
      'pain_point': 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
      'use_case': 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      'feature_request': 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
      'product_capability': 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
      'stakeholder': 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
      'competitor': 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    }
    return colorMap[type] || 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400'
  }

  return (
    <Card>
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className={`p-2 rounded-lg ${getEntityColor(entity.entity_type)}`}>
            {getEntityIcon(entity.entity_type)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">{entity.name}</h4>
            <p className="text-xs text-gray-700 dark:text-gray-400 line-clamp-2">{entity.description}</p>
          </div>
        </div>

        {entity.confidence_score && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-700 dark:text-gray-400">Confidence</span>
              <span className="font-medium text-gray-900 dark:text-white">{Math.round(entity.confidence_score * 100)}%</span>
            </div>
          </div>
        )}

        {/* Promote button for persona entities that haven't been promoted yet */}
        {entity.entity_type === 'persona' && !entity.isPromoted && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => onPromote(entity)}
              className="w-full text-sm px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Promote to Managed
            </button>
          </div>
        )}

        {/* Already promoted badge */}
        {entity.entity_type === 'persona' && entity.isPromoted && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-center py-2 px-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg flex items-center justify-center gap-2">
              <Check className="w-3.5 h-3.5" />
              Already Managed
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export function AddContextModal({
  selectedProductIds,
  onClose,
  onSuccess
}: {
  selectedProductIds: number[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [step, setStep] = useState<'select-type' | 'upload'>('select-type')
  const [sourceType, setSourceType] = useState('')
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [retentionPolicy, setRetentionPolicy] = useState('30_days')
  const [error, setError] = useState('')

  const sourceTypes = [
    {
      category: 'Customer Feedback',
      types: [
        { value: 'csv_survey', label: 'Survey CSV', icon: FileText, enabled: true },
        { value: 'support_ticket', label: 'Support Tickets', icon: AlertCircle, enabled: true },
        { value: 'intercom', label: 'Intercom', icon: MessageSquare, enabled: false, comingSoon: true },
      ]
    },
    {
      category: 'Meetings & Communication',
      types: [
        { value: 'meeting_transcript', label: 'Meeting Transcript', icon: MessageSquare, enabled: true },
        { value: 'email', label: 'Email Thread', icon: Mail, enabled: true },
        { value: 'slack_conversation', label: 'Slack Messages', icon: Slack, enabled: true },
      ]
    },
    {
      category: 'Documentation',
      types: [
        { value: 'document_pdf', label: 'PDF Document', icon: FileText, enabled: true },
        { value: 'web_page', label: 'Web Page / URL', icon: BookOpen, enabled: false, comingSoon: true },
        { value: 'github_repo', label: 'GitHub Repository', icon: Github, enabled: false, comingSoon: true },
      ]
    },
    {
      category: 'Integrations',
      types: [
        { value: 'slack_integration', label: 'Slack (Live)', icon: Slack, enabled: false, comingSoon: true },
        { value: 'confluence', label: 'Confluence', icon: Cloud, enabled: false, comingSoon: true },
        { value: 'gmail_api', label: 'Gmail API', icon: Mail, enabled: false, comingSoon: true },
      ]
    }
  ]

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      // Auto-fill name from filename if empty
      if (!name) {
        setName(selectedFile.name.replace(/\.[^/.]+$/, ''))
      }
      setError('')
    }
  }

  const handleUpload = async () => {
    if (!file || !name) {
      setError('Please select a file and enter a name')
      return
    }

    if (selectedProductIds.length === 0) {
      setError('Please select a product first')
      return
    }

    setUploading(true)
    setError('')

    const formData = new FormData()
    try {
      formData.append('file', file)
      formData.append('name', name)
      formData.append('product_id', selectedProductIds[0].toString())
      formData.append('source_type', sourceType)
      formData.append('retention_policy', retentionPolicy)
      if (description) {
        formData.append('description', description)
      }

      const response = await api.context.uploadFile(formData)

      // Check if upload succeeded but extraction failed
      if (response.data.error_message) {
        setError(response.data.error_message)
      } else {
        onSuccess()
      }
    } catch (err: any) {
      // Handle duplicate content error (409)
      if (err.response?.status === 409 && err.response?.data?.detail?.error === 'duplicate_content') {
        const detail = err.response.data.detail
        const existingSource = detail.existing_source

        const choice = confirm(
          `⚠️ Duplicate Content Detected\n\n` +
          `This content appears identical to "${existingSource.name}" uploaded on ${new Date(existingSource.created_at).toLocaleDateString()}.\n\n` +
          `Would you like to link to the existing source instead? This will save storage and prevent duplicate entity extraction.\n\n` +
          `Click OK to link to existing source (recommended)\n` +
          `Click Cancel to upload anyway as a separate source`
        )

        if (choice) {
          // Link to existing source
          setError('')
          onSuccess() // Close modal and refresh
          alert('✓ Linked to existing source successfully')
        } else {
          // User wants to upload anyway - add force flag
          formData.append('force_duplicate', 'true')
          try {
            const retryResponse = await api.context.uploadFile(formData)
            if (retryResponse.data.error_message) {
              setError(retryResponse.data.error_message)
            } else {
              onSuccess()
            }
          } catch (retryErr: any) {
            setError(retryErr.response?.data?.detail || 'Failed to upload file')
          }
        }
      } else {
        // Handle other errors
        const errorMessage = typeof err.response?.data?.detail === 'string'
          ? err.response.data.detail
          : err.response?.data?.detail?.message || 'Failed to upload file'
        setError(errorMessage)
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-2xl font-bold">
            {step === 'select-type' ? 'Select Source Type' : 'Upload File'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'select-type' ? (
          <div className="p-6 space-y-8">
            {sourceTypes.map((category) => (
              <div key={category.category}>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  {category.category}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {category.types.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => {
                        if (type.enabled) {
                          setSourceType(type.value)
                          setStep('upload')
                        }
                      }}
                      disabled={!type.enabled}
                      className={`p-4 rounded-lg border-2 transition text-left relative ${
                        !type.enabled
                          ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                      }`}
                    >
                      <type.icon className="w-6 h-6 mb-2 text-gray-600 dark:text-gray-400" />
                      <div className="text-sm font-medium">{type.label}</div>
                      {type.comingSoon && (
                        <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-medium">
                          Soon
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">Upload File</label>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".txt,.csv,.pdf,.md,.json"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <Upload className="w-12 h-12 text-gray-400 mb-3" />
                  {file ? (
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {file.name}
                    </p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        TXT, CSV, PDF, MD, JSON files supported
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-2">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Q1 Customer Survey"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this context source..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Data Retention Policy */}
            <div>
              <label className="block text-sm font-medium mb-2">Data Retention Policy</label>
              <div className="space-y-3">
                <label className={`relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition ${
                  retentionPolicy === 'delete_immediately'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}>
                  <input
                    type="radio"
                    name="retention"
                    value="delete_immediately"
                    checked={retentionPolicy === 'delete_immediately'}
                    onChange={(e) => setRetentionPolicy(e.target.value)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">🔒 Maximum Privacy</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Delete original file after AI extraction completes. You'll keep extracted insights and short quotes.
                    </p>
                  </div>
                </label>

                <label className={`relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition ${
                  retentionPolicy === '30_days'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}>
                  <input
                    type="radio"
                    name="retention"
                    value="30_days"
                    checked={retentionPolicy === '30_days'}
                    onChange={(e) => setRetentionPolicy(e.target.value)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">⚖️ Balanced</span>
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Keep original for 30 days, then auto-delete. Allows re-extraction if needed.
                    </p>
                  </div>
                </label>

                <label className={`relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition ${
                  retentionPolicy === '90_days'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}>
                  <input
                    type="radio"
                    name="retention"
                    value="90_days"
                    checked={retentionPolicy === '90_days'}
                    onChange={(e) => setRetentionPolicy(e.target.value)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">📅 Extended Retention</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Keep original for 90 days, then auto-delete.
                    </p>
                  </div>
                </label>

                <label className={`relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition ${
                  retentionPolicy === 'retain_encrypted'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}>
                  <input
                    type="radio"
                    name="retention"
                    value="retain_encrypted"
                    checked={retentionPolicy === 'retain_encrypted'}
                    onChange={(e) => setRetentionPolicy(e.target.value)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">📁 Full Retention (Encrypted)</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Keep original file indefinitely, encrypted. Best for audit/compliance requirements.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setStep('select-type')}
                disabled={uploading}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                Back
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !file || !name}
                className="flex-1 btn-primary disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
