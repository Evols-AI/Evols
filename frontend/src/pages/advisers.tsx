import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Sparkles, MessageSquare, ArrowRight, History, ChevronRight } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card, EmptyState, Loading } from '@/components/PageContainer'

interface Adviser {
  id: number
  type: string
  name: string
  description: string
  icon: string
  is_custom: boolean
}

export default function Advisers() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [advisers, setAdvisers] = useState<Adviser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    const currentUser = getCurrentUser()
    setUser(currentUser)
    loadAdvisers()
  }, [router])

  const loadAdvisers = async () => {
    try {
      const response = await api.get('/advisers/')
      setAdvisers(response.data.advisers)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load advisers')
    } finally {
      setLoading(false)
    }
  }

  const startSession = async (adviserId: number, adviserType: string) => {
    try {
      const response = await api.post('/advisers/sessions', {
        adviser_id: adviserId,
        adviser_type: adviserType
      })

      const sessionId = response.data.session_id
      router.push(`/advisers/session/${sessionId}`)
    } catch (err: any) {
      alert(`Failed to start session: ${err.response?.data?.detail || err.message}`)
    }
  }

  if (loading) {
    return <Loading />
  }

  return (
    <>
      <Head>
        <title>Advisers - Evols</title>
      </Head>

      <Header user={user} currentPage="advisers" />

      <PageContainer>
        <PageHeader
          title="AI Advisers"
          description="Expert advisers to help with specific product management tasks"
          icon={Sparkles}
          action={{
            label: 'View History',
            onClick: () => router.push('/advisers/history'),
            icon: History
          }}
        />

        {user?.role === 'TENANT_ADMIN' && (
          <div className="mb-6">
            <button
              onClick={() => router.push('/admin/advisers')}
              className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
            >
              <Sparkles className="w-4 h-4" />
              Manage & Customize Advisers
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {advisers.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No advisers available"
            description="Contact your administrator to set up advisers"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {advisers.map((adviser) => (
              <Card key={`${adviser.type}-${adviser.id}`} hover>
                <div className="p-6">
                  {/* Icon & Badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-4xl">{adviser.icon}</div>
                    {adviser.is_custom && (
                      <span className="px-2 py-1 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                        Custom
                      </span>
                    )}
                  </div>

                  {/* Name & Description */}
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {adviser.name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 line-clamp-3">
                    {adviser.description}
                  </p>

                  {/* Start Button */}
                  <button
                    onClick={() => startSession(adviser.id, adviser.type)}
                    className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-lg transition-colors font-medium"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Start Session
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Quick Info */}
        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                How Advisers Work
              </h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Each adviser asks a few questions to understand your needs</li>
                <li>• The adviser analyzes your data and generates recommendations</li>
                <li>• You can refine the output through natural conversation</li>
                <li>• All sessions are saved so you can revisit them later</li>
              </ul>
            </div>
          </div>
        </div>
      </PageContainer>
    </>
  )
}
