/**
 * Work Context Page
 * Personal PM operating system - role, team, capacity, projects, relationships
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Briefcase, TrendingUp, Calendar, CheckSquare, Lightbulb, Plus, Trash2, Edit, Loader2 } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card, Loading } from '@/components/PageContainer'
import TaskModal from '@/components/work-context/TaskModal'
import DecisionModal from '@/components/work-context/DecisionModal'
import WeeklyFocusModal from '@/components/work-context/WeeklyFocusModal'
import { useProducts } from '@/hooks/useProducts'

type TabType = 'overview' | 'tasks' | 'decisions' | 'meetings' | 'weekly-focus'

export default function WorkContext() {
  const router = useRouter()
  const { selectedProductIds } = useProducts()
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

  // Modal states
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [decisionModalOpen, setDecisionModalOpen] = useState(false)
  const [selectedDecision, setSelectedDecision] = useState<any>(null)
  const [weeklyFocusModalOpen, setWeeklyFocusModalOpen] = useState(false)
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null)
  const [deletingDecisionId, setDeletingDecisionId] = useState<number | null>(null)

  const productId = selectedProductIds[0]

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    const currentUser = getCurrentUser()
    setUser(currentUser)
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [
        contextRes,
        projectsRes,
        relationshipsRes,
        tasksRes,
        decisionsRes,
        meetingsRes,
        focusRes
      ] = await Promise.all([
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
      setDecisions(decisionsRes.data.slice(0, 5)) // Recent 5
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
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('Failed to delete task')
    } finally {
      setDeletingTaskId(null)
    }
  }

  const handleDeleteDecision = async (decisionId: number) => {
    if (!confirm('Delete this decision?')) return

    setDeletingDecisionId(decisionId)
    try {
      await api.workContext.deletePMDecision(decisionId)
      await loadData()
    } catch (error) {
      console.error('Error deleting decision:', error)
      alert('Failed to delete decision')
    } finally {
      setDeletingDecisionId(null)
    }
  }

  const openTaskModal = (task?: any) => {
    setSelectedTask(task || null)
    setTaskModalOpen(true)
  }

  const openDecisionModal = (decision?: any) => {
    setSelectedDecision(decision || null)
    setDecisionModalOpen(true)
  }

  const getCapacityColor = (status?: string) => {
    switch (status) {
      case 'sustainable': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
      case 'stretched': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30'
      case 'overloaded': return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30'
      case 'unsustainable': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30'
    }
  }

  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case 'green': return 'bg-green-500'
      case 'yellow': return 'bg-yellow-500'
      case 'red': return 'bg-red-500'
      case 'completed': return 'bg-blue-500'
      case 'paused': return 'bg-gray-400'
      default: return 'bg-gray-400'
    }
  }

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      critical: '🔴 Critical Today',
      high_leverage: '🟡 High Leverage',
      stakeholder: '🔵 Stakeholder',
      sweep: '⚪ Sweep Queue',
      backlog: '🟣 Backlog'
    }
    return labels[priority] || priority
  }

  if (loading) {
    return (
      <>
        <Header user={user} currentPage="work-context" />
        <PageContainer>
          <Loading />
        </PageContainer>
      </>
    )
  }

  return (
    <div className="min-h-screen">
      <Header user={user} currentPage="work-context" />
      <PageContainer>
        <PageHeader
          title="Work Context"
          description="Your personal PM operating system"
          icon={Briefcase}
        />

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-1 overflow-x-auto">
            <button
              onClick={() => setSelectedTab('overview')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition whitespace-nowrap ${
                selectedTab === 'overview'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-2" />
              Overview
            </button>
            <button
              onClick={() => setSelectedTab('tasks')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition whitespace-nowrap ${
                selectedTab === 'tasks'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <CheckSquare className="w-4 h-4 inline mr-2" />
              Tasks ({tasks.filter(t => t.status === 'todo' || t.status === 'in_progress').length})
            </button>
            <button
              onClick={() => setSelectedTab('decisions')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition whitespace-nowrap ${
                selectedTab === 'decisions'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Lightbulb className="w-4 h-4 inline mr-2" />
              Decisions ({decisions.length})
            </button>
            <button
              onClick={() => setSelectedTab('weekly-focus')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition whitespace-nowrap ${
                selectedTab === 'weekly-focus'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              Weekly Focus
            </button>
          </div>
        </div>

        {/* Overview Tab */}
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            {/* Capacity & Role */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Capacity */}
              <Card>
                <h3 className="text-lg text-gray-900 dark:text-white mb-4">Capacity</h3>
                {workContext?.capacity_status ? (
                  <div>
                    <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getCapacityColor(workContext.capacity_status)}`}>
                      {workContext.capacity_status.replace('_', ' ').toUpperCase()}
                    </div>
                    {workContext.capacity_factors && (
                      <p className="mt-3 text-sm text-gray-700 dark:text-gray-400">
                        {workContext.capacity_factors}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No capacity info yet</p>
                )}
              </Card>

              {/* Role */}
              <Card>
                <h3 className="text-lg text-gray-900 dark:text-white mb-4">Role & Team</h3>
                {workContext?.title || workContext?.team ? (
                  <div className="space-y-2 text-sm">
                    {workContext.title && (
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">{workContext.title}</span>
                      </div>
                    )}
                    {workContext.team && (
                      <div className="text-gray-700 dark:text-gray-400">{workContext.team}</div>
                    )}
                    {workContext.manager_name && (
                      <div className="text-gray-700 dark:text-gray-400">
                        Reports to: {workContext.manager_name}
                        {workContext.manager_title && ` (${workContext.manager_title})`}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No role info yet</p>
                )}
              </Card>
            </div>

            {/* This Week's Focus */}
            {weeklyFocus && (weeklyFocus.focus_1 || weeklyFocus.focus_2 || weeklyFocus.focus_3) && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg text-gray-900 dark:text-white">
                    Three Things That Matter This Week
                  </h3>
                  <button
                    onClick={() => setWeeklyFocusModalOpen(true)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                </div>
                <div className="space-y-2">
                  {weeklyFocus.focus_1 && (
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400">1.</span>
                      <span className="text-gray-900 dark:text-white">{weeklyFocus.focus_1}</span>
                    </div>
                  )}
                  {weeklyFocus.focus_2 && (
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400">2.</span>
                      <span className="text-gray-900 dark:text-white">{weeklyFocus.focus_2}</span>
                    </div>
                  )}
                  {weeklyFocus.focus_3 && (
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400">3.</span>
                      <span className="text-gray-900 dark:text-white">{weeklyFocus.focus_3}</span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Active Projects */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg text-gray-900 dark:text-white">Active Projects</h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">{activeProjects.length} projects</span>
              </div>
              {activeProjects.length > 0 ? (
                <div className="space-y-3">
                  {activeProjects.map((project) => (
                    <div key={project.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className={`w-2 h-2 mt-2 rounded-full ${getProjectStatusColor(project.status)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white">{project.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {project.role}
                          </span>
                        </div>
                        {project.next_milestone && (
                          <div className="text-sm text-gray-700 dark:text-gray-400 mt-1">
                            Next: {project.next_milestone}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No active projects</p>
              )}
            </Card>

            {/* Key Relationships */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg text-gray-900 dark:text-white">Key Relationships</h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">{keyRelationships.length} people</span>
              </div>
              {keyRelationships.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {keyRelationships.map((rel) => (
                    <div key={rel.id} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="font-medium text-gray-900 dark:text-white">{rel.name}</div>
                      {rel.role && (
                        <div className="text-sm text-gray-700 dark:text-gray-400">{rel.role}</div>
                      )}
                      {rel.relationship_type && (
                        <div className="text-xs text-gray-600 dark:text-gray-500 mt-1">
                          {rel.relationship_type}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No relationships tracked</p>
              )}
            </Card>
          </div>
        )}

        {/* Tasks Tab */}
        {selectedTab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => openTaskModal()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                <Plus className="w-4 h-4" />
                New Task
              </button>
            </div>

            {/* Kanban Board with Swimlanes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* TODO Column */}
              <div className="flex flex-col">
                <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-t-lg border-b-2 border-blue-500">
                  <h3 className="text-gray-900 dark:text-white">
                    📋 To Do ({tasks.filter(t => t.status === 'todo').length})
                  </h3>
                </div>
                <div className="flex-1 bg-gray-50 dark:bg-gray-900/30 rounded-b-lg p-4 space-y-3 min-h-[500px]">
                  {['critical', 'high_leverage', 'stakeholder', 'sweep', 'backlog'].map((priority) => {
                    const priorityTasks = tasks.filter(t => t.priority === priority && t.status === 'todo')
                    if (priorityTasks.length === 0) return null

                    return (
                      <div key={priority} className="space-y-2">
                        <div className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          {getPriorityLabel(priority)}
                        </div>
                        {priorityTasks.map((task) => (
                          <div key={task.id} className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 group hover:shadow-md transition">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0 font-medium text-sm text-gray-900 dark:text-white">
                                {task.title}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openTaskModal(task)}
                                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded opacity-0 group-hover:opacity-100 transition"
                                  title="Edit"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  disabled={deletingTaskId === task.id}
                                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition"
                                  title="Delete"
                                >
                                  {deletingTaskId === task.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                            {task.description && (
                              <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">{task.description}</div>
                            )}
                            {task.deadline && (
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                📅 {new Date(task.deadline).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  {tasks.filter(t => t.status === 'todo').length === 0 && (
                    <div className="text-center text-gray-400 dark:text-gray-600 text-sm py-8">
                      No tasks in To Do
                    </div>
                  )}
                </div>
              </div>

              {/* IN PROGRESS Column */}
              <div className="flex flex-col">
                <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-t-lg border-b-2 border-yellow-500">
                  <h3 className="text-gray-900 dark:text-white">
                    🚀 In Progress ({tasks.filter(t => t.status === 'in_progress').length})
                  </h3>
                </div>
                <div className="flex-1 bg-gray-50 dark:bg-gray-900/30 rounded-b-lg p-4 space-y-3 min-h-[500px]">
                  {['critical', 'high_leverage', 'stakeholder', 'sweep', 'backlog'].map((priority) => {
                    const priorityTasks = tasks.filter(t => t.priority === priority && t.status === 'in_progress')
                    if (priorityTasks.length === 0) return null

                    return (
                      <div key={priority} className="space-y-2">
                        <div className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          {getPriorityLabel(priority)}
                        </div>
                        {priorityTasks.map((task) => (
                          <div key={task.id} className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 group hover:shadow-md transition">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0 font-medium text-sm text-gray-900 dark:text-white">
                                {task.title}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openTaskModal(task)}
                                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded opacity-0 group-hover:opacity-100 transition"
                                  title="Edit"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  disabled={deletingTaskId === task.id}
                                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition"
                                  title="Delete"
                                >
                                  {deletingTaskId === task.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                            {task.description && (
                              <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">{task.description}</div>
                            )}
                            {task.deadline && (
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                📅 {new Date(task.deadline).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  {tasks.filter(t => t.status === 'in_progress').length === 0 && (
                    <div className="text-center text-gray-400 dark:text-gray-600 text-sm py-8">
                      No tasks in progress
                    </div>
                  )}
                </div>
              </div>

              {/* DONE Column */}
              <div className="flex flex-col">
                <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-t-lg border-b-2 border-green-500">
                  <h3 className="text-gray-900 dark:text-white">
                    ✅ Done ({tasks.filter(t => t.status === 'completed').length})
                  </h3>
                </div>
                <div className="flex-1 bg-gray-50 dark:bg-gray-900/30 rounded-b-lg p-4 space-y-3 min-h-[500px]">
                  {['critical', 'high_leverage', 'stakeholder', 'sweep', 'backlog'].map((priority) => {
                    const priorityTasks = tasks.filter(t => t.priority === priority && t.status === 'completed')
                    if (priorityTasks.length === 0) return null

                    return (
                      <div key={priority} className="space-y-2">
                        <div className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          {getPriorityLabel(priority)}
                        </div>
                        {priorityTasks.map((task) => (
                          <div key={task.id} className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 group hover:shadow-md transition opacity-75">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0 font-medium text-sm text-gray-900 dark:text-white line-through">
                                {task.title}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openTaskModal(task)}
                                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded opacity-0 group-hover:opacity-100 transition"
                                  title="Edit"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  disabled={deletingTaskId === task.id}
                                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition"
                                  title="Delete"
                                >
                                  {deletingTaskId === task.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                            {task.description && (
                              <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">{task.description}</div>
                            )}
                            {task.deadline && (
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                📅 {new Date(task.deadline).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  {tasks.filter(t => t.status === 'completed').length === 0 && (
                    <div className="text-center text-gray-400 dark:text-gray-600 text-sm py-8">
                      No completed tasks
                    </div>
                  )}
                </div>
              </div>
            </div>

            {tasks.length === 0 && (
              <Card>
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No tasks yet. Click "New Task" to add one.
                </p>
              </Card>
            )}
          </div>
        )}

        {/* Decisions Tab */}
        {selectedTab === 'decisions' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => openDecisionModal()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                <Plus className="w-4 h-4" />
                Log Decision
              </button>
            </div>

            {decisions.length > 0 ? (
              decisions.map((decision) => (
                <Card key={decision.id}>
                  <div className="flex items-start justify-between mb-2 group">
                    <h3 className="text-gray-900 dark:text-white flex-1">
                      #{decision.decision_number}: {decision.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                        {decision.category}
                      </span>
                      <button
                        onClick={() => openDecisionModal(decision)}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded opacity-0 group-hover:opacity-100 transition"
                        title="Edit decision"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDecision(decision.id)}
                        disabled={deletingDecisionId === decision.id}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                        title="Delete decision"
                      >
                        {deletingDecisionId === decision.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-400 mb-3">{decision.context}</div>
                  <div className="text-sm">
                    <div className="font-medium text-gray-900 dark:text-white mb-1">Decision:</div>
                    <div className="text-gray-700 dark:text-gray-400">{decision.decision}</div>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-500 mt-3">
                    {new Date(decision.decision_date).toLocaleDateString()}
                  </div>
                </Card>
              ))
            ) : (
              <Card>
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No decisions logged yet. Click "Log Decision" to add one.
                </p>
              </Card>
            )}
          </div>
        )}

        {/* Weekly Focus Tab */}
        {selectedTab === 'weekly-focus' && weeklyFocus && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-gray-900 dark:text-white">
                Week of {new Date(weeklyFocus.week_start_date).toLocaleDateString()}
              </h3>
              <button
                onClick={() => setWeeklyFocusModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Focus #1
                </label>
                <div className="text-gray-900 dark:text-white">
                  {weeklyFocus.focus_1 || <span className="text-gray-500 italic">Not set</span>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Focus #2
                </label>
                <div className="text-gray-900 dark:text-white">
                  {weeklyFocus.focus_2 || <span className="text-gray-500 italic">Not set</span>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Focus #3
                </label>
                <div className="text-gray-900 dark:text-white">
                  {weeklyFocus.focus_3 || <span className="text-gray-500 italic">Not set</span>}
                </div>
              </div>
              {weeklyFocus.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes
                  </label>
                  <div className="text-gray-700 dark:text-gray-400">
                    {weeklyFocus.notes}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}
      </PageContainer>

      {/* Modals */}
      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false)
          setSelectedTask(null)
        }}
        onSuccess={loadData}
        task={selectedTask}
        productId={productId}
      />

      <DecisionModal
        isOpen={decisionModalOpen}
        onClose={() => {
          setDecisionModalOpen(false)
          setSelectedDecision(null)
        }}
        onSuccess={loadData}
        decision={selectedDecision}
        productId={productId}
      />

      <WeeklyFocusModal
        isOpen={weeklyFocusModalOpen}
        onClose={() => setWeeklyFocusModalOpen(false)}
        onSuccess={loadData}
        weeklyFocus={weeklyFocus}
      />
    </div>
  )
}
