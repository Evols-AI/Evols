import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { TrendingUp, Rocket, RefreshCw, Loader2, Sparkles, Package, Layers, Target, ArrowUpDown, Check, Grid, Calendar, ChevronDown } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, Card, EmptyState, StatCard, Loading } from '@/components/PageContainer'
import { useJobPolling } from '@/hooks/useJobPolling'
import { InitiativeCard } from '@/components/roadmap/InitiativeCard'
import { PriorityMatrixTab } from '@/components/roadmap/PriorityMatrixTab'
import { InitiativeRoadmapTab } from '@/components/roadmap/InitiativeRoadmapTab'
import { useProducts } from '@/hooks/useProducts'
import { confirmDemoOperation } from '@/utils/demoWarning'

type TabType = 'projects' | 'matrix' | 'timeline'

function TabNav({ activeTab, setActiveTab }: { activeTab: TabType; setActiveTab: (tab: TabType) => void }) {
  const tabs = [
    { id: 'projects' as TabType, label: 'Projects', icon: Package },
    { id: 'matrix' as TabType, label: 'Priority Matrix', icon: Grid },
    { id: 'timeline' as TabType, label: 'Initiative Roadmap', icon: Calendar },
  ]

  return (
    <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
      {tabs.map(tab => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors ${
              isActive
                ? 'border-blue-500 text-blue-500 dark:text-blue-300'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Icon className="w-5 h-5" />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export default function Roadmap() {
  const router = useRouter()
  const { selectedProductIds } = useProducts()
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<TabType>('projects')
  const [initiatives, setInitiatives] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [themes, setThemes] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshJobId, setRefreshJobId] = useState<string | null>(null)
  const [expandedInitiatives, setExpandedInitiatives] = useState<Set<number>>(new Set())
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [sortBy, setSortBy] = useState<'urgency' | 'projects' | 'feedback' | 'accounts' | 'name'>('urgency')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const sortDropdownRef = useRef<HTMLDivElement>(null)

  const { jobStatus: refreshJobStatus, isPolling: isRefreshing } = useJobPolling({
    jobId: refreshJobId,
    onComplete: (result) => {
      loadInitiatives()
      setRefreshJobId(null)
      localStorage.removeItem('initiatives_refresh_job_id')

      // Show consolidated success message from backend
      alert(`✓ ${result?.message || 'Themes, initiatives, and projects refreshed successfully!'}`)
    },
    onError: (error) => {
      setRefreshJobId(null)
      localStorage.removeItem('initiatives_refresh_job_id')
      alert(`✗ Failed to refresh: ${error}`)
    },
  })

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    setUser(getCurrentUser())
    loadProducts()

    // Only load data if products are selected
    if (selectedProductIds.length > 0) {
      loadInitiatives()
    } else {
      setLoading(false)
    }

    const savedJobId = localStorage.getItem('initiatives_refresh_job_id')
    if (savedJobId) setRefreshJobId(savedJobId)
  }, [selectedProductIds])

  const loadProducts = async () => {
    try {
      const data = await api.products.list()
      setProducts(data)
    } catch (error) {
      console.error('Failed to load products:', error)
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset to page 1 when sort changes
  useEffect(() => {
    setCurrentPage(1)
  }, [sortBy])

  const getSortDisplayText = () => {
    switch (sortBy) {
      case 'urgency':
        return 'Urgency & Impact'
      case 'projects':
        return 'Project Count'
      case 'feedback':
        return 'Feedback Count'
      case 'accounts':
        return 'Account Count'
      case 'name':
        return 'A-Z'
      default:
        return 'Sort By'
    }
  }

  const sortInitiatives = (initiativesList: any[]) => {
    const sorted = [...initiativesList]

    switch (sortBy) {
      case 'urgency':
        return sorted.sort((a, b) => {
          const aScore = (a.themes || []).reduce((sum: number, t: any) =>
            sum + (t.urgency_score || 0) + (t.impact_score || 0), 0) / Math.max((a.themes || []).length, 1)
          const bScore = (b.themes || []).reduce((sum: number, t: any) =>
            sum + (t.urgency_score || 0) + (t.impact_score || 0), 0) / Math.max((b.themes || []).length, 1)
          return bScore - aScore
        })
      case 'projects':
        return sorted.sort((a, b) => {
          const aCount = projects.filter(p => p.initiative_id === a.id).length
          const bCount = projects.filter(p => p.initiative_id === b.id).length
          return bCount - aCount
        })
      case 'feedback':
        return sorted.sort((a, b) => {
          const aCount = (a.themes || []).reduce((sum: number, t: any) => sum + (t.feedback_count || 0), 0)
          const bCount = (b.themes || []).reduce((sum: number, t: any) => sum + (t.feedback_count || 0), 0)
          return bCount - aCount
        })
      case 'accounts':
        return sorted.sort((a, b) => {
          const aCount = (a.themes || []).reduce((sum: number, t: any) => sum + (t.account_count || 0), 0)
          const bCount = (b.themes || []).reduce((sum: number, t: any) => sum + (t.account_count || 0), 0)
          return bCount - aCount
        })
      case 'name':
        return sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
      default:
        return sorted
    }
  }

  const getPaginatedInitiatives = () => {
    const sorted = sortInitiatives(initiatives)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return sorted.slice(startIndex, endIndex)
  }

  const totalPages = Math.ceil(initiatives.length / itemsPerPage)

  const loadInitiatives = async () => {
    try {
      setLoading(true)
      const productIdsParam = selectedProductIds.join(',')

      // Fetch all data in parallel
      const [initiativesResponse, projectsResponse, themesResponse] = await Promise.all([
        api.getInitiatives({ product_ids: productIdsParam }),
        api.getProjects({ product_ids: productIdsParam }),
        api.getThemes({ product_ids: productIdsParam }),
      ])

      const initiativesData = initiativesResponse.data.items || initiativesResponse.data || []
      const projectsData = projectsResponse.data.items || projectsResponse.data || []
      const themesData = themesResponse.data.items || themesResponse.data || []

      // Backend already returns initiatives with their themes, no enrichment needed
      setInitiatives(initiativesData)
      setProjects(projectsData)
      setThemes(themesData)
    } catch (error) {
      console.error('Error loading roadmap data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshInitiatives = async () => {
    // Check if user is operating on demo products and show warning
    const confirmed = await confirmDemoOperation(
      selectedProductIds,
      products,
      'refresh themes, initiatives, and projects'
    )

    if (!confirmed) {
      return // User cancelled
    }

    try {
      const response = await api.refreshThemesAsync()
      const { job_id } = response.data

      localStorage.setItem('initiatives_refresh_job_id', job_id)
      setRefreshJobId(job_id)
    } catch (error: any) {
      console.error('Error starting refresh:', error)
      alert(`Failed to start refresh: ${error.response?.data?.detail || error.message}`)
    }
  }

  const toggleInitiative = (id: number) => {
    const newExpanded = new Set(expandedInitiatives)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedInitiatives(newExpanded)
  }

  const totalProjects = projects.length
  const totalThemes = new Set(
    initiatives.flatMap(i => (i.themes || []).map((t: any) => t.id))
  ).size

  return (
    <>
      <Head>
        <title>Roadmap - Evols</title>
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Header user={user} currentPage="roadmap" />

        <PageContainer>
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Product Roadmap
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefreshInitiatives}
                  disabled={isRefreshing}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                  title={refreshJobStatus?.message || undefined}
                >
                  {isRefreshing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {isRefreshing ? (
                    <span>Refreshing... {refreshJobStatus?.progress ? `${(refreshJobStatus.progress * 100).toFixed(0)}%` : ''}</span>
                  ) : (
                    <span>Refresh All</span>
                  )}
                </button>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              AI-powered product roadmap with prioritized initiatives and projects based on customer feedback
            </p>
          </div>

          {selectedProductIds.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-body mb-2">No product selected</p>
              <p className="text-sm text-muted">
                Please select a product from the dropdown above to view your roadmap.
              </p>
            </Card>
          ) : loading ? (
            <Card>
              <Loading text="Loading initiatives..." />
            </Card>
          ) : initiatives.length === 0 ? (
            <Card>
              <EmptyState
                icon={Rocket}
                title="No roadmap yet"
                description="Upload customer feedback and click 'Refresh All' to automatically generate an AI-powered product roadmap with prioritized initiatives and projects."
                action={
                  <Link href="/feedback" className="btn-primary inline-flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Go to Feedback
                  </Link>
                }
              />
            </Card>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
                <StatCard
                  title="Total Themes"
                  value={totalThemes}
                  icon={<Layers className="w-5 h-5" />}
                  color="blue"
                />
                <StatCard
                  title="Total Initiatives"
                  value={initiatives.length}
                  icon={<Target className="w-5 h-5" />}
                  color="green"
                />
                <StatCard
                  title="Total Projects"
                  value={totalProjects}
                  icon={<Package className="w-5 h-5" />}
                  color="purple"
                />
                <StatCard
                  title="Avg Urgency"
                  value={(() => {
                    const initiativesWithThemes = initiatives.filter(i => i.themes && i.themes.length > 0)
                    if (initiativesWithThemes.length === 0) return '0%'
                    const totalUrgency = initiativesWithThemes.reduce((sum, i) => {
                      const themes = i.themes || []
                      const avgUrgency = themes.length > 0
                        ? themes.reduce((tSum: number, t: any) => tSum + (t.urgency_score || 0), 0) / themes.length
                        : 0
                      return sum + avgUrgency
                    }, 0)
                    return ((totalUrgency / initiativesWithThemes.length) * 100).toFixed(0) + '%'
                  })()}
                  icon={<TrendingUp className="w-5 h-5" />}
                  color="orange"
                />
                <StatCard
                  title="Avg Impact"
                  value={(() => {
                    const initiativesWithThemes = initiatives.filter(i => i.themes && i.themes.length > 0)
                    if (initiativesWithThemes.length === 0) return '0%'
                    const totalImpact = initiativesWithThemes.reduce((sum, i) => {
                      const themes = i.themes || []
                      const avgImpact = themes.length > 0
                        ? themes.reduce((tSum: number, t: any) => tSum + (t.impact_score || 0), 0) / themes.length
                        : 0
                      return sum + avgImpact
                    }, 0)
                    return ((totalImpact / initiativesWithThemes.length) * 100).toFixed(0) + '%'
                  })()}
                  icon={<TrendingUp className="w-5 h-5" />}
                  color="green"
                />
              </div>

              {/* Tab Navigation */}
              <TabNav activeTab={activeTab} setActiveTab={setActiveTab} />

              {/* Initiatives List Header with Sorting and Pagination (Projects Tab) */}
              {activeTab === 'projects' && (
                <>
                  <div className="flex items-center justify-between mb-6 mt-2">
                    <h2 className="text-2xl font-bold text-heading">
                      Initiatives ({initiatives.length})
                    </h2>

                <div className="flex items-center gap-3">
                  {/* Sort Dropdown */}
                  <div className="relative" ref={sortDropdownRef}>
                    <button
                      onClick={() => setShowSortDropdown(!showSortDropdown)}
                      className="px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 min-w-[200px]"
                    >
                      <ArrowUpDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm font-medium">{getSortDisplayText()}</span>
                      <ChevronDown className="absolute right-3 w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>

                    {showSortDropdown && (
                      <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50">
                        <div className="p-2">
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-2">
                            Sort By
                          </div>
                          {[
                            { value: 'urgency', label: 'Urgency & Impact', icon: '🔥' },
                            { value: 'projects', label: 'Project Count', icon: '📦' },
                            { value: 'feedback', label: 'Feedback Count', icon: '💬' },
                            { value: 'accounts', label: 'Account Count', icon: '👥' },
                            { value: 'name', label: 'A-Z', icon: '🔤' },
                          ].map((option) => (
                            <button
                              key={option.value}
                              onClick={() => {
                                setSortBy(option.value as any)
                                setShowSortDropdown(false)
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors ${
                                sortBy === option.value ? 'bg-gray-100 dark:bg-gray-600' : ''
                              }`}
                            >
                              <span className="text-base">{option.icon}</span>
                              <span className={`text-sm font-medium ${
                                sortBy === option.value ? 'text-blue-500 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'
                              }`}>
                                {option.label}
                              </span>
                              {sortBy === option.value && (
                                <Check className="ml-auto w-4 h-4 text-blue-500 dark:text-blue-300" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pagination Controls (Top) */}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-body font-medium whitespace-nowrap">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </div>

                  {/* Initiatives List */}
                  <div className="space-y-6">
                    {getPaginatedInitiatives().map((initiative) => (
                      <InitiativeCard
                        key={initiative.id}
                        initiative={initiative}
                        projects={projects.filter(p => p.initiative_id === initiative.id)}
                        isExpanded={expandedInitiatives.has(initiative.id)}
                        onToggle={() => toggleInitiative(initiative.id)}
                      />
                    ))}
                  </div>

                  {/* Pagination Controls (Bottom) */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-8">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-body font-medium">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Tab 2: Priority Matrix */}
              {activeTab === 'matrix' && (
                <PriorityMatrixTab
                  initiatives={initiatives}
                  projects={projects}
                  themes={themes}
                />
              )}

              {/* Tab 3: Initiative Roadmap */}
              {activeTab === 'timeline' && (
                <InitiativeRoadmapTab
                  initiatives={initiatives}
                  projects={projects}
                  onRefresh={loadInitiatives}
                />
              )}
            </>
          )}
        </PageContainer>
      </div>
    </>
  )
}
