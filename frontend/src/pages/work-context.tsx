/**
 * Work Context Page
 * Personal PM operating system - role, team, capacity, projects, relationships
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Briefcase, Users, TrendingUp, Calendar, BookOpen, CheckSquare, Lightbulb } from 'lucide-react'
import { getCurrentUser, isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card, Loading } from '@/components/PageContainer'

type TabType = 'overview' | 'tasks' | 'decisions' | 'meetings' | 'weekly-focus'

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
        <Header />
        <PageContainer>
          <Loading />
        </PageContainer>
      </>
    )
  }

  return (
    <>
      <Header />
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
              Tasks ({tasks.filter(t => t.status !== 'completed').length})
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
              onClick={() => setSelectedTab('meetings')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition whitespace-nowrap ${
                selectedTab === 'meetings'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Meetings ({meetings.length})
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
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Capacity</h3>
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
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Role & Team</h3>
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
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Three Things That Matter This Week
                </h3>
                <div className="space-y-2">
                  {weeklyFocus.focus_1 && (
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 font-bold">1.</span>
                      <span className="text-gray-900 dark:text-white">{weeklyFocus.focus_1}</span>
                    </div>
                  )}
                  {weeklyFocus.focus_2 && (
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 font-bold">2.</span>
                      <span className="text-gray-900 dark:text-white">{weeklyFocus.focus_2}</span>
                    </div>
                  )}
                  {weeklyFocus.focus_3 && (
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 font-bold">3.</span>
                      <span className="text-gray-900 dark:text-white">{weeklyFocus.focus_3}</span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Active Projects */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Active Projects</h3>
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
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Key Relationships</h3>
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
            {['critical', 'high_leverage', 'stakeholder', 'sweep', 'backlog'].map((priority) => {
              const priorityTasks = tasks.filter(t => t.priority === priority && t.status !== 'completed')
              if (priorityTasks.length === 0) return null

              return (
                <Card key={priority}>
                  <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
                    {getPriorityLabel(priority)} ({priorityTasks.length})
                  </h3>
                  <div className="space-y-2">
                    {priorityTasks.map((task) => (
                      <div key={task.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-white">{task.title}</div>
                          {task.description && (
                            <div className="text-sm text-gray-700 dark:text-gray-400 mt-1">{task.description}</div>
                          )}
                          {task.deadline && (
                            <div className="text-xs text-gray-600 dark:text-gray-500 mt-1">
                              Due: {new Date(task.deadline).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          {task.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* Decisions Tab */}
        {selectedTab === 'decisions' && (
          <div className="space-y-4">
            {decisions.map((decision) => (
              <Card key={decision.id}>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    #{decision.decision_number}: {decision.title}
                  </h3>
                  <span className="text-xs px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                    {decision.category}
                  </span>
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
            ))}
          </div>
        )}

        {/* Meetings Tab */}
        {selectedTab === 'meetings' && (
          <div className="space-y-4">
            {meetings.map((meeting) => (
              <Card key={meeting.id}>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{meeting.title}</h3>
                  <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    {meeting.meeting_type.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-400 mb-2">
                  {new Date(meeting.meeting_date).toLocaleDateString()}
                </div>
                {meeting.notes && (
                  <div className="text-sm text-gray-700 dark:text-gray-400 mt-2">
                    {meeting.notes.substring(0, 200)}...
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Weekly Focus Tab */}
        {selectedTab === 'weekly-focus' && weeklyFocus && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Week of {new Date(weeklyFocus.week_start_date).toLocaleDateString()}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Focus #1
                </label>
                <div className="text-gray-900 dark:text-white">
                  {weeklyFocus.focus_1 || 'Not set'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Focus #2
                </label>
                <div className="text-gray-900 dark:text-white">
                  {weeklyFocus.focus_2 || 'Not set'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Focus #3
                </label>
                <div className="text-gray-900 dark:text-white">
                  {weeklyFocus.focus_3 || 'Not set'}
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
    </>
  )
}
