import Head from 'next/head'
import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import {
  Database, Plus, Upload, FileText, MessageSquare, Mail, Slack,
  Github, BookOpen, Cloud, X, Loader2, Search,
  Building2, User, Lightbulb, AlertCircle, Zap, Users, Target, Trash2, Check, RefreshCw, Brain, ChevronDown, Network, Filter, Pencil, GitMerge
} from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api, apiClient } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, Card, EmptyState, Loading } from '@/components/PageContainer'
import KnowledgeGraphTab from '@/components/context/KnowledgeGraphTab'

type ViewType = 'sources' | 'entities' | 'insights' | 'knowledge_graph'

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
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [entityTypeFilter, setEntityTypeFilter] = useState<Set<string>>(new Set())
  const [processingSourceIds, setProcessingSourceIds] = useState<Set<number>>(new Set())

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

    loadContext()
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

  const handleTabChange = (view: ViewType) => {
    setSelectedView(view)
    router.push(`/context?tab=${view}`, undefined, { shallow: true })
    if (view === 'entities') loadGraphEntities()
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

      // Re-derive processing set from server state so the spinner survives navigation.
      const inProgress = allSources
        .filter((s: any) => s.status === 'processing' || s.status === 'pending')
        .map((s: any) => s.id)
      if (inProgress.length > 0) {
        setProcessingSourceIds(prev => {
          const next = new Set(prev)
          inProgress.forEach((id: number) => next.add(id))
          return next
        })
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
                  onClick={() => { loadContext(); loadGraphEntities() }}
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
                      <Lightbulb className="w-4 h-4 inline mr-2" />
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
                  </div>

                  {/* Search + entity type filter */}
                  <div className="flex items-center gap-2">
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
                        counts={graphEntities.reduce<Record<string, number>>((acc, e) => {
                          acc[e.entity_type] = (acc[e.entity_type] ?? 0) + 1
                          return acc
                        }, {})}
                      />
                    )}
                  </div>
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
                />
              ) : selectedView === 'knowledge_graph' ? (
                <KnowledgeGraphTab typeFilter={entityTypeFilter} onTypeFilterChange={setEntityTypeFilter} />
              ) : (
                <InsightsView sources={contextSources} entities={graphEntities} />
              )}
            </>
          )}
        </PageContainer>

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

const ENTITY_TYPES = [
  { value: 'persona',         label: 'Personas'         },
  { value: 'person',          label: 'People'           },
  { value: 'pain_point',      label: 'Pain Points'      },
  { value: 'feature_request', label: 'Feature Requests' },
  { value: 'feature',         label: 'Features'         },
  { value: 'competitor',      label: 'Competitors'      },
  { value: 'organization',    label: 'Organizations'    },
  { value: 'product',         label: 'Products'         },
  { value: 'technology',      label: 'Technology'       },
  { value: 'project',         label: 'Projects'         },
  { value: 'business_goal',   label: 'Business Goals'   },
  { value: 'metric',          label: 'Metrics'          },
  { value: 'decision',        label: 'Decisions'        },
  { value: 'market',          label: 'Markets'          },
]

function EntityTypeFilterDropdown({
  selected,
  onChange,
  counts = {},
}: {
  selected: Set<string>
  onChange: (next: Set<string>) => void
  counts?: Record<string, number>
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

  const toggle = (type: string) => {
    const next = new Set(selected)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    onChange(next)
  }

  const label = selected.size === 0
    ? 'All types'
    : selected.size === 1
      ? ENTITY_TYPES.find(t => t.value === [...selected][0])?.label ?? [...selected][0]
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
            {ENTITY_TYPES.map(({ value, label: lbl }) => (
              <button
                key={value}
                onClick={() => toggle(value)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted rounded transition-colors"
              >
                <div className="w-4 h-4 border border-border rounded flex items-center justify-center flex-shrink-0">
                  {selected.has(value) && <Check className="w-3 h-3 text-primary" />}
                </div>
                <span className="text-sm text-foreground flex-1 text-left">
                  {lbl}
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
                <div className="col-span-2 text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
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
}: {
  entities: any[]
  loading: boolean
  onRefresh?: () => void
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
            icon={Brain}
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
}: {
  entity: any
  onClose: () => void
  onSaved: () => void
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
              {ENTITY_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
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

export function AddContextModal({
  onClose,
  onSuccess
}: {
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

    setUploading(true)
    setError('')

    const formData = new FormData()
    try {
      formData.append('file', file)
      formData.append('name', name)
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
      <div className="bg-card rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <h2 className="page-title">
            {step === 'select-type' ? 'Select Source Type' : 'Upload File'}
          </h2>
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
                        if (type.enabled) {
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
                      <type.icon className="w-6 h-6 mb-2 text-muted-foreground" />
                      <div className="text-sm font-medium">{type.label}</div>
                      {type.comingSoon && (
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
            <div>
              <label className="block text-sm font-medium mb-2">Data Retention Policy</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowRetentionDropdown(!showRetentionDropdown)}
                  className="w-full flex items-center justify-between px-4 py-3 border border-border rounded-lg bg-input text-foreground hover:bg-muted focus:ring-2 focus:ring-ring/50 focus:border-ring transition"
                >
                  <span className="flex items-center gap-2 text-sm">
                    {retentionPolicy === 'delete_immediately' && '🔒 Maximum Privacy'}
                    {retentionPolicy === '30_days' && (
                      <>
                        ⚖️ Balanced
                        <span className="px-2 py-0.5 text-[10px] rounded-full bg-chart-3/15 text-chart-3 font-medium">
                          Recommended
                        </span>
                      </>
                    )}
                    {retentionPolicy === '90_days' && '📅 Extended Retention'}
                    {retentionPolicy === 'retain_encrypted' && '📁 Full Retention (Encrypted)'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showRetentionDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showRetentionDropdown && (
                  <div className="absolute z-50 mt-2 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                    <div className="p-1 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setRetentionPolicy('delete_immediately');
                          setShowRetentionDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-3 rounded transition-colors ${
                          retentionPolicy === 'delete_immediately'
                            ? 'bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">🔒 Maximum Privacy</span>
                          {retentionPolicy === 'delete_immediately' && (
                            <Check className="w-4 h-4 text-primary dark:text-primary" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
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
                            ? 'bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">⚖️ Balanced</span>
                            <span className="px-2 py-0.5 text-[10px] rounded-full bg-chart-3/15 text-chart-3 font-medium">
                              Recommended
                            </span>
                          </div>
                          {retentionPolicy === '30_days' && (
                            <Check className="w-4 h-4 text-primary dark:text-primary" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
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
                            ? 'bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">📅 Extended Retention</span>
                          {retentionPolicy === '90_days' && (
                            <Check className="w-4 h-4 text-primary dark:text-primary" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
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
                            ? 'bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">📁 Full Retention (Encrypted)</span>
                          {retentionPolicy === 'retain_encrypted' && (
                            <Check className="w-4 h-4 text-primary dark:text-primary" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
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
