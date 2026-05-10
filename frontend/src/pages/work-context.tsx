/**
 * Work Context Page
 * Personal PM operating system - role, team, capacity, projects, relationships
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Briefcase, TrendingUp, CheckSquare, Lightbulb, Plus, Trash2, Edit, Loader2, Users, Bot, FileText, Calendar } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card, Loading } from '@/components/PageContainer'
import TaskModal from '@/components/work-context/TaskModal'
import DecisionModal from '@/components/work-context/DecisionModal'
import WeeklyFocusModal from '@/components/work-context/WeeklyFocusModal'
import StrategyTab from '@/components/context/StrategyTab'

type TabType = 'overview' | 'tasks' | 'decisions' | 'meetings' | 'weekly-focus' | 'strategy'

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
  const [timeline, setTimeline] = useState<any[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [meetings, setMeetings] = useState<any[]>([])
  const [weeklyFocus, setWeeklyFocus] = useState<any>(null)

  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [decisionModalOpen, setDecisionModalOpen] = useState(false)
  const [selectedDecision, setSelectedDecision] = useState<any>(null)
  const [weeklyFocusModalOpen, setWeeklyFocusModalOpen] = useState(false)
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null)
  const [deletingDecisionId, setDeletingDecisionId] = useState<number | null>(null)


  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return }
    const currentUser = getCurrentUser()
    setUser(currentUser)
    const { tab } = router.query
    if (tab && ['overview','tasks','decisions','meetings','weekly-focus','strategy'].includes(tab as string)) {
      setSelectedTab(tab as TabType)
    }
    loadData()
  }, [])


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
      setDecisions(decisionsRes.data)
      setMeetings(meetingsRes.data)
      setWeeklyFocus(focusRes.data)
      // Refresh timeline if it was already loaded
      if (timeline.length > 0 || selectedTab === 'decisions') {
        loadTimeline()
      }
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

  const loadTimeline = async () => {
    setTimelineLoading(true)
    try {
      const res = await api.workContext.getDecisionsTimeline()
      setTimeline(res.data)
    } catch (e) {
      console.error('Failed to load decisions timeline', e)
    } finally {
      setTimelineLoading(false)
    }
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

  const handleDecisionsTabClick = () => {
    setSelectedTab('decisions')
    if (timeline.length === 0) loadTimeline()
  }

  const TABS: { id: TabType; label: string; icon: any; badge?: number; onClick?: () => void }[] = [
    { id: 'overview',  label: 'Overview',  icon: TrendingUp },
    { id: 'tasks',     label: 'Tasks',     icon: CheckSquare, badge: tasks.filter(t => t.status === 'todo' || t.status === 'in_progress').length },
    { id: 'decisions', label: 'Decisions', icon: Lightbulb,   onClick: handleDecisionsTabClick },
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
            {TABS.map(({ id, label, icon: Icon, badge, onClick }) => (
              <button
                key={id}
                onClick={onClick ?? (() => setSelectedTab(id))}
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Decisions from AI sessions, meeting notes, and manually logged entries — sorted by date.
              </p>
              <button onClick={() => openDecisionModal()} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" />Log Decision
              </button>
            </div>

            {timelineLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : timeline.length > 0 ? (
              <div className="relative">
                {/* vertical line */}
                <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border" />
                <div className="space-y-0">
                  {timeline.map((item, idx) => {
                    const isFirst = idx === 0
                    const date = new Date(item.date)
                    const prevDate = idx > 0 ? new Date(timeline[idx - 1].date) : null
                    const showDateDivider = !prevDate || date.toDateString() !== prevDate.toDateString()

                    const sourceConfig: Record<string, { icon: any; color: string; label: string }> = {
                      manual:     { icon: FileText, color: 'text-primary bg-primary/10',      label: 'Manual' },
                      ai_session: { icon: Bot,      color: 'text-chart-3 bg-chart-3/15',      label: item.source_label },
                      meeting:    { icon: Calendar, color: 'text-chart-4 bg-chart-4/15',      label: item.source_label },
                    }
                    const src = sourceConfig[item.source] ?? sourceConfig.manual
                    const Icon = src.icon

                    return (
                      <div key={item.id}>
                        {showDateDivider && (
                          <div className="flex items-center gap-3 py-3 pl-10">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                        )}
                        <div className="flex gap-4 pb-4 group">
                          {/* dot */}
                          <div className={`relative z-10 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${src.color}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          {/* card */}
                          <div className="flex-1 min-w-0 bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h3 className="text-sm font-medium text-foreground leading-snug flex-1">{item.title}</h3>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {item.category && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{item.category}</span>
                                )}
                                {item.source === 'manual' && (
                                  <>
                                    <button
                                      onClick={() => {
                                        const pm = decisions.find(d => d.id === item.pm_decision_id)
                                        if (pm) openDecisionModal(pm)
                                      }}
                                      className="p-1 text-muted-foreground hover:text-primary rounded opacity-0 group-hover:opacity-100 transition"
                                      title="Edit"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteDecision(item.pm_decision_id)}
                                      disabled={deletingDecisionId === item.pm_decision_id}
                                      className="p-1 text-muted-foreground hover:text-destructive rounded opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                                      title="Delete"
                                    >
                                      {deletingDecisionId === item.pm_decision_id
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <Trash2 className="w-3.5 h-3.5" />}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            {item.context && (
                              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{item.context}</p>
                            )}
                            <p className="text-sm text-muted-foreground line-clamp-3">{item.summary}</p>
                            {item.tags && item.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {item.tags.map((tag: string) => (
                                  <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">{tag}</span>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${src.color}`}>{src.label}</span>
                              <span className="text-xs text-muted-foreground/60">
                                {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <Card>
                <p className="text-center text-muted-foreground py-8">
                  No decisions found. Log one manually, or decisions from AI sessions and meetings will appear here automatically.
                </p>
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

      </PageContainer>

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

