import { useState } from 'react'
import { ChevronDown, ChevronRight, Edit2 } from 'lucide-react'
import { ProjectCard } from './ProjectCard'
import { InitiativeEditModal } from './InitiativeEditModal'

interface InitiativeCardProps {
  initiative: any
  projects: any[]
  isExpanded: boolean
  onToggle: () => void
  onRefresh?: () => void
}

export function InitiativeCard({
  initiative,
  projects,
  isExpanded,
  onToggle,
  onRefresh,
}: InitiativeCardProps) {
  const [showEditModal, setShowEditModal] = useState(false)
  const sortedProjects = [...projects].sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
  const boulders = sortedProjects.filter(p => p.is_boulder)
  const pebbles = sortedProjects.filter(p => !p.is_boulder)

  // Calculate aggregate metrics from linked themes
  const themes = initiative.themes || []
  const totalFeedback = themes.reduce((sum: number, t: any) => sum + (t.feedback_count || 0), 0)
  const totalAccounts = themes.reduce((sum: number, t: any) => sum + (t.account_count || 0), 0)
  const avgUrgency = themes.length > 0
    ? themes.reduce((sum: number, t: any) => sum + (t.urgency_score || 0), 0) / themes.length
    : 0
  const avgImpact = themes.length > 0
    ? themes.reduce((sum: number, t: any) => sum + (t.impact_score || 0), 0) / themes.length
    : 0

  return (
    <div className="card-hover p-6">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg text-heading">{initiative.title}</h3>
            <button
              onClick={() => setShowEditModal(true)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Edit initiative"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-body mb-4">{initiative.description || 'No description'}</p>

          {/* Linked Themes Section */}
          {themes.length > 0 && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                Addressing {themes.length} Theme{themes.length > 1 ? 's' : ''}:
              </div>
              <div className="space-y-1">
                {themes.map((theme: any) => (
                  <div key={theme.id} className="text-xs text-body">
                    • {theme.title}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="font-medium">{totalFeedback}</span>
              <span className="text-body ml-1">feedback items</span>
            </div>
            <div>
              <span className="font-medium">{totalAccounts}</span>
              <span className="text-body ml-1">accounts</span>
            </div>
            <div>
              <span className="font-medium text-orange-600">
                {(avgUrgency * 100).toFixed(0)}%
              </span>
              <span className="text-body ml-1">urgency</span>
            </div>
            <div>
              <span className="font-medium text-green-600">
                {(avgImpact * 100).toFixed(0)}%
              </span>
              <span className="text-body ml-1">impact</span>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Section */}
      {projects.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onToggle}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <span>{projects.length} Projects</span>
            <span className="text-xs text-gray-500">
              ({boulders.length} boulders, {pebbles.length} pebbles)
            </span>
          </button>

          {isExpanded && (
            <div className="mt-3 space-y-3">
              {sortedProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
      )}

      {projects.length === 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No projects yet. Projects will be automatically generated when you refresh.
          </p>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <InitiativeEditModal
          initiative={initiative}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            if (onRefresh) {
              onRefresh()
            }
          }}
        />
      )}
    </div>
  )
}
