/**
 * Weekly Focus Modal
 * Edit three things that matter this week
 */

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { api } from '@/services/api'

interface WeeklyFocusModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  weeklyFocus: any
}

export default function WeeklyFocusModal({ isOpen, onClose, onSuccess, weeklyFocus }: WeeklyFocusModalProps) {
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    focus_1: '',
    focus_2: '',
    focus_3: '',
    notes: '',
  })

  useEffect(() => {
    if (weeklyFocus) {
      setFormData({
        focus_1: weeklyFocus.focus_1 || '',
        focus_2: weeklyFocus.focus_2 || '',
        focus_3: weeklyFocus.focus_3 || '',
        notes: weeklyFocus.notes || '',
      })
    }
  }, [weeklyFocus])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      await api.workContext.updateWeeklyFocus(weeklyFocus.id, formData)
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error saving weekly focus:', error)
      alert('Failed to save weekly focus')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="page-title text-foreground">
              Three Things That Matter This Week
            </h2>
            {weeklyFocus && (
              <p className="text-sm text-muted-foreground mt-1">
                Week of {new Date(weeklyFocus.week_start_date).toLocaleDateString()}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Focus 1 */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Focus #1
            </label>
            <textarea
              value={formData.focus_1}
              onChange={(e) => setFormData({ ...formData, focus_1: e.target.value })}
              rows={2}
              placeholder="First priority for this week"
              className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-ring/50 outline-none"
            />
          </div>

          {/* Focus 2 */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Focus #2
            </label>
            <textarea
              value={formData.focus_2}
              onChange={(e) => setFormData({ ...formData, focus_2: e.target.value })}
              rows={2}
              placeholder="Second priority for this week"
              className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-ring/50 outline-none"
            />
          </div>

          {/* Focus 3 */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Focus #3
            </label>
            <textarea
              value={formData.focus_3}
              onChange={(e) => setFormData({ ...formData, focus_3: e.target.value })}
              rows={2}
              placeholder="Third priority for this week"
              className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-ring/50 outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Additional context or reflections"
              className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-ring/50 outline-none"
            />
          </div>

          <div className="bg-primary/5 dark:bg-primary/10 border border-primary/30 dark:border-primary/20 rounded-lg p-4">
            <p className="text-sm text-primary/85 dark:text-primary">
              <strong>Tip:</strong> Keep these focused and achievable. Three meaningful things are better than a long list of tasks.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/85 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
