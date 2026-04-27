/**
 * Decision Modal
 * Log PM decisions with full context
 */

import { useState, useEffect } from 'react'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import { api } from '@/services/api'

interface DecisionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  decision?: any
  productId?: number
}

const CATEGORIES = [
  { value: 'product', label: 'Product' },
  { value: 'technical', label: 'Technical' },
  { value: 'organizational', label: 'Organizational' },
  { value: 'career', label: 'Career' },
  { value: 'process', label: 'Process' },
  { value: 'stakeholder', label: 'Stakeholder' },
]

export default function DecisionModal({ isOpen, onClose, onSuccess, decision, productId }: DecisionModalProps) {
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    category: 'product',
    context: '',
    options_considered: [{ option: '', pros: '', cons: '' }],
    decision: '',
    reasoning: '',
    tradeoffs: '',
    stakeholders: [] as string[],
    expected_outcome: '',
    product_id: productId || null,
  })
  const [stakeholderInput, setStakeholderInput] = useState('')

  useEffect(() => {
    if (decision) {
      setFormData({
        title: decision.title || '',
        category: decision.category || 'product',
        context: decision.context || '',
        options_considered: decision.options_considered || [{ option: '', pros: '', cons: '' }],
        decision: decision.decision || '',
        reasoning: decision.reasoning || '',
        tradeoffs: decision.tradeoffs || '',
        stakeholders: decision.stakeholders || [],
        expected_outcome: decision.expected_outcome || '',
        product_id: decision.product_id || productId || null,
      })
    }
  }, [decision, productId])

  const addOption = () => {
    setFormData({
      ...formData,
      options_considered: [...formData.options_considered, { option: '', pros: '', cons: '' }]
    })
  }

  const removeOption = (index: number) => {
    setFormData({
      ...formData,
      options_considered: formData.options_considered.filter((_, i) => i !== index)
    })
  }

  const updateOption = (index: number, field: string, value: string) => {
    const updated = [...formData.options_considered]
    updated[index] = { ...updated[index], [field]: value }
    setFormData({ ...formData, options_considered: updated })
  }

  const addStakeholder = () => {
    if (stakeholderInput.trim()) {
      setFormData({
        ...formData,
        stakeholders: [...formData.stakeholders, stakeholderInput.trim()]
      })
      setStakeholderInput('')
    }
  }

  const removeStakeholder = (index: number) => {
    setFormData({
      ...formData,
      stakeholders: formData.stakeholders.filter((_, i) => i !== index)
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const payload = {
        ...formData,
        product_id: formData.product_id || null,
      }

      if (decision) {
        await api.workContext.updatePMDecision(decision.id, payload)
      } else {
        await api.workContext.createPMDecision(payload)
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error saving decision:', error)
      alert('Failed to save decision')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="page-title text-gray-900 dark:text-white">
            {decision ? 'Edit Decision' : 'Log Decision'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="Brief summary of the decision"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#A78BFA]/50 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#A78BFA]/50 outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Context */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Context *
            </label>
            <textarea
              value={formData.context}
              onChange={(e) => setFormData({ ...formData, context: e.target.value })}
              required
              rows={3}
              placeholder="What prompted this decision?"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#A78BFA]/50 outline-none"
            />
          </div>

          {/* Options Considered */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Options Considered *
              </label>
              <button
                type="button"
                onClick={addOption}
                className="text-sm text-[#A78BFA] dark:text-[#A78BFA] hover:underline flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Option
              </button>
            </div>
            <div className="space-y-3">
              {formData.options_considered.map((opt, idx) => (
                <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Option {idx + 1}
                    </span>
                    {formData.options_considered.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOption(idx)}
                        className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={opt.option}
                    onChange={(e) => updateOption(idx, 'option', e.target.value)}
                    placeholder="Option description"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#A78BFA]/50 outline-none text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <textarea
                      value={opt.pros}
                      onChange={(e) => updateOption(idx, 'pros', e.target.value)}
                      placeholder="Pros"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#A78BFA]/50 outline-none text-sm"
                    />
                    <textarea
                      value={opt.cons}
                      onChange={(e) => updateOption(idx, 'cons', e.target.value)}
                      placeholder="Cons"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#A78BFA]/50 outline-none text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Decision */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Decision Made *
            </label>
            <textarea
              value={formData.decision}
              onChange={(e) => setFormData({ ...formData, decision: e.target.value })}
              required
              rows={2}
              placeholder="What was decided?"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#A78BFA]/50 outline-none"
            />
          </div>

          {/* Reasoning */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reasoning *
            </label>
            <textarea
              value={formData.reasoning}
              onChange={(e) => setFormData({ ...formData, reasoning: e.target.value })}
              required
              rows={3}
              placeholder="Why this option?"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#A78BFA]/50 outline-none"
            />
          </div>

          {/* Tradeoffs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tradeoffs
            </label>
            <textarea
              value={formData.tradeoffs}
              onChange={(e) => setFormData({ ...formData, tradeoffs: e.target.value })}
              rows={2}
              placeholder="What are we giving up?"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#A78BFA]/50 outline-none"
            />
          </div>

          {/* Stakeholders */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Stakeholders
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={stakeholderInput}
                onChange={(e) => setStakeholderInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addStakeholder())}
                placeholder="Add stakeholder name"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#A78BFA]/50 outline-none"
              />
              <button
                type="button"
                onClick={addStakeholder}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Add
              </button>
            </div>
            {formData.stakeholders.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.stakeholders.map((stakeholder, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-[#A78BFA]/10 dark:bg-[#A78BFA]/10 text-[#8B5CF6] dark:text-[#A78BFA] rounded-full text-sm"
                  >
                    {stakeholder}
                    <button
                      type="button"
                      onClick={() => removeStakeholder(idx)}
                      className="hover:bg-[#A78BFA]/10 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Expected Outcome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Expected Outcome
            </label>
            <textarea
              value={formData.expected_outcome}
              onChange={(e) => setFormData({ ...formData, expected_outcome: e.target.value })}
              rows={2}
              placeholder="What do you expect to happen?"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#A78BFA]/50 outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[#8B5CF6] text-white rounded-lg hover:bg-[#7C3AED] disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {decision ? 'Update' : 'Log'} Decision
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
