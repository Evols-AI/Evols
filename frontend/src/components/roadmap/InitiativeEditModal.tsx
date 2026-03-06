import { useState } from 'react'
import { X } from 'lucide-react'
import { api } from '@/services/api'

interface InitiativeEditModalProps {
  initiative: any
  onClose: () => void
  onSaved: () => void
}

export function InitiativeEditModal({ initiative, onClose, onSaved }: InitiativeEditModalProps) {
  const [status, setStatus] = useState(initiative.status || 'idea')
  const [expectedRetentionImpact, setExpectedRetentionImpact] = useState<string>(
    initiative.expected_retention_impact ? (initiative.expected_retention_impact * 100).toFixed(0) : ''
  )
  const [expectedArrImpact, setExpectedArrImpact] = useState<string>(
    initiative.expected_arr_impact ? initiative.expected_arr_impact.toString() : ''
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      // Convert percentages back to decimals
      const updateData: any = {
        status,
      }

      if (expectedRetentionImpact) {
        updateData.expected_retention_impact = parseFloat(expectedRetentionImpact) / 100
      }

      if (expectedArrImpact) {
        updateData.expected_arr_impact = parseFloat(expectedArrImpact)
      }

      await api.updateInitiative(initiative.id, updateData)
      onSaved()
      onClose()
    } catch (err: any) {
      console.error('Failed to update initiative:', err)
      setError(err.response?.data?.detail || 'Failed to update initiative')
    } finally {
      setIsSaving(false)
    }
  }

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
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Edit Initiative
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-6">{initiative.title}</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Status */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="idea">Idea</option>
            <option value="backlog">Backlog (Later)</option>
            <option value="planned">Planned (Next)</option>
            <option value="in_progress">In Progress (Now)</option>
            <option value="launched">Launched (Completed)</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Now = in_progress, Next = planned, Later = backlog/idea
          </p>
        </div>

        {/* Expected Outcomes */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Expected Outcomes
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
            Set at least one outcome to classify this initiative as Retention or Growth.
            Leave both empty for Infrastructure initiatives.
          </p>

          {/* Retention Impact */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Expected Retention Impact (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={expectedRetentionImpact}
              onChange={(e) => setExpectedRetentionImpact(e.target.value)}
              placeholder="e.g., 5 for 5% lift"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Expected % improvement in retention/churn metrics
            </p>
          </div>

          {/* ARR Impact */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Expected ARR Impact ($)
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              value={expectedArrImpact}
              onChange={(e) => setExpectedArrImpact(e.target.value)}
              placeholder="e.g., 50000 for $50k ARR"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Expected $ impact on Annual Recurring Revenue
            </p>
          </div>
        </div>

        {/* Strategy Classification Preview */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Strategy Classification:
          </div>
          <div className="text-sm">
            {expectedRetentionImpact && parseFloat(expectedRetentionImpact) > 0 ? (
              <span className="px-3 py-1 rounded bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                Retention
              </span>
            ) : expectedArrImpact && parseFloat(expectedArrImpact) > 0 ? (
              <span className="px-3 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                Growth
              </span>
            ) : (
              <span className="px-3 py-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
                Infrastructure
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 btn-primary disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
