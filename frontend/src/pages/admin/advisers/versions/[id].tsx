import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, History, RotateCcw, Clock } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card, Loading } from '@/components/PageContainer'

interface Version {
  id: number
  version_number: number
  change_description: string
  created_at: string
  created_by_user_id: number
}

export default function AdviserVersions() {
  const router = useRouter()
  const { id } = router.query
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adviserName, setAdviserName] = useState('')
  const [versions, setVersions] = useState<Version[]>([])
  const [restoring, setRestoring] = useState<number | null>(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    const currentUser = getCurrentUser()
    setUser(currentUser)

    if (currentUser?.role !== 'TENANT_ADMIN') {
      setError('Access denied. Tenant admin privileges required.')
      setLoading(false)
      return
    }

    if (id) {
      loadData()
    }
  }, [router, id])

  const loadData = async () => {
    try {
      const [adviserRes, versionsRes] = await Promise.all([
        api.get(`/advisers/admin/custom/${id}`),
        api.get(`/advisers/admin/custom/${id}/versions`)
      ])

      setAdviserName(adviserRes.data.name)
      setVersions(versionsRes.data.versions || [])
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load version history')
    } finally {
      setLoading(false)
    }
  }

  const restoreVersion = async (versionId: number, versionNumber: number) => {
    if (!confirm(`Restore to version ${versionNumber}? This will save your current config as a backup.`)) {
      return
    }

    setRestoring(versionId)
    try {
      await api.post(`/advisers/admin/custom/${id}/restore/${versionId}`, null)
      alert(`Successfully restored to version ${versionNumber}!`)
      router.push(`/admin/advisers/edit/${id}`)
    } catch (err: any) {
      alert(`Failed to restore: ${err.response?.data?.detail || err.message}`)
    } finally {
      setRestoring(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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
        <title>Version History - {adviserName} - Evols Admin</title>
      </Head>

      <Header user={user} currentPage="advisers" />

      <PageContainer>
        <button
          onClick={() => router.push(`/admin/advisers/edit/${id}`)}
          className="flex items-center gap-2 text-blue-500 hover:text-blue-600 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Adviser Settings
        </button>

        <PageHeader
          title={`Version History: ${adviserName}`}
          description="View and restore previous configurations"
          icon={History}
        />

        {error && !error.includes('Access denied') && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {versions.length === 0 ? (
          <Card>
            <div className="p-12 text-center">
              <History className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Version History Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Versions are automatically saved when you edit this adviser
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {versions.map((version, index) => (
              <Card key={version.id}>
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          v{version.version_number}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Version {version.version_number}
                          </h3>
                          {index === 0 && (
                            <span className="px-2 py-1 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                              Latest
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {version.change_description || 'No description'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <Clock className="w-3 h-3" />
                          {formatDate(version.created_at)}
                        </div>
                      </div>
                    </div>

                    {index !== 0 && (
                      <button
                        onClick={() => restoreVersion(version.id, version.version_number)}
                        disabled={restoring === version.id}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                      >
                        {restoring === version.id ? (
                          <>
                            <span className="inline-block animate-spin">⏳</span>
                            Restoring...
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-4 h-4" />
                            Restore
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            About Version History
          </h4>
          <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
            <li>• A new version is automatically saved every time you update this adviser</li>
            <li>• Your current config will be backed up before restoring a previous version</li>
            <li>• You can restore any previous version at any time</li>
            <li>• Version history is preserved even if you make multiple changes</li>
          </ul>
        </div>
      </PageContainer>
    </>
  )
}
