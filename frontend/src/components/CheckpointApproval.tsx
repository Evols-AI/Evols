/**
 * CheckpointApproval
 * The core transparency primitive in Evols.
 * Every major auto-step shows a checkpoint: "Here's what we did → Approve / Edit"
 * PMs never feel surprised; they always have a review gate before continuing.
 */

import { useState } from 'react'
import { CheckCircle, Edit3, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'

interface CheckpointApprovalProps {
  title: string
  summary: string
  details?: React.ReactNode      // Expandable detail view
  onApprove: () => void
  onEdit?: () => void
  approveLabel?: string
  editLabel?: string
  isApproved?: boolean
  isLoading?: boolean
  className?: string
}

export default function CheckpointApproval({
  title,
  summary,
  details,
  onApprove,
  onEdit,
  approveLabel = 'Looks good → Continue',
  editLabel = 'Edit',
  isApproved = false,
  isLoading = false,
  className = '',
}: CheckpointApprovalProps) {
  const [expanded, setExpanded] = useState(false)

  if (isApproved) {
    return (
      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 ${className}`}>
        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
        <span className="text-sm text-green-700 dark:text-green-400 font-medium">{title} — approved</span>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="mt-0.5 p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/40">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">{summary}</p>
        </div>
      </div>

      {/* Expandable details */}
      {details && (
        <>
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full px-4 py-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors border-t border-blue-100 dark:border-blue-900"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Hide details' : 'View details'}
          </button>
          {expanded && (
            <div className="px-4 pb-3 pt-1 border-t border-blue-100 dark:border-blue-900">
              {details}
            </div>
          )}
        </>
      )}

      {/* Action buttons */}
      <div className="px-4 py-3 flex items-center gap-2 border-t border-blue-100 dark:border-blue-900 bg-white/50 dark:bg-gray-900/30">
        <button
          onClick={onApprove}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <CheckCircle className="w-4 h-4" />
          {isLoading ? 'Processing…' : approveLabel}
        </button>
        {onEdit && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            {editLabel}
          </button>
        )}
      </div>
    </div>
  )
}
