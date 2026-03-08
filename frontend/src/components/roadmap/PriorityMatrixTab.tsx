import { useMemo, useState, useRef, useEffect } from 'react'
import { Grid, ChevronDown, Check, Filter } from 'lucide-react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { calculateAverageUrgency, effortToSize, getInitiativeColor, getStatusColor, getChartColors } from '@/utils/roadmap'

interface PriorityMatrixTabProps {
  initiatives: any[]
  projects: any[]
  themes: any[]
}

interface BubbleData {
  x: number
  y: number
  z: number
  project: any
  initiative: any
  urgency: number
  color: string
}

// Custom bubble shape that uses the z value for size
const CustomBubble = (props: any) => {
  const { cx, cy, fill, payload } = props
  const radius = payload.z || 10 // Use z value as radius

  return (
    <circle
      cx={cx}
      cy={cy}
      r={radius}
      fill={fill}
      fillOpacity={0.7}
      stroke={fill}
      strokeWidth={2}
    />
  )
}

export function PriorityMatrixTab({ initiatives, projects, themes }: PriorityMatrixTabProps) {
  const [selectedProject, setSelectedProject] = useState<any | null>(null)
  const [filterInitiatives, setFilterInitiatives] = useState<number[]>([])
  const [filterThemes, setFilterThemes] = useState<number[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const [showInitiativeDropdown, setShowInitiativeDropdown] = useState(false)
  const [showThemeDropdown, setShowThemeDropdown] = useState(false)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)

  const initiativeDropdownRef = useRef<HTMLDivElement>(null)
  const themeDropdownRef = useRef<HTMLDivElement>(null)
  const statusDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (initiativeDropdownRef.current && !initiativeDropdownRef.current.contains(event.target as Node)) {
        setShowInitiativeDropdown(false)
      }
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target as Node)) {
        setShowThemeDropdown(false)
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleInitiative = (initiativeId: number) => {
    setFilterInitiatives(prev =>
      prev.includes(initiativeId)
        ? prev.filter(id => id !== initiativeId)
        : [...prev, initiativeId]
    )
  }

  const toggleTheme = (themeId: number) => {
    setFilterThemes(prev =>
      prev.includes(themeId)
        ? prev.filter(id => id !== themeId)
        : [...prev, themeId]
    )
  }

  const bubbleData = useMemo(() => {
    let filtered = projects

    // Filter by initiatives (multi-select)
    if (filterInitiatives.length > 0) {
      filtered = filtered.filter(p => filterInitiatives.includes(p.initiative_id))
    }

    // Filter by themes (multi-select)
    if (filterThemes.length > 0) {
      const initiativesWithThemes = initiatives.filter(i =>
        i.themes?.some((t: any) => filterThemes.includes(t.id))
      )
      const initiativeIds = new Set(initiativesWithThemes.map(i => i.id))
      filtered = filtered.filter(p => initiativeIds.has(p.initiative_id))
    }

    // Filter by timeframe (now/next/later based on initiative status, not project status)
    if (filterStatus !== 'all') {
      const statusMap: { [key: string]: string[] } = {
        'now': ['in_progress'],
        'next': ['planned'],
        'later': ['backlog', 'idea'],
      }
      const allowedStatuses = statusMap[filterStatus] || []

      // Find initiatives with the allowed statuses
      const initiativesWithStatus = initiatives.filter(i => {
        const status = i.status || 'backlog' // Default to backlog if no status
        return allowedStatuses.includes(status)
      })
      const initiativeIds = new Set(initiativesWithStatus.map(i => i.id))

      // Filter projects by their parent initiative's status
      filtered = filtered.filter(p => initiativeIds.has(p.initiative_id))
    }

    return filtered.map(project => {
      const initiative = initiatives.find(i => i.id === project.initiative_id)
      const themeUrgency = calculateAverageUrgency(initiative?.themes || [])

      return {
        x: themeUrgency * 100, // Scale 0-1 to 0-100
        y: project.priority_score || 0,
        z: effortToSize(project.effort || 'medium'),
        project,
        initiative,
        urgency: themeUrgency,
        color: getInitiativeColor(project.initiative_id),
      }
    })
  }, [projects, initiatives, themes, filterInitiatives, filterThemes, filterStatus])

  const chartColors = getChartColors()

  const getInitiativeDisplayText = () => {
    if (filterInitiatives.length === 0) return 'All Initiatives'
    if (filterInitiatives.length === 1) {
      const initiative = initiatives.find(i => i.id === filterInitiatives[0])
      return initiative ? initiative.title : 'All Initiatives'
    }
    return `${filterInitiatives.length} Initiatives`
  }

  const getThemeDisplayText = () => {
    if (filterThemes.length === 0) return 'All Themes'
    if (filterThemes.length === 1) {
      const theme = themes.find(t => t.id === filterThemes[0])
      return theme ? theme.title : 'All Themes'
    }
    return `${filterThemes.length} Themes`
  }

  const getStatusDisplayText = () => {
    if (filterStatus === 'all') return 'All Timeframes'
    return filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-4 mb-6 flex-wrap">
        {/* Initiative Filter */}
        <div className="relative" ref={initiativeDropdownRef}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Filter by Initiative
          </label>
          <button
            onClick={() => setShowInitiativeDropdown(!showInitiativeDropdown)}
            className="px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 min-w-[200px]"
          >
            <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium truncate flex-1 text-left">{getInitiativeDisplayText()}</span>
            <ChevronDown className="absolute right-3 w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>

          {showInitiativeDropdown && (
            <div className="absolute left-0 mt-2 w-80 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
              <div className="p-2">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Select Initiatives (Multi)
                  </div>
                  {filterInitiatives.length > 0 && (
                    <button
                      onClick={() => setFilterInitiatives([])}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                {initiatives.map((initiative) => {
                  const isSelected = filterInitiatives.includes(initiative.id)
                  return (
                    <button
                      key={initiative.id}
                      onClick={() => toggleInitiative(initiative.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors ${
                        isSelected ? 'bg-gray-100 dark:bg-gray-600' : ''
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getInitiativeColor(initiative.id) }}
                      />
                      <span className={`text-sm font-medium flex-1 text-left truncate ${
                        isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
                      }`}>
                        {initiative.title}
                      </span>
                      {isSelected && (
                        <Check className="ml-auto w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Theme Filter */}
        <div className="relative" ref={themeDropdownRef}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Filter by Theme
          </label>
          <button
            onClick={() => setShowThemeDropdown(!showThemeDropdown)}
            className="px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 min-w-[200px]"
          >
            <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium truncate flex-1 text-left">{getThemeDisplayText()}</span>
            <ChevronDown className="absolute right-3 w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>

          {showThemeDropdown && (
            <div className="absolute left-0 mt-2 w-80 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
              <div className="p-2">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Select Themes (Multi)
                  </div>
                  {filterThemes.length > 0 && (
                    <button
                      onClick={() => setFilterThemes([])}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                {themes.map((theme) => {
                  const isSelected = filterThemes.includes(theme.id)
                  return (
                    <button
                      key={theme.id}
                      onClick={() => toggleTheme(theme.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors ${
                        isSelected ? 'bg-gray-100 dark:bg-gray-600' : ''
                      }`}
                    >
                      <span className={`text-sm font-medium flex-1 text-left truncate ${
                        isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
                      }`}>
                        {theme.title}
                      </span>
                      {isSelected && (
                        <Check className="ml-auto w-4 h-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Timeframe Filter */}
        <div className="relative" ref={statusDropdownRef}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Filter by Timeframe
          </label>
          <button
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            className="px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 min-w-[200px]"
          >
            <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium truncate flex-1 text-left">{getStatusDisplayText()}</span>
            <ChevronDown className="absolute right-3 w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>

          {showStatusDropdown && (
            <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50">
              <div className="p-2">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-2">
                  Select Timeframe
                </div>
                {[
                  { value: 'all', label: 'All Timeframes' },
                  { value: 'now', label: 'Now (In Progress)' },
                  { value: 'next', label: 'Next (Planned)' },
                  { value: 'later', label: 'Later (Backlog)' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setFilterStatus(option.value)
                      setShowStatusDropdown(false)
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors ${
                      filterStatus === option.value ? 'bg-gray-100 dark:bg-gray-600' : ''
                    }`}
                  >
                    <span className={`text-sm font-medium flex-1 text-left ${
                      filterStatus === option.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {option.label}
                    </span>
                    {filterStatus === option.value && (
                      <Check className="ml-auto w-4 h-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Chart Guide:</div>
        <div className="grid grid-cols-3 gap-4 text-xs text-gray-600 dark:text-gray-400">
          <div>
            <strong>Y-axis (↑):</strong> RICE Priority Score (higher = more important)
          </div>
          <div>
            <strong>X-axis (→):</strong> Urgency Score from themes (0-100%)
          </div>
          <div>
            <strong>Bubble Size:</strong> Effort (small → medium → large → xlarge)
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
        {bubbleData.length === 0 ? (
          <div className="text-center py-20">
            <Grid className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400 text-lg font-medium mb-2">No projects to display</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Projects will appear here once they are generated from initiatives.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={600}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 60 }}>
            <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name="Urgency"
              domain={[0, 100]}
              tick={{ fill: chartColors.text }}
              label={{
                value: 'Urgency Score (%)',
                position: 'bottom',
                offset: 40,
                style: { fill: chartColors.text }
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Priority"
              tick={{ fill: chartColors.text }}
              label={{
                value: 'RICE Priority Score',
                angle: -90,
                position: 'left',
                offset: 40,
                style: { fill: chartColors.text }
              }}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ strokeDasharray: '3 3' }}
            />
            <Scatter
              name="Projects"
              data={bubbleData}
              onClick={(data: any) => setSelectedProject(data.project)}
              style={{ cursor: 'pointer' }}
              shape={<CustomBubble />}
            >
              {bubbleData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        )}
      </div>

      {/* Project Details Modal */}
      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          initiative={initiatives.find(i => i.id === selectedProject.initiative_id)}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  )
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload[0]) return null

  const data = payload[0].payload

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      <p className="font-bold text-gray-900 dark:text-white mb-2">{data.project.title}</p>
      <div className="space-y-1 text-sm">
        <p className="text-gray-600 dark:text-gray-400">
          <strong>RICE Score:</strong> {data.y.toFixed(2)}
        </p>
        <p className="text-gray-600 dark:text-gray-400">
          <strong>Urgency:</strong> {data.x.toFixed(1)}%
        </p>
        <p className="text-gray-600 dark:text-gray-400">
          <strong>Effort:</strong> {data.project.effort}
        </p>
        {data.initiative && (
          <p className="text-gray-600 dark:text-gray-400">
            <strong>Initiative:</strong> {data.initiative.title}
          </p>
        )}
        <div className="mt-2">
          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(data.project.status)}`}>
            {data.project.status}
          </span>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Click to see details</p>
    </div>
  )
}

function ProjectDetailModal({ project, initiative, onClose }: { project: any; initiative: any; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{project.title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-4">{project.description}</p>

        {/* RICE Breakdown */}
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">RICE Score Breakdown:</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Reach:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">{project.reach || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Persona Weight:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {project.persona_weight?.toFixed(2) || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Confidence:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {project.confidence ? (project.confidence * 100).toFixed(0) + '%' : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Effort Score:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">{project.effort_score || 'N/A'}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600 dark:text-gray-400">Priority Score:</span>
              <span className="ml-2 font-bold text-lg text-blue-500 dark:text-blue-300">
                {project.priority_score?.toFixed(2) || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Initiative */}
        {initiative && (
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Initiative:</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{initiative.title}</div>
          </div>
        )}

        {/* Acceptance Criteria */}
        {project.acceptance_criteria && project.acceptance_criteria.length > 0 && (
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Acceptance Criteria:</div>
            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
              {project.acceptance_criteria.map((criterion: string, idx: number) => (
                <li key={idx}>{criterion}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Badges */}
        <div className="flex gap-2 flex-wrap">
          <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(project.status)}`}>
            {project.status}
          </span>
          <span className={`px-3 py-1 rounded text-sm font-medium ${
            project.effort === 'small' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
            project.effort === 'medium' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
            project.effort === 'large' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' :
            'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
          }`}>
            {project.effort}
          </span>
          <span className={`px-3 py-1 rounded text-sm font-medium ${
            project.is_boulder
              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
          }`}>
            {project.is_boulder ? 'Boulder' : 'Pebble'}
          </span>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full btn-primary"
        >
          Close
        </button>
      </div>
    </div>
  )
}
