import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { Sparkles, Users, MessageSquare, Scale, RefreshCw, Loader2, Edit2, X, ChevronDown, Check, ArrowUpDown } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card, EmptyState, Loading } from '@/components/PageContainer'
import { useJobPolling } from '@/hooks/useJobPolling'
import { useProducts } from '@/hooks/useProducts'

export default function Personas() {
  const router = useRouter()
  const { selectedProductIds } = useProducts()
  const [user, setUser] = useState<any>(null)
  const [personas, setPersonas] = useState<any[]>([])
  const [totalPersonas, setTotalPersonas] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showAskModal, setShowAskModal] = useState(false)
  const [showVoteModal, setShowVoteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [editingPersona, setEditingPersona] = useState<any>(null)
  const [selectedForMerge, setSelectedForMerge] = useState<number[]>([])
  const [tagFilter, setTagFilter] = useState<string[]>(['new', 'advisor'])
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [sortBy, setSortBy] = useState<'confidence' | 'name' | 'revenue' | 'usage'>('confidence')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(12)
  const [refreshJobId, setRefreshJobId] = useState<string | null>(null)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const statusDropdownRef = useRef<HTMLDivElement>(null)
  const sortDropdownRef = useRef<HTMLDivElement>(null)

  const { jobStatus: refreshJobStatus, isPolling: isRefreshing } = useJobPolling({
    jobId: refreshJobId,
    onComplete: (result) => {
      loadPersonas()
      loadLastRefreshTime()
      setRefreshJobId(null)
      localStorage.removeItem('personas_refresh_job_id')

      // Show consolidated success message from backend
      alert(`✓ ${result?.message || 'Personas refreshed successfully!'}`)
    },
    onError: (error) => {
      setRefreshJobId(null)
      localStorage.removeItem('personas_refresh_job_id')
      alert(`✗ Failed to refresh personas: ${error}`)
    },
  })

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    setUser(getCurrentUser())

    // Only load data if products are selected
    if (selectedProductIds.length > 0) {
      loadPersonas()
      loadLastRefreshTime()
    } else {
      setLoading(false)
    }

    const savedJobId = localStorage.getItem('personas_refresh_job_id')
    if (savedJobId) setRefreshJobId(savedJobId)
  }, [selectedProductIds])

  useEffect(() => {
    if (user && selectedProductIds.length > 0) {
      loadPersonas()
      setCurrentPage(1) // Reset to page 1 when filter or sort changes
    }
  }, [tagFilter, sortBy, selectedProductIds])

  const loadPersonas = async () => {
    try {
      setLoading(true)
      const productIdsParam = selectedProductIds.join(',')
      const response = await api.getPersonas({
        status_filter: tagFilter.join(','),
        product_ids: productIdsParam
      })
      setPersonas(response.data.items || response.data || [])

      const totalResponse = await api.getPersonas({
        status_filter: 'new,advisor,dismissed',
        product_ids: productIdsParam
      })
      setTotalPersonas((totalResponse.data.items || totalResponse.data || []).length)
    } catch (error) {
      console.error('Error loading personas:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadLastRefreshTime = async () => {
    try {
      const response = await api.getPersonaRefreshSettings()
      const lastRefresh = response.data.last_refresh_date
      if (lastRefresh) {
        setLastRefreshTime(new Date(lastRefresh))
      }
    } catch (error) {
      console.error('Error loading last refresh time:', error)
    }
  }

  const toggleStatusFilter = (status: string) => {
    setTagFilter(prev => {
      if (prev.includes(status)) {
        // Don't allow removing all filters
        if (prev.length === 1) return prev
        return prev.filter(s => s !== status)
      } else {
        return [...prev, status]
      }
    })
  }

  const getFilterDisplayText = () => {
    if (tagFilter.length === 3) return 'All'
    const statusNames = tagFilter.map(s => {
      if (s === 'advisor') return 'Active'
      if (s === 'dismissed') return 'Inactive'
      return 'New'
    })
    return statusNames.join(' & ')
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false)
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getSortDisplayText = () => {
    switch (sortBy) {
      case 'confidence':
        return 'Confidence Score'
      case 'name':
        return 'A-Z'
      case 'revenue':
        return 'Revenue'
      case 'usage':
        return 'Usage Frequency'
      default:
        return 'Sort By'
    }
  }

  const sortPersonas = (personasList: any[]) => {
    const sorted = [...personasList]

    switch (sortBy) {
      case 'confidence':
        return sorted.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0))
      case 'name':
        return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      case 'revenue':
        return sorted.sort((a, b) => {
          const aRevenue = a.extra_data?.revenue_contribution || 0
          const bRevenue = b.extra_data?.revenue_contribution || 0
          return bRevenue - aRevenue
        })
      case 'usage':
        return sorted.sort((a, b) => {
          const usageOrder = { 'Daily': 3, 'Weekly': 2, 'Monthly': 1 }
          const aUsage = usageOrder[a.extra_data?.usage_frequency as keyof typeof usageOrder] || 0
          const bUsage = usageOrder[b.extra_data?.usage_frequency as keyof typeof usageOrder] || 0
          return bUsage - aUsage
        })
      default:
        return sorted
    }
  }

  const getPaginatedPersonas = () => {
    const sorted = sortPersonas(personas)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return sorted.slice(startIndex, endIndex)
  }

  const totalPages = Math.ceil(personas.length / itemsPerPage)

  const handleRefreshPersonas = async () => {
    try {
      const response = await api.refreshPersonasAsync()
      const { job_id } = response.data

      localStorage.setItem('personas_refresh_job_id', job_id)
      setRefreshJobId(job_id)
    } catch (error: any) {
      console.error('Error starting persona refresh:', error)
      alert(`Failed to start persona refresh: ${error.response?.data?.detail || error.message}`)
    }
  }

  const formatLastRefresh = () => {
    if (!lastRefreshTime) return null
    const now = new Date()
    const diffMs = now.getTime() - lastRefreshTime.getTime()
    const diffMins = Math.abs(Math.floor(diffMs / 60000))

    if (diffMins < 1) return 'Just now'
    if (diffMins === 1) return '1 minute ago'
    if (diffMins < 60) return `${diffMins} minutes ago`

    const diffHours = Math.abs(Math.floor(diffMins / 60))
    if (diffHours === 1) return '1 hour ago'
    if (diffHours < 24) return `${diffHours} hours ago`

    return lastRefreshTime.toLocaleDateString()
  }

  const handleEditPersona = async (persona: any) => {
    // If persona is "new", mark it as active since user is reviewing it
    if (persona.status === 'new') {
      try {
        await api.updatePersonaStatus(persona.id, 'advisor')
        // Update persona in state without reloading (preserves scroll position)
        setPersonas(prev =>
          prev.map(p => p.id === persona.id ? { ...p, status: 'advisor' } : p)
        )
      } catch (error) {
        console.error('Error updating status:', error)
      }
    }
    setEditingPersona(persona)
    setShowEditModal(true)
  }

  const handleSavePersona = async (personaId: number, updates: any) => {
    try {
      await api.updatePersona(personaId, updates)
      // Update persona in state without reloading (preserves scroll position)
      setPersonas(prev =>
        prev.map(p => p.id === personaId ? { ...p, ...updates } : p)
      )
      setShowEditModal(false)
      alert('Persona updated successfully!')
    } catch (error) {
      console.error('Error updating persona:', error)
      alert('Failed to update persona')
    }
  }

  const handleChangeStatus = async (personaId: number, status: string) => {
    try {
      await api.updatePersonaStatus(personaId, status)
      // Clear from merge selection if selected
      setSelectedForMerge(prev => prev.filter(id => id !== personaId))

      // Update persona in state without reloading (preserves scroll position)
      setPersonas(prev =>
        prev.map(p => p.id === personaId ? { ...p, status } : p)
      )
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Failed to update status')
    }
  }

  const toggleMergeSelection = (personaId: number) => {
    setSelectedForMerge(prev =>
      prev.includes(personaId)
        ? prev.filter(id => id !== personaId)
        : [...prev, personaId]
    )
  }

  const handleMerge = async (primaryId: number) => {
    try {
      await api.mergePersonas({
        persona_ids: selectedForMerge,
        primary_persona_id: primaryId
      })
      await loadPersonas()
      setSelectedForMerge([])
      setShowMergeModal(false)
      alert('Personas merged successfully!')
    } catch (error) {
      console.error('Error merging personas:', error)
      alert('Failed to merge personas')
    }
  }

  const formatLastUpdated = (dateString: string) => {
    if (!dateString) return 'Recently'

    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.abs(Math.floor(diffMs / (1000 * 60 * 60 * 24)))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return `${Math.floor(diffDays / 30)} months ago`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'advisor':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'new':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      case 'dismissed':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  return (
    <>
      <Head>
        <title>Personas - Evols</title>
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Header user={user} currentPage="personas" />

        <PageContainer>
          {/* Custom Header with Refresh Button */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Digital Twin Personas
                </h1>
              </div>
              <button
                onClick={handleRefreshPersonas}
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
                  <span>Refresh Personas</span>
                )}
              </button>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-gray-600 dark:text-gray-400">
                AI-powered customer personas from your feedback
              </p>
              {lastRefreshTime && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  • Last refreshed {formatLastRefresh()}
                </p>
              )}
            </div>
          </div>

          {selectedProductIds.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-body mb-2">No product selected</p>
              <p className="text-sm text-muted">
                Please select a product from the dropdown above to view personas.
              </p>
            </Card>
          ) : loading ? (
            <Card>
              <Loading text="Loading personas..." />
            </Card>
          ) : totalPersonas === 0 ? (
            <Card>
              <EmptyState
                icon={<Users className="w-16 h-16" />}
                title="No personas yet"
                description="Personas are automatically generated when you add feedback with customer segments. Upload some feedback to get started!"
                action={
                  <Link href="/feedback"
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Go to Feedback
                  </Link>
                }
              />
            </Card>
          ) : personas.length === 0 ? (
            <>
              {/* Action Buttons Row */}
              <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowAskModal(true)}
                    className="btn-primary flex items-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Ask Personas
                  </button>

                  <button
                    onClick={() => setShowVoteModal(true)}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Scale className="w-4 h-4" />
                    Trade-off Voting
                  </button>
                </div>

                {/* Status Filter Multi-Select */}
                <div className="relative" ref={statusDropdownRef}>
                  <button
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    className="px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 min-w-[160px]"
                  >
                    <span className="text-sm font-medium">{getFilterDisplayText()}</span>
                    <ChevronDown className="absolute right-3 w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>

                  {showStatusDropdown && (
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50">
                      <div className="p-2">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-2">
                          Filter by Status
                        </div>
                        {[
                          { value: 'new', label: 'New', color: 'text-blue-600 dark:text-blue-400' },
                          { value: 'advisor', label: 'Active', color: 'text-green-600 dark:text-green-400' },
                          { value: 'dismissed', label: 'Inactive', color: 'text-gray-600 dark:text-gray-400' },
                        ].map((status) => (
                          <button
                            key={status.value}
                            onClick={() => toggleStatusFilter(status.value)}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                          >
                            <div className="w-4 h-4 flex items-center justify-center border-2 border-gray-300 dark:border-gray-500 rounded">
                              {tagFilter.includes(status.value) && (
                                <Check className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                              )}
                            </div>
                            <span className={`text-sm font-medium ${status.color}`}>
                              {status.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Personas Grid Header */}
              <div id="personas-list" className="mb-6">
                <h2 className="text-2xl font-bold text-heading">
                  {getFilterDisplayText()} Personas (0)
                </h2>
              </div>

              {/* No Results Message */}
              <Card>
                <div className="text-center py-12">
                  <Users className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    No {getFilterDisplayText().toLowerCase()} personas found
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Try selecting different filters to view other personas
                  </p>
                </div>
              </Card>
            </>
          ) : (
            <>
              {/* Action Buttons Row */}
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setShowAskModal(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Ask Personas
                </button>

                <button
                  onClick={() => setShowVoteModal(true)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Scale className="w-4 h-4" />
                  Trade-off Voting
                </button>
              </div>

              {/* Merge Selection Info */}
              {selectedForMerge.length >= 2 && (
                <div className="mb-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedForMerge.length} personas selected</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Select a primary persona and merge
                    </p>
                  </div>
                  <button
                    onClick={() => setShowMergeModal(true)}
                    className="btn-primary"
                  >
                    Merge Selected
                  </button>
                </div>
              )}

              {/* Personas Grid Header with Filters, Sorting, and Pagination */}
              <div id="personas-list" className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-heading">
                  {getFilterDisplayText()} Personas ({personas.length})
                </h2>

                <div className="flex items-center gap-3">
                  {/* Status Filter Multi-Select */}
                  <div className="relative" ref={statusDropdownRef}>
                    <button
                      onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                      className="px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 min-w-[160px]"
                    >
                      <span className="text-sm font-medium">{getFilterDisplayText()}</span>
                      <ChevronDown className="absolute right-3 w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>

                    {showStatusDropdown && (
                      <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50">
                        <div className="p-2">
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-2">
                            Filter by Status
                          </div>
                          {[
                            { value: 'new', label: 'New', color: 'text-blue-600 dark:text-blue-400' },
                            { value: 'advisor', label: 'Active', color: 'text-green-600 dark:text-green-400' },
                            { value: 'dismissed', label: 'Inactive', color: 'text-gray-600 dark:text-gray-400' },
                          ].map((status) => (
                            <button
                              key={status.value}
                              onClick={() => toggleStatusFilter(status.value)}
                              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                            >
                              <div className="w-4 h-4 flex items-center justify-center border-2 border-gray-300 dark:border-gray-500 rounded">
                                {tagFilter.includes(status.value) && (
                                  <Check className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                )}
                              </div>
                              <span className={`text-sm font-medium ${status.color}`}>
                                {status.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sort Dropdown */}
                  <div className="relative" ref={sortDropdownRef}>
                    <button
                      onClick={() => setShowSortDropdown(!showSortDropdown)}
                      className="px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 min-w-[180px]"
                    >
                      <ArrowUpDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm font-medium">{getSortDisplayText()}</span>
                      <ChevronDown className="absolute right-3 w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>

                    {showSortDropdown && (
                      <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50">
                        <div className="p-2">
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-2">
                            Sort By
                          </div>
                          {[
                            { value: 'confidence', label: 'Confidence Score', icon: '📊' },
                            { value: 'name', label: 'A-Z', icon: '🔤' },
                            { value: 'revenue', label: 'Revenue Contribution', icon: '💰' },
                            { value: 'usage', label: 'Usage Frequency', icon: '⚡' },
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {getPaginatedPersonas().map((persona: any) => (
                  <PersonaCard
                    key={persona.id}
                    persona={persona}
                    onEdit={handleEditPersona}
                    onChangeStatus={handleChangeStatus}
                    onToggleMerge={toggleMergeSelection}
                    isSelectedForMerge={selectedForMerge.includes(persona.id)}
                    getStatusColor={getStatusColor}
                    formatLastUpdated={formatLastUpdated}
                  />
                ))}
              </div>

              {/* Pagination Controls */}
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

        {/* Ask Personas Modal */}
        {showAskModal && <AskPersonasModal personas={personas.filter(p => p.status === 'advisor')} onClose={() => setShowAskModal(false)} />}

        {/* Trade-off Voting Modal */}
        {showVoteModal && <TradeOffVotingModal personas={personas.filter(p => p.status === 'advisor')} onClose={() => setShowVoteModal(false)} />}

        {/* Edit Persona Modal */}
        {showEditModal && editingPersona && (
          <EditPersonaModal
            persona={editingPersona}
            onClose={() => {
              setShowEditModal(false)
              setEditingPersona(null)
            }}
            onSave={handleSavePersona}
          />
        )}

        {/* Merge Personas Modal */}
        {showMergeModal && (
          <MergePersonasModal
            personaIds={selectedForMerge}
            personas={personas}
            onClose={() => setShowMergeModal(false)}
            onMerge={handleMerge}
          />
        )}
      </div>
    </>
  )
}

function ActionCard({
  icon,
  title,
  description,
  onClick,
  color,
}: {
  icon: React.ReactNode, title: string, description: string, onClick: () => void, color: string
}) {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-600 to-blue-700',
    purple: 'from-purple-600 to-purple-700',
    green: 'from-green-600 to-green-700',
  }

  return (
    <button
      onClick={onClick}
      className="card-hover p-6 text-left w-full"
    >
      <div className={`w-12 h-12 bg-gradient-to-br ${colorClasses[color]} rounded-lg flex items-center justify-center text-white mb-4`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-heading mb-2">{title}</h3>
      <p className="text-sm text-body">{description}</p>
    </button>
  )
}

function PersonaCard({
  persona,
  onEdit,
  onChangeStatus,
  onToggleMerge,
  isSelectedForMerge,
  getStatusColor,
  formatLastUpdated,
}: {
  persona: any
  onEdit: (persona: any) => void
  onChangeStatus: (id: number, status: string) => void
  onToggleMerge: (id: number) => void
  isSelectedForMerge: boolean
  getStatusColor: (status: string) => string
  formatLastUpdated: (date: string) => string
}) {
  const segmentColors: Record<string, string> = {
    Enterprise: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    'Mid-Market': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    SMB: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  }

  return (
    <div className="card-hover p-6 relative">
      {/* Checkbox for merging */}
      <div className="absolute top-3 left-3">
        <input
          type="checkbox"
          checked={isSelectedForMerge}
          onChange={() => onToggleMerge(persona.id)}
          className="w-4 h-4 text-indigo-600 rounded"
        />
      </div>

      <div className="pl-8">
        {/* Header with Last Updated */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-heading mb-1">{persona.name}</h3>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${segmentColors[persona.segment] || 'badge-gray'}`}>
                {persona.segment}
              </span>
              {persona.status === 'new' && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  New
                </span>
              )}
            </div>
          </div>

          {/* Last Updated & Confidence */}
          <div className="text-right">
            <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              {Math.round((persona.confidence_score || 0) * 100)}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Updated {formatLastUpdated(persona.updated_at)}
            </div>
          </div>
        </div>

        <p className="text-sm text-body mb-4">{persona.persona_summary}</p>

        {persona.key_pain_points && persona.key_pain_points.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-body mb-2">Pain Points</div>
            <div className="flex flex-wrap gap-1.5">
              {persona.key_pain_points.slice(0, 3).map((point: string, idx: number) => (
                <span key={idx}
                  className="px-2.5 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-full text-xs font-medium"
                >
                  {point}
                </span>
              ))}
            </div>
          </div>
        )}

        {persona.feature_priorities && persona.feature_priorities.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-body mb-2">Priorities</div>
            <div className="flex flex-wrap gap-1.5">
              {persona.feature_priorities.slice(0, 3).map((priority: string, idx: number) => (
                <span key={idx}
                  className="px-2.5 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-xs font-medium"
                >
                  {priority}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <div>
            <div className="text-xs font-medium text-body mb-1">Revenue Contribution</div>
            <div className="text-sm font-semibold text-heading">
              {persona.extra_data?.revenue_contribution
                ? `$${(persona.extra_data.revenue_contribution / 1000).toFixed(0)}K`
                : 'N/A'}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-body mb-1">Usage Frequency</div>
            <div className="text-sm font-semibold text-heading">
              {persona.extra_data?.usage_frequency || 'N/A'}
            </div>
          </div>
        </div>

        <div className="text-xs text-muted mb-4">
          Based on {persona.based_on_feedback_count || 0} feedback items
          {persona.based_on_interview_count > 0 && `, ${persona.based_on_interview_count} interviews`}
          {persona.based_on_deal_count > 0 && `, ${persona.based_on_deal_count} deals`}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => onEdit(persona)}
            className="btn-secondary text-sm py-1.5 px-3"
          >
            <Edit2 className="w-3.5 h-3.5 inline mr-1" />
            Edit
          </button>

          {/* Active/Inactive Toggle */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${persona.status === 'advisor' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {persona.status === 'advisor' ? 'Active' : 'Inactive'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={persona.status === 'advisor'}
                onChange={() => {
                  const newStatus = persona.status === 'advisor' ? 'dismissed' : 'advisor'
                  onChangeStatus(persona.id, newStatus)
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}

function AskPersonasModal({ personas, onClose }: { personas: any[]; onClose: () => void }) {
  const [question, setQuestion] = useState('')
  const [selectedPersonas, setSelectedPersonas] = useState<number[]>([])
  const [responses, setResponses] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [askingProgress, setAskingProgress] = useState<{ current: number; total: number } | null>(null)

  const handleAsk = async () => {
    if (!question.trim() || selectedPersonas.length === 0) {
      alert('Please enter a question and select at least one persona')
      return
    }

    setLoading(true)
    setAskingProgress({ current: 0, total: selectedPersonas.length })

    try {
      const personaResponses: any[] = []
      let completed = 0

      // Use backend LLM-powered API to get persona responses
      // Track real progress as each persona responds
      const responsePromises = selectedPersonas.map(async (personaId) => {
        try {
          const result = await api.simulatePersona({
            persona_id: personaId,
            question: question,
          })

          const response = {
            personaName: result.data.persona_name,
            response: result.data.response,
            reasoning: result.data.reasoning,
            confidence: result.data.confidence,
          }

          // Update progress in real-time as each response completes
          completed++
          setAskingProgress({ current: completed, total: selectedPersonas.length })

          return response
        } catch (error) {
          const persona = personas.find(p => p.id === personaId)

          // Update progress even on error
          completed++
          setAskingProgress({ current: completed, total: selectedPersonas.length })

          return {
            personaName: persona?.name || 'Unknown',
            response: 'Unable to generate response. Please try again.',
            reasoning: 'Error contacting AI service',
            confidence: 0,
          }
        }
      })

      const results = await Promise.all(responsePromises)

      // Show completion briefly before hiding
      setTimeout(() => setAskingProgress(null), 500)

      setResponses(results)
    } catch (error) {
      setAskingProgress(null)
      console.error('Error asking personas:', error)
      alert('Failed to get responses from personas')
    } finally {
      setLoading(false)
    }
  }

  const togglePersona = (personaId: number) => {
    setSelectedPersonas(prev =>
      prev.includes(personaId)
        ? prev.filter(id => id !== personaId)
        : [...prev, personaId]
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-heading">Ask Personas</h2>
          <button onClick={onClose} className="text-muted hover:text-heading transition">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Question Input */}
          <div>
            <label className="block text-sm font-medium text-heading mb-2">Your Question</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask your personas anything about features, priorities, pain points..."
              rows={4}
              className="input"
            />
          </div>

          {/* Persona Selection */}
          <div>
            <label className="block text-sm font-medium text-heading mb-2">Select Personas to Ask</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {personas.map(persona => (
                <button
                  key={persona.id}
                  onClick={() => togglePersona(persona.id)}
                  className={`p-3 rounded-lg border-2 transition ${
                    selectedPersonas.includes(persona.id)
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="text-sm font-medium text-heading">{persona.name}</div>
                  <div className="text-xs text-body">{persona.segment}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Ask Button / Progress */}
          {askingProgress ? (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-600 animate-pulse" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Asking Personas...
                  </h3>
                </div>
                <span className="text-sm font-medium text-blue-600">
                  {askingProgress.current}/{askingProgress.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${(askingProgress.current / askingProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                Receiving responses in real-time as personas respond...
              </p>
            </div>
          ) : (
            <button
              onClick={handleAsk}
              disabled={loading || !question.trim() || selectedPersonas.length === 0}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Asking Personas...' : 'Ask Personas'}
            </button>
          )}

          {/* Responses */}
          {responses.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-heading">Responses (AI-Powered Digital Twins)</h3>
              {responses.map((response, idx) => (
                <div key={idx} className="card p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-semibold text-heading">{response.personaName}</div>
                    {response.confidence !== undefined && (
                      <div className="text-xs text-body">
                        Confidence: {(response.confidence * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-body mb-2">{response.response}</p>
                  {response.reasoning && (
                    <div className="text-xs text-muted mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="font-medium">Based on:</span> {response.reasoning}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TradeOffVotingModal({ personas, onClose }: { personas: any[]; onClose: () => void }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [votes, setVotes] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [votingProgress, setVotingProgress] = useState<{ current: number; total: number } | null>(null)

  const addOption = () => setOptions([...options, ''])
  const removeOption = (index: number) => setOptions(options.filter((_, i) => i !== index))
  const updateOption = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const handleVote = async () => {
    const validOptions = options.filter(o => o.trim())
    if (!question.trim() || validOptions.length < 2) {
      alert('Please enter a question and at least 2 options')
      return
    }

    setLoading(true)
    setVotingProgress({ current: 0, total: personas.length })

    try {
      // Use backend LLM-powered API for voting
      // Make individual calls per persona to track real progress
      const formattedOptions = validOptions.map((opt, idx) => ({
        id: String.fromCharCode(65 + idx), // A, B, C, D...
        description: opt
      }))

      let completed = 0
      const allVotes: any[] = []

      // Call backend once per persona to get real-time progress
      const votePromises = personas.map(async (persona) => {
        try {
          const result = await api.personaVote({
            persona_ids: [persona.id], // Single persona per call
            question: question,
            options: formattedOptions,
          })

          // Extract the vote for this persona
          const votes = result.data.votes || []

          // Update progress in real-time
          completed++
          setVotingProgress({ current: completed, total: personas.length })

          return votes
        } catch (error) {
          console.error(`Error getting vote from persona ${persona.name}:`, error)

          // Update progress even on error
          completed++
          setVotingProgress({ current: completed, total: personas.length })

          return []
        }
      })

      const voteResultsArray = await Promise.all(votePromises)

      // Flatten all votes into single array
      const votesData = voteResultsArray.flat()

      // Show completion briefly before hiding
      setTimeout(() => setVotingProgress(null), 500)

      console.log('All votes received:', votesData)
      console.log('Choices received:', votesData.map((v: any) => v.choice))

      const voteResults = validOptions.map((option, idx) => {
        const optionId = String.fromCharCode(65 + idx)
        console.log(`Filtering for option ${optionId}:`, option)

        // Handle both 'choice' and 'selected_option_id' field names
        const votesForOption = votesData.filter((v: any) =>
          v.choice === optionId || v.selected_option_id === optionId
        )

        console.log(`  Matched votes:`, votesForOption.length)

        return {
          option,
          votes: votesForOption.length,
          percentage: Math.round((votesForOption.length / personas.length) * 100),
          personas: votesForOption.map((v: any) => v.persona_name),
          reasoning: votesForOption.map((v: any) => ({
            persona: v.persona_name,
            reason: v.reasoning
          }))
        }
      })

      // Sort by votes descending
      voteResults.sort((a, b) => b.votes - a.votes)

      setVotes(voteResults)
    } catch (error: any) {
      console.error('Error getting votes:', error)
      setVotingProgress(null)
      const errorMsg = error.response?.data?.detail || error.message || 'Unknown error'
      alert(`Failed to get persona votes: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-heading">Trade-off Voting</h2>
          <button onClick={onClose} className="text-muted hover:text-heading transition">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Question Input */}
          <div>
            <label className="block text-sm font-medium text-heading mb-2">Trade-off Question</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="E.g., What should we prioritize next quarter?"
              className="input"
            />
          </div>

          {/* Options */}
          <div>
            <label className="block text-sm font-medium text-heading mb-2">Options</label>
            <div className="space-y-3">
              {options.map((option, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => updateOption(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    className="input flex-1"
                  />
                  {options.length > 2 && (
                    <button
                      onClick={() => removeOption(idx)}
                      className="btn-secondary px-3"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addOption} className="btn-secondary">
                + Add Option
              </button>
            </div>
          </div>

          {/* Get Votes Button / Progress */}
          {votingProgress ? (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600 animate-pulse" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Collecting Persona Votes...
                  </h3>
                </div>
                <span className="text-sm font-medium text-purple-600">
                  {votingProgress.current}/{votingProgress.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div
                  className="bg-gradient-to-r from-purple-600 to-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${(votingProgress.current / votingProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                Receiving votes in real-time as personas respond...
              </p>
            </div>
          ) : (
            <button
              onClick={handleVote}
              disabled={loading || !question.trim() || options.filter(o => o.trim()).length < 2}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Getting Votes...' : 'Get Persona Votes'}
            </button>
          )}

          {/* Vote Results */}
          {votes && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-heading">Voting Results</h3>
              {votes.map((result: any, idx: number) => (
                <div key={idx} className="card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-heading">{result.option}</div>
                    <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                      {result.percentage}%
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                    <div
                      className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all"
                      style={{ width: `${result.percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-body">
                    Voted by: {result.personas.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
function EditPersonaModal({ persona, onClose, onSave }: {
  persona: any
  onClose: () => void
  onSave: (personaId: number, updates: any) => void
}) {
  const [formData, setFormData] = useState({
    name: persona.name,
    description: persona.description || '',
    segment: persona.segment,
    persona_summary: persona.persona_summary || '',
    key_pain_points: persona.key_pain_points?.join(', ') || '',
    feature_priorities: persona.feature_priorities?.join(', ') || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(persona.id, {
      ...formData,
      key_pain_points: formData.key_pain_points.split(',').map((s: string) => s.trim()).filter(Boolean),
      feature_priorities: formData.feature_priorities.split(',').map((s: string) => s.trim()).filter(Boolean),
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Edit Persona</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              required
            />
          </div>

          {/* Segment */}
          <div>
            <label className="block text-sm font-medium mb-2">Segment</label>
            <select
              value={formData.segment}
              onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
              className="select"
            >
              <option value="Enterprise">Enterprise</option>
              <option value="Mid-Market">Mid-Market</option>
              <option value="SMB">SMB</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
              rows={3}
            />
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm font-medium mb-2">Summary</label>
            <textarea
              value={formData.persona_summary}
              onChange={(e) => setFormData({ ...formData, persona_summary: e.target.value })}
              className="input"
              rows={3}
            />
          </div>

          {/* Pain Points */}
          <div>
            <label className="block text-sm font-medium mb-2">Pain Points (comma-separated)</label>
            <input
              type="text"
              value={formData.key_pain_points}
              onChange={(e) => setFormData({ ...formData, key_pain_points: e.target.value })}
              className="input"
              placeholder="e.g., Slow onboarding, High churn, Complex setup"
            />
          </div>

          {/* Priorities */}
          <div>
            <label className="block text-sm font-medium mb-2">Feature Priorities (comma-separated)</label>
            <input
              type="text"
              value={formData.feature_priorities}
              onChange={(e) => setFormData({ ...formData, feature_priorities: e.target.value })}
              className="input"
              placeholder="e.g., Mobile app, API access, Integrations"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MergePersonasModal({ personaIds, personas, onClose, onMerge }: {
  personaIds: number[]
  personas: any[]
  onClose: () => void
  onMerge: (primaryId: number) => void
}) {
  const [primaryId, setPrimaryId] = useState<number | null>(null)
  const selectedPersonas = personas.filter(p => personaIds.includes(p.id))

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Merge Personas</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Select which persona should be the primary (its name and segment will be kept).
            All attributes will be intelligently combined.
          </p>

          <div className="space-y-2">
            {selectedPersonas.map(persona => (
              <button
                key={persona.id}
                onClick={() => setPrimaryId(persona.id)}
                className={`w-full text-left p-4 rounded-lg border-2 transition ${
                  primaryId === persona.id
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{persona.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{persona.segment}</p>
                  </div>
                  {primaryId === persona.id && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
                      Primary
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-6">
            <button onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              onClick={() => primaryId && onMerge(primaryId)}
              disabled={!primaryId}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              Merge Personas
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
