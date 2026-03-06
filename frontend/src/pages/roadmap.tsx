import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { TrendingUp, Rocket, RefreshCw, Loader2, Mountain, Zap, ChevronRight, ChevronDown, Sparkles, Package, Layers, Target, ArrowUpDown, Check } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, Card, EmptyState, StatCard, Loading } from '@/components/PageContainer'
import { useJobPolling } from '@/hooks/useJobPolling'

export default function Roadmap() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [initiatives, setInitiatives] = useState<any[]>([])
  const [projects, setProjects] = useState<Record<number, any[]>>({})
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
    loadInitiatives()

    const savedJobId = localStorage.getItem('initiatives_refresh_job_id')
    if (savedJobId) setRefreshJobId(savedJobId)
  }, [])

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
          const aCount = (projects[a.id] || []).length
          const bCount = (projects[b.id] || []).length
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
      const initiativesResponse = await api.getInitiatives()
      const initiativesData = initiativesResponse.data.items || initiativesResponse.data || []
      setInitiatives(initiativesData)

      const projectsResponse = await api.getProjects()
      const projectsData = projectsResponse.data.items || projectsResponse.data || []

      const projectsByInitiative: Record<number, any[]> = {}
      projectsData.forEach((project: any) => {
        if (!projectsByInitiative[project.initiative_id]) {
          projectsByInitiative[project.initiative_id] = []
        }
        projectsByInitiative[project.initiative_id].push(project)
      })
      setProjects(projectsByInitiative)
    } catch (error) {
      console.error('Error loading initiatives:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshInitiatives = async () => {
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

  const totalProjects = Object.values(projects).reduce((sum, arr) => sum + arr.length, 0)
  const totalThemes = new Set(
    initiatives.flatMap(i => (i.themes || []).map((t: any) => t.id))
  ).size

  return (
    <>
      <Head>
        <title>Roadmap - ProductOS</title>
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

          {loading ? (
            <Card>
              <Loading text="Loading initiatives..." />
            </Card>
          ) : initiatives.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Rocket className="w-16 h-16" />}
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

              {/* Initiatives List Header with Sorting and Pagination */}
              <div className="flex items-center justify-between mb-6 mt-8">
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
                                sortBy === option.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
                              }`}>
                                {option.label}
                              </span>
                              {sortBy === option.value && (
                                <Check className="ml-auto w-4 h-4 text-blue-600 dark:text-blue-400" />
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
                    projects={projects[initiative.id] || []}
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
        </PageContainer>
      </div>
    </>
  )
}

function InitiativeCard({
  initiative,
  projects,
  isExpanded,
  onToggle,
}: {
  initiative: any
  projects: any[]
  isExpanded: boolean
  onToggle: () => void
}) {
  const sortedProjects = [...projects].sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
  const boulders = sortedProjects.filter(p => p.is_boulder)
  const pebbles = sortedProjects.filter(p => !p.is_boulder)

  // Calculate aggregate metrics from linked themes
  const themes = initiative.themes || []
  const totalFeedback = themes.reduce((sum: number, t: any) => sum + (t.feedback_count || 0), 0)
  const totalAccounts = themes.reduce((sum: number, t: any) => sum + (t.account_count || 0), 0)
  const avgUrgency = themes.length > 0 
    ? themes.reduce((sum: number, t: any) => sum + (t.urgency_score || 0), 0) / themes.length 
    : 0
  const avgImpact = themes.length > 0
    ? themes.reduce((sum: number, t: any) => sum + (t.impact_score || 0), 0) / themes.length
    : 0

  return (
    <div className="card-hover p-6">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-heading">{initiative.title}</h3>
          </div>
          <p className="text-sm text-body mb-4">{initiative.description || 'No description'}</p>

          {/* Linked Themes Section */}
          {themes.length > 0 && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                Addressing {themes.length} Theme{themes.length > 1 ? 's' : ''}:
              </div>
              <div className="space-y-1">
                {themes.map((theme: any) => (
                  <div key={theme.id} className="text-xs text-body">
                    • {theme.title}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="font-medium">{totalFeedback}</span>
              <span className="text-body ml-1">feedback items</span>
            </div>
            <div>
              <span className="font-medium">{totalAccounts}</span>
              <span className="text-body ml-1">accounts</span>
            </div>
            <div>
              <span className="font-medium text-orange-600">
                {(avgUrgency * 100).toFixed(0)}%
              </span>
              <span className="text-body ml-1">urgency</span>
            </div>
            <div>
              <span className="font-medium text-green-600">
                {(avgImpact * 100).toFixed(0)}%
              </span>
              <span className="text-body ml-1">impact</span>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Section */}
      {projects.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onToggle}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <span>{projects.length} Projects</span>
            <span className="text-xs text-gray-500">
              ({boulders.length} boulders, {pebbles.length} pebbles)
            </span>
          </button>

          {isExpanded && (
            <div className="mt-3 space-y-3">
              {sortedProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
      )}

      {projects.length === 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No projects yet. Projects will be automatically generated when you refresh.
          </p>
        </div>
      )}
    </div>
  )
}
function ProjectCard({ project }: { project: any }) {
  const [expanded, setExpanded] = useState(false)

  const effortColors = {
    small: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    large: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    xlarge: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  }

  return (
    <div className="pl-4 py-3 border-l-2 border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {project.is_boulder ? (
              <Mountain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            ) : (
              <Zap className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            )}
            <span className="font-medium text-sm text-heading">{project.title}</span>
          </div>
          <p className="text-xs text-body mb-2">{project.description}</p>

          {project.acceptance_criteria && project.acceptance_criteria.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {expanded ? 'Hide' : 'Show'} acceptance criteria ({project.acceptance_criteria.length})
            </button>
          )}

          {expanded && project.acceptance_criteria && (
            <div className="mt-2 ml-6">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Acceptance Criteria:
              </div>
              <ul className="text-xs text-body space-y-0.5 list-disc ml-4">
                {project.acceptance_criteria.map((criterion: string, idx: number) => (
                  <li key={idx}>{criterion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="ml-4 flex flex-col items-end gap-2">
          <div className="text-right">
            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              {project.priority_score?.toFixed(1) || 'N/A'}
            </div>
            <div className="text-xs text-gray-500">Priority</div>
          </div>

          <span className={`px-2 py-0.5 rounded text-xs font-medium ${effortColors[project.effort as keyof typeof effortColors]}`}>
            {project.effort}
          </span>

          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              project.is_boulder
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
            }`}
          >
            {project.is_boulder ? 'Boulder' : 'Pebble'}
          </span>
        </div>
      </div>
    </div>
  )
}
