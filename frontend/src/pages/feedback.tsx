import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { Sparkles, Upload, Plus, Search, X, MessageSquare, ChevronDown, Check, Loader2, Info, ChevronUp } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card, EmptyState, Loading } from '@/components/PageContainer'
import { formatCategory, getCategoryColor } from '@/utils/formatters'
import { useJobPolling } from '@/hooks/useJobPolling'

export default function Feedback() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [feedback, setFeedback] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(100)
  const [showAddModal, setShowAddModal] = useState(false)
  const [uploadJobId, setUploadJobId] = useState<string | null>(null)
  const [segments, setSegments] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedSegments, setSelectedSegments] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [showSegmentDropdown, setShowSegmentDropdown] = useState(false)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [showCsvDocs, setShowCsvDocs] = useState(false)
  const segmentDropdownRef = useRef<HTMLDivElement>(null)
  const categoryDropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { jobStatus: uploadJobStatus, isPolling: isUploading } = useJobPolling({
    jobId: uploadJobId,
    onComplete: (result) => {
      setUploadJobId(null)
      localStorage.removeItem('feedback_upload_job_id')

      // Show consolidated success message with all stats
      const parts = [
        `✓ CSV Upload Complete!`,
        `\nImported: ${result?.imported || 0} feedback items`,
      ]

      if (result?.themes_generated) {
        parts.push(`✓ Themes generated from feedback`)
      }

      if (result?.personas_generated) {
        parts.push(`✓ Personas generated from feedback`)
      }

      if (result?.errors && result.errors.length > 0) {
        parts.push(`\n⚠️ ${result.errors.length} rows had errors`)
      }

      if (result?.generation_warnings && result.generation_warnings.length > 0) {
        parts.push(`\n⚠️ ${result.generation_warnings.join(', ')}`)
      }

      alert(parts.join('\n'))

      // Reload feedback list (reset to page 1)
      setCurrentPage(1)
      loadFeedback()
    },
    onError: (error) => {
      setUploadJobId(null)
      localStorage.removeItem('feedback_upload_job_id')
      alert(`✗ Failed to upload CSV: ${error}`)
    },
  })

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    const currentUser = getCurrentUser()
    setUser(currentUser)
    loadFeedback()
    loadSegments()

    const savedJobId = localStorage.getItem('feedback_upload_job_id')
    if (savedJobId) setUploadJobId(savedJobId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (segmentDropdownRef.current && !segmentDropdownRef.current.contains(event.target as Node)) {
        setShowSegmentDropdown(false)
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadFeedback = async () => {
    try {
      setLoading(true)
      const skip = (currentPage - 1) * itemsPerPage
      const response = await api.getFeedback({ skip, limit: itemsPerPage })

      // Handle both old and new response formats
      if (response.data.items) {
        setFeedback(response.data.items)
        setTotal(response.data.total || response.data.items.length)
      } else {
        setFeedback(response.data || [])
        setTotal((response.data || []).length)
      }
    } catch (error) {
      console.error('Error loading feedback:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSegments = async () => {
    try {
      const response = await api.getSegments()
      setSegments(response.data || [])

      // Also extract unique categories from feedback
      const feedbackResponse = await api.getFeedback({ skip: 0, limit: 1000 })
      const allFeedback = feedbackResponse.data.items || feedbackResponse.data || []
      const uniqueCategories = [...new Set(allFeedback.map((f: any) => f.category).filter(Boolean))] as string[]
      setCategories(uniqueCategories)
    } catch (error) {
      console.error('Error loading segments:', error)
    }
  }

  const toggleSegmentFilter = (segment: string) => {
    setSelectedSegments(prev => {
      if (prev.includes(segment)) {
        return prev.filter(s => s !== segment)
      } else {
        return [...prev, segment]
      }
    })
  }

  const toggleCategoryFilter = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category)
      } else {
        return [...prev, category]
      }
    })
  }

  const getSegmentFilterText = () => {
    if (selectedSegments.length === 0) return 'All Segments'
    if (selectedSegments.length === segments.length) return 'All Segments'
    return selectedSegments.join(', ')
  }

  const getCategoryFilterText = () => {
    if (selectedCategories.length === 0) return 'All Categories'
    return selectedCategories.length === 1 ? formatCategory(selectedCategories[0]) : `${selectedCategories.length} selected`
  }

  const handleUploadCSV = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a CSV file')
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await api.uploadFeedbackCSVAsync(formData)
      const { job_id } = response.data

      localStorage.setItem('feedback_upload_job_id', job_id)
      setUploadJobId(job_id)
    } catch (error: any) {
      console.error('Error uploading CSV:', error)
      const errorMessage = error.response?.data?.detail || 'Failed to start CSV upload. Please try again.'
      alert(`❌ Upload failed: ${errorMessage}`)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleAddFeedback = async (feedbackData: any) => {
    try {
      await api.createFeedback(feedbackData)
      setCurrentPage(1)
      await loadFeedback()
      setShowAddModal(false)
      alert('Feedback added successfully!')
    } catch (error) {
      console.error('Error adding feedback:', error)
      alert('Failed to add feedback. Please try again.')
    }
  }

  return (
    <>
      <Head>
        <title>Voice of Customer - Evols</title>
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Header user={user} currentPage="feedback" />

        <PageContainer>
          <PageHeader
            title="Voice of Customer"
            subtitle={`${total} VoC items collected`}
            action={
              <div className="flex items-center gap-3">
                <input ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button onClick={handleUploadCSV}
                  disabled={isUploading}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                  title={uploadJobStatus?.message || undefined}
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {isUploading ? (
                    <span>Uploading... {uploadJobStatus?.progress ? `${(uploadJobStatus.progress * 100).toFixed(0)}%` : ''}</span>
                  ) : (
                    <span>Upload CSV</span>
                  )}
                </button>
                <button onClick={() => setShowAddModal(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add VoC
                </button>
              </div>
            }
          />

          {/* CSV Format Documentation */}
          <Card className="mb-6">
            <button
              onClick={() => setShowCsvDocs(!showCsvDocs)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-semibold text-heading">CSV Upload Format</h3>
              </div>
              {showCsvDocs ? (
                <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              )}
            </button>

            {showCsvDocs && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-heading mb-2">Required Columns</h4>
                  <ul className="text-sm text-body space-y-1 ml-4 list-disc">
                    <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">content</code> - Feedback content/description</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-heading mb-2">Recommended Columns</h4>
                  <ul className="text-sm text-body space-y-1 ml-4 list-disc">
                    <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">account_name</code> or <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">customer</code> - Company/account name (used for Account records & priority scoring)</li>
                    <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">segment</code> or <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">customer_segment</code> - Customer segment (Enterprise, Mid-Market, SMB)</li>
                    <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">title</code> - Short title for the feedback</li>
                    <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">category</code> - Feedback category (feature_request, bug, improvement, etc.)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-heading mb-2">Optional Columns (for Enhanced Personas)</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-body mb-1">Revenue Contribution:</p>
                      <ul className="text-sm text-body space-y-1 ml-4 list-disc">
                        <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">mrr</code> - Monthly Recurring Revenue</li>
                        <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">arr</code> - Annual Recurring Revenue</li>
                        <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">revenue</code> - General revenue value</li>
                        <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">account_value</code> - Account value</li>
                      </ul>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-body mb-1">Usage Frequency:</p>
                      <ul className="text-sm text-body space-y-1 ml-4 list-disc">
                        <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">usage_frequency</code> - Daily, Weekly, or Monthly</li>
                        <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">login_frequency</code> - Login frequency metric</li>
                        <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">daily_active</code> - Boolean for daily active users</li>
                        <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">weekly_active</code> - Boolean for weekly active users</li>
                      </ul>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-body mb-1">Demographics & Firmographics:</p>
                      <ul className="text-sm text-body space-y-1 ml-4 list-disc">
                        <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">industry</code> - Industry (SaaS, Healthcare, FinTech, etc.)</li>
                        <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">company_size</code> - Number of employees</li>
                        <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">region</code> - Geographic region (North America, Europe, Asia, etc.)</li>
                        <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">job_role</code> - Customer's job role (Product Manager, CTO, etc.)</li>
                        <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">subscription_plan</code> - Plan tier (Starter, Professional, Business, Enterprise)</li>
                      </ul>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-body mb-1">Additional Metadata:</p>
                      <ul className="text-sm text-body space-y-1 ml-4 list-disc">
                        <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">category</code> - Feedback category (feature_request, bug, complaint, etc.)</li>
                        <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">urgency_score</code> - Urgency score (0.0 - 1.0)</li>
                        <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">impact_score</code> - Impact score (0.0 - 1.0)</li>
                        <li><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">feedback_date</code> - Date of feedback</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    💡 <strong>Tip:</strong> Including <strong>account_name</strong> is crucial for priority scoring. Without it, project priorities will be 0.
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    📊 <strong>Enhanced Personas:</strong> Including revenue (mrr/arr) and usage_frequency data helps generate personas with accurate revenue_contribution and usage_frequency metrics for weighted priority calculations.
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Filters and Search */}
          <Card className="mb-6">
            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search VoC..."
                    className="input pl-10"
                  />
                </div>
              </div>

              {/* Category Filter */}
              {categories.length > 0 && (
                <div className="relative" ref={categoryDropdownRef}>
                  <button
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    className="px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 min-w-[160px]"
                  >
                    <span className="text-sm font-medium">{getCategoryFilterText()}</span>
                    <ChevronDown className="absolute right-3 w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>

                  {showCategoryDropdown && (
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50">
                      <div className="p-2">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-2">
                          Filter by Category
                        </div>
                        {categories.map((category) => (
                          <button
                            key={category}
                            onClick={() => toggleCategoryFilter(category)}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                          >
                            <div className="w-4 h-4 flex items-center justify-center border-2 border-gray-300 dark:border-gray-500 rounded">
                              {selectedCategories.includes(category) && (
                                <Check className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                              )}
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {formatCategory(category)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Segment Filter */}
              {segments.length > 0 && (
                <div className="relative" ref={segmentDropdownRef}>
                  <button
                    onClick={() => setShowSegmentDropdown(!showSegmentDropdown)}
                    className="px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 min-w-[160px]"
                  >
                    <span className="text-sm font-medium">{getSegmentFilterText()}</span>
                    <ChevronDown className="absolute right-3 w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>

                  {showSegmentDropdown && (
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50">
                      <div className="p-2">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-2">
                          Filter by Segment
                        </div>
                        {segments.map((segment) => (
                          <button
                            key={segment}
                            onClick={() => toggleSegmentFilter(segment)}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                          >
                            <div className="w-4 h-4 flex items-center justify-center border-2 border-gray-300 dark:border-gray-500 rounded">
                              {selectedSegments.includes(segment) && (
                                <Check className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                              )}
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {segment}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* VoC List */}
          {loading ? (
            <Card>
              <Loading text="Loading VoC..." />
            </Card>
          ) : feedback.length === 0 ? (
            <Card>
              <EmptyState
                icon={<MessageSquare className="w-16 h-16" />}
                title="No VoC items yet"
                description="Upload a CSV file or manually add VoC items to get started"
                action={
                  <button onClick={() => setShowAddModal(true)}
                    className="btn-primary"
                  >
                    Add Your First VoC
                  </button>
                }
              />
            </Card>
          ) : (
            <Card padding="none">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="card-header">
                    All VoC
                  </h2>

                  {/* Pagination Controls */}
                  {total > itemsPerPage && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-body">
                        Page {currentPage} of {Math.ceil(total / itemsPerPage)}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(total / itemsPerPage), p + 1))}
                        disabled={currentPage >= Math.ceil(total / itemsPerPage)}
                        className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-4">
                {feedback.map((item: any) => (
                  <FeedbackItem key={item.id}
                    title={item.title || item.summary || 'Untitled Feedback'}
                    content={item.content || item.description || 'No content'}
                    customer={item.customer_name || item.account_name || item.customer || 'Unknown Customer'}
                    segment={item.customer_segment || item.segment || 'Unassigned'}
                    category={item.category || 'uncategorized'}
                    date={formatDate(item.created_at)}
                  />
                ))}
              </div>

              {/* Pagination Controls (Bottom) */}
              {total > itemsPerPage && (
                <div className="p-6 pt-0 flex items-center justify-center gap-3">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-body font-medium">
                    Page {currentPage} of {Math.ceil(total / itemsPerPage)}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(total / itemsPerPage), p + 1))}
                    disabled={currentPage >= Math.ceil(total / itemsPerPage)}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </Card>
          )}
        </PageContainer>

        {/* Add VoC Modal */}
        {showAddModal && <AddFeedbackModal segments={segments} onClose={() => setShowAddModal(false)} onSubmit={handleAddFeedback} />}
      </div>
    </>
  )
}

function FeedbackItem({
  title,
  content,
  customer,
  segment,
  category,
  date,
}: {
  title: string, content: string, customer: string, segment: string, category: string, date: string
}) {
  const segmentColors: Record<string, string> = {
    'Enterprise': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    'Mid-Market': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'SMB': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  }

  const formattedCategory = formatCategory(category)
  const categoryColor = getCategoryColor(category)

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover-lift cursor-pointer">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-heading mb-2">{title}</h3>
          <p className="text-sm text-body mb-3 line-clamp-2">{content}</p>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${categoryColor}`}>
              {formattedCategory}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${segmentColors[segment] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
              {segment}
            </span>
            <span className="text-gray-500 dark:text-gray-400">• {customer}</span>
            <span className="text-gray-500 dark:text-gray-400">• {date}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return 'Unknown'

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.abs(Math.floor(diffMs / 60000))
  const diffHours = Math.abs(Math.floor(diffMs / 3600000))
  const diffDays = Math.abs(Math.floor(diffMs / 86400000))

  // Handle future dates
  if (diffMs < 0) {
    if (diffMins < 60) return `in ${diffMins} minutes`
    if (diffHours < 24) return `in ${diffHours} hours`
    if (diffDays < 7) return `in ${diffDays} days`
  }

  // Handle past dates
  if (diffMins < 60) return `${diffMins} minutes ago`
  if (diffHours < 24) return `${diffHours} hours ago`
  if (diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString()
}

function AddFeedbackModal({ segments: feedbackSegments, onClose, onSubmit }: { segments: string[]; onClose: () => void; onSubmit: (data: any) => void }) {
  const [mode, setMode] = useState<'manual' | 'document'>('manual')
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    customer_name: '',
    customer_segment: '',
    category: '',
    source: 'manual',
  })
  const [submitting, setSubmitting] = useState(false)
  const [parsedItems, setParsedItems] = useState<any[]>([])
  const [parsing, setParsing] = useState(false)
  const [segments, setSegments] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load segments dynamically from personas
  useEffect(() => {
    const loadSegments = async () => {
      try {
        const response = await api.getPersonas()
        const personas = response.data.items || response.data || []
        const uniqueSegments = [...new Set(personas.map((p: any) => p.segment).filter(Boolean))] as string[]

        if (uniqueSegments.length > 0) {
          setSegments(uniqueSegments)
        } else {
          // Fallback to feedback segments if no personas
          setSegments(feedbackSegments.length > 0 ? feedbackSegments : ['Enterprise', 'Mid-Market', 'SMB'])
        }
      } catch (error) {
        console.error('Error loading segments:', error)
        setSegments(feedbackSegments.length > 0 ? feedbackSegments : ['Enterprise', 'Mid-Market', 'SMB'])
      }
    }
    loadSegments()
  }, [feedbackSegments])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit(formData)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(txt|pdf|doc|docx)$/i)) {
      alert('Please upload a .txt, .pdf, .doc, or .docx file')
      return
    }

    setParsing(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await api.parseFeedbackDocument(formData)
      const items = response.data.feedback_items || []

      setParsedItems(items)
      if (items.length === 0) {
        alert('No feedback items could be extracted from the document')
      }
    } catch (error: any) {
      console.error('Error parsing document:', error)
      alert(`Failed to parse document: ${error.response?.data?.detail || error.message}`)
    } finally {
      setParsing(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleBulkImport = async () => {
    setSubmitting(true)
    try {
      for (const item of parsedItems) {
        await api.createFeedback({
          title: item.title,
          content: item.content,
          customer_name: item.customer_name || 'Unknown',
          customer_segment: item.customer_segment,
          category: item.category,
          source: 'document_upload',
        })
      }
      alert(`Successfully imported ${parsedItems.length} feedback items!`)
      onClose()
      window.location.reload()
    } catch (error) {
      console.error('Error importing feedback:', error)
      alert('Failed to import some feedback items. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Add VoC</h2>
            <button onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Tabs */}
          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 -mb-px">
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                mode === 'manual'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Manual Entry
            </button>
            <button
              type="button"
              onClick={() => setMode('document')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                mode === 'document'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Upload Document
            </button>
          </div>
        </div>

        {mode === 'manual' ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              Title *
            </label>
            <input id="title"
              name="title"
              type="text"
              required
                value={formData.title}
              onChange={handleChange}
              className="input"
              placeholder="Brief summary of the VoC"
            />
          </div>

          {/* Content */}
          <div>
            <label htmlFor="content" className="block text-sm font-medium mb-2">
              Content *
            </label>
            <textarea id="content"
              name="content"
              rows={4}
              required
                value={formData.content}
              onChange={handleChange}
              className="input"
              placeholder="Detailed VoC description"
            />
          </div>

          {/* Customer/Account */}
          <div>
            <label htmlFor="customer_name" className="block text-sm font-medium mb-2">
              Customer / Account *
            </label>
            <input id="customer_name"
              name="customer_name"
              type="text"
              required
                value={formData.customer_name}
              onChange={handleChange}
              className="input"
              placeholder="Company name"
            />
          </div>

          {/* Segment and Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="customer_segment" className="block text-sm font-medium mb-2">
                Segment *
              </label>
              <select id="customer_segment"
                name="customer_segment"
                required
                value={formData.customer_segment}
                onChange={handleChange}
                className="input"
              >
                <option value="">Select segment</option>
                {segments.length > 0 ? (
                  segments.map((segment) => (
                    <option key={segment} value={segment}>
                      {segment}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Enterprise">Enterprise</option>
                    <option value="Mid-Market">Mid-Market</option>
                    <option value="SMB">SMB</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium mb-2">
                Category
              </label>
              <select id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="input"
              >
                <option value="">Select category (optional)</option>
                <option value="feature_request">Feature-Request</option>
                <option value="bug">Bug</option>
                <option value="tech_debt">Tech-Debt</option>
                <option value="improvement">Improvement</option>
                <option value="question">Question</option>
                <option value="praise">Praise</option>
                <option value="complaint">Complaint</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit"
              disabled={submitting}
              className="btn-primary disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add VoC'}
            </button>
          </div>
        </form>
        ) : (
          <div className="p-6 space-y-5">
            {/* Document Upload */}
            {parsedItems.length === 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Upload a document containing multiple feedback items. Our AI will automatically detect and extract individual feedback entries.
                </p>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.pdf,.doc,.docx"
                    onChange={handleDocumentUpload}
                    className="hidden"
                  />
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Upload Document</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Supports .txt, .pdf, .doc, .docx files
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={parsing}
                    className="btn-primary disabled:opacity-50"
                  >
                    {parsing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Parsing...
                      </>
                    ) : (
                      'Choose File'
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    Extracted {parsedItems.length} Feedback Items
                  </h3>
                  <button
                    type="button"
                    onClick={() => setParsedItems([])}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  >
                    Upload Different File
                  </button>
                </div>

                <div className="max-h-96 overflow-y-auto space-y-3">
                  {parsedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-sm">{item.title}</h4>
                        {item.confidence && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {(item.confidence * 100).toFixed(0)}% confident
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                        {item.content}
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        {item.customer_name && (
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                            {item.customer_name}
                          </span>
                        )}
                        {item.customer_segment && (
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                            {item.customer_segment}
                          </span>
                        )}
                        {item.category && (
                          <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">
                            {item.category}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkImport}
                    disabled={submitting}
                    className="btn-primary disabled:opacity-50"
                  >
                    {submitting ? 'Importing...' : `Import ${parsedItems.length} Items`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
