import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { Sparkles, Users, RefreshCw, Loader2, Edit2, X, ChevronDown, Check, ArrowUpDown } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card, EmptyState, Loading } from '@/components/PageContainer'
import { useJobPolling } from '@/hooks/useJobPolling'
import { useProducts } from '@/hooks/useProducts'
import { confirmDemoOperation } from '@/utils/demoWarning'

export default function Personas() {
  const router = useRouter()
  const { selectedProductIds } = useProducts()
  const [user, setUser] = useState<any>(null)
  const [personas, setPersonas] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [totalPersonas, setTotalPersonas] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [editingPersona, setEditingPersona] = useState<any>(null)
  const [selectedForMerge, setSelectedForMerge] = useState<number[]>([])
  const [tagFilter, setTagFilter] = useState<string[]>(['new', 'active'])
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
    loadProducts()

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

  const loadProducts = async () => {
    try {
      const data = await api.products.list()
      setProducts(data)
    } catch (error) {
      console.error('Failed to load products:', error)
    }
  }

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

      // Fetch managed personas only - extracted personas are now on Context page
      const managedResponse = await api.getPersonas(productIdsParam, {
        status_filter: tagFilter.join(',')
      })
      const managedPersonas = (managedResponse.data.items || managedResponse.data || []).map((p: any) => ({
        ...p,
        source: 'managed',
        isExtracted: false
      }))

      setPersonas(managedPersonas)

      // Update total count
      const totalResponse = await api.getPersonas(productIdsParam, {
        status_filter: 'new,active,inactive'
      })
      const managedTotal = (totalResponse.data.items || totalResponse.data || []).length
      setTotalPersonas(managedTotal)
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
      if (s === 'active') return 'Active'
      if (s === 'inactive') return 'Inactive'
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
    // Check if user is operating on demo products and show warning
    const confirmed = await confirmDemoOperation(
      selectedProductIds,
      products,
      'refresh personas'
    )

    if (!confirmed) {
      return // User cancelled
    }

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
        await api.updatePersonaStatus(persona.id, 'active')
        // Update persona in state without reloading (preserves scroll position)
        setPersonas(prev =>
          prev.map(p => p.id === persona.id ? { ...p, status: 'active' } : p)
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

  const handlePromotePersona = async (persona: any) => {
    if (!await confirmDemoOperation(selectedProductIds, products, 'promote persona')) return

    try {
      // Create a managed persona from the extracted entity
      const promoteData = {
        name: persona.name,
        persona_summary: persona.description,
        segment: persona.category || 'Mid-Market',
        key_pain_points: persona.attributes?.pain_points || [],
        feature_priorities: persona.attributes?.priorities || [],
        confidence_score: persona.confidence_score,
        status: 'active',
        product_id: selectedProductIds[0] || null,
        extra_data: {
          promoted_from_entity_id: persona.entityId,
          original_source: 'extracted_entity'
        }
      }

      await api.createPersona(promoteData)

      // Reload personas to show the new managed one
      await loadPersonas()

      alert('✓ Persona promoted to managed successfully!')
    } catch (error: any) {
      console.error('Error promoting persona:', error)
      alert(`Failed to promote persona: ${error.response?.data?.detail || error.message}`)
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
      case 'active':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'new':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      case 'inactive':
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
          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-8 h-8 text-blue-500" />
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Digital Twin Personas
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              AI-powered customer personas from your feedback
            </p>
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
                icon={Users}
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
              {/* Personas Grid Header */}
              <div id="personas-list" className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-heading">
                  {getFilterDisplayText()} Personas (0)
                </h2>

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
                          { value: 'active', label: 'Active', color: 'text-green-600 dark:text-green-400' },
                          { value: 'inactive', label: 'Inactive', color: 'text-gray-600 dark:text-gray-400' },
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

              {/* Merge Selection Info */}
              {selectedForMerge.length >= 2 && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-between">
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
                            { value: 'active', label: 'Active', color: 'text-green-600 dark:text-green-400' },
                            { value: 'inactive', label: 'Inactive', color: 'text-gray-600 dark:text-gray-400' },
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
                    onPromote={handlePromotePersona}
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
  onPromote,
  isSelectedForMerge,
  getStatusColor,
  formatLastUpdated,
}: {
  persona: any
  onEdit: (persona: any) => void
  onChangeStatus: (id: number, status: string) => void
  onToggleMerge: (id: number) => void
  onPromote?: (persona: any) => void
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
      {/* Checkbox for merging (only for managed personas) */}
      {!persona.isExtracted && (
        <div className="absolute top-3 left-3">
          <input
            type="checkbox"
            checked={isSelectedForMerge}
            onChange={() => onToggleMerge(persona.id)}
            className="w-4 h-4 text-blue-500 rounded"
          />
        </div>
      )}

      <div className="pl-8">
        {/* Header with Last Updated */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-heading mb-1">{persona.name}</h3>
            <div className="flex items-center gap-2">
              {persona.isExtracted ? (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  🤖 AI-Extracted
                </span>
              ) : (
                <>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${segmentColors[persona.segment] || 'badge-gray'}`}>
                    {persona.segment}
                  </span>
                  {persona.status === 'new' && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      New
                    </span>
                  )}
                </>
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
          {persona.isExtracted ? (
            /* Promote button for extracted personas */
            <button
              onClick={() => onPromote?.(persona)}
              className="btn-primary text-sm py-1.5 px-4 flex-1"
            >
              <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />
              Promote to Managed
            </button>
          ) : (
            /* Edit and status toggle for managed personas */
            <>
              <button
                onClick={() => onEdit(persona)}
                className="btn-secondary text-sm py-1.5 px-3"
              >
                <Edit2 className="w-3.5 h-3.5 inline mr-1" />
                Edit
              </button>

              {/* Active/Inactive Toggle */}
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${persona.status === 'active' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {persona.status === 'active' ? 'Active' : 'Inactive'}
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={persona.status === 'active'}
                    onChange={() => {
                      const newStatus = persona.status === 'active' ? 'inactive' : 'active'
                      onChangeStatus(persona.id, newStatus)
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                </label>
              </div>
            </>
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
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{persona.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{persona.segment}</p>
                  </div>
                  {primaryId === persona.id && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-600">
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
