import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Sparkles, Plus, Edit, Trash2, Copy, Eye } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card, EmptyState, Loading } from '@/components/PageContainer'

interface Adviser {
  id: number
  name: string
  description: string
  icon: string
  source_adviser_id?: number
  is_active: boolean
  created_at: string
}

interface DefaultAdviser {
  id: number
  type: string
  name: string
  description: string
  icon: string
}

export default function AdviserAdmin() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [customAdvisers, setCustomAdvisers] = useState<Adviser[]>([])
  const [defaultAdvisers, setDefaultAdvisers] = useState<DefaultAdviser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTab, setSelectedTab] = useState<'custom' | 'default'>('default')
  const [viewingAdviserDetails, setViewingAdviserDetails] = useState<any>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    const currentUser = getCurrentUser()
    setUser(currentUser)

    if (currentUser?.role !== 'TENANT_ADMIN' && currentUser?.role !== 'SUPER_ADMIN') {
      setError('Access denied. This feature requires admin privileges.')
      setLoading(false)
      return
    }

    loadData()
  }, [router])

  // Keep default tab selected when no custom advisers
  useEffect(() => {
    if (!loading && customAdvisers.length === 0 && selectedTab === 'custom') {
      setSelectedTab('default')
    }
  }, [loading, customAdvisers.length, selectedTab])

  const loadData = async () => {
    try {
      const currentUser = getCurrentUser()

      if (currentUser?.role === 'SUPER_ADMIN') {
        // For SUPER_ADMIN, load platform-level advisers only
        const platformResponse = await api.get('/advisers/platform/advisers')
        const platformAdvisers = platformResponse.data.advisers || []
        setDefaultAdvisers(platformAdvisers)
        setCustomAdvisers([]) // No custom advisers for SUPER_ADMIN view
      } else {
        // For TENANT_ADMIN, load tenant-specific advisers
        // Load custom advisers
        const customResponse = await api.get('/advisers/admin/custom')
        setCustomAdvisers(customResponse.data)

        // Load default advisers
        const defaultResponse = await api.get('/advisers/')
        const defaultAdvisersData = defaultResponse.data.advisers.filter((a: any) => a.is_custom === false)
        setDefaultAdvisers(defaultAdvisersData)

        console.log('Loaded advisers:', {
          custom: customResponse.data.length,
          default: defaultAdvisersData.length,
          allAdvisers: defaultResponse.data.advisers.length
        })
      }
    } catch (err: any) {
      console.error('Failed to load advisers:', err)
      setError(err.response?.data?.detail || 'Failed to load advisers')
    } finally {
      setLoading(false)
    }
  }

  const cloneAdviser = async (adviserId: number, adviserName: string) => {
    const newName = prompt(`Enter name for cloned skill:`, `${adviserName} (Custom)`)
    if (!newName) return

    try {
      await api.post(`/advisers/admin/clone/${adviserId}`, null, {
        params: { new_name: newName }
      })
      alert('Skill cloned successfully!')
      loadData()
    } catch (err: any) {
      alert(`Failed to clone skill: ${err.response?.data?.detail || err.message}`)
    }
  }

  const toggleAdviser = async (adviserId: number, currentStatus: boolean) => {
    try {
      await api.put(`/advisers/admin/custom/${adviserId}`, {
        is_active: !currentStatus
      })
      loadData()
    } catch (err: any) {
      alert(`Failed to update skill: ${err.response?.data?.detail || err.message}`)
    }
  }

  const deleteAdviser = async (adviserId: number, adviserName: string) => {
    if (!confirm(`Are you sure you want to delete "${adviserName}"? This cannot be undone.`)) {
      return
    }

    try {
      await api.delete(`/advisers/admin/custom/${adviserId}`)
      alert('Skill deleted successfully')
      loadData()
    } catch (err: any) {
      alert(`Failed to delete skill: ${err.response?.data?.detail || err.message}`)
    }
  }

  const viewDefaultAdviserDetails = async (adviserId: number) => {
    setLoadingDetails(true)
    try {
      const response = await api.get(`/advisers/admin/default/${adviserId}`)
      setViewingAdviserDetails(response.data)
    } catch (err: any) {
      alert(`Failed to load skill details: ${err.response?.data?.detail || err.message}`)
    } finally {
      setLoadingDetails(false)
    }
  }

  if (loading) {
    return <Loading />
  }

  if (error && error.includes('Access denied')) {
    return (
      <>
        <Head>
          <title>Access Denied - Evols</title>
        </Head>
        <Header user={user} currentPage="advisers" />
        <PageContainer>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        </PageContainer>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Manage Skills - Evols Admin</title>
      </Head>

      <Header user={user} currentPage="advisers" />

      <PageContainer>
        <PageHeader
          title="Manage Skills"
          description="Customize AI skills for your organization"
          icon={Sparkles}
        />

        {error && !error.includes('Access denied') && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Tabs */}
        {user?.role !== 'SUPER_ADMIN' && (
          <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-6">
              <button
                onClick={() => setSelectedTab('custom')}
                className={`pb-3 px-1 border-b-2 transition-colors ${
                  selectedTab === 'custom'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-medium'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Custom Skills ({customAdvisers.length})
              </button>
              <button
                onClick={() => setSelectedTab('default')}
                className={`pb-3 px-1 border-b-2 transition-colors ${
                  selectedTab === 'default'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-medium'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Default Skills ({defaultAdvisers.length})
              </button>
            </div>
          </div>
        )}

        {/* Custom Advisers Tab */}
        {selectedTab === 'custom' && (
          <>
            {customAdvisers.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No custom skills yet"
                description="Clone a default skill to customize it for your organization"
              />
            ) : (
              <div className="space-y-4">
                {customAdvisers.map((adviser) => (
                  <Card key={adviser.id}>
                    <div className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="text-3xl">{adviser.icon}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {adviser.name}
                              </h3>
                              <span
                                className={`px-2 py-1 text-xs rounded ${
                                  adviser.is_active
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {adviser.is_active ? 'Active' : 'Inactive'}
                              </span>
                              {adviser.source_adviser_id && (
                                <span className="px-2 py-1 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                                  Cloned
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {adviser.description}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              Created {new Date(adviser.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => toggleAdviser(adviser.id, adviser.is_active)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            title={adviser.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => router.push(`/admin/advisers/edit/${adviser.id}`)}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteAdviser(adviser.id, adviser.name)}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Default Advisers Tab */}
        {(selectedTab === 'default' || user?.role === 'SUPER_ADMIN') && (
          <>
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                {user?.role === 'SUPER_ADMIN'
                  ? 'Platform-level AI skills. These are available to all tenants.'
                  : 'These are the default AI skills provided by Evols. You can clone them to create customized versions for your organization.'
                }
              </p>
            </div>

            <div className="space-y-4">
              {defaultAdvisers.map((adviser) => (
                <Card key={adviser.id}>
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="text-3xl">{adviser.icon}</div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            {adviser.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {adviser.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => viewDefaultAdviserDetails(adviser.id)}
                          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View Details
                        </button>
                        {user?.role !== 'SUPER_ADMIN' && (
                          <button
                            onClick={() => cloneAdviser(adviser.id, adviser.name)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                            Clone
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Adviser Details Modal */}
        {viewingAdviserDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50" onClick={() => setViewingAdviserDetails(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{viewingAdviserDetails.icon}</span>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{viewingAdviserDetails.name}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{viewingAdviserDetails.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingAdviserDetails(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Tools */}
                {viewingAdviserDetails.tools && viewingAdviserDetails.tools.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Available Tools</h3>
                    <div className="flex flex-wrap gap-2">
                      {viewingAdviserDetails.tools.map((tool: string, idx: number) => (
                        <span key={idx} className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-sm">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Initial Questions */}
                {viewingAdviserDetails.initial_questions && viewingAdviserDetails.initial_questions.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Initial Questions</h3>
                    <ul className="space-y-2">
                      {viewingAdviserDetails.initial_questions.map((q: any, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <span className="text-blue-500">•</span>
                          {typeof q === 'string' ? q : q.question}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Instructions */}
                {viewingAdviserDetails.instructions && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Instructions</h3>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                      <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                        {viewingAdviserDetails.instructions}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Output Template */}
                {viewingAdviserDetails.output_template && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Output Template</h3>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                      <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                        {viewingAdviserDetails.output_template}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setViewingAdviserDetails(null)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setViewingAdviserDetails(null)
                      cloneAdviser(viewingAdviserDetails.id, viewingAdviserDetails.name)
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    Clone This Skill
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </PageContainer>
    </>
  )
}
