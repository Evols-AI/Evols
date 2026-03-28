import { useState } from 'react'
import { Mountain, Zap } from 'lucide-react'
import { getEffortColor } from '@/utils/roadmap'

interface ProjectCardProps {
  project: any
}

export function ProjectCard({ project }: ProjectCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="pl-4 py-3 border-l-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {project.is_boulder ? (
              <Mountain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            ) : (
              <Zap className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            )}
            <span className="font-medium text-sm text-heading">{project.title}</span>
          </div>
          <p className="text-xs text-body mb-2">{project.description}</p>

          {project.acceptance_criteria && project.acceptance_criteria.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-blue-500 dark:text-blue-300 hover:underline"
            >
              {expanded ? 'Hide' : 'Show'} acceptance criteria ({project.acceptance_criteria.length})
            </button>
          )}

          {expanded && project.acceptance_criteria && (
            <div className="mt-2 ml-6">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Acceptance Criteria:
              </div>
              <ul className="text-xs text-body space-y-0.5 list-disc ml-4">
                {project.acceptance_criteria.map((criterion: string, idx: number) => (
                  <li key={idx}>{criterion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="ml-4 flex flex-col items-end gap-2">
          <div className="text-right">
            <div className="text-xl text-blue-500 dark:text-blue-300">
              {project.priority_score?.toFixed(1) || 'N/A'}
            </div>
            <div className="text-xs text-gray-500">Priority</div>
          </div>

          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getEffortColor(project.effort)}`}>
            {project.effort}
          </span>

          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              project.is_boulder
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
            }`}
          >
            {project.is_boulder ? 'Boulder' : 'Pebble'}
          </span>
        </div>
      </div>
    </div>
  )
}
