import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { BarChart3, TrendingUp, Users, MessageSquare, ThumbsUp, ThumbsDown, Zap } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card, Loading, StatCard } from '@/components/PageContainer'

export default function AdvisersPlatform() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [analytics, setAnalytics] = useState<any>(null)
  const [advisers, setAdvisers] = useState<any[]>([])
  const [evaluations, setEvaluations] = useState<any[]>([])

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    const currentUser = getCurrentUser()
    setUser(currentUser)

    if (currentUser?.role !== 'SUPER_ADMIN') {
      setError('Access denied. Super admin privileges required.')
      setLoading(false)
      return
    }

    loadData()
  }, [router])

  const loadData = async () => {
    try {
      const [analyticsRes, advisersRes, evalsRes] = await Promise.all([
        api.get('/advisers/platform/analytics').catch(err => {
          console.error('Analytics error:', err)
          return { data: null }
        }),
        api.get('/advisers/platform/advisers').catch(err => {
          console.error('Advisers error:', err)
          return { data: { advisers: [] } }
        }),
        api.get('/advisers/platform/evaluations?limit=20').catch(err => {
          console.error('Evaluations error:', err)
          return { data: { evaluations: [] } }
        })
      ])

      setAnalytics(analyticsRes.data)
      setAdvisers(advisersRes.data.advisers || [])
      setEvaluations(evalsRes.data.evaluations || [])
    } catch (err: any) {
      console.error('Load data error:', err)
      setError(err.response?.data?.detail || 'Failed to load platform data')
    } finally {
      setLoading(false)
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
        <title>Platform Advisers Analytics - Evols</title>
      </Head>

      <Header user={user} currentPage="advisers" />

      <PageContainer>
        <PageHeader
          title="Platform Analytics"
          description="System-wide adviser performance and usage metrics"
          icon={BarChart3}
        />

        {error && !error.includes('Access denied') && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Stats Overview */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              title="Total Sessions"
              value={analytics.total_sessions || 0}
              icon={<MessageSquare className="w-5 h-5" />}
              color="blue"
            />
            <StatCard
              title="Completed"
              value={analytics.completed_sessions || 0}
              subtitle={`${(analytics.completion_rate || 0).toFixed(1)}% completion rate`}
              icon={<TrendingUp className="w-5 h-5" />}
              color="green"
            />
            <StatCard
              title="Average Rating"
              value={(analytics.average_rating || 0).toFixed(1) + '/5'}
              icon={<ThumbsUp className="w-5 h-5" />}
              color="purple"
            />
            <StatCard
              title="Active Advisers"
              value={advisers.filter((a: any) => a.is_active).length}
              subtitle={`${advisers.length} total`}
              icon={<Zap className="w-5 h-5" />}
              color="orange"
            />
          </div>
        )}

        {/* Sessions by Phase */}
        {analytics && analytics.sessions_by_phase && (
          <Card className="mb-6">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Sessions by Phase
              </h3>
              <div className="space-y-3">
                {Object.entries(analytics.sessions_by_phase).map(([phase, count]: [string, any]) => {
                  const total = analytics.total_sessions || 1
                  const percentage = ((count / total) * 100).toFixed(1)
                  const colors: Record<string, string> = {
                    'INITIAL_GENERATION': 'bg-yellow-500',
                    'REFINEMENT': 'bg-blue-500',
                    'COMPLETED': 'bg-green-500'
                  }
                  return (
                    <div key={phase}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {phase.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {count} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`${colors[phase] || 'bg-gray-500'} h-2 rounded-full transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        )}

        {/* Default Advisers */}
        <Card className="mb-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Default Advisers
            </h3>
            <div className="space-y-3">
              {advisers.map((adviser: any) => (
                <div
                  key={adviser.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{adviser.icon}</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {adviser.name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {adviser.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 text-xs rounded-full ${
                        adviser.is_active
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {adviser.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Recent Evaluations */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recent User Feedback
            </h3>
            <div className="space-y-3">
              {evaluations.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No feedback yet
                </p>
              ) : (
                evaluations.map((evaluation: any, index: number) => (
                  <div
                    key={evaluation.id || index}
                    className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {evaluation.rating && (
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <span
                                key={i}
                                className={i < evaluation.rating ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        )}
                        {evaluation.helpful !== null && (
                          <span className={`text-sm ${evaluation.helpful ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {evaluation.helpful ? <ThumbsUp className="w-4 h-4 inline" /> : <ThumbsDown className="w-4 h-4 inline" />}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(evaluation.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {evaluation.feedback_text && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                        "{evaluation.feedback_text}"
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Session: {evaluation.session_id.slice(0, 8)}... • User: {evaluation.user_id}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            Platform Admin Features
          </h4>
          <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
            <li>• View system-wide adviser usage and performance</li>
            <li>• Monitor user satisfaction through ratings and feedback</li>
            <li>• Track completion rates and identify drop-off points</li>
            <li>• Manage default advisers (create, edit, activate/deactivate)</li>
          </ul>
        </div>
      </PageContainer>
    </>
  )
}
