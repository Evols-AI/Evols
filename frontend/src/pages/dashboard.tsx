/**
 * Dashboard — Always-On Product Brain
 * Signal Feed, Decision Tracker, Quick Actions
 */

import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import {
  TrendingUp,
  ArrowRight, Plus, Upload, FlaskConical, BarChart3,
  FileText, Users, Scale, MessageSquare, X, BookOpen, Database
} from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, StatCard, Card, Loading } from '@/components/PageContainer'
import { useProducts } from '@/hooks/useProducts'
import { AddContextModal } from '@/pages/context'

// ── Types ──────────────────────────────────────────────────────────────────

/* Signal Feed types - temporarily disabled
interface Signal {
  id: number
  signal_type: 'emerging_theme' | 'anomaly' | 'assumption_challenged' | 'new_feedback'
  title: string
  description: string
  confidence: number
  status: 'active' | 'inactive' | 'investigating'
  created_at: string
}
*/

interface DashboardStats {
  feedbackCount: number
  themeCount: number
  personaCount: number
  decisionCount: number
  totalArr: number
  feedbackTrend: 'up' | 'down' | 'neutral'
}

// ── Sub-components ─────────────────────────────────────────────────────────

/* Signal Feed components - Temporarily disabled
function SignalCard({ signal, onDismiss, onInvestigate }: {
  signal: Signal
  onDismiss: () => void
  onInvestigate: () => void
}) {
  const typeConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    emerging_theme: { icon: <TrendingUp className="w-4 h-4" />, color: 'blue', label: 'Emerging Theme' },
    anomaly: { icon: <AlertTriangle className="w-4 h-4" />, color: 'orange', label: 'Anomaly' },
    assumption_challenged: { icon: <Zap className="w-4 h-4" />, color: 'purple', label: 'Assumption Challenged' },
    new_feedback: { icon: <Bell className="w-4 h-4" />, color: 'green', label: 'New Feedback' },
  }
  const cfg = typeConfig[signal.signal_type] || typeConfig.new_feedback
  const colorMap: Record<string, string> = {
    blue: 'bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary',
    orange: 'bg-chart-4/15 text-chart-4',
    purple: 'bg-chart-1/10 text-chart-1',
    green: 'bg-chart-3/10 text-chart-3',
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
          <h4 className="text-sm text-heading mb-1">{signal.title}</h4>
          <p className="text-xs text-body line-clamp-2">{signal.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
        <button
          onClick={onInvestigate}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary dark:text-primary bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 dark:hover:bg-primary/10 rounded-lg transition"
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
*/

function DecisionStatusDot({ status }: { status: string }) {
  const cfg: Record<string, { color: string; label: string }> = {
    active: { color: 'bg-primary dark:bg-primary', label: 'Active' },
    completed: { color: 'bg-chart-3', label: 'Done' },
    on_track: { color: 'bg-chart-3', label: 'On Track' },
    at_risk: { color: 'bg-chart-4', label: 'At Risk' },
    off_track: { color: 'bg-destructive', label: 'Off Track' },
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
  // const [signals, setSignals] = useState<Signal[]>([])
  const [personas, setPersonas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddContextModal, setShowAddContextModal] = useState(false)

  useEffect(() => {
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
      // Delay showing "No product selected" to give ProductSelector time to auto-select demo product
      // This prevents showing the message briefly on first load before auto-select completes
      const timer = setTimeout(() => {
        setLoading(false)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [router, selectedProductIds])

  const loadData = async () => {
    setLoading(true)
    try {
      const productIdsParam = selectedProductIds.join(',')
      const [feedbackRes, themesRes, decisionsRes, personasRes] = await Promise.all([
        api.getFeedback({ limit: 1, product_ids: productIdsParam }),
        api.getThemes({ limit: 5, product_ids: productIdsParam }),
        api.getDecisions({ limit: 5, product_ids: productIdsParam }),
        api.getPersonas(productIdsParam),
      ])
      const feedbackItems = feedbackRes.data?.items || feedbackRes.data || []
      const themesData = themesRes.data?.items || themesRes.data || []
      const decisionsData = decisionsRes.data?.items || decisionsRes.data || []
      const personasData = personasRes.data?.items || personasRes.data || []
      const totalArr = themesData.reduce((s: number, t: any) => s + (t.total_arr || 0), 0)

      // Filter only active personas for modals
      const activePersonas = personasData.filter((p: any) => p.status === 'active')

      setStats({
        feedbackCount: feedbackRes.data?.total || feedbackItems.length,
        themeCount: themesRes.data?.total || themesData.length,
        personaCount: personasRes.data?.total || personasData.length,
        decisionCount: decisionsRes.data?.total || decisionsData.length,
        totalArr,
        feedbackTrend: 'up',
      })
      setThemes(themesData)
      setDecisions(decisionsData)
      setPersonas(activePersonas)

      // Mock signals - temporarily disabled
      // setSignals([
      //   {
      //     id: 1,
      //     signal_type: 'emerging_theme',
      //     title: 'New theme: Onboarding friction increasing',
      //     description: '12 new feedback items in the last 7 days mention onboarding difficulty, up 40% from previous week.',
      //     confidence: 0.87,
      //     status: 'active',
      //     created_at: new Date().toISOString(),
      //   },
      //   {
      //     id: 2,
      //     signal_type: 'assumption_challenged',
      //     title: 'Enterprise segment more price-sensitive than assumed',
      //     description: '3 recent interviews and 8 feedback items suggest enterprise buyers are citing price as a blocker.',
      //     confidence: 0.72,
      //     status: 'active',
      //     created_at: new Date().toISOString(),
      //   },
      // ])
    } catch (e) {
      console.error('Dashboard load error:', e)
    } finally {
      setLoading(false)
    }
  }

  // const dismissSignal = (id: number) =>
  //   setSignals(prev => prev.filter(s => s.id !== id))

  const hasData = stats.feedbackCount > 0

  return (
    <>
      <Head><title>Dashboard — Evols</title></Head>
      <div className="min-h-screen bg-background">
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
              <div className="bg-gradient-to-br bg-primary/5 rounded-lg p-8 border border-primary/30 dark:border-primary/20">
                <h2 className="card-header mb-2">🚀 Let's get started</h2>
                <p className="text-body mb-6 max-w-xl">
                  Upload your first VoC or connect a data source and Evols will auto-cluster themes, build persona twins, and help you make your first evidence-backed decision.
                </p>
                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    { href: '/context', icon: <Upload className="w-6 h-6 text-primary" />, title: 'Upload Context', desc: 'CSV from Intercom, Zendesk, or manual input' },
                    { href: '/knowledge', icon: <BarChart3 className="w-6 h-6 text-chart-1" />, title: 'Knowledge Graph', desc: 'Explore your AI-extracted knowledge graph' },
                    { href: '/workbench', icon: <FlaskConical className="w-6 h-6 text-primary" />, title: 'Open Workbench', desc: 'Start your first decision brief' },
                  ].map(item => (
                    <Link key={item.href} href={item.href}
                      className="card-hover p-5"
                    >
                      <div className="mb-3">{item.icon}</div>
                      <h3 className="text-heading mb-1">{item.title}</h3>
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
                        <Link href="/knowledge" className="text-sm text-link flex items-center gap-1">
                          View all <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                      <div className="space-y-3">
                        {themes.map((theme: any) => (
                          <div key={theme.id} className="flex items-center gap-3 p-3 rounded-lg hover-lift">
                            <div className="flex-shrink-0 w-1 h-10 rounded-full bg-primary dark:bg-primary" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-heading line-clamp-1">{theme.title}</p>
                              <p className="text-xs text-body">{theme.feedback_count || 0} items</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {theme.total_arr > 0 && (
                                <p className="text-sm text-chart-3">
                                  ${(theme.total_arr / 1000).toFixed(0)}K
                                </p>
                              )}
                              {theme.urgency_score != null && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${theme.urgency_score > 0.7 ? 'bg-destructive/10 text-destructive' :
                                    theme.urgency_score > 0.4 ? 'bg-chart-4/20 text-chart-4' :
                                      'bg-chart-3/15 text-chart-3'
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
                    <h2 className="text-xl text-foreground mb-3">Quick Actions</h2>
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowAddContextModal(true)}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover-lift w-full text-left"
                      >
                        <div className="p-2 rounded-lg flex-shrink-0 bg-chart-1/10">
                          <Database className="w-4 h-4 text-chart-1" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-heading">Add Context</div>
                          <div className="text-xs text-body">Upload feedback, docs, or data</div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted ml-auto" />
                      </button>

                      <Link href="/workbench?skill=persona_analyzer" className="flex items-center gap-3 p-2.5 rounded-lg hover-lift">
                        <div className="p-2 rounded-lg flex-shrink-0 bg-chart-1/10">
                          <MessageSquare className="w-4 h-4 text-chart-1" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-heading">Ask a Persona</div>
                          <div className="text-xs text-body">Use @persona_analyzer skill</div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted ml-auto" />
                      </Link>

                      <Link href="/workbench?skill=decision_workbench" className="flex items-center gap-3 p-2.5 rounded-lg hover-lift">
                        <div className="p-2 rounded-lg flex-shrink-0 bg-primary/5 dark:bg-primary/10">
                          <FlaskConical className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-heading">New Decision</div>
                          <div className="text-xs text-body">Use @decision_workbench skill</div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted ml-auto" />
                      </Link>
                    </div>
                  </Card>

                  {/* Signal Feed - Temporarily hidden
                  {signals.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Bell className="w-4 h-4 text-chart-4" />
                        <h2 className="text-heading text-sm uppercase tracking-wide">Signal Feed</h2>
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
                  */}
                </div>
              </div>
            </div>
          )}
        </PageContainer>

        {/* Add Context Modal */}
        {showAddContextModal && (
          <AddContextModal
            selectedProductIds={selectedProductIds}
            onClose={() => setShowAddContextModal(false)}
            onSuccess={() => {
              setShowAddContextModal(false)
              loadData()
            }}
          />
        )}
      </div>
    </>
  )
}
