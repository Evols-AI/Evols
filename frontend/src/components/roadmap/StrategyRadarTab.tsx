import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { formatPercentage } from '@/utils/roadmap'

interface StrategyRadarTabProps {
  initiatives: any[]
  projects: any[]
}

interface StrategyBreakdown {
  retention: any[]
  growth: any[]
  infrastructure: any[]
  stats: {
    retentionCount: number
    growthCount: number
    infrastructureCount: number
    retentionProjects: number
    growthProjects: number
    infrastructureProjects: number
  }
}

export function StrategyRadarTab({ initiatives, projects }: StrategyRadarTabProps) {
  const [viewBy, setViewBy] = useState<'initiatives' | 'projects'>('initiatives')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  const breakdown = useMemo(() => categorizeInitiatives(initiatives, projects), [initiatives, projects])

  const chartData = viewBy === 'initiatives'
    ? [
        { name: 'Retention', value: breakdown.stats.retentionCount, fill: '#10b981', color: 'green' },
        { name: 'Growth', value: breakdown.stats.growthCount, fill: '#3b82f6', color: 'blue' },
        { name: 'Infrastructure', value: breakdown.stats.infrastructureCount, fill: '#8b5cf6', color: 'purple' },
      ]
    : [
        { name: 'Retention', value: breakdown.stats.retentionProjects, fill: '#10b981', color: 'green' },
        { name: 'Growth', value: breakdown.stats.growthProjects, fill: '#3b82f6', color: 'blue' },
        { name: 'Infrastructure', value: breakdown.stats.infrastructureProjects, fill: '#8b5cf6', color: 'purple' },
      ]

  const totalCount = chartData.reduce((sum, item) => sum + item.value, 0)

  if (initiatives.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-gray-400 mb-4">📊</div>
        <p className="text-gray-600 dark:text-gray-400 text-lg font-medium mb-2">No initiatives to analyze</p>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Strategic allocation will be displayed once initiatives are created.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* View Toggle */}
      <div className="flex justify-center gap-4 mb-6">
        <button
          onClick={() => setViewBy('initiatives')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewBy === 'initiatives'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          By Initiatives
        </button>
        <button
          onClick={() => setViewBy('projects')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewBy === 'projects'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          By Projects
        </button>
      </div>

      {/* Donut Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
        <h3 className="text-lg text-gray-900 dark:text-white mb-4 text-center">
          Strategic Allocation
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={120}
              dataKey="value"
              label={(entry) => `${entry.name}: ${entry.value} (${((entry.value / totalCount) * 100).toFixed(0)}%)`}
              labelLine={{ stroke: '#666' }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip viewBy={viewBy} />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
          <div className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Retention</div>
          <div className="text-2xl text-green-700 dark:text-green-300">
            {breakdown.stats.retentionCount}
          </div>
          <div className="text-xs text-green-600 dark:text-green-500">
            {breakdown.stats.retentionProjects} projects
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Growth</div>
          <div className="text-2xl text-blue-700 dark:text-blue-300">
            {breakdown.stats.growthCount}
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-500">
            {breakdown.stats.growthProjects} projects
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">Infrastructure</div>
          <div className="text-2xl text-purple-700 dark:text-purple-300">
            {breakdown.stats.infrastructureCount}
          </div>
          <div className="text-xs text-purple-600 dark:text-purple-500">
            {breakdown.stats.infrastructureProjects} projects
          </div>
        </div>
      </div>

      {/* Category Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CategorySection
          title="Retention"
          color="green"
          initiatives={breakdown.retention}
          projects={projects}
          isExpanded={expandedCategory === 'retention'}
          onToggle={() => setExpandedCategory(expandedCategory === 'retention' ? null : 'retention')}
        />
        <CategorySection
          title="Growth"
          color="blue"
          initiatives={breakdown.growth}
          projects={projects}
          isExpanded={expandedCategory === 'growth'}
          onToggle={() => setExpandedCategory(expandedCategory === 'growth' ? null : 'growth')}
        />
        <CategorySection
          title="Infrastructure"
          color="purple"
          initiatives={breakdown.infrastructure}
          projects={projects}
          isExpanded={expandedCategory === 'infrastructure'}
          onToggle={() => setExpandedCategory(expandedCategory === 'infrastructure' ? null : 'infrastructure')}
        />
      </div>
    </div>
  )
}

function categorizeInitiatives(initiatives: any[], projects: any[]): StrategyBreakdown {
  const retention = initiatives.filter(i =>
    i.expected_retention_impact && i.expected_retention_impact > 0
  )

  const growth = initiatives.filter(i =>
    i.expected_arr_impact && i.expected_arr_impact > 0 &&
    !retention.includes(i)
  )

  const infrastructure = initiatives.filter(i =>
    !retention.includes(i) && !growth.includes(i)
  )

  const countProjects = (inits: any[]) =>
    projects.filter(p => inits.some(i => i.id === p.initiative_id)).length

  return {
    retention,
    growth,
    infrastructure,
    stats: {
      retentionCount: retention.length,
      growthCount: growth.length,
      infrastructureCount: infrastructure.length,
      retentionProjects: countProjects(retention),
      growthProjects: countProjects(growth),
      infrastructureProjects: countProjects(infrastructure),
    }
  }
}

function CustomTooltip({ active, payload, viewBy }: any) {
  if (!active || !payload || !payload[0]) return null

  const data = payload[0]

  return (
    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      <p className="text-gray-900 dark:text-white">{data.name}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {data.value} {viewBy === 'initiatives' ? 'initiatives' : 'projects'}
      </p>
    </div>
  )
}

interface CategorySectionProps {
  title: string
  color: 'green' | 'blue' | 'purple'
  initiatives: any[]
  projects: any[]
  isExpanded: boolean
  onToggle: () => void
}

function CategorySection({ title, color, initiatives, projects, isExpanded, onToggle }: CategorySectionProps) {
  const colorClasses = {
    green: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-700 dark:text-green-300',
      badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-700 dark:text-blue-300',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      border: 'border-purple-200 dark:border-purple-800',
      text: 'text-purple-700 dark:text-purple-300',
      badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    },
  }

  const classes = colorClasses[color]

  return (
    <div className={`${classes.bg} border ${classes.border} rounded-lg p-4`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between mb-3"
      >
        <h4 className={`text-lg ${classes.text}`}>{title}</h4>
        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>

      <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {initiatives.length} initiative{initiatives.length !== 1 ? 's' : ''}
      </div>

      {isExpanded && (
        <div className="space-y-2">
          {initiatives.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-500 text-center py-4">
              No initiatives in this category
            </p>
          ) : (
            initiatives.map(initiative => {
              const projectCount = projects.filter(p => p.initiative_id === initiative.id).length
              const themes = initiative.themes || []
              const avgUrgency = themes.length > 0
                ? themes.reduce((sum: number, t: any) => sum + (t.urgency_score || 0), 0) / themes.length
                : 0

              return (
                <div
                  key={initiative.id}
                  className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700"
                >
                  <div className="font-medium text-sm text-gray-900 dark:text-white mb-1">
                    {initiative.title}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                    {initiative.description || 'No description'}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-500">
                      {projectCount} project{projectCount !== 1 ? 's' : ''}
                    </span>
                    {avgUrgency > 0 && (
                      <span className={`px-2 py-0.5 rounded ${classes.badge}`}>
                        {formatPercentage(avgUrgency)} urgent
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
