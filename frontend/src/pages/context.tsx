import Head from 'next/head'
import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import {
  Database, Plus, Upload, MessageSquare,
  X, Loader2, Search,
  Building2, User, Lightbulb, AlertCircle, Zap, Users, Target, Trash2, Check, RefreshCw, Brain, ChevronDown, Network, Filter, Pencil, GitMerge, Layers,
  Link2, Link2Off, Play, CheckCircle2, XCircle, ArrowLeft, BarChart3, BookOpen, Tag, ChevronRight, Clock, TrendingUp
} from 'lucide-react'
import ConnectorIcon from '@/components/ConnectorIcon'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api, apiClient } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, Card, EmptyState, Loading } from '@/components/PageContainer'
const KnowledgeGraphTab = dynamic(() => import('@/components/context/KnowledgeGraphTab'), { ssr: false })

type ViewType = 'sources' | 'entities' | 'insights' | 'knowledge_graph' | 'ai_sessions'

export default function Context() {
  const router = useRouter()
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
  const [filterType] = useState<string>('all')
  const [filterStatus] = useState<string>('all')
  const [entityTypeFilter, setEntityTypeFilter] = useState<Set<string>>(new Set())
  const [configuredEntityTypes, setConfiguredEntityTypes] = useState<string[]>([])
  const [processingSourceIds, setProcessingSourceIds] = useState<Set<number>>(new Set())
  const [aiSummary, setAiSummary] = useState<any>(null)
  const [aiEntries, setAiEntries] = useState<any[]>([])
  const [aiDays, setAiDays] = useState(7)
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedAiEntry, setSelectedAiEntry] = useState<any>(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    const currentUser = getCurrentUser()
    setUser(currentUser)

    // Check URL params for tab
    const { tab } = router.query
    if (tab && ['sources', 'entities', 'insights', 'knowledge_graph', 'ai_sessions'].includes(tab as string)) {
      setSelectedView(tab as ViewType)
      if (tab === 'entities' || tab === 'knowledge_graph') loadGraphEntities()
      if (tab === 'ai_sessions') loadAiSessions()
    }

    loadContext()
    loadConfiguredEntityTypes()
  }, [router])

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

  const loadAiSessions = async () => {
    setAiLoading(true)
    try {
      const [sumRes, entriesRes] = await Promise.all([
        apiClient.get(`/api/v1/team-knowledge/quota/summary?days=${aiDays}`),
        apiClient.get('/api/v1/team-knowledge/entries?limit=50'),
      ])
      setAiSummary(sumRes.data)
      setAiEntries(entriesRes.data)
    } catch (e) {
      console.error('Failed to load AI session data', e)
    } finally {
      setAiLoading(false)
    }
  }

  const handleAiEntryClick = async (entry: any) => {
    setSelectedAiEntry(entry)
    try {
      const detail = await apiClient.get(`/api/v1/team-knowledge/entries/${entry.id}`)
      setSelectedAiEntry(detail.data)
    } catch { /* leave preview */ }
  }

  const handleTabChange = (view: ViewType) => {
    setSelectedView(view)
    router.push(`/context?tab=${view}`, undefined, { shallow: true })
    if (view === 'entities' || view === 'knowledge_graph') loadGraphEntities()
    if (view === 'ai_sessions') loadAiSessions()
  }

  const loadContext = async () => {
    try {
      setLoading(true)

      const [sourcesRes, groupsRes] = await Promise.all([
        api.context.getSources({}),
        api.context.getSourceGroups({}),
      ])

      const allSources = Array.isArray(sourcesRes.data) ? sourcesRes.data : []
      const groups = Array.isArray(groupsRes.data) ? groupsRes.data : []
      setContextSources(allSources.filter((s: any) => !s.source_group_id))
      setSourceGroups(groups)

      // Re-derive which sources are still being processed by LightRAG.
      // The DB status is set to COMPLETED immediately after submission (before
      // LightRAG finishes), so we must ask LightRAG directly.
      if (allSources.length > 0) {
        const ids = allSources.map((s: any) => s.id).join(',')
        try {
          const statusRes = await apiClient.get('/api/v1/graph/processing-status', {
            params: { source_ids: ids },
            validateStatus: () => true,
          })
          if (statusRes.status === 200) {
            const statuses: Record<string, string> = statusRes.data?.sources ?? {}
            const inProgress = allSources
              .map((s: any) => s.id)
              .filter((id: number) => {
                const st = statuses[String(id)]
                return st === 'pending' || st === 'processing'
              })
            setProcessingSourceIds(new Set(inProgress))
          }
        } catch {
          // non-fatal — spinner just won't show until next poll cycle
        }
      }
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
    // LightRAG stores extracted attributes inline in the description as
    // <!-- attrs: {"key":"value"} --> — parse them out and strip the marker.
    let rawDescription: string = props.description ?? ''
    let inlineAttrs: Record<string, string> = {}
    const attrsMatch = rawDescription.match(/<!--\s*attrs:\s*(\{.*?\})\s*-->/)
    if (attrsMatch) {
      try { inlineAttrs = JSON.parse(attrsMatch[1]) } catch { /* ignore malformed */ }
      rawDescription = rawDescription.replace(attrsMatch[0], '').trim()
    }
    const attrs = Object.keys(inlineAttrs).length > 0 ? inlineAttrs : (props.attributes ?? {})
    // Parse LLM confidence (0-1) from attributes if present
    const llmConf = attrs.confidence != null && attrs.confidence !== 'null'
      ? parseFloat(attrs.confidence) : null
    // 3-signal structural confidence (mirrors KnowledgeGraphTab formula, no degree available here)
    const sourceCount = (props.source_id ?? '').split('<SEP>').filter(Boolean).length || 1
    const descLen = rawDescription.length
    const structConf = 0.4 * Math.min(sourceCount / 5, 1) + 0.3 * Math.min(descLen / 300, 1)
    const confidence = llmConf !== null && !isNaN(llmConf)
      ? 0.25 * Math.min(Math.max(llmConf, 0), 1) + 0.35 * Math.min(sourceCount / 5, 1) + 0.15 * Math.min(descLen / 300, 1)
      : structConf
    const normalizedType = normaliseEntityType(props.entity_type ?? 'other')
    return {
      id: node.id,
      name: props.entity_id ?? node.id,
      entity_type: normalizedType,
      description: rawDescription,
      confidence_score: confidence,
      attributes: attrs,
      source_count: sourceCount,
    }
  }

  const loadConfiguredEntityTypes = async () => {
    try {
      const res = await api.getGraphExtractionSettings()
      const types: {name: string}[] = res.data.entity_types ?? []
      setConfiguredEntityTypes(types.map(t => normaliseEntityType(t.name)))
    } catch {
      // non-fatal — filter falls back to deriving from graph data
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
    const matchesType = entityTypeFilter.size === 0 || entityTypeFilter.has(entity.entity_type)
    return matchesSearch && matchesType
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
                  onClick={() => {
                    loadContext()
                    loadGraphEntities()
                    if (selectedView === 'ai_sessions') loadAiSessions()
                  }}
                  className="btn-secondary flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
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

          {loading ? (
            <Card>
              <Loading text="Loading context..." />
            </Card>
          ) : (
            <>
              {/* Primary Tabs */}
              <div className="border-b border-border mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleTabChange('sources')}
                      className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
                        selectedView === 'sources'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                      }`}
                    >
                      <Database className="w-4 h-4 inline mr-2" />
                      Sources ({sourceGroups.length + contextSources.length})
                    </button>
                    <button
                      onClick={() => {
                        handleTabChange('entities')
                      }}
                      className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
                        selectedView === 'entities'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                      }`}
                    >
                      <Layers className="w-4 h-4 inline mr-2" />
                      Entity List
                    </button>
                    <button
                      onClick={() => handleTabChange('knowledge_graph')}
                      className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
                        selectedView === 'knowledge_graph'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                      }`}
                    >
                      <Network className="w-4 h-4 inline mr-2" />
                      Entity Graph
                    </button>
                    <button
                      onClick={() => handleTabChange('ai_sessions')}
                      className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
                        selectedView === 'ai_sessions'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                      }`}
                    >
                      <BarChart3 className="w-4 h-4 inline mr-2" />
                      AI Sessions
                    </button>
                  </div>

                  {/* Search + entity type filter — hidden on AI sessions tab */}
                  {selectedView !== 'ai_sessions' && <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search..."
                        className="pl-10 pr-4 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none"
                      />
                    </div>
                    {(selectedView === 'entities' || selectedView === 'knowledge_graph') && (
                      <EntityTypeFilterDropdown
                        selected={entityTypeFilter}
                        onChange={setEntityTypeFilter}
                        availableTypes={configuredEntityTypes}
                        counts={graphEntities.reduce<Record<string, number>>((acc, e) => {
                          acc[e.entity_type] = (acc[e.entity_type] ?? 0) + 1
                          return acc
                        }, {})}
                      />
                    )}
                  </div>}
                </div>
              </div>

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
                  loading={entitiesLoading}
                  onRefresh={loadGraphEntities}
                  configuredEntityTypes={configuredEntityTypes}
                />
              ) : selectedView === 'knowledge_graph' ? (
                <KnowledgeGraphTab typeFilter={entityTypeFilter} onTypeFilterChange={setEntityTypeFilter} searchTerm={searchTerm} />
              ) : selectedView === 'ai_sessions' ? (
                <AiSessionsView
                  summary={aiSummary}
                  entries={aiEntries}
                  loading={aiLoading}
                  days={aiDays}
                  onDaysChange={(d) => { setAiDays(d); }}
                  onRefresh={loadAiSessions}
                  onEntryClick={handleAiEntryClick}
                />
              ) : (
                <InsightsView sources={contextSources} entities={graphEntities} />
              )}
            </>
          )}
        </PageContainer>

        {/* AI Entry Detail Modal */}
        {selectedAiEntry && <AiEntryDetailModal entry={selectedAiEntry} onClose={() => setSelectedAiEntry(null)} />}

        {/* Add Context Modal */}
        {showAddModal && (
          <AddContextModal
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

function normaliseEntityType(raw: string): string {
  const map: Record<string, string> = {
    'painpoint': 'pain_point', 'featurerequest': 'feature_request',
    'businessgoal': 'business_goal',
    'PainPoint': 'pain_point', 'FeatureRequest': 'feature_request',
    'BusinessGoal': 'business_goal',
  }
  return map[raw] ?? raw.toLowerCase()
}

function humaniseEntityType(type: string): string {
  // Convert snake_case / camelCase / PascalCase to Title Case words
  return type
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
}

const ENTITY_TYPE_COLORS: Record<string, string> = {
  person:          'hsl(var(--chart-5))',
  decision:        'hsl(var(--chart-5))',
  organization:    'hsl(var(--chart-3))',
  product:         'hsl(var(--chart-3))',
  feature:         'hsl(var(--chart-3))',
  persona:         'hsl(var(--chart-1))',
  business_goal:   'hsl(var(--chart-1))',
  project:         'hsl(var(--chart-1))',
  competitor:      'hsl(var(--chart-2))',
  technology:      'hsl(var(--chart-2))',
  market:          'hsl(var(--chart-2))',
  feature_request: 'hsl(var(--chart-4))',
  metric:          'hsl(var(--chart-4))',
  pain_point:      'hsl(var(--destructive))',
}


function EntityTypeFilterDropdown({
  selected,
  onChange,
  counts = {},
  availableTypes = [],
}: {
  selected: Set<string>
  onChange: (next: Set<string>) => void
  counts?: Record<string, number>
  availableTypes?: string[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Merge configured types with any extra types actually present in the graph.
  // Sort: configured types first (in their config order), then unknown extras alphabetically.
  const configSet = new Set(availableTypes)
  const graphExtras = Object.keys(counts).filter(t => !configSet.has(t)).sort()
  const allTypes = [...availableTypes, ...graphExtras]

  const toggle = (type: string) => {
    const next = new Set(selected)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    onChange(next)
  }

  const label = selected.size === 0
    ? 'All types'
    : selected.size === 1
      ? humaniseEntityType([...selected][0])
      : `${selected.size} types`

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-input border border-border rounded-lg hover:bg-muted transition-colors"
      >
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{label}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-card border border-border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
          <div className="p-2">
            <button
              onClick={() => onChange(new Set())}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded transition-colors text-left"
            >
              <div className="w-4 h-4 border border-border rounded flex items-center justify-center flex-shrink-0">
                {selected.size === 0 && <Check className="w-3 h-3 text-primary" />}
              </div>
              <span className="text-sm font-medium text-foreground">All types</span>
            </button>
            <div className="border-t border-border my-1" />
            {allTypes.map((value) => (
              <button
                key={value}
                onClick={() => toggle(value)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded transition-colors"
              >
                <div className="w-4 h-4 border border-border rounded flex items-center justify-center flex-shrink-0">
                  {selected.has(value) && <Check className="w-3 h-3 text-primary" />}
                </div>
                <span className="text-sm text-foreground flex-1 text-left">
                  {humaniseEntityType(value)}
                  {counts[value] != null && (
                    <span className="ml-1 text-muted-foreground">({counts[value]})</span>
                  )}
                </span>
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ background: ENTITY_TYPE_COLORS[value] ?? 'hsl(var(--muted-foreground))' }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
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
            className="w-full text-left text-foreground"
          >
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database className="w-6 h-6 text-primary" />
                    <div>
                      <h3 className="text-lg text-foreground">{group.name}</h3>
                      {group.description && (
                        <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">
                        {group.sources_count} sources
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {group.total_entities} entities
                      </div>
                    </div>
                    <button
                      onClick={(e) => onDeleteGroup(group.id, group.name, e)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition"
                      title="Delete source group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <svg
                      className={`w-5 h-5 text-muted-foreground transition-transform ${
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
                <div className="col-span-2">
                  <Loading text="Loading sources..." />
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
  loading,
  onRefresh,
  configuredEntityTypes = [],
}: {
  entities: any[]
  loading: boolean
  onRefresh?: () => void
  configuredEntityTypes?: string[]
}) {
  const [editEntity, setEditEntity] = React.useState<any | null>(null)
  const [mergeEntity, setMergeEntity] = React.useState<any | null>(null)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

  const toggleSelect = (id: string, ctrlHeld: boolean) => {
    if (!ctrlHeld) {
      setSelectedIds(prev => prev.size === 1 && prev.has(id) ? new Set() : new Set([id]))
      return
    }
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSaved = () => {
    setEditEntity(null)
    setMergeEntity(null)
    setSelectedIds(new Set())
    onRefresh?.()
  }

  if (loading) return <Loading />

  return (
    <>
      {/* Bulk action toolbar */}
      {selectedIds.size > 1 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
          <button
            onClick={() => setMergeEntity({ id: '__multi__', name: '' })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
          >
            <GitMerge className="w-3.5 h-3.5" />
            Merge {selectedIds.size} selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition"
          >
            Clear
          </button>
        </div>
      )}

      {entities.length === 0 ? (
        <Card>
          <EmptyState
            icon={Layers}
            title="No entities in knowledge graph yet"
            description="Add context sources — LightRAG will extract entities automatically"
            action={null}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {entities.map((entity) => (
            <EntityCard
              key={entity.id}
              entity={entity}
              isSelected={selectedIds.has(entity.id)}
              onSelect={(ctrlHeld) => toggleSelect(entity.id, ctrlHeld)}
              onEdit={() => setEditEntity(entity)}
              onMerge={() => setMergeEntity(entity)}
            />
          ))}
        </div>
      )}

      {editEntity && (
        <EditEntityModal
          entity={editEntity}
          onClose={() => setEditEntity(null)}
          onSaved={handleSaved}
          entityTypes={configuredEntityTypes}
        />
      )}

      {mergeEntity && (
        <MergeEntitiesModal
          sourceNames={
            mergeEntity.id === '__multi__'
              ? entities.filter(e => selectedIds.has(e.id)).map((e: any) => e.name)
              : [mergeEntity.name]
          }
          allEntityNames={entities.map((e: any) => e.name)}
          onClose={() => setMergeEntity(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}

function EditEntityModal({
  entity,
  onClose,
  onSaved,
  entityTypes = [],
}: {
  entity: any
  onClose: () => void
  onSaved: () => void
  entityTypes?: string[]
}) {
  const [name, setName] = React.useState(entity.name)
  const [entityType, setEntityType] = React.useState(entity.entity_type)
  const [description, setDescription] = React.useState(entity.description ?? '')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  const nameChanged = name.trim() !== entity.name

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      await api.graph.editEntity({
        entity_name: entity.name,
        updated_data: {
          entity_id: name.trim(),
          entity_type: entityType,
          description: description.trim(),
        },
        allow_rename: nameChanged,
        allow_merge: nameChanged,
      })
      onSaved()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save entity')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Edit Entity</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none text-sm"
            />
            {nameChanged && (
              <p className="text-xs text-muted-foreground mt-1">
                Renaming will merge with an existing entity if one already has this name.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Entity Type</label>
            <select
              value={entityType}
              onChange={e => setEntityType(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none text-sm"
            >
              {/* Always include the current type even if not in configured list */}
              {Array.from(new Set([entityType, ...entityTypes])).map((value) => (
                <option key={value} value={value}>{humaniseEntityType(value)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none text-sm resize-none"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg transition">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 btn-primary text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MergeEntitiesModal({
  sourceNames,
  allEntityNames,
  onClose,
  onSaved,
}: {
  sourceNames: string[]
  allEntityNames: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const [targetName, setTargetName] = React.useState('')
  const [customTarget, setCustomTarget] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  const candidateTargets = allEntityNames.filter(n => !sourceNames.includes(n))

  const handleMerge = async () => {
    const target = targetName.trim()
    if (!target) { setError('Please select or enter a target entity name'); return }
    setSaving(true)
    setError('')
    try {
      await api.graph.mergeEntities({
        entities_to_change: sourceNames,
        entity_to_change_into: target,
      })
      onSaved()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to merge entities')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Merge into…</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              {sourceNames.length === 1
                ? <>Merging <span className="font-medium text-foreground">"{sourceNames[0]}"</span> into:</>
                : <>Merging <span className="font-medium text-foreground">{sourceNames.length} entities</span> into:</>}
            </p>
            {sourceNames.length > 1 && (
              <ul className="text-xs text-muted-foreground list-disc list-inside mb-3 max-h-24 overflow-y-auto">
                {sourceNames.map(n => <li key={n}>{n}</li>)}
              </ul>
            )}
          </div>

          {!customTarget ? (
            <div>
              <label className="block text-sm font-medium mb-1.5">Target entity (existing)</label>
              <select
                value={targetName}
                onChange={e => setTargetName(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none text-sm"
              >
                <option value="">— select target —</option>
                {candidateTargets.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <button
                onClick={() => { setCustomTarget(true); setTargetName('') }}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Or enter a custom name
              </button>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1.5">Target entity name</label>
              <input
                value={targetName}
                onChange={e => setTargetName(e.target.value)}
                placeholder="e.g. Enterprise Customer"
                className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none text-sm"
              />
              <button
                onClick={() => { setCustomTarget(false); setTargetName('') }}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Select from existing instead
              </button>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg transition">Cancel</button>
          <button
            onClick={handleMerge}
            disabled={saving || !targetName.trim()}
            className="flex-1 btn-primary text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Merging…</> : 'Merge'}
          </button>
        </div>
      </div>
    </div>
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
              <Database className="w-8 h-8 text-primary" />
              <span className="text-3xl">{sources.length}</span>
            </div>
            <p className="text-sm text-muted">Context Sources</p>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-chart-1" />
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
              <AlertCircle className="w-8 h-8 text-destructive" />
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
              <Zap className="w-8 h-8 text-chart-4" />
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
          <Zap className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
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
    return <ConnectorIcon type={type} className="w-5 h-5" />
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-chart-3/15 text-chart-3'
      case 'processing': return 'bg-primary/10 text-primary'
      case 'failed': return 'bg-destructive/10 text-destructive'
      case 'pending': return 'bg-chart-4/20 text-chart-4'
      default: return 'bg-muted text-muted-foreground'
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
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition disabled:opacity-50"
          title="Delete source"
        >
          {deleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>

        <div className="flex items-start gap-4 pr-8">
          <div className="p-3 rounded-lg bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary">
            {getSourceIcon(source.source_type)}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-lg text-foreground mb-1">{toTitleCase(source.name)}</h3>
            {source.description && (
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{source.description}</p>
            )}
            {source.content_summary && (
              <div className="bg-muted/50 border border-border rounded px-3 py-2 mb-3">
                <p className="text-xs text-muted-foreground">
                  <strong>Content deleted:</strong> {source.content_summary}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(source.status)}`}>
                {source.status}
              </span>
              {isProcessing && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Extracting entities…
                </span>
              )}
              {!isProcessing && source.entities_extracted_count > 0 && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-chart-1/15 text-chart-1">
                  {source.entities_extracted_count} entities
                </span>
              )}
              {source.content_deleted_at && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground" title={`Content deleted on ${new Date(source.content_deleted_at).toLocaleDateString()}`}>
                  🔒 Content deleted
                </span>
              )}
              {source.is_encrypted && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-chart-4/20 text-chart-4" title="Content encrypted">
                  🔐 Encrypted
                </span>
              )}
              {source.deletion_scheduled_for && !source.content_deleted_at && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-chart-2/15 text-chart-2" title={`Scheduled for deletion on ${new Date(source.deletion_scheduled_for).toLocaleDateString()}`}>
                  ⏱️ Scheduled: {new Date(source.deletion_scheduled_for).toLocaleDateString()}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(source.created_at).toLocaleDateString()}
              </span>
            </div>

          </div>
        </div>
      </div>
    </Card>
  )
}

function EntityCard({
  entity,
  isSelected,
  onSelect,
  onEdit,
  onMerge,
}: {
  entity: any
  isSelected?: boolean
  onSelect?: (ctrlHeld: boolean) => void
  onEdit?: () => void
  onMerge?: () => void
}) {
  const iconMap: Record<string, any> = {
    'persona': Users, 'pain_point': AlertCircle, 'feature_request': Lightbulb,
    'competitor': Building2, 'business_goal': Target, 'metric': Zap,
    'decision': Lightbulb, 'person': User, 'organization': Building2,
    'product': Database, 'feature': Zap, 'technology': Zap,
    'meeting': MessageSquare, 'project': Target, 'market': Building2,
  }
  const colorMap: Record<string, string> = {
    'persona':         'bg-chart-1/15 text-chart-1',
    'person':          'bg-chart-5/15 text-chart-5',
    'pain_point':      'text-destructive bg-destructive/10',
    'feature_request': 'bg-chart-4/20 text-chart-4',
    'feature':         'bg-chart-3/15 text-chart-3',
    'competitor':      'bg-chart-2/15 text-chart-2',
    'organization':    'bg-chart-5/15 text-chart-5',
    'product':         'bg-chart-3/15 text-chart-3',
    'technology':      'bg-chart-5/15 text-chart-5',
    'business_goal':   'bg-chart-1/15 text-chart-1',
    'metric':          'bg-chart-3/15 text-chart-3',
    'decision':        'bg-chart-5/15 text-chart-5',
    'project':         'bg-chart-1/15 text-chart-1',
    'market':          'bg-chart-2/15 text-chart-2',
    'meeting':         'bg-muted text-muted-foreground',
  }
  const Icon = iconMap[entity.entity_type] || Target
  const iconColor = colorMap[entity.entity_type] || 'bg-muted text-muted-foreground'

  const attrs = entity.attributes ?? {}
  const sentiment: string | null = attrs.sentiment && attrs.sentiment !== 'null' ? attrs.sentiment : null
  const urgency: string | null = attrs.urgency && attrs.urgency !== 'null' ? attrs.urgency : null
  const businessImpact: string | null = attrs.business_impact && attrs.business_impact !== 'null' ? attrs.business_impact : null
  const snippet: string | null = attrs.context_snippet && attrs.context_snippet !== 'null' ? attrs.context_snippet : null
  // Custom attributes — any key that isn't one of the known special-cased ones
  const knownAttrKeys = new Set(['sentiment', 'urgency', 'business_impact', 'context_snippet', 'confidence'])
  const customAttrs = Object.entries(attrs).filter(
    ([k, v]) => !knownAttrKeys.has(k) && v != null && v !== 'null' && v !== ''
  ) as [string, string][]

  const sentimentColor = (s: string) => {
    if (/^positive$/i.test(s)) return 'bg-chart-3/20 text-chart-3'
    if (/mostly_positive/i.test(s)) return 'bg-chart-3/10 text-chart-3'
    if (/^negative$/i.test(s)) return 'bg-destructive/15 text-destructive'
    if (/mostly_negative/i.test(s)) return 'bg-destructive/10 text-destructive'
    return 'bg-muted text-muted-foreground'
  }
  const urgencyColor = (u: string) => {
    if (/^critical$/i.test(u)) return 'bg-destructive/20 text-destructive'
    if (/^high$/i.test(u)) return 'bg-destructive/10 text-destructive'
    if (/^medium$/i.test(u)) return 'bg-chart-4/20 text-chart-4'
    if (/^low$/i.test(u)) return 'bg-muted text-muted-foreground'
    return 'bg-muted/50 text-muted-foreground/60'
  }
  const impactColor = (i: string) => {
    if (/^transformative$/i.test(i)) return 'bg-chart-1/20 text-chart-1'
    if (/^high$/i.test(i)) return 'bg-chart-1/10 text-chart-1'
    if (/^medium$/i.test(i)) return 'bg-primary/10 text-primary'
    if (/^low$/i.test(i)) return 'bg-muted text-muted-foreground'
    return 'bg-muted/50 text-muted-foreground/60'
  }

  return (
    <Card className={`transition-all ${onSelect ? 'cursor-pointer' : ''} ${isSelected ? 'ring-2 ring-primary' : onSelect ? 'hover:ring-1 hover:ring-border' : ''}`}>
      <div
        className="p-4 flex flex-col gap-3"
        onClick={onSelect ? (e: React.MouseEvent) => onSelect(e.ctrlKey || e.metaKey) : undefined}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg flex-shrink-0 ${iconColor}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="text-sm font-medium text-foreground truncate">{entity.name}</h4>
              <span className="text-xs text-muted-foreground capitalize">{entity.entity_type.replace(/_/g, ' ')}</span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-3">{entity.description}</p>
          </div>
        </div>

        {/* Attribute badges */}
        {(sentiment || urgency || businessImpact || customAttrs.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {sentiment && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sentimentColor(sentiment)}`}>
                Sentiment: {sentiment}
              </span>
            )}
            {urgency && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${urgencyColor(urgency)}`}>
                Urgency: {urgency}
              </span>
            )}
            {businessImpact && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${impactColor(businessImpact)}`}>
                Impact: {businessImpact}
              </span>
            )}
            {customAttrs.map(([key, value]) => (
              <span
                key={key}
                className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium"
                title={key.replace(/_/g, ' ')}
              >
                {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}: {String(value)}
              </span>
            ))}
          </div>
        )}

        {/* Context snippet */}
        {snippet && (
          <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2 line-clamp-2">
            "{snippet}"
          </p>
        )}

        {/* Confidence bar */}
        {entity.confidence_score != null && (
          <div className="pt-1 border-t border-border">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Confidence</span>
              <span className="font-medium text-foreground">{Math.round(entity.confidence_score * 100)}%</span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.round(entity.confidence_score * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        {(onEdit || onMerge) && (
          <div className="flex gap-2 pt-1 border-t border-border" onClick={e => e.stopPropagation()}>
            {onEdit && (
              <button
                onClick={onEdit}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
            {onMerge && (
              <button
                onClick={onMerge}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition"
              >
                <GitMerge className="w-3 h-3" /> Merge into…
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}



// ── AI Sessions helpers ────────────────────────────────────────────────────────

function formatAiTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatAiCost(tokens: number): string {
  const dollars = (tokens / 1_000_000) * 3
  if (dollars < 0.01) return '<$0.01'
  return `$${dollars.toFixed(2)}`
}

function timeAgo(isoDate: string): string {
  const normalized = isoDate.endsWith('Z') || isoDate.includes('+') ? isoDate : isoDate + 'Z'
  const diff = Date.now() - new Date(normalized).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const ROLE_COLORS: Record<string, string> = {
  engineer: 'bg-primary/10 text-primary dark:text-primary',
  pm:       'bg-primary/10 text-primary dark:text-primary',
  designer: 'bg-chart-2/15 text-chart-2',
  qa:       'bg-chart-4/20 text-chart-4',
  other:    'bg-muted text-muted-foreground',
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  insight: 'Insight', decision: 'Decision', artifact: 'Artifact',
  research_finding: 'Research', pattern: 'Pattern', context: 'Context',
}

function AiSessionEntryCard({ entry, onClick }: { entry: any; onClick: () => void }) {
  const roleColor = ROLE_COLORS[entry.role] || ROLE_COLORS.other
  return (
    <Card hover onClick={onClick} padding="sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColor}`}>{entry.role}</span>
            <span className="text-xs text-muted-foreground">{ENTRY_TYPE_LABELS[entry.entry_type] || entry.entry_type}</span>
            {entry.product_area && <span className="text-xs text-muted-foreground/60">· {entry.product_area}</span>}
          </div>
          <h4 className="text-sm font-medium text-foreground leading-snug mb-1.5">{entry.title}</h4>
          {entry.tags && entry.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <Tag className="w-3 h-3 text-muted-foreground/60" />
              {entry.tags.slice(0, 3).map((tag: string) => (
                <span key={tag} className="text-xs text-muted-foreground/70">{tag}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-xs text-muted-foreground/60">{timeAgo(entry.created_at)}</span>
          {entry.token_count && <span className="text-xs font-mono text-muted-foreground/60">{formatAiTokens(entry.token_count)} tok</span>}
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
        </div>
      </div>
    </Card>
  )
}

function AiEntryDetailModal({ entry, onClose }: { entry: any; onClose: () => void }) {
  const roleColor = ROLE_COLORS[entry.role] || ROLE_COLORS.other
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColor}`}>{entry.role}</span>
              <span className="text-xs text-muted-foreground">{ENTRY_TYPE_LABELS[entry.entry_type] || entry.entry_type}</span>
            </div>
            <h3 className="text-sm font-semibold text-foreground">{entry.title}</h3>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {timeAgo(entry.created_at)}
              {entry.token_count && ` · ${formatAiTokens(entry.token_count)} tokens`}
              {entry.retrieval_count !== undefined && ` · retrieved ${entry.retrieval_count}×`}
            </p>
          </div>
          <button onClick={onClose} className="ml-4 text-muted-foreground hover:text-foreground flex-shrink-0 transition-colors">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {entry.content
            ? <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{entry.content}</p>
            : <p className="text-sm text-muted-foreground italic">Loading content...</p>
          }
          {entry.tags && entry.tags.length > 0 && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <Tag className="w-3.5 h-3.5 text-muted-foreground/60" />
              {entry.tags.map((tag: string) => (
                <span key={tag} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { StatCard } from '@/components/PageContainer'

function AiSessionsView({
  summary,
  entries,
  loading,
  days,
  onDaysChange,
  onRefresh,
  onEntryClick,
}: {
  summary: any
  entries: any[]
  loading: boolean
  days: number
  onDaysChange: (d: number) => void
  onRefresh: () => void
  onEntryClick: (entry: any) => void
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative">
          <select
            value={days}
            onChange={e => onDaysChange(Number(e.target.value))}
            className="text-sm px-3 py-2 pr-8 border border-border rounded-md bg-input text-foreground appearance-none cursor-pointer focus:ring-2 focus:ring-ring/50"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
        <button onClick={onRefresh} disabled={loading} className="btn-secondary flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh
        </button>
      </div>

      {loading ? <Card><div className="p-8 text-center text-sm text-muted-foreground">Loading session data...</div></Card> : summary ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Sessions"          value={summary.sessions}                subtitle="tracked"                                  icon={<Clock className="w-5 h-5" />}     color="blue" />
            <StatCard title="Knowledge Entries" value={summary.knowledge_entries_total} subtitle={`+${summary.knowledge_entries_new} this period`} icon={<BookOpen className="w-5 h-5" />}  color="orange" />
            <StatCard title="Quota Extended"    value={`${summary.quota_extended_pct}%`} subtitle="effective capacity gain"                icon={<TrendingUp className="w-5 h-5" />} color="purple" />
            <StatCard title="Rate Limit Hits"   value={summary.rate_limit_hits}          subtitle="this period"                            icon={<Users className="w-5 h-5" />}     color={summary.rate_limit_hits > 0 ? 'red' : 'blue'} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card padding="md">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Knowledge Investment</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tokens invested</span>
                  <span className="font-mono font-medium text-foreground">{formatAiTokens(summary.tokens_invested ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Creation sessions</span>
                  <span className="font-mono font-medium text-foreground">{summary.creation_sessions ?? 0}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 mt-1">
                  <span className="text-muted-foreground">Potential future value</span>
                  <span className="font-mono font-medium text-chart-4">~{formatAiTokens(summary.potential_future_value ?? 0)}</span>
                </div>
              </div>
            </Card>

            <Card padding="md">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Knowledge Reuse</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tokens retrieved</span>
                  <span className="font-mono font-medium text-foreground">{formatAiTokens(summary.tokens_retrieved)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Retrieval sessions</span>
                  <span className="font-mono font-medium text-foreground">{summary.retrieval_sessions ?? 0}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 mt-1">
                  <span className="text-muted-foreground">Actual savings</span>
                  <span className="font-mono font-medium text-chart-3">{formatAiTokens(summary.actual_savings ?? 0)}</span>
                </div>
              </div>
              {(summary.retrieval_sessions ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground/60 mt-3">No reuse yet — savings realized when context is retrieved</p>
              )}
            </Card>

            <Card padding="md">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Net Impact</h3>
              {(() => {
                const net = summary.net_impact ?? ((summary.actual_savings ?? 0) - (summary.tokens_invested ?? 0))
                const roi = summary.roi_pct ?? 0
                const isPositive = net >= 0
                return (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Net tokens</span>
                      <span className={`font-mono font-semibold ${isPositive ? 'text-chart-3' : 'text-muted-foreground'}`}>
                        {isPositive ? '+' : ''}{formatAiTokens(net)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cost impact</span>
                      <span className={`font-mono font-medium ${isPositive ? 'text-chart-3' : 'text-muted-foreground'}`}>
                        {isPositive ? '-' : '+'}{formatAiCost(Math.abs(net))}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 mt-1">
                      <span className="text-muted-foreground">ROI</span>
                      <span className={`font-mono font-semibold ${isPositive ? 'text-chart-3' : 'text-muted-foreground'}`}>
                        {(summary.tokens_invested ?? 0) > 0 ? `${roi > 0 ? '+' : ''}${roi.toFixed(0)}%` : 'Pending'}
                      </span>
                    </div>
                  </div>
                )
              })()}
            </Card>
          </div>
        </div>
      ) : (
        <Card><p className="text-sm text-muted-foreground p-4">No session data yet. Start a Claude Code session with the Evols CLI installed to begin tracking.</p></Card>
      )}

      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Session Knowledge — {entries.length} entries
        </h2>
        {loading ? null : entries.length === 0 ? (
          <Card>
            <div className="p-12 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-base font-medium mb-1">No knowledge entries yet</h3>
              <p className="text-sm text-muted-foreground">Complete a Claude Code session with the Evols CLI installed — the Stop hook will auto-sync your session knowledge.</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {entries.map((entry: any) => (
              <AiSessionEntryCard key={entry.id} entry={entry} onClick={() => onEntryClick(entry)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const INTEGRATION_CONFIG_FIELDS: Record<string, { key: string; label: string; placeholder: string }[]> = {
  // existing
  slack:      [{ key: 'channel_ids', label: 'Channel IDs (comma-separated)', placeholder: 'C123ABC, C456DEF  (leave blank for all)' }],
  notion:     [{ key: 'database_ids', label: 'Database IDs (comma-separated)', placeholder: 'leave blank for all' }],
  zendesk:    [{ key: 'subdomain', label: 'Zendesk subdomain', placeholder: 'yourcompany' }],
  github:     [{ key: 'repos', label: 'Repositories (comma-separated)', placeholder: 'org/repo1, org/repo2' }],
  salesforce: [{ key: 'instance_url', label: 'Salesforce instance URL', placeholder: 'https://yourorg.salesforce.com' }],
  outlook:    [],
  teams:      [],
  // new
  jira:       [
    { key: 'domain',  label: 'Atlassian domain',      placeholder: 'yourcompany.atlassian.net' },
    { key: 'email',   label: 'Account email',          placeholder: 'you@company.com' },
  ],
  hubspot:    [],
  freshdesk:  [{ key: 'domain', label: 'Freshdesk domain', placeholder: 'yourcompany.freshdesk.com' }],
  asana:      [{ key: 'workspace_id', label: 'Workspace ID (optional)', placeholder: 'leave blank for all workspaces' }],
  pipedrive:  [],
  confluence: [
    { key: 'domain',    label: 'Atlassian domain',      placeholder: 'yourcompany.atlassian.net' },
    { key: 'email',     label: 'Account email',          placeholder: 'you@company.com' },
    { key: 'space_key', label: 'Space key (optional)',   placeholder: 'leave blank for all spaces' },
  ],
  intercom:   [],
  linear:     [{ key: 'team_key', label: 'Team key (optional)', placeholder: 'leave blank for all teams' }],
  gmail:      [],
  zoom:       [],
  discord:    [
    { key: 'guild_id',    label: 'Server (Guild) ID',               placeholder: '123456789012345678' },
    { key: 'channel_ids', label: 'Channel IDs (comma-separated, optional)', placeholder: 'leave blank for all text channels' },
  ],
}

export function AddContextModal({
  onClose,
  onSuccess
}: {
  onClose: () => void
  onSuccess: (newSourceId?: number) => void
}) {
  const [step, setStep] = useState<'select-type' | 'upload' | 'connect'>('select-type')
  const [sourceType, setSourceType] = useState('')
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  // Integration connect state
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null)
  const [integrationStatus, setIntegrationStatus] = useState<any>(null)
  const [oauthToken, setOauthToken] = useState('')
  const [configValues, setConfigValues] = useState<Record<string, string>>({})
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)

  const openIntegrationConnect = async (system: string) => {
    setSelectedIntegration(system)
    setOauthToken('')
    setConfigValues({})
    setError('')
    // Load current status for this integration
    try {
      const res = await api.integrations.list()
      const integrations: any[] = Array.isArray(res.data) ? res.data : []
      const found = integrations.find((i: any) => i.source_system === system)
      setIntegrationStatus(found ?? { source_system: system, status: 'not_connected', config: {}, meta: {} })
    } catch {
      setIntegrationStatus({ source_system: system, status: 'not_connected', config: {}, meta: {} })
    }
    setStep('connect')
  }

  const handleMicrosoftOAuth = (system: string) => {
    const url = `/api/v1/integrations/oauth/start/microsoft?system=${system}`
    const popup = window.open(url, 'ms_oauth', 'width=600,height=700')
    const timer = setInterval(async () => {
      if (popup?.closed) {
        clearInterval(timer)
        // Refresh status
        try {
          const res = await api.integrations.list()
          const integrations: any[] = Array.isArray(res.data) ? res.data : []
          const found = integrations.find((i: any) => i.source_system === system)
          setIntegrationStatus(found ?? integrationStatus)
        } catch {}
      }
    }, 500)
  }

  const handleTokenConnect = async () => {
    if (!oauthToken.trim()) { setError('Token is required'); return }
    setConnecting(true); setError('')
    try {
      const fields = INTEGRATION_CONFIG_FIELDS[selectedIntegration] || []
      const configPayload: Record<string, any> = {}
      fields.forEach(f => {
        if (configValues[f.key]) {
          const raw = configValues[f.key]
          configPayload[f.key] = f.key.endsWith('_ids') || f.key === 'repos'
            ? raw.split(',').map((s: string) => s.trim()).filter(Boolean)
            : raw.trim()
        }
      })
      await api.integrations.connect(selectedIntegration, { access_token: oauthToken.trim(), config: configPayload })
      const res = await api.integrations.list()
      const integrations: any[] = Array.isArray(res.data) ? res.data : []
      setIntegrationStatus(integrations.find((i: any) => i.source_system === selectedIntegration) ?? integrationStatus)
      setOauthToken('')
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }

  const handleSaveConfig = async () => {
    setSavingConfig(true); setError('')
    try {
      const fields = INTEGRATION_CONFIG_FIELDS[selectedIntegration] || []
      const configPayload: Record<string, any> = {}
      fields.forEach(f => {
        if (configValues[f.key] !== undefined) {
          const raw = configValues[f.key]
          configPayload[f.key] = f.key.endsWith('_ids') || f.key === 'repos'
            ? raw.split(',').map((s: string) => s.trim()).filter(Boolean)
            : raw.trim()
        }
      })
      await api.integrations.updateConfig(selectedIntegration, { config: configPayload })
      const res = await api.integrations.list()
      const integrations: any[] = Array.isArray(res.data) ? res.data : []
      setIntegrationStatus(integrations.find((i: any) => i.source_system === selectedIntegration) ?? integrationStatus)
      setConfigValues({})
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Save failed')
    } finally {
      setSavingConfig(false)
    }
  }

  const handleSyncNow = async () => {
    setSyncing(true); setError('')
    try {
      await api.integrations.sync(selectedIntegration)
      const res = await api.integrations.list()
      const integrations: any[] = Array.isArray(res.data) ? res.data : []
      setIntegrationStatus(integrations.find((i: any) => i.source_system === selectedIntegration) ?? integrationStatus)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm(`Disconnect ${selectedIntegration}? Stored tokens will be deleted.`)) return
    setDisconnecting(true)
    try {
      await api.integrations.disconnect(selectedIntegration)
      setIntegrationStatus({ ...integrationStatus, status: 'disconnected' })
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Disconnect failed')
    } finally {
      setDisconnecting(false)
    }
  }

  const sourceTypes = [
    {
      category: 'Upload',
      types: [
        { value: 'document_pdf', label: 'Document', enabled: true },
      ]
    },
    {
      category: 'Live Integrations',
      integration: true,
      types: [
        { value: 'slack',      label: 'Slack',                enabled: true },
        { value: 'outlook',    label: 'Outlook / Office 365', enabled: true },
        { value: 'teams',      label: 'Microsoft Teams',      enabled: true },
        { value: 'notion',     label: 'Notion',               enabled: true },
        { value: 'salesforce', label: 'Salesforce',           enabled: true },
        { value: 'zendesk',    label: 'Zendesk',              enabled: true },
        { value: 'github',     label: 'GitHub',               enabled: true },
        { value: 'jira',       label: 'Jira',                 enabled: true },
        { value: 'hubspot',    label: 'HubSpot',              enabled: true },
        { value: 'freshdesk',  label: 'Freshdesk',            enabled: true },
        { value: 'asana',      label: 'Asana',                enabled: true },
        { value: 'pipedrive',  label: 'Pipedrive',            enabled: true },
        { value: 'confluence', label: 'Confluence',           enabled: true },
        { value: 'intercom',   label: 'Intercom',             enabled: true },
        { value: 'linear',     label: 'Linear',               enabled: true },
        { value: 'gmail',      label: 'Gmail',                enabled: true },
        { value: 'zoom',       label: 'Zoom',                 enabled: true },
        { value: 'discord',    label: 'Discord',              enabled: true },
      ]
    },
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

    setUploading(true)
    setError('')

    const formData = new FormData()
    try {
      formData.append('file', file)
      formData.append('name', name)
      formData.append('source_type', sourceType)
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

  const isMicrosoft = selectedIntegration === 'outlook' || selectedIntegration === 'teams'
  const isConnected = integrationStatus?.status === 'connected'
  const integrationFields = INTEGRATION_CONFIG_FIELDS[selectedIntegration] || []

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
      <div className="bg-card rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            {step !== 'select-type' && (
              <button
                onClick={() => { setStep('select-type'); setError('') }}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="page-title">
              {step === 'select-type' ? 'Add Source' : step === 'upload' ? 'Upload File' : (integrationStatus?.meta?.label ?? selectedIntegration)}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'select-type' ? (
          <div className="p-6 space-y-8">
            {sourceTypes.map((category) => (
              <div key={category.category}>
                <h3 className="text-sm text-muted-foreground mb-3">
                  {category.category}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {category.types.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => {
                        if (!type.enabled) return
                        if ((category as any).integration) {
                          openIntegrationConnect(type.value)
                        } else {
                          setSourceType(type.value)
                          setStep('upload')
                        }
                      }}
                      disabled={!type.enabled}
                      className={`p-4 rounded-lg border-2 transition text-left relative ${
                        !type.enabled
                          ? 'opacity-50 cursor-not-allowed border-border'
                          : 'border-border hover:border-primary hover:bg-primary/5'
                      }`}
                    >
                      <ConnectorIcon type={type.value} className="w-6 h-6 mb-2 text-muted-foreground" />
                      <div className="text-sm font-medium">{type.label}</div>
                      {(type as any).comingSoon && (
                        <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-chart-4/20 text-chart-4 font-medium">
                          Soon
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : step === 'connect' ? (
          <div className="p-6 space-y-5">
            {/* Status row */}
            <div className="flex items-center gap-3">
              {isConnected
                ? <span className="flex items-center gap-1.5 text-sm px-3 py-1 rounded-full bg-chart-3/15 text-chart-3 font-medium"><CheckCircle2 className="w-4 h-4" />Connected</span>
                : integrationStatus?.status === 'error'
                  ? <span className="flex items-center gap-1.5 text-sm px-3 py-1 rounded-full bg-destructive/15 text-destructive font-medium"><XCircle className="w-4 h-4" />Error</span>
                  : <span className="text-sm px-3 py-1 rounded-full bg-muted text-muted-foreground">Not connected</span>
              }
              {integrationStatus?.last_synced_at && (
                <span className="text-xs text-muted-foreground">Last synced: {new Date(integrationStatus.last_synced_at).toLocaleString()}</span>
              )}
            </div>

            {integrationStatus?.last_error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{integrationStatus.last_error}</p>
            )}

            {/* Description */}
            <p className="text-sm text-muted-foreground">{integrationStatus?.meta?.description ?? ''}</p>

            {/* Connect area */}
            {!isConnected && (
              isMicrosoft ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Click below to authorise Evols with your Microsoft account. A popup will open — sign in and approve the requested permissions.
                  </p>
                  <button
                    onClick={() => handleMicrosoftOAuth(selectedIntegration)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/85 text-primary-foreground rounded-lg hover:bg-primary transition text-sm"
                  >
                    <Link2 className="w-4 h-4" />
                    Authorise with Microsoft
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Access token / API key</label>
                    <input
                      type="password"
                      value={oauthToken}
                      onChange={e => setOauthToken(e.target.value)}
                      placeholder="Paste your token here"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none text-sm"
                    />
                  </div>
                  {integrationFields.map(f => (
                    <div key={f.key}>
                      <label className="block text-sm font-medium mb-1.5">{f.label}</label>
                      <input
                        type="text"
                        value={configValues[f.key] ?? ''}
                        onChange={e => setConfigValues(v => ({ ...v, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none text-sm"
                      />
                    </div>
                  ))}
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <button
                    onClick={handleTokenConnect}
                    disabled={connecting}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/85 text-primary-foreground rounded-lg hover:bg-primary transition text-sm disabled:opacity-50"
                  >
                    {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                    Connect
                  </button>
                </div>
              )
            )}

            {/* Config for already-connected integrations */}
            {isConnected && integrationFields.length > 0 && (
              <div className="space-y-4 pt-2 border-t border-border">
                <h3 className="text-sm font-medium text-foreground">Configuration</h3>
                {integrationFields.map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium mb-1.5">{f.label}</label>
                    <input
                      type="text"
                      value={configValues[f.key] ?? (
                        Array.isArray(integrationStatus?.config?.[f.key])
                          ? integrationStatus.config[f.key].join(', ')
                          : integrationStatus?.config?.[f.key] ?? ''
                      )}
                      onChange={e => setConfigValues(v => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none text-sm"
                    />
                  </div>
                ))}
                {error && <p className="text-sm text-destructive">{error}</p>}
                <button
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  className="flex items-center gap-2 px-4 py-2 bg-primary/85 text-primary-foreground rounded-lg hover:bg-primary transition text-sm disabled:opacity-50"
                >
                  {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save
                </button>
              </div>
            )}

            {/* Connected actions */}
            {isConnected && (
              <div className="flex items-center gap-3 pt-2 border-t border-border">
                <button
                  onClick={handleSyncNow}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted transition text-sm disabled:opacity-50"
                >
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Sync Now
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-destructive/10 hover:text-destructive transition text-sm text-muted-foreground disabled:opacity-50"
                >
                  {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2Off className="w-4 h-4" />}
                  Disconnect
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">Upload File</label>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
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
                  <Upload className="w-12 h-12 text-muted-foreground mb-3" />
                  {file ? (
                    <p className="text-sm font-medium text-foreground">
                      {file.name}
                    </p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground">
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
                className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none"
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
                className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-ring/50 outline-none"
              />
            </div>

            {/* Data Retention Policy */}
            {/* Error Message */}
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive dark:text-destructive px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-border">
              <button
                onClick={() => setStep('select-type')}
                disabled={uploading}
                className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition"
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
