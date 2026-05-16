/**
 * Work Context Page
 * Personal PM operating system - role, team, capacity, projects, relationships
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Briefcase, TrendingUp, CheckSquare, Lightbulb, Plus, Trash2, Edit, Loader2, Users, Bot, FileText, ChevronRight, ChevronLeft, GitBranch } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card, Loading } from '@/components/PageContainer'
import TaskModal from '@/components/work-context/TaskModal'
import DecisionModal from '@/components/work-context/DecisionModal'
import WeeklyFocusModal from '@/components/work-context/WeeklyFocusModal'
type TabType = 'overview' | 'tasks' | 'decisions'
type GraphTask = { id: string; name: string; description: string }

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
  const [weeklyFocus, setWeeklyFocus] = useState<any>(null)

  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [decisionModalOpen, setDecisionModalOpen] = useState(false)
  const [selectedDecision, setSelectedDecision] = useState<any>(null)
  const [weeklyFocusModalOpen, setWeeklyFocusModalOpen] = useState(false)
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null)
  const [deletingDecisionId, setDeletingDecisionId] = useState<number | null>(null)
  const [graphTasks, setGraphTasks] = useState<GraphTask[]>([])
  const [graphTasksLoading, setGraphTasksLoading] = useState(false)
  const [movingTaskId, setMovingTaskId] = useState<number | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [graphPanelOpen, setGraphPanelOpen] = useState(false)


  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return }
    const currentUser = getCurrentUser()
    setUser(currentUser)
    const { tab } = router.query
    if (tab && ['overview','tasks','decisions'].includes(tab as string)) {
      setSelectedTab(tab as TabType)
    }
    loadData()
    loadGraphTasks()
  }, [])


  const loadData = async () => {
    setLoading(true)
    try {
      const [contextRes, projectsRes, relationshipsRes, tasksRes, decisionsRes, focusRes] = await Promise.all([
        api.workContext.getWorkContext(),
        api.workContext.getActiveProjects(),
        api.workContext.getKeyRelationships(),
        api.workContext.getTasks(),
        api.workContext.getPMDecisions(),
        api.workContext.getCurrentWeeklyFocus()
      ])
      setWorkContext(contextRes.data)
      setActiveProjects(projectsRes.data)
      setKeyRelationships(relationshipsRes.data)
      setTasks(tasksRes.data)
      setDecisions(decisionsRes.data)
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

  const loadGraphTasks = async () => {
    setGraphTasksLoading(true)
    try {
      const res = await api.graph.getAll()
      const nodes: any[] = res.data?.nodes ?? []
      const parsed: GraphTask[] = nodes
        .filter(n => (n.properties?.entity_type ?? '').toLowerCase() === 'task')
        .map(n => {
          const props = n.properties ?? {}
          let desc = props.description ?? ''
          const m = desc.match(/<!--\s*attrs:\s*(\{.*?\})\s*-->/)
          if (m) desc = desc.replace(m[0], '').trim()
          return { id: n.id, name: props.entity_id ?? n.id, description: desc }
        })
      setGraphTasks(parsed)
    } catch (e) {
      console.error('Failed to load graph tasks', e)
    } finally {
      setGraphTasksLoading(false)
    }
  }

  const handlePullFromGraph = async (graphTask: GraphTask) => {
    const userName = user?.name || user?.email || 'Unknown'
    const description = graphTask.description
      ? `${graphTask.description}\n\nAssigned to: ${userName}`
      : `Assigned to: ${userName}`
    try {
      await api.workContext.createTask({
        title: graphTask.name,
        description,
        status: 'todo',
        priority: 'backlog',
      })
      await loadData()
    } catch { alert('Failed to pull task') }
  }

  const handleMoveTask = async (taskId: number, direction: 'left' | 'right') => {
    const STATUSES = ['todo', 'in_progress', 'completed'] as const
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const idx = STATUSES.indexOf(task.status)
    const nextIdx = direction === 'right' ? idx + 1 : idx - 1
    if (nextIdx < 0 || nextIdx >= STATUSES.length) return
    setMovingTaskId(taskId)
    try {
      await api.workContext.updateTask(taskId, { status: STATUSES[nextIdx] })
      await loadData()
    } catch { alert('Failed to move task') }
    finally { setMovingTaskId(null) }
  }

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    setDragOverCol(null)
    const taskId = parseInt(e.dataTransfer.getData('taskId'), 10)
    const fromStatus = e.dataTransfer.getData('fromStatus')
    if (!taskId || fromStatus === targetStatus) return
    setMovingTaskId(taskId)
    try {
      await api.workContext.updateTask(taskId, { status: targetStatus })
      await loadData()
    } catch { alert('Failed to move task') }
    finally { setMovingTaskId(null) }
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
          <div className="flex items-center justify-between">
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
            {selectedTab === 'tasks' && (
              <div className="flex items-center gap-2 mb-1">
                <button onClick={() => setGraphPanelOpen(true)} className="btn-secondary flex items-center gap-2">
                  <GitBranch className="w-4 h-4" />From Knowledge Graph
                </button>
                <button onClick={() => openTaskModal()} className="btn-primary flex items-center gap-2">
                  <Plus className="w-4 h-4" />New Task
                </button>
              </div>
            )}
            {selectedTab === 'decisions' && (
              <button onClick={() => openDecisionModal()} className="btn-primary flex items-center gap-2 mb-1">
                <Plus className="w-4 h-4" />Log Decision
              </button>
            )}
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
          <div className="flex gap-4 items-start relative">

            {/* Knowledge graph slide-in panel */}
            {graphPanelOpen && (
              <div className="fixed inset-y-0 right-0 z-50 flex">
                {/* backdrop */}
                <div className="fixed inset-0 bg-black/30" onClick={() => setGraphPanelOpen(false)} />
                <div className="relative ml-auto w-80 bg-background border-l border-border flex flex-col shadow-xl" style={{ height: '100vh' }}>
                  <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium text-foreground">From Knowledge Graph</h3>
                    </div>
                    <button onClick={() => setGraphPanelOpen(false)} className="p-1 text-muted-foreground hover:text-foreground rounded transition">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {graphTasksLoading ? (
                      <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                    ) : graphTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground/60 text-center py-8">No Task entities in graph yet</p>
                    ) : graphTasks.map(gt => {
                      const alreadyPulled = tasks.some(t => t.title === gt.name)
                      return (
                        <div key={gt.id} className="bg-card border border-border rounded-lg p-3 group">
                          <p className="text-sm font-medium text-foreground mb-1">{gt.name}</p>
                          {gt.description && (
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-3">{gt.description}</p>
                          )}
                          {alreadyPulled ? (
                            <span className="text-xs text-muted-foreground/60 italic">Already in board</span>
                          ) : (
                            <button
                              onClick={() => handlePullFromGraph(gt)}
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />Pull to board
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Swimlanes */}
            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                {([
                  { status: 'todo',        label: '📋 To Do' },
                  { status: 'in_progress', label: '🚀 In Progress' },
                  { status: 'completed',   label: '✅ Done' },
                ] as const).map(({ status, label }, colIdx) => {
                  const colTasks = tasks.filter(t => t.status === status)
                  const isOver = dragOverCol === status
                  return (
                    <div
                      key={status}
                      className={`flex flex-col rounded-xl border overflow-hidden transition-colors ${isOver ? 'border-primary bg-primary/5' : 'border-border'}`}
                      style={{ height: 'calc(100vh - 220px)' }}
                      onDragOver={e => { e.preventDefault(); setDragOverCol(status) }}
                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null) }}
                      onDrop={e => handleDrop(e, status)}
                    >
                      <div className="px-4 py-3 bg-muted/50 border-b border-border flex-shrink-0">
                        <h3 className="text-sm font-medium text-foreground">
                          {label} <span className="text-muted-foreground font-normal">({colTasks.length})</span>
                        </h3>
                      </div>
                      <div className="flex-1 overflow-y-auto bg-muted/20 p-3 space-y-2">
                        {['critical', 'high_leverage', 'stakeholder', 'sweep', 'backlog'].map((priority) => {
                          const priorityTasks = colTasks.filter(t => t.priority === priority)
                          if (priorityTasks.length === 0) return null
                          return (
                            <div key={priority} className="space-y-2">
                              <div className="text-xs text-muted-foreground tracking-wide pt-1">
                                {getPriorityLabel(priority)}
                              </div>
                              {priorityTasks.map((task) => (
                                <TaskCard
                                  key={task.id}
                                  task={task}
                                  done={status === 'completed'}
                                  deleting={deletingTaskId === task.id}
                                  moving={movingTaskId === task.id}
                                  colIdx={colIdx}
                                  onEdit={() => openTaskModal(task)}
                                  onDelete={() => handleDeleteTask(task.id)}
                                  onMoveLeft={() => handleMoveTask(task.id, 'left')}
                                  onMoveRight={() => handleMoveTask(task.id, 'right')}
                                  onDragStart={e => {
                                    e.dataTransfer.setData('taskId', String(task.id))
                                    e.dataTransfer.setData('fromStatus', status)
                                    e.dataTransfer.effectAllowed = 'move'
                                  }}
                                />
                              ))}
                            </div>
                          )
                        })}
                        {colTasks.length === 0 && (
                          <div className="text-center text-muted-foreground/50 text-sm py-8">
                            {isOver ? 'Drop here' : 'No tasks'}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Decisions Tab ─────────────────────────────────────── */}
        {selectedTab === 'decisions' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Decisions from AI sessions and manually logged entries — sorted by date.
            </p>

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
                      manual:     { icon: FileText, color: 'text-primary bg-primary/10',  label: 'Manual' },
                      ai_session: { icon: Bot,      color: 'text-chart-3 bg-chart-3/15',  label: item.source_label },
                    }
                    const src = sourceConfig[item.source] ?? sourceConfig.manual
                    const Icon = src.icon

                    return (
                      <div key={item.id}>
                        {showDateDivider && (
                          <div className="flex items-center gap-3 py-3 pl-10">
                            <span className="text-xs font-medium text-muted-foreground tracking-wide">
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
                  No decisions found. Log one manually, or AI session decisions will appear here automatically when synced.
                </p>
              </Card>
            )}
          </div>
        )}

      </PageContainer>

      <TaskModal isOpen={taskModalOpen} onClose={() => { setTaskModalOpen(false); setSelectedTask(null) }} onSuccess={loadData} task={selectedTask} />
      <DecisionModal isOpen={decisionModalOpen} onClose={() => { setDecisionModalOpen(false); setSelectedDecision(null) }} onSuccess={loadData} decision={selectedDecision} />
      <WeeklyFocusModal isOpen={weeklyFocusModalOpen} onClose={() => setWeeklyFocusModalOpen(false)} onSuccess={loadData} weeklyFocus={weeklyFocus} />
    </div>
  )
}

// ── Shared task card ───────────────────────────────────────────────────────

function TaskCard({ task, done, deleting, moving, colIdx, onEdit, onDelete, onMoveLeft, onMoveRight, onDragStart }: {
  task: any; done: boolean; deleting: boolean; moving: boolean; colIdx: number
  onEdit: () => void; onDelete: () => void; onMoveLeft: () => void; onMoveRight: () => void
  onDragStart: (e: React.DragEvent) => void
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`bg-card border border-border p-3 rounded-lg group hover:border-primary/30 transition cursor-grab active:cursor-grabbing ${done ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className={`flex-1 min-w-0 font-medium text-sm text-foreground ${done ? 'line-through' : ''}`}>
          {task.title}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          {colIdx > 0 && (
            <button onClick={onMoveLeft} disabled={moving} className="p-1 text-muted-foreground hover:text-primary rounded" title="Move left">
              {moving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>
          )}
          {colIdx < 2 && (
            <button onClick={onMoveRight} disabled={moving} className="p-1 text-muted-foreground hover:text-primary rounded" title="Move right">
              {moving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          )}
          <button onClick={onEdit} className="p-1 text-muted-foreground hover:text-primary rounded" title="Edit">
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} disabled={deleting} className="p-1 text-muted-foreground hover:text-destructive rounded" title="Delete">
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

