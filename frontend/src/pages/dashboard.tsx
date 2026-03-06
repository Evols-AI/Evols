/**
 * Dashboard — Always-On Product Brain
 * Signal Feed, Decision Tracker, Quick Actions
 */

import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import {
  TrendingUp, Bell, XCircle,
  ArrowRight, Plus, Upload, FlaskConical, BarChart3,
  FileText, AlertTriangle, Eye, Users, Zap, Scale, MessageSquare, X
} from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, StatCard, Card, Loading } from '@/components/PageContainer'
import { useProducts } from '@/hooks/useProducts'

// ── Types ──────────────────────────────────────────────────────────────────

interface Signal {
  id: number
  signal_type: 'emerging_theme' | 'anomaly' | 'assumption_challenged' | 'new_feedback'
  title: string
  description: string
  confidence: number
  status: 'active' | 'dismissed' | 'investigating'
  created_at: string
}

interface DashboardStats {
  feedbackCount: number
  themeCount: number
  personaCount: number
  decisionCount: number
  totalArr: number
  feedbackTrend: 'up' | 'down' | 'neutral'
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SignalCard({ signal, onDismiss, onInvestigate }: {
  signal: Signal
  onDismiss: () => void
  onInvestigate: () => void
}) {
  const typeConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    emerging_theme:        { icon: <TrendingUp className="w-4 h-4" />,    color: 'blue',   label: 'Emerging Theme' },
    anomaly:               { icon: <AlertTriangle className="w-4 h-4" />, color: 'orange', label: 'Anomaly' },
    assumption_challenged: { icon: <Zap className="w-4 h-4" />,          color: 'purple', label: 'Assumption Challenged' },
    new_feedback:          { icon: <Bell className="w-4 h-4" />,         color: 'green',  label: 'New Feedback' },
  }
  const cfg = typeConfig[signal.signal_type] || typeConfig.new_feedback
  const colorMap: Record<string, string> = {
    blue:   'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    green:  'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
  }
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 p-2 rounded-lg mt-0.5 ${colorMap[cfg.color]}`}>
          {cfg.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${colorMap[cfg.color]}`}>
              {cfg.label}
            </span>
            <span className="text-xs text-muted">{Math.round(signal.confidence * 100)}% confidence</span>
          </div>
          <h4 className="text-sm font-semibold text-heading mb-1">{signal.title}</h4>
          <p className="text-xs text-body line-clamp-2">{signal.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onInvestigate}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition"
        >
          <Eye className="w-3.5 h-3.5" /> Investigate
        </button>
        <button
          onClick={onDismiss}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted hover-lift rounded-lg"
        >
          <XCircle className="w-3.5 h-3.5" /> Dismiss
        </button>
      </div>
    </div>
  )
}

function DecisionStatusDot({ status }: { status: string }) {
  const cfg: Record<string, { color: string; label: string }> = {
    active:    { color: 'bg-blue-500 dark:bg-blue-400',   label: 'Active' },
    completed: { color: 'bg-green-500 dark:bg-green-400',  label: 'Done' },
    on_track:  { color: 'bg-green-500 dark:bg-green-400',  label: 'On Track' },
    at_risk:   { color: 'bg-yellow-500 dark:bg-yellow-400', label: 'At Risk' },
    off_track: { color: 'bg-red-500 dark:bg-red-400',    label: 'Off Track' },
  }
  const c = cfg[status] || cfg.active
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${c.color}`} />
      <span className="text-xs text-body">{c.label}</span>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()
  const { selectedProductIds } = useProducts()
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<DashboardStats>({
    feedbackCount: 0, themeCount: 0, personaCount: 0,
    decisionCount: 0, totalArr: 0, feedbackTrend: 'neutral',
  })
  const [themes, setThemes] = useState<any[]>([])
  const [decisions, setDecisions] = useState<any[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [personas, setPersonas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAskModal, setShowAskModal] = useState(false)
  const [showVoteModal, setShowVoteModal] = useState(false)

  useEffect(() => {
    const checkAuthAndLoad = () => {
      if (!isAuthenticated()) {
        router.replace('/login')
        return
      }
      const currentUser = getCurrentUser()
      setUser(currentUser)

      // SUPER_ADMIN users don't have tenant context, redirect to Admin Panel
      if (currentUser?.role === 'SUPER_ADMIN') {
        router.replace('/admin/tenants')
        return
      }

      if (selectedProductIds.length > 0) {
        loadData()
      } else {
        setLoading(false)
      }
    }
    checkAuthAndLoad()
  }, [router, selectedProductIds])

  const loadData = async () => {
    setLoading(true)
    try {
      const productIdsParam = selectedProductIds.join(',')
      console.log('Dashboard loadData - selectedProductIds:', selectedProductIds)
      console.log('Dashboard loadData - productIdsParam:', productIdsParam)
      const [feedbackRes, themesRes, decisionsRes, personasRes] = await Promise.all([
        api.getFeedback({ limit: 1, product_ids: productIdsParam }),
        api.getThemes({ limit: 5, product_ids: productIdsParam }),
        api.getDecisions({ limit: 5, product_ids: productIdsParam }),
        api.getPersonas({ product_ids: productIdsParam }),
      ])
      const feedbackItems = feedbackRes.data?.items || feedbackRes.data || []
      const themesData    = themesRes.data?.items   || themesRes.data  || []
      const decisionsData = decisionsRes.data?.items || decisionsRes.data || []
      const personasData  = personasRes.data?.items  || personasRes.data  || []
      const totalArr = themesData.reduce((s: number, t: any) => s + (t.total_arr || 0), 0)

      // Filter only advisor personas for modals
      const advisorPersonas = personasData.filter((p: any) => p.status === 'advisor')

      setStats({
        feedbackCount: feedbackRes.data?.total || feedbackItems.length,
        themeCount:    themesRes.data?.total   || themesData.length,
        personaCount:  personasRes.data?.total || personasData.length,
        decisionCount: decisionsRes.data?.total || decisionsData.length,
        totalArr,
        feedbackTrend: 'up',
      })
      setThemes(themesData)
      setDecisions(decisionsData)
      setPersonas(advisorPersonas)

      // Mock signals until signal endpoint is implemented
      setSignals([
        {
          id: 1,
          signal_type: 'emerging_theme',
          title: 'New theme: Onboarding friction increasing',
          description: '12 new feedback items in the last 7 days mention onboarding difficulty, up 40% from previous week.',
          confidence: 0.87,
          status: 'active',
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          signal_type: 'assumption_challenged',
          title: 'Enterprise segment more price-sensitive than assumed',
          description: '3 recent interviews and 8 feedback items suggest enterprise buyers are citing price as a blocker.',
          confidence: 0.72,
          status: 'active',
          created_at: new Date().toISOString(),
        },
      ])
    } catch (e) {
      console.error('Dashboard load error:', e)
    } finally {
      setLoading(false)
    }
  }

  const dismissSignal = (id: number) =>
    setSignals(prev => prev.filter(s => s.id !== id))

  const hasData = stats.feedbackCount > 0

  return (
    <>
      <Head><title>Dashboard — Evols</title></Head>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Header user={user} currentPage="dashboard" />

        <PageContainer className="max-w-7xl">
          {/* Welcome */}
          <div className="page-header">
            <div>
              <h1 className="page-title">
                Good morning, {user?.full_name?.split(' ')[0] || 'there'} 👋
              </h1>
              <p className="page-subtitle">Here's what your product data is telling you.</p>
            </div>
          </div>

          {selectedProductIds.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-body mb-2">No product selected</p>
              <p className="text-sm text-muted">Please select a product from the dropdown above to view your dashboard.</p>
            </Card>
          ) : loading ? (
            <Loading text="Loading your dashboard..." />
          ) : !hasData ? (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 rounded-lg p-8 border border-indigo-200 dark:border-indigo-800">
                <h2 className="card-header mb-2">🚀 Let's get started</h2>
                <p className="text-body mb-6 max-w-xl">
                  Upload your first VoC or connect a data source and Evols will auto-cluster themes, build persona twins, and help you make your first evidence-backed decision.
                </p>
                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    { href: '/feedback', icon: <Upload className="w-6 h-6 text-blue-600" />, title: 'Upload VoC', desc: 'CSV from Intercom, Zendesk, or manual input' },
                    { href: '/roadmap',   icon: <BarChart3 className="w-6 h-6 text-purple-600" />, title: 'View Roadmap', desc: 'AI-powered prioritized product roadmap' },
                    { href: '/workbench',icon: <FlaskConical className="w-6 h-6 text-indigo-600" />, title: 'Open Workbench', desc: 'Start your first decision brief' },
                  ].map(item => (
                    <Link key={item.href} href={item.href}
                      className="card-hover p-5"
                    >
                      <div className="mb-3">{item.icon}</div>
                      <h3 className="font-semibold text-heading mb-1">{item.title}</h3>
                      <p className="text-sm text-body">{item.desc}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Stats row */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard title="VoC Items" value={stats.feedbackCount.toLocaleString()} icon={<FileText className="w-5 h-5" />} trend={stats.feedbackTrend} color="blue" />
                <StatCard title="Themes" value={stats.themeCount} icon={<BarChart3 className="w-5 h-5" />} color="purple" />
                <StatCard title="Persona Twins" value={stats.personaCount} icon={<Users className="w-5 h-5" />} color="green" />
                <StatCard title="Decisions" value={stats.decisionCount} icon={<FileText className="w-5 h-5" />} color="orange" />
                <StatCard
                  title="ARR in Themes"
                  value={stats.totalArr > 0 ? `$${(stats.totalArr / 1000).toFixed(0)}K` : '—'}
                  icon={<TrendingUp className="w-5 h-5" />}
                  color="green"
                  subtitle="across active themes"
                />
              </div>

              {/* Main content 2/3 + 1/3 */}
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {themes.length > 0 && (
                    <Card>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="card-header">Top Themes by ARR</h2>
                        <Link href="/roadmap" className="text-sm text-link flex items-center gap-1">
                          View all <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                      <div className="space-y-3">
                        {themes.map((theme: any) => (
                          <div key={theme.id} className="flex items-center gap-3 p-3 rounded-lg hover-lift">
                            <div className="flex-shrink-0 w-1 h-10 rounded-full bg-indigo-600 dark:bg-indigo-500" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-heading line-clamp-1">{theme.title}</p>
                              <p className="text-xs text-body">{theme.feedback_count || 0} items</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {theme.total_arr > 0 && (
                                <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                                  ${(theme.total_arr / 1000).toFixed(0)}K
                                </p>
                              )}
                              {theme.urgency_score != null && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  theme.urgency_score > 0.7 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                                  theme.urgency_score > 0.4 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                                  'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                }`}>
                                  {theme.urgency_score > 0.7 ? 'High' : theme.urgency_score > 0.4 ? 'Med' : 'Low'}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {decisions.length > 0 && (
                    <Card>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="card-header">Decision Tracker</h2>
                        <Link href="/decisions" className="text-sm text-link flex items-center gap-1">
                          View all <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                      <div className="space-y-2">
                        {decisions.map((d: any) => (
                          <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg hover-lift">
                            <DecisionStatusDot status={d.status || 'active'} />
                            <p className="flex-1 text-sm text-heading line-clamp-1">{d.title || d.objective}</p>
                            <Link href={`/decisions/${d.id}`} className="text-xs text-link flex-shrink-0">View</Link>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>

                <div className="space-y-6">
                  <Card>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Quick Actions</h2>
                    <div className="space-y-2">
                      <Link href="/feedback" className="flex items-center gap-3 p-2.5 rounded-lg hover-lift">
                        <div className="p-2 rounded-lg flex-shrink-0 bg-purple-50 dark:bg-purple-900/20">
                          <Plus className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-heading">Add VoC</div>
                          <div className="text-xs text-body">Import or create new</div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted ml-auto" />
                      </Link>

                      <button
                        onClick={() => setShowAskModal(true)}
                        disabled={personas.length === 0}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover-lift disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="p-2 rounded-lg flex-shrink-0 bg-violet-50 dark:bg-violet-900/20">
                          <MessageSquare className="w-4 h-4 text-violet-600" />
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-medium text-heading">Ask a Persona</div>
                          <div className="text-xs text-body">
                            {personas.length > 0 ? 'Simulate customer response' : 'No active personas yet'}
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted ml-auto" />
                      </button>

                      <button
                        onClick={() => setShowVoteModal(true)}
                        disabled={personas.length === 0}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover-lift disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="p-2 rounded-lg flex-shrink-0 bg-orange-50 dark:bg-orange-900/20">
                          <Scale className="w-4 h-4 text-orange-600" />
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-medium text-heading">Trade-off Voting</div>
                          <div className="text-xs text-body">
                            {personas.length > 0 ? 'Get persona votes on options' : 'No active personas yet'}
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted ml-auto" />
                      </button>

                      <Link href="/workbench" className="flex items-center gap-3 p-2.5 rounded-lg hover-lift">
                        <div className="p-2 rounded-lg flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/20">
                          <FlaskConical className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-heading">New Decision</div>
                          <div className="text-xs text-body">Open the workbench</div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted ml-auto" />
                      </Link>
                    </div>
                  </Card>

                  {signals.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Bell className="w-4 h-4 text-orange-500" />
                        <h2 className="font-bold text-heading text-sm uppercase tracking-wide">Signal Feed</h2>
                      </div>
                      <div className="space-y-3">
                        {signals.map(signal => (
                          <SignalCard
                            key={signal.id}
                            signal={signal}
                            onDismiss={() => dismissSignal(signal.id)}
                            onInvestigate={() => router.push('/workbench')}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </PageContainer>

        {/* Ask Personas Modal */}
        {showAskModal && personas.length > 0 && (
          <AskPersonasModal personas={personas} onClose={() => setShowAskModal(false)} />
        )}

        {/* Trade-off Voting Modal */}
        {showVoteModal && personas.length > 0 && (
          <TradeOffVotingModal personas={personas} onClose={() => setShowVoteModal(false)} />
        )}
      </div>
    </>
  )
}

// ── Modal Components ───────────────────────────────────────────────────────

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
      let completed = 0

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

          completed++
          setAskingProgress({ current: completed, total: selectedPersonas.length })

          return response
        } catch (error) {
          const persona = personas.find(p => p.id === personaId)
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
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
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
      const formattedOptions = validOptions.map((opt, idx) => ({
        id: String.fromCharCode(65 + idx),
        description: opt
      }))

      let completed = 0

      const votePromises = personas.map(async (persona) => {
        try {
          const result = await api.personaVote({
            persona_ids: [persona.id],
            question: question,
            options: formattedOptions,
          })

          const votes = result.data.votes || []
          completed++
          setVotingProgress({ current: completed, total: personas.length })

          return votes
        } catch (error) {
          console.error(`Error getting vote from persona ${persona.name}:`, error)
          completed++
          setVotingProgress({ current: completed, total: personas.length })
          return []
        }
      })

      const voteResultsArray = await Promise.all(votePromises)
      const votesData = voteResultsArray.flat()

      setTimeout(() => setVotingProgress(null), 500)

      const voteResults = validOptions.map((option, idx) => {
        const optionId = String.fromCharCode(65 + idx)
        const votesForOption = votesData.filter((v: any) =>
          v.choice === optionId || v.selected_option_id === optionId
        )

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
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
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
