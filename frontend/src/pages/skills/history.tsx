import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { History, MessageSquare, Clock, CheckCircle, ArrowLeft, ChevronRight, Trash2 } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card, EmptyState, Loading } from '@/components/PageContainer'

interface Session {
  session_id: string
  adviser_id: number
  adviser_type: string
  phase: string
  session_name: string | null
  created_at: string
  last_message_at: string | null
}

export default function SkillHistory() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    const currentUser = getCurrentUser()
    setUser(currentUser)
    loadHistory()
  }, [router])

  const loadHistory = async () => {
    try {
      const response = await api.get('/advisers/sessions/history')
      setSessions(response.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  const getPhaseDisplay = (phase: string) => {
    switch (phase) {
      case 'initial_generation':
        return { label: 'In Progress', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' }
      case 'refinement':
        return { label: 'Refining', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' }
      case 'completed':
        return { label: 'Completed', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' }
      default:
        return { label: 'Unknown', color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' }
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent navigation when clicking delete

    if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      return
    }

    try {
      await api.delete(`/advisers/sessions/${sessionId}`)
      // Reload history
      await loadHistory()
    } catch (err: any) {
      alert(`Failed to delete session: ${err.response?.data?.detail || err.message}`)
    }
  }

  if (loading) {
    return <Loading />
  }

  return (
    <>
      <Head>
        <title>Session History - Evols</title>
      </Head>

      <Header user={user} currentPage="advisers" />

      <PageContainer>
        <button
          onClick={() => router.push('/skills')}
          className="flex items-center gap-2 text-blue-500 hover:text-blue-600 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Skills
        </button>

        <PageHeader
          title="Session History"
          description="View and continue your previous skill sessions"
          icon={History}
        />

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {sessions.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No sessions yet"
            description="Start a session with a skill to see it here"
            action={{
              label: 'Browse Skills',
              onClick: () => router.push('/skills')
            }}
          />
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => {
              const phaseDisplay = getPhaseDisplay(session.phase)

              return (
                <Card
                  key={session.session_id}
                  hover
                  onClick={() => router.push(`/skills/session/${session.session_id}`)}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {session.session_name || `Session ${session.session_id.slice(0, 8)}`}
                          </h3>
                          <span className={`px-2 py-1 text-xs rounded ${phaseDisplay.color}`}>
                            {phaseDisplay.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>Started {formatDate(session.created_at)}</span>
                          </div>
                          {session.last_message_at && (
                            <div className="flex items-center gap-1">
                              <MessageSquare className="w-4 h-4" />
                              <span>Last activity {formatDate(session.last_message_at)}</span>
                            </div>
                          )}
                          {session.phase === 'completed' && (
                            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                              <CheckCircle className="w-4 h-4" />
                              <span>Completed</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleDelete(session.session_id, e)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition"
                          title="Delete session"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* Stats Summary */}
        {sessions.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Sessions</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {sessions.length}
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">In Progress</div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {sessions.filter(s => s.phase === 'refinement' || s.phase === 'initial_generation').length}
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Completed</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {sessions.filter(s => s.phase === 'completed').length}
                </div>
              </div>
            </Card>
          </div>
        )}
      </PageContainer>
    </>
  )
}
