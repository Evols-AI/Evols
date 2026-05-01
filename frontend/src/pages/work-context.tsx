/**
 * Work Context Page
 * Personal PM operating system - role, team, capacity, projects, relationships
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Briefcase, TrendingUp, Calendar, CheckSquare, Lightbulb, Plus, Trash2, Edit, Loader2, Book, BarChart3, Coins, Users, Clock, BookOpen, Tag, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card, StatCard, Loading, EmptyState } from '@/components/PageContainer'
import TaskModal from '@/components/work-context/TaskModal'
import DecisionModal from '@/components/work-context/DecisionModal'
import WeeklyFocusModal from '@/components/work-context/WeeklyFocusModal'
import StrategyTab from '@/components/context/StrategyTab'

type TabType = 'overview' | 'tasks' | 'decisions' | 'meetings' | 'weekly-focus' | 'strategy' | 'ai-sessions'

export default function WorkContext() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState<TabType>('overview')
  const [workContext, setWorkContext] = useState<any>(null)
  const [activeProjects, setActiveProjects] = useState<any[]>([])
  const [keyRelationships, setKeyRelationships] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [decisions, setDecisions] = useState<any[]>([])
  const [meetings, setMeetings] = useState<any[]>([])
  const [weeklyFocus, setWeeklyFocus] = useState<any>(null)

  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [decisionModalOpen, setDecisionModalOpen] = useState(false)
  const [selectedDecision, setSelectedDecision] = useState<any>(null)
  const [weeklyFocusModalOpen, setWeeklyFocusModalOpen] = useState(false)
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null)
  const [deletingDecisionId, setDeletingDecisionId] = useState<number | null>(null)

  const [aiSummary, setAiSummary] = useState<any>(null)
  const [aiEntries, setAiEntries] = useState<any[]>([])
  const [aiDays, setAiDays] = useState(7)
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedAiEntry, setSelectedAiEntry] = useState<any>(null)

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return }
    const currentUser = getCurrentUser()
    setUser(currentUser)
    const { tab } = router.query
    if (tab && ['overview','tasks','decisions','meetings','weekly-focus','strategy','ai-sessions'].includes(tab as string)) {
      setSelectedTab(tab as TabType)
    }
    loadData()
  }, [])

  useEffect(() => {
    if (selectedTab === 'ai-sessions') loadAiSessions()
  }, [selectedTab, aiDays])

  const loadAiSessions = async () => {
    setAiLoading(true)
    try {
      const [sumRes, entriesRes] = await Promise.all([
        api.get(`/team-knowledge/quota/summary?days=${aiDays}`),
        api.get('/team-knowledge/entries?limit=50'),
      ])
      setAiSummary(sumRes.data)
      setAiEntries(entriesRes.data)
    } catch (e) {
      console.error('Failed to load AI session data', e)
    } finally {
      setAiLoading(false)
    }
  }

  const handleAiEntryClick = async (entry: any) => {
    setSelectedAiEntry(entry)
    try {
      const detail = await api.get(`/team-knowledge/entries/${entry.id}`)
      setSelectedAiEntry(detail.data)
    } catch { /* leave preview */ }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [contextRes, projectsRes, relationshipsRes, tasksRes, decisionsRes, meetingsRes, focusRes] = await Promise.all([
        api.workContext.getWorkContext(),
        api.workContext.getActiveProjects(),
        api.workContext.getKeyRelationships(),
        api.workContext.getTasks(),
        api.workContext.getPMDecisions(),
        api.workContext.getMeetingNotes({ limit: 10 }),
        api.workContext.getCurrentWeeklyFocus()
      ])
      setWorkContext(contextRes.data)
      setActiveProjects(projectsRes.data)
      setKeyRelationships(relationshipsRes.data)
      setTasks(tasksRes.data)
      setDecisions(decisionsRes.data.slice(0, 5))
      setMeetings(meetingsRes.data)
      setWeeklyFocus(focusRes.data)
    } catch (error) {
      console.error('Error loading work context:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Delete this task?')) return
    setDeletingTaskId(taskId)
    try {
      await api.workContext.deleteTask(taskId)
      await loadData()
    } catch { alert('Failed to delete task') }
    finally { setDeletingTaskId(null) }
  }

  const handleDeleteDecision = async (decisionId: number) => {
    if (!confirm('Delete this decision?')) return
    setDeletingDecisionId(decisionId)
    try {
      await api.workContext.deletePMDecision(decisionId)
      await loadData()
    } catch { alert('Failed to delete decision') }
    finally { setDeletingDecisionId(null) }
  }

  const openTaskModal = (task?: any) => { setSelectedTask(task || null); setTaskModalOpen(true) }
  const openDecisionModal = (decision?: any) => { setSelectedDecision(decision || null); setDecisionModalOpen(true) }

  const getCapacityColor = (status?: string) => {
    switch (status) {
      case 'sustainable':   return 'text-chart-3 bg-chart-3/15'
      case 'stretched':     return 'text-chart-4 bg-chart-4/20'
      case 'overloaded':    return 'text-destructive bg-destructive/10'
      case 'unsustainable': return 'text-destructive dark:text-destructive bg-destructive/100/10'
      default:              return 'text-muted-foreground bg-muted'
    }
  }

  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case 'green':     return 'bg-chart-3'
      case 'yellow':    return 'bg-chart-4'
      case 'red':       return 'bg-destructive/100'
      case 'completed': return 'bg-primary'
      default:          return 'bg-muted-foreground/40'
    }
  }

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      critical:      '🔴 Critical Today',
      high_leverage: '🟡 High Leverage',
      stakeholder:   '🔵 Stakeholder',
      sweep:         '⚪ Sweep Queue',
      backlog:       '🟣 Backlog'
    }
    return labels[priority] || priority
  }

  const TABS: { id: TabType; label: string; icon: any; badge?: number }[] = [
    { id: 'overview',    label: 'Overview',      icon: TrendingUp },
    { id: 'tasks',       label: 'Tasks',         icon: CheckSquare, badge: tasks.filter(t => t.status === 'todo' || t.status === 'in_progress').length },
    { id: 'decisions',   label: 'Decisions',     icon: Lightbulb,   badge: decisions.length },
    { id: 'ai-sessions', label: 'AI Sessions',   icon: BarChart3 },
  ]

  if (loading) {
    return (
      <>
        <Header user={user} currentPage="work-context" />
        <PageContainer><Loading /></PageContainer>
      </>
    )
  }

  return (
    <div className="min-h-screen">
      <Header user={user} currentPage="work-context" />
      <PageContainer>
        <PageHeader title="Work Context" description="Your personal AI operating system" icon={Briefcase} />

        {/* Tabs */}
        <div className="mb-6 border-b border-border">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon, badge }) => (
              <button
                key={id}
                onClick={() => setSelectedTab(id)}
                className={`px-4 py-3 font-medium text-sm border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                  selectedTab === id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {badge !== undefined && badge > 0 && (
                  <span className="ml-1 text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 leading-none">{badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Overview Tab ─────────────────────────────────────── */}
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card padding="md">
                <h3 className="text-base font-medium text-foreground mb-4">Capacity</h3>
                {workContext?.capacity_status ? (
                  <div>
                    <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getCapacityColor(workContext.capacity_status)}`}>
                      {workContext.capacity_status.replace('_', ' ').toUpperCase()}
                    </div>
                    {workContext.capacity_factors && (
                      <p className="mt-3 text-sm text-muted-foreground">{workContext.capacity_factors}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No capacity info yet</p>
                )}
              </Card>

              <Card padding="md">
                <h3 className="text-base font-medium text-foreground mb-4">Role & Team</h3>
                {workContext?.title || workContext?.team ? (
                  <div className="space-y-2 text-sm">
                    {workContext.title && <div className="font-medium text-foreground">{workContext.title}</div>}
                    {workContext.team && <div className="text-muted-foreground">{workContext.team}</div>}
                    {workContext.manager_name && (
                      <div className="text-muted-foreground">
                        Reports to: {workContext.manager_name}
                        {workContext.manager_title && ` (${workContext.manager_title})`}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No role info yet</p>
                )}
              </Card>
            </div>

            {weeklyFocus && (weeklyFocus.focus_1 || weeklyFocus.focus_2 || weeklyFocus.focus_3) && (
              <Card padding="md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-medium text-foreground">Three Things That Matter This Week</h3>
                  <button onClick={() => setWeeklyFocusModalOpen(true)} className="text-sm text-primary hover:text-primary flex items-center gap-1 transition-colors">
                    <Edit className="w-4 h-4" />Edit
                  </button>
                </div>
                <div className="space-y-2">
                  {[weeklyFocus.focus_1, weeklyFocus.focus_2, weeklyFocus.focus_3].map((focus, i) =>
                    focus ? (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-primary font-medium">{i + 1}.</span>
                        <span className="text-foreground text-sm">{focus}</span>
                      </div>
                    ) : null
                  )}
                </div>
              </Card>
            )}

            <Card padding="md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-medium text-foreground">Active Projects</h3>
                <span className="text-sm text-muted-foreground">{activeProjects.length} projects</span>
              </div>
              {activeProjects.length > 0 ? (
                <div className="space-y-2">
                  {activeProjects.map((project) => (
                    <div key={project.id} className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg">
                      <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${getProjectStatusColor(project.status)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-foreground">{project.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{project.role}</span>
                        </div>
                        {project.next_milestone && (
                          <div className="text-xs text-muted-foreground mt-1">Next: {project.next_milestone}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active projects</p>
              )}
            </Card>

            <Card padding="md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-medium text-foreground">Key Relationships</h3>
                <span className="text-sm text-muted-foreground">{keyRelationships.length} people</span>
              </div>
              {keyRelationships.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {keyRelationships.map((rel) => (
                    <div key={rel.id} className="p-3 bg-muted/40 rounded-lg">
                      <div className="font-medium text-sm text-foreground">{rel.name}</div>
                      {rel.role && <div className="text-xs text-muted-foreground mt-0.5">{rel.role}</div>}
                      {rel.relationship_type && <div className="text-xs text-muted-foreground/70 mt-0.5">{rel.relationship_type}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No relationships tracked</p>
              )}
            </Card>
          </div>
        )}

        {/* ── Tasks Tab ─────────────────────────────────────────── */}
        {selectedTab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => openTaskModal()} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" />New Task
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {([
                { status: 'todo',        label: '📋 To Do',      statusKey: 'todo' },
                { status: 'in_progress', label: '🚀 In Progress', statusKey: 'in_progress' },
                { status: 'completed',   label: '✅ Done',        statusKey: 'completed' },
              ] as const).map(({ status, label }) => {
                const colTasks = tasks.filter(t => t.status === status)
                return (
                  <div key={status} className="flex flex-col rounded-xl border border-border overflow-hidden">
                    <div className="px-4 py-3 bg-muted/50 border-b border-border">
                      <h3 className="text-sm font-medium text-foreground">
                        {label} <span className="text-muted-foreground font-normal">({colTasks.length})</span>
                      </h3>
                    </div>
                    <div className="flex-1 bg-muted/20 p-3 space-y-2 min-h-[480px]">
                      {['critical', 'high_leverage', 'stakeholder', 'sweep', 'backlog'].map((priority) => {
                        const priorityTasks = colTasks.filter(t => t.priority === priority)
                        if (priorityTasks.length === 0) return null
                        return (
                          <div key={priority} className="space-y-2">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider pt-1">
                              {getPriorityLabel(priority)}
                            </div>
                            {priorityTasks.map((task) => (
                              <TaskCard
                                key={task.id}
                                task={task}
                                done={status === 'completed'}
                                deleting={deletingTaskId === task.id}
                                onEdit={() => openTaskModal(task)}
                                onDelete={() => handleDeleteTask(task.id)}
                              />
                            ))}
                          </div>
                        )
                      })}
                      {colTasks.length === 0 && (
                        <div className="text-center text-muted-foreground/50 text-sm py-8">No tasks</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {tasks.length === 0 && (
              <Card>
                <p className="text-center text-muted-foreground py-8">No tasks yet. Click "New Task" to add one.</p>
              </Card>
            )}
          </div>
        )}

        {/* ── Decisions Tab ─────────────────────────────────────── */}
        {selectedTab === 'decisions' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => openDecisionModal()} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" />Log Decision
              </button>
            </div>
            {decisions.length > 0 ? decisions.map((decision) => (
              <Card key={decision.id} padding="md">
                <div className="flex items-start justify-between mb-2 group">
                  <h3 className="text-foreground text-sm font-medium flex-1">
                    #{decision.decision_number}: {decision.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary dark:text-primary">
                      {decision.category}
                    </span>
                    <button onClick={() => openDecisionModal(decision)} className="p-1 text-muted-foreground hover:text-primary rounded opacity-0 group-hover:opacity-100 transition" title="Edit">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteDecision(decision.id)} disabled={deletingDecisionId === decision.id} className="p-1 text-muted-foreground hover:text-destructive rounded opacity-0 group-hover:opacity-100 transition disabled:opacity-50" title="Delete">
                      {deletingDecisionId === decision.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground mb-3">{decision.context}</div>
                <div className="text-sm">
                  <div className="font-medium text-foreground mb-1">Decision:</div>
                  <div className="text-muted-foreground">{decision.decision}</div>
                </div>
                <div className="text-xs text-muted-foreground/70 mt-3">
                  {new Date(decision.decision_date).toLocaleDateString()}
                </div>
              </Card>
            )) : (
              <Card>
                <p className="text-center text-muted-foreground py-8">No decisions logged yet. Click "Log Decision" to add one.</p>
              </Card>
            )}
          </div>
        )}

        {/* ── Weekly Focus Tab ──────────────────────────────────── */}
        {selectedTab === 'weekly-focus' && weeklyFocus && (
          <Card padding="md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium text-foreground">
                Week of {new Date(weeklyFocus.week_start_date).toLocaleDateString()}
              </h3>
              <button onClick={() => setWeeklyFocusModalOpen(true)} className="btn-primary flex items-center gap-2">
                <Edit className="w-4 h-4" />Edit
              </button>
            </div>
            <div className="space-y-4">
              {['focus_1', 'focus_2', 'focus_3'].map((key, i) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Focus #{i + 1}</label>
                  <div className="text-sm text-foreground">
                    {weeklyFocus[key] || <span className="text-muted-foreground/60 italic">Not set</span>}
                  </div>
                </div>
              ))}
              {weeklyFocus.notes && (
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Notes</label>
                  <div className="text-sm text-muted-foreground">{weeklyFocus.notes}</div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ── Strategy Docs Tab ─────────────────────────────────── */}
        {selectedTab === 'strategy' && <StrategyTab />}

        {/* ── AI Sessions Tab ───────────────────────────────────── */}
        {selectedTab === 'ai-sessions' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <select
                  value={aiDays}
                  onChange={e => setAiDays(Number(e.target.value))}
                  className="text-sm px-3 py-2 pr-8 border border-border rounded-md bg-input text-foreground appearance-none cursor-pointer focus:ring-2 focus:ring-ring/50 focus:border-ring"
                >
                  <option value={7}>Last 7 days</option>
                  <option value={14}>Last 14 days</option>
                  <option value={30}>Last 30 days</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
              <button onClick={loadAiSessions} disabled={aiLoading} className="btn-secondary flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} />Refresh
              </button>
            </div>

            {aiLoading ? <Loading text="Loading session data..." /> : aiSummary ? (
              <div className="space-y-4">
                {/* Top row: sessions + knowledge graph */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard title="Sessions"         value={aiSummary.sessions}                subtitle="tracked"                        icon={<Clock className="w-5 h-5" />}     color="blue" />
                  <StatCard title="Knowledge Entries" value={aiSummary.knowledge_entries_total} subtitle={`+${aiSummary.knowledge_entries_new} this period`} icon={<BookOpen className="w-5 h-5" />}  color="orange" />
                  <StatCard title="Quota Extended"    value={`${aiSummary.quota_extended_pct}%`} subtitle="effective capacity gain"       icon={<TrendingUp className="w-5 h-5" />} color="purple" />
                  <StatCard title="Rate Limit Hits"   value={aiSummary.rate_limit_hits}          subtitle="this period"                   icon={<Users className="w-5 h-5" />}     color={aiSummary.rate_limit_hits > 0 ? 'red' : 'blue'} />
                </div>

                {/* Investment vs Reuse split */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Investment */}
                  <Card padding="md">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Knowledge Investment</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tokens invested</span>
                        <span className="font-mono font-medium text-foreground">{formatAiTokens(aiSummary.tokens_invested ?? 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Creation sessions</span>
                        <span className="font-mono font-medium text-foreground">{aiSummary.creation_sessions ?? 0}</span>
                      </div>
                      <div className="flex justify-between border-t border-border pt-2 mt-1">
                        <span className="text-muted-foreground">Potential future value</span>
                        <span className="font-mono font-medium text-chart-4">~{formatAiTokens(aiSummary.potential_future_value ?? 0)}</span>
                      </div>
                    </div>
                  </Card>

                  {/* Reuse */}
                  <Card padding="md">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Knowledge Reuse</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tokens retrieved</span>
                        <span className="font-mono font-medium text-foreground">{formatAiTokens(aiSummary.tokens_retrieved)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Retrieval sessions</span>
                        <span className="font-mono font-medium text-foreground">{aiSummary.retrieval_sessions ?? 0}</span>
                      </div>
                      <div className="flex justify-between border-t border-border pt-2 mt-1">
                        <span className="text-muted-foreground">Actual savings</span>
                        <span className="font-mono font-medium text-chart-3">{formatAiTokens(aiSummary.actual_savings ?? 0)}</span>
                      </div>
                    </div>
                    {(aiSummary.retrieval_sessions ?? 0) === 0 && (
                      <p className="text-xs text-muted-foreground/60 mt-3">No reuse yet — savings realized when context is retrieved</p>
                    )}
                  </Card>

                  {/* Net Impact */}
                  <Card padding="md">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Net Impact</h3>
                    {(() => {
                      const net = aiSummary.net_impact ?? ((aiSummary.actual_savings ?? 0) - (aiSummary.tokens_invested ?? 0))
                      const roi = aiSummary.roi_pct ?? 0
                      const isPositive = net >= 0
                      return (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Net tokens</span>
                            <span className={`font-mono font-semibold ${isPositive ? 'text-chart-3' : 'text-muted-foreground'}`}>
                              {isPositive ? '+' : ''}{formatAiTokens(net)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Cost impact</span>
                            <span className={`font-mono font-medium ${isPositive ? 'text-chart-3' : 'text-muted-foreground'}`}>
                              {isPositive ? '-' : '+'}{formatAiCost(Math.abs(net))}
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-border pt-2 mt-1">
                            <span className="text-muted-foreground">ROI</span>
                            <span className={`font-mono font-semibold ${isPositive ? 'text-chart-3' : 'text-muted-foreground'}`}>
                              {(aiSummary.tokens_invested ?? 0) > 0 ? `${roi > 0 ? '+' : ''}${roi.toFixed(0)}%` : 'Pending'}
                            </span>
                          </div>
                        </div>
                      )
                    })()}
                  </Card>
                </div>
              </div>
            ) : (
              <Card><p className="text-sm text-muted-foreground p-4">No session data yet. Start a Claude Code session with the Evols plugin to begin tracking.</p></Card>
            )}

            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Session Knowledge — {aiEntries.length} entries
              </h2>
              {aiLoading ? null : aiEntries.length === 0 ? (
                <EmptyState icon={BookOpen} title="No knowledge entries yet" description="Complete a Claude Code session with the Evols plugin — the Stop hook will auto-sync your session knowledge." />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {aiEntries.map((entry: any) => (
                    <AiSessionEntryCard key={entry.id} entry={entry} onClick={() => handleAiEntryClick(entry)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </PageContainer>

      {selectedAiEntry && <AiEntryDetailModal entry={selectedAiEntry} onClose={() => setSelectedAiEntry(null)} />}

      <TaskModal isOpen={taskModalOpen} onClose={() => { setTaskModalOpen(false); setSelectedTask(null) }} onSuccess={loadData} task={selectedTask} />
      <DecisionModal isOpen={decisionModalOpen} onClose={() => { setDecisionModalOpen(false); setSelectedDecision(null) }} onSuccess={loadData} decision={selectedDecision} />
      <WeeklyFocusModal isOpen={weeklyFocusModalOpen} onClose={() => setWeeklyFocusModalOpen(false)} onSuccess={loadData} weeklyFocus={weeklyFocus} />
    </div>
  )
}

// ── Shared task card ───────────────────────────────────────────────────────

function TaskCard({ task, done, deleting, onEdit, onDelete }: {
  task: any; done: boolean; deleting: boolean; onEdit: () => void; onDelete: () => void
}) {
  return (
    <div className={`bg-card border border-border p-3 rounded-lg group hover:border-primary/30 transition ${done ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className={`flex-1 min-w-0 font-medium text-sm text-foreground ${done ? 'line-through' : ''}`}>
          {task.title}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1 text-muted-foreground hover:text-primary rounded opacity-0 group-hover:opacity-100 transition" title="Edit">
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} disabled={deleting} className="p-1 text-muted-foreground hover:text-destructive rounded opacity-0 group-hover:opacity-100 transition" title="Delete">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      {task.description && (
        <div className="text-xs text-muted-foreground mb-1.5 line-clamp-2">{task.description}</div>
      )}
      {task.deadline && (
        <div className="text-xs text-muted-foreground/70">
          📅 {new Date(task.deadline).toLocaleDateString()}
        </div>
      )}
    </div>
  )
}

// ── AI Sessions helpers ────────────────────────────────────────────────────

function formatAiTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatAiCost(tokens: number): string {
  const dollars = (tokens / 1_000_000) * 3
  if (dollars < 0.01) return '<$0.01'
  return `$${dollars.toFixed(2)}`
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const ROLE_COLORS: Record<string, string> = {
  engineer: 'bg-primary/10 text-primary dark:text-primary',
  pm:       'bg-primary/10 text-primary dark:text-primary',
  designer: 'bg-chart-2/15 text-chart-2',
  qa:       'bg-chart-4/20 text-chart-4',
  other:    'bg-muted text-muted-foreground',
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  insight: 'Insight', decision: 'Decision', artifact: 'Artifact',
  research_finding: 'Research', pattern: 'Pattern', context: 'Context',
}

function AiSessionEntryCard({ entry, onClick }: { entry: any; onClick: () => void }) {
  const roleColor = ROLE_COLORS[entry.role] || ROLE_COLORS.other
  return (
    <Card hover onClick={onClick} padding="sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColor}`}>{entry.role}</span>
            <span className="text-xs text-muted-foreground">{ENTRY_TYPE_LABELS[entry.entry_type] || entry.entry_type}</span>
            {entry.product_area && <span className="text-xs text-muted-foreground/60">· {entry.product_area}</span>}
          </div>
          <h4 className="text-sm font-medium text-foreground leading-snug mb-1.5">{entry.title}</h4>
          {entry.tags && entry.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <Tag className="w-3 h-3 text-muted-foreground/60" />
              {entry.tags.slice(0, 3).map((tag: string) => (
                <span key={tag} className="text-xs text-muted-foreground/70">{tag}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-xs text-muted-foreground/60">{timeAgo(entry.created_at)}</span>
          {entry.token_count && <span className="text-xs font-mono text-muted-foreground/60">{formatAiTokens(entry.token_count)} tok</span>}
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
        </div>
      </div>
    </Card>
  )
}

function AiEntryDetailModal({ entry, onClose }: { entry: any; onClose: () => void }) {
  const roleColor = ROLE_COLORS[entry.role] || ROLE_COLORS.other
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColor}`}>{entry.role}</span>
              <span className="text-xs text-muted-foreground">{ENTRY_TYPE_LABELS[entry.entry_type] || entry.entry_type}</span>
            </div>
            <h3 className="text-sm font-semibold text-foreground">{entry.title}</h3>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {timeAgo(entry.created_at)}
              {entry.token_count && ` · ${formatAiTokens(entry.token_count)} tokens`}
              {entry.retrieval_count !== undefined && ` · retrieved ${entry.retrieval_count}×`}
            </p>
          </div>
          <button onClick={onClose} className="ml-4 text-muted-foreground hover:text-foreground flex-shrink-0 transition-colors">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {entry.content
            ? <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{entry.content}</p>
            : <p className="text-sm text-muted-foreground italic">Loading content...</p>
          }
          {entry.tags && entry.tags.length > 0 && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <Tag className="w-3.5 h-3.5 text-muted-foreground/60" />
              {entry.tags.map((tag: string) => (
                <span key={tag} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
