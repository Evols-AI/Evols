import Head from 'next/head'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
  Database, Plus, Upload, FileText, MessageSquare, Mail, Slack,
  Github, BookOpen, Cloud, X, Loader2, Search,
  Building2, User, Lightbulb, AlertCircle, Zap, Users, Target, Trash2, Check, RefreshCw, Brain, ChevronDown, Network
} from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api, apiClient } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, Card, EmptyState, Loading } from '@/components/PageContainer'
import { useProducts } from '@/hooks/useProducts'
import { confirmDemoOperation } from '@/utils/demoWarning'
import KnowledgeGraphTab from '@/components/context/KnowledgeGraphTab'

type ViewType = 'sources' | 'entities' | 'insights' | 'knowledge_graph'

export default function Context() {
  const router = useRouter()
  const { selectedProductIds } = useProducts()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedView, setSelectedView] = useState<ViewType>('sources')
  const [contextSources, setContextSources] = useState<any[]>([])
  const [sourceGroups, setSourceGroups] = useState<any[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())
  const [graphEntities, setGraphEntities] = useState<any[]>([])
  const [entitiesLoading, setEntitiesLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedEntityType, setSelectedEntityType] = useState<string>('all')
  const [processingSourceIds, setProcessingSourceIds] = useState<Set<number>>(new Set())
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
    if (tab && ['sources', 'entities', 'insights', 'knowledge_graph'].includes(tab as string)) {
      setSelectedView(tab as ViewType)
      if (tab === 'entities') loadGraphEntities()
    }

    if (selectedProductIds.length > 0) {
      loadContext()
    } else {
      setLoading(false)
    }
  }, [router, selectedProductIds])

  // Poll LightRAG processing status for newly uploaded sources
  useEffect(() => {
    if (processingSourceIds.size === 0) return
    const ids = Array.from(processingSourceIds)
    const interval = setInterval(async () => {
      try {
        const res = await apiClient.get('/api/v1/graph/processing-status', {
          params: { source_ids: ids.join(',') },
          validateStatus: () => true,
        })
        if (res.status !== 200) return
        const statuses: Record<string, string> = res.data?.sources ?? {}
        const stillPending = ids.filter(id => {
          const s = statuses[String(id)]
          return s === 'pending' || s === 'processing' || s === 'unknown'
        })
        const done = ids.filter(id => {
          const s = statuses[String(id)]
          return s === 'processed' || s === 'failed'
        })
        if (done.length > 0) {
          setProcessingSourceIds(prev => {
            const next = new Set(prev)
            done.forEach(id => next.delete(id))
            return next
          })
          loadContext() // refresh source list to pick up entity counts
          if (selectedView === 'entities') loadGraphEntities()
        }
        if (stillPending.length === 0) clearInterval(interval)
      } catch {
        // ignore transient errors
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [processingSourceIds])

  const handleTabChange = (view: ViewType) => {
    setSelectedView(view)
    router.push(`/context?tab=${view}`, undefined, { shallow: true })
    if (view === 'entities') loadGraphEntities()
  }

  const loadContext = async () => {
    try {
      setLoading(true)
      const productIdsParam = selectedProductIds.join(',')

      const [sourcesRes, groupsRes] = await Promise.all([
        api.context.getSources({ product_ids: productIdsParam }),
        api.context.getSourceGroups({ product_ids: productIdsParam }),
      ])

      const allSources = Array.isArray(sourcesRes.data) ? sourcesRes.data : []
      const groups = Array.isArray(groupsRes.data) ? groupsRes.data : []
      setContextSources(allSources.filter((s: any) => !s.source_group_id))
      setSourceGroups(groups)
    } catch (error) {
      console.error('Error loading context:', error)
      setContextSources([])
    } finally {
      setLoading(false)
    }
  }

  // Map a LightRAG graph node to the entity shape expected by EntityCard
  function nodeToEntity(node: any): any {
    const props = node.properties ?? {}
    const attrs = props.attributes ?? {}
    // Parse LLM confidence (0-1) from attributes if present
    const llmConf = attrs.confidence != null && attrs.confidence !== 'null'
      ? parseFloat(attrs.confidence) : null
    // 3-signal structural confidence (mirrors KnowledgeGraphTab formula, no degree available here)
    const sourceCount = (props.source_id ?? '').split('<SEP>').filter(Boolean).length || 1
    const descLen = (props.description ?? '').length
    const structConf = 0.4 * Math.min(sourceCount / 5, 1) + 0.3 * Math.min(descLen / 300, 1)
    const confidence = llmConf !== null && !isNaN(llmConf)
      ? 0.25 * Math.min(Math.max(llmConf, 0), 1) + 0.35 * Math.min(sourceCount / 5, 1) + 0.15 * Math.min(descLen / 300, 1)
      : structConf
    // Normalize LightRAG types (stored as lowercase-fused: "painpoint", "featurerequest")
    // to canonical underscore form used by filter buttons and icon/color maps
    const rawType: string = props.entity_type ?? 'other'
    const typeNorm: Record<string, string> = {
      'painpoint': 'pain_point', 'featurerequest': 'feature_request',
      'businessgoal': 'business_goal',
      // PascalCase variants (belt-and-suspenders)
      'PainPoint': 'pain_point', 'FeatureRequest': 'feature_request',
      'BusinessGoal': 'business_goal',
    }
    const normalizedType = typeNorm[rawType] ?? rawType.toLowerCase()
    return {
      id: node.id,
      name: props.entity_id ?? node.id,
      entity_type: normalizedType,
      description: props.description ?? '',
      confidence_score: confidence,
      attributes: attrs,
      source_count: sourceCount,
    }
  }

  const loadGraphEntities = async () => {
    try {
      setEntitiesLoading(true)
      const res = await apiClient.get('/api/v1/graph/graph', { validateStatus: () => true })
      if (res.status !== 200) { setGraphEntities([]); return }
      const nodes: any[] = res.data?.nodes ?? []
      setGraphEntities(nodes.map(nodeToEntity))
    } catch {
      setGraphEntities([])
    } finally {
      setEntitiesLoading(false)
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

  const filteredEntities = graphEntities.filter(entity => {
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
                  <Brain className="w-8 h-8" style={{ color: 'hsl(var(--primary))' }} />
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
                      onClick={() => handleTabChange('sources')}
                      className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
                        selectedView === 'sources'
                          ? 'border-[#A78BFA] text-[#A78BFA] dark:text-[#A78BFA]'
                          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <Database className="w-4 h-4 inline mr-2" />
                      Sources ({sourceGroups.length + contextSources.length})
                    </button>
                    <button
                      onClick={() => {
                        handleTabChange('entities')
                        setSelectedEntityType('all')
                      }}
                      className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
                        selectedView === 'entities'
                          ? 'border-[#A78BFA] text-[#A78BFA] dark:text-[#A78BFA]'
                          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <Lightbulb className="w-4 h-4 inline mr-2" />
                      Entity List ({graphEntities.length})
                    </button>
                    <button
                      onClick={() => handleTabChange('knowledge_graph')}
                      className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
                        selectedView === 'knowledge_graph'
                          ? 'border-[#A78BFA] text-[#A78BFA] dark:text-[#A78BFA]'
                          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <Network className="w-4 h-4 inline mr-2" />
                      Entity Graph
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
                      className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#A78BFA]/50 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Secondary Tabs (Entity Type Filter) - Only show for Extracted Intelligence */}
              {selectedView === 'entities' && (
                <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'all',            label: 'All',              Icon: Target,       active: 'bg-[#A78BFA]/10 text-[#8B5CF6] dark:bg-[#A78BFA]/10 dark:text-[#A78BFA]' },
                      { value: 'persona',        label: 'Personas',         Icon: Users,        active: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
                      { value: 'person',         label: 'People',           Icon: User,         active: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
                      { value: 'pain_point',     label: 'Pain Points',      Icon: AlertCircle,  active: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
                      { value: 'feature_request',label: 'Feature Requests', Icon: Lightbulb,    active: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
                      { value: 'feature',        label: 'Features',         Icon: Zap,          active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
                      { value: 'competitor',     label: 'Competitors',      Icon: Building2,    active: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
                      { value: 'organization',   label: 'Organizations',    Icon: Building2,    active: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300' },
                      { value: 'product',        label: 'Products',         Icon: Database,     active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
                      { value: 'technology',     label: 'Technology',       Icon: Zap,          active: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
                      { value: 'project',        label: 'Projects',         Icon: Target,       active: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
                      { value: 'business_goal',  label: 'Business Goals',   Icon: Target,       active: 'bg-[#A78BFA]/10 text-[#8B5CF6] dark:bg-[#A78BFA]/10 dark:text-[#A78BFA]' },
                      { value: 'metric',         label: 'Metrics',          Icon: Zap,          active: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' },
                      { value: 'decision',       label: 'Decisions',        Icon: Lightbulb,    active: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
                      { value: 'market',         label: 'Markets',          Icon: Building2,    active: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
                    ].map(({ value, label, Icon, active }) => (
                      <button
                        key={value}
                        onClick={() => setSelectedEntityType(value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                          selectedEntityType === value
                            ? active
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Content Views */}
              {selectedView === 'sources' ? (
                <SourcesView
                  sources={filteredSources}
                  groups={sourceGroups}
                  expandedGroups={expandedGroups}
                  processingSourceIds={processingSourceIds}
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
                  loading={entitiesLoading}
                  onRefresh={loadGraphEntities}
                  selectedProductIds={selectedProductIds}
                />
              ) : selectedView === 'knowledge_graph' ? (
                <KnowledgeGraphTab />
              ) : (
                <InsightsView sources={contextSources} entities={graphEntities} />
              )}
            </>
          )}
        </PageContainer>

        {/* Add Context Modal */}
        {showAddModal && (
          <AddContextModal
            selectedProductIds={selectedProductIds}
            onClose={() => setShowAddModal(false)}
            onSuccess={(newSourceId?: number) => {
              setShowAddModal(false)
              loadContext()
              if (newSourceId) {
                setProcessingSourceIds(prev => new Set(prev).add(newSourceId))
              }
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
  processingSourceIds,
  onToggleGroup,
  onRefresh,
  onDeleteGroup
}: {
  sources: any[]
  groups: any[]
  expandedGroups: Set<number>
  processingSourceIds: Set<number>
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
          icon={Brain}
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
                    <Database className="w-6 h-6 text-[#A78BFA]" />
                    <div>
                      <h3 className="text-lg text-gray-900 dark:text-white">{group.name}</h3>
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
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#A78BFA]" />
                </div>
              ) : (
                groupSources[group.id]?.map((source: any) => (
                  <ContextSourceCard key={source.id} source={source} onRefresh={onRefresh} isProcessing={processingSourceIds.has(source.id)} />
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
            <ContextSourceCard key={source.id} source={source} onRefresh={onRefresh} isProcessing={processingSourceIds.has(source.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function EntitiesView({
  entities,
  selectedEntityType,
  loading,
  onRefresh,
  selectedProductIds
}: {
  entities: any[]
  selectedEntityType: string
  loading: boolean
  onRefresh: () => void
  selectedProductIds: number[]
}) {
  const filteredByType = selectedEntityType === 'all'
    ? entities
    : entities.filter(e => e.entity_type === selectedEntityType)

  if (loading) {
    return <Loading />
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <button onClick={onRefresh} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>
      {filteredByType.length === 0 ? (
        <Card>
          <EmptyState
            icon={Brain}
            title="No entities in knowledge graph yet"
            description="Add context sources — LightRAG will extract entities automatically"
            action={null}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredByType.map((entity) => (
            <EntityCard key={entity.id} entity={entity} selectedProductIds={selectedProductIds} />
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
              <Database className="w-8 h-8 text-[#A78BFA]" />
              <span className="text-3xl">{sources.length}</span>
            </div>
            <p className="text-sm text-muted">Context Sources</p>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-purple-500" />
              <span className="text-3xl">
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
              <span className="text-3xl">
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
              <span className="text-3xl">
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
          <h3 className="text-xl mb-2">AI-Powered Insights Coming Soon</h3>
          <p className="text-muted max-w-2xl mx-auto">
            Get automatic trend analysis, sentiment tracking, opportunity identification, and strategic recommendations based on your context data
          </p>
        </div>
      </Card>
    </div>
  )
}

function ContextSourceCard({ source, onRefresh, isProcessing }: { source: any; onRefresh: () => void; isProcessing?: boolean }) {
  const [deleting, setDeleting] = React.useState(false)

  const toTitleCase = (str: string) => {
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

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
      case 'processing': return 'bg-[#A78BFA]/10 text-[#8B5CF6] dark:bg-[#A78BFA]/10 dark:text-[#A78BFA]'
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
          <div className="p-3 rounded-lg bg-[#A78BFA]/10 dark:bg-[#A78BFA]/10 text-[#A78BFA] dark:text-[#A78BFA]">
            {getSourceIcon(source.source_type)}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-lg text-gray-900 dark:text-white mb-1">{toTitleCase(source.name)}</h3>
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
              {isProcessing && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-[#A78BFA]/10 text-[#8B5CF6] dark:bg-[#A78BFA]/10 dark:text-[#A78BFA]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Extracting entities…
                </span>
              )}
              {!isProcessing && source.entities_extracted_count > 0 && (
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

          </div>
        </div>
      </div>
    </Card>
  )
}

function EntityCard({ entity }: { entity: any; selectedProductIds?: number[] }) {
  const iconMap: Record<string, any> = {
    'persona': Users, 'pain_point': AlertCircle, 'feature_request': Lightbulb,
    'competitor': Building2, 'business_goal': Target, 'metric': Zap,
    'decision': Lightbulb, 'person': User, 'organization': Building2,
    'product': Database, 'feature': Zap, 'technology': Zap,
    'meeting': MessageSquare, 'project': Target, 'market': Building2,
  }
  const colorMap: Record<string, string> = {
    'persona': 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    'pain_point': 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    'feature_request': 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    'competitor': 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    'business_goal': 'bg-[#A78BFA]/10 text-[#A78BFA] dark:bg-[#A78BFA]/10 dark:text-[#A78BFA]',
    'metric': 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
    'decision': 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    'product': 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    'feature': 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  }
  const Icon = iconMap[entity.entity_type] || Target
  const iconColor = colorMap[entity.entity_type] || 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400'

  const attrs = entity.attributes ?? {}
  const sentiment: string | null = attrs.sentiment && attrs.sentiment !== 'null' ? attrs.sentiment : null
  const urgency: string | null = attrs.urgency && attrs.urgency !== 'null' ? attrs.urgency : null
  const businessImpact: string | null = attrs.business_impact && attrs.business_impact !== 'null' ? attrs.business_impact : null
  const snippet: string | null = attrs.context_snippet && attrs.context_snippet !== 'null' ? attrs.context_snippet : null

  const sentimentColor = (s: string) => {
    if (/positive|good|great/i.test(s)) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    if (/negative|bad|poor/i.test(s)) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
  const urgencyColor = (u: string) => {
    if (/high|critical|urgent/i.test(u)) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    if (/medium|moderate/i.test(u)) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
  const impactColor = (i: string) => {
    if (/high/i.test(i)) return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    if (/medium/i.test(i)) return 'bg-[#A78BFA]/10 text-[#8B5CF6] dark:bg-[#A78BFA]/10 dark:text-[#A78BFA]'
    return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }

  return (
    <Card>
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg flex-shrink-0 ${iconColor}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">{entity.name}</h4>
              <span className="text-xs text-gray-500 dark:text-gray-500 capitalize">{entity.entity_type.replace(/_/g, ' ')}</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3">{entity.description}</p>
          </div>
        </div>

        {/* Attribute badges */}
        {(sentiment || urgency || businessImpact) && (
          <div className="flex flex-wrap gap-1.5">
            {sentiment && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sentimentColor(sentiment)}`}>
                {sentiment}
              </span>
            )}
            {urgency && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${urgencyColor(urgency)}`}>
                {urgency} urgency
              </span>
            )}
            {businessImpact && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${impactColor(businessImpact)}`}>
                {businessImpact} impact
              </span>
            )}
          </div>
        )}

        {/* Context snippet */}
        {snippet && (
          <p className="text-xs text-gray-500 dark:text-gray-500 italic border-l-2 border-gray-300 dark:border-gray-600 pl-2 line-clamp-2">
            "{snippet}"
          </p>
        )}

        {/* Confidence bar */}
        {entity.confidence_score != null && (
          <div className="pt-1 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-500 dark:text-gray-500">Confidence</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">{Math.round(entity.confidence_score * 100)}%</span>
            </div>
            <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#8B5CF6]"
                style={{ width: `${Math.round(entity.confidence_score * 100)}%` }}
              />
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
  onSuccess: (newSourceId?: number) => void
}) {
  const [step, setStep] = useState<'select-type' | 'upload'>('select-type')
  const [sourceType, setSourceType] = useState('')
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [retentionPolicy, setRetentionPolicy] = useState('30_days')
  const [showRetentionDropdown, setShowRetentionDropdown] = useState(false)
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
        onSuccess(response.data.id)
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
          onSuccess() // Close modal and refresh (no new source to poll)
          alert('✓ Linked to existing source successfully')
        } else {
          // User wants to upload anyway - add force flag
          formData.append('force_duplicate', 'true')
          try {
            const retryResponse = await api.context.uploadFile(formData)
            if (retryResponse.data.error_message) {
              setError(retryResponse.data.error_message)
            } else {
              onSuccess(retryResponse.data.id)
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
          <h2 className="page-title">
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
                <h3 className="text-sm text-gray-700 dark:text-gray-300 mb-3">
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
                          : 'border-gray-200 dark:border-gray-700 hover:border-[#A78BFA] hover:bg-[#A78BFA]/5 dark:hover:bg-[#A78BFA]/10'
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
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#A78BFA]/50 outline-none"
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
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#A78BFA]/50 outline-none"
              />
            </div>

            {/* Data Retention Policy */}
            <div>
              <label className="block text-sm font-medium mb-2">Data Retention Policy</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowRetentionDropdown(!showRetentionDropdown)}
                  className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-2 focus:ring-[#A78BFA]/50 focus:border-[#A78BFA] transition"
                >
                  <span className="flex items-center gap-2 text-sm">
                    {retentionPolicy === 'delete_immediately' && '🔒 Maximum Privacy'}
                    {retentionPolicy === '30_days' && (
                      <>
                        ⚖️ Balanced
                        <span className="px-2 py-0.5 text-[10px] rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                          Recommended
                        </span>
                      </>
                    )}
                    {retentionPolicy === '90_days' && '📅 Extended Retention'}
                    {retentionPolicy === 'retain_encrypted' && '📁 Full Retention (Encrypted)'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${showRetentionDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showRetentionDropdown && (
                  <div className="absolute z-50 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
                    <div className="p-1 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setRetentionPolicy('delete_immediately');
                          setShowRetentionDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-3 rounded transition-colors ${
                          retentionPolicy === 'delete_immediately'
                            ? 'bg-[#A78BFA]/5 dark:bg-[#A78BFA]/10 text-[#8B5CF6] dark:text-[#A78BFA]'
                            : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">🔒 Maximum Privacy</span>
                          {retentionPolicy === 'delete_immediately' && (
                            <Check className="w-4 h-4 text-[#A78BFA] dark:text-[#A78BFA]" />
                          )}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Delete original file after AI extraction completes.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRetentionPolicy('30_days');
                          setShowRetentionDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-3 rounded transition-colors ${
                          retentionPolicy === '30_days'
                            ? 'bg-[#A78BFA]/5 dark:bg-[#A78BFA]/10 text-[#8B5CF6] dark:text-[#A78BFA]'
                            : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">⚖️ Balanced</span>
                            <span className="px-2 py-0.5 text-[10px] rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                              Recommended
                            </span>
                          </div>
                          {retentionPolicy === '30_days' && (
                            <Check className="w-4 h-4 text-[#A78BFA] dark:text-[#A78BFA]" />
                          )}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Keep original for 30 days, then auto-delete.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRetentionPolicy('90_days');
                          setShowRetentionDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-3 rounded transition-colors ${
                          retentionPolicy === '90_days'
                            ? 'bg-[#A78BFA]/5 dark:bg-[#A78BFA]/10 text-[#8B5CF6] dark:text-[#A78BFA]'
                            : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">📅 Extended Retention</span>
                          {retentionPolicy === '90_days' && (
                            <Check className="w-4 h-4 text-[#A78BFA] dark:text-[#A78BFA]" />
                          )}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Keep original for 90 days, then auto-delete.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRetentionPolicy('retain_encrypted');
                          setShowRetentionDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-3 rounded transition-colors ${
                          retentionPolicy === 'retain_encrypted'
                            ? 'bg-[#A78BFA]/5 dark:bg-[#A78BFA]/10 text-[#8B5CF6] dark:text-[#A78BFA]'
                            : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">📁 Full Retention (Encrypted)</span>
                          {retentionPolicy === 'retain_encrypted' && (
                            <Check className="w-4 h-4 text-[#A78BFA] dark:text-[#A78BFA]" />
                          )}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Keep original file indefinitely, encrypted.
                        </p>
                      </button>
                    </div>
                  </div>
                )}
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
