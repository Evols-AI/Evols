/**
 * DecisionCanvas — Center pane of the Decision Workbench
 * Steps: Frame → Context → Options → Compare → Personas
 */

import { useState } from 'react'
import {
  ChevronRight, RefreshCw, ThumbsUp, ThumbsDown, Users,
  ArrowRight, AlertTriangle, CheckCircle, Loader2, FileText, BarChart3,
  Briefcase, Rocket, Globe, Plus, X
} from 'lucide-react'
import CitationChip from '@/components/CitationChip'
import CheckpointApproval from '@/components/CheckpointApproval'
import type { WorkbenchState, DecisionOption } from '@/pages/workbench/index'
import { api } from '@/services/api'

// ── Props ─────────────────────────────────────────────────────────────────

interface DecisionCanvasProps {
  state: WorkbenchState
  votingProgress: { current: number; total: number } | null
  availableSegments: string[]
  onObjectiveChange: (v: string) => void
  onSegmentsChange: (v: string[]) => void
  onTimeHorizonChange: (v: string) => void
  onConstraintsChange: (v: string) => void
  onProductNameChange: (v: string) => void
  onProductDescriptionChange: (v: string) => void
  onCompetitorsChange: (v: string[]) => void
  onIsBeyondIdeaPhaseChange: (v: boolean) => void
  onUseInternalContextChange: (v: boolean) => void
  onUseExternalContextChange: (v: boolean) => void
  onPullContext: () => void
  onPullInternetData: () => void
  onGeneratePersonasFromMarket: () => void
  onGenerateOptions: () => void
  onAskPersonas: () => void
  onRegenerate: (constraints: string) => void
  onSelectOption: (id: string) => void
  onSavePersonas: () => void
  onFrameNewDecision: () => void
}

// ── Step indicator ────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: 'Frame Decision' },
  { n: 2, label: 'Gather Context' },
  { n: 3, label: 'Generate Options' },
  { n: 4, label: 'Get Validation' },
]

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 px-6 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center gap-1">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            s.n < current ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
            s.n === current ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' :
            'bg-gray-100 text-gray-400 dark:bg-gray-800'
          }`}>
            {s.n < current ? <CheckCircle className="w-3 h-3" /> : <span>{s.n}</span>}
            {s.label}
          </div>
          {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300 dark:text-gray-600" />}
        </div>
      ))}
    </div>
  )
}

// ── Risk badge ────────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const cfg = {
    low:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    high:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg[level]}`}>
      {level === 'high' && <AlertTriangle className="w-3 h-3" />}
      {level} risk
    </span>
  )
}

// ── Option card ───────────────────────────────────────────────────────────

function OptionCard({
  option, selected, onSelect, onThumbsUp, onThumbsDown
}: {
  option: DecisionOption
  selected: boolean
  onSelect: () => void
  onThumbsUp: () => void
  onThumbsDown: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
        selected
          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10 shadow-md'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-blue-300 dark:hover:border-blue-700'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white">{option.title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{option.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <RiskBadge level={option.risk_level} />
          {option.arr_upside > 0 && (
            <span className="text-xs font-semibold text-green-600 dark:text-green-400">
              +${(option.arr_upside / 1000).toFixed(0)}K ARR
            </span>
          )}
        </div>
      </div>

      {/* Segments */}
      {option.segments_served?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {option.segments_served.map(s => (
            <span key={s} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded-full text-xs">
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Pros / Cons toggle */}
      <button
        onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}
        className="text-xs text-blue-500 dark:text-blue-300 hover:underline mb-2"
      >
        {expanded ? 'Hide' : 'Show'} pros & cons
      </button>

      {expanded && (
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1 uppercase tracking-wide">Pros</p>
            <ul className="space-y-1">
              {option.pros.map((p, i) => (
                <li key={i} className="text-xs text-gray-600 dark:text-gray-300 flex items-start gap-1">
                  <span className="text-green-500 mt-0.5">+</span> {p}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1 uppercase tracking-wide">Cons</p>
            <ul className="space-y-1">
              {option.cons.map((c, i) => (
                <li key={i} className="text-xs text-gray-600 dark:text-gray-300 flex items-start gap-1">
                  <span className="text-red-400 mt-0.5">−</span> {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Citations + feedback buttons */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        {option.citations?.length > 0
          ? <CitationChip citations={option.citations} />
          : <span className="text-xs text-gray-400">No citations</span>
        }
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={onThumbsUp} className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors" title="This option looks good">
            <ThumbsUp className="w-4 h-4 text-gray-400 hover:text-green-600" />
          </button>
          <button onClick={onThumbsDown} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="This option needs work">
            <ThumbsDown className="w-4 h-4 text-gray-400 hover:text-red-500" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Persona vote row ──────────────────────────────────────────────────────

function PersonaVoteRow({ vote }: { vote: any }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="w-24 flex-shrink-0">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 line-clamp-1">{vote.persona_name}</p>
        <p className="text-xs text-gray-400">{vote.segment}</p>
      </div>
      <div className="flex-1 flex gap-1">
        {vote.votes?.map((v: any) => (
          <div key={v.option_id} className="flex-1 text-center">
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 mb-0.5">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.round(v.score * 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{Math.round(v.score * 100)}%</span>
          </div>
        ))}
      </div>
      <div className="w-20 flex-shrink-0 text-right">
        <span className="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded-full font-medium">
          Votes {vote.top_choice}
        </span>
      </div>
    </div>
  )
}

// ── Main canvas ───────────────────────────────────────────────────────────

export default function DecisionCanvas({
  state, votingProgress, availableSegments,
  onObjectiveChange, onSegmentsChange, onTimeHorizonChange,
  onConstraintsChange, onProductNameChange, onProductDescriptionChange,
  onUseInternalContextChange, onUseExternalContextChange,
  onCompetitorsChange, onIsBeyondIdeaPhaseChange, onPullContext, onPullInternetData,
  onGeneratePersonasFromMarket, onGenerateOptions, onAskPersonas, onRegenerate, onSelectOption,
  onSavePersonas, onFrameNewDecision,
}: DecisionCanvasProps) {
  const [localConstraints, setLocalConstraints] = useState('')
  const [competitorInput, setCompetitorInput] = useState('')

  // Decision closure state
  const [showVoteChart, setShowVoteChart] = useState(false)
  const [showDecisionBrief, setShowDecisionBrief] = useState(false)

  // Use dynamic segments from personas, fallback to defaults if empty
  const SEGMENT_OPTIONS = availableSegments.length > 0
    ? availableSegments
    : ['Enterprise', 'Mid-Market', 'SMB', 'Startup']

  const handleAddCompetitor = () => {
    if (competitorInput.trim() && !state.competitors.includes(competitorInput.trim())) {
      onCompetitorsChange([...state.competitors, competitorInput.trim()])
      setCompetitorInput('')
    }
  }

  const handleRemoveCompetitor = (competitor: string) => {
    onCompetitorsChange(state.competitors.filter(c => c !== competitor))
  }

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Step Bar */}
      <StepBar current={state.step} />

      <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">


        {/* ── Frame the question ─────────────────────────── */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Frame Your Decision
          </h2>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">

            {/* Objective */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                What are you trying to decide? <span className="text-red-500">*</span>
              </label>
              <textarea
                value={state.objective}
                onChange={e => onObjectiveChange(e.target.value)}
                placeholder="e.g. What should we prioritize for Q3? Should we build feature X or Y?"
                rows={2}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-white resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Target segments <span className="text-gray-400 text-xs font-normal">(optional)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[...SEGMENT_OPTIONS, 'Other / Not sure'].map(seg => (
                    <button
                      key={seg}
                      onClick={() => {
                        const cur = state.segments
                        onSegmentsChange(cur.includes(seg) ? cur.filter(s => s !== seg) : [...cur, seg])
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        state.segments.includes(seg)
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {seg}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Time horizon <span className="text-gray-400 text-xs font-normal">(optional)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['Next 30 days', 'Next quarter', 'Next 6 months', 'A year from now', 'Flexible / TBD'].map(horizon => (
                    <button
                      key={horizon}
                      onClick={() => onTimeHorizonChange(horizon)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        state.time_horizon === horizon
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {horizon}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Constraints <span className="text-gray-400 text-xs font-normal">(optional)</span>
              </label>
              <textarea
                value={state.constraints}
                onChange={e => onConstraintsChange(e.target.value)}
                placeholder="e.g. Must ship by end of quarter, Limited to 2 engineers, No external dependencies"
                rows={2}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-white resize-none"
              />
            </div>
          </div>
        </section>

        {/* ── Context Selection ─────────────────────────── */}
        {state.objective && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Choose Context Sources
            </h2>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">

              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select which context sources you want to use for generating decision options:
              </p>

              {/* Internal Context Checkbox */}
              <div className="flex items-start gap-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                <input
                  type="checkbox"
                  id="use-internal"
                  checked={state.use_internal_context}
                  onChange={e => onUseInternalContextChange(e.target.checked)}
                  className="w-5 h-5 mt-0.5 text-blue-500 border-gray-300 rounded focus:ring-blue-400"
                />
                <div className="flex-1">
                  <label htmlFor="use-internal" className="block text-sm font-semibold text-gray-900 dark:text-white cursor-pointer">
                    <Briefcase className="w-4 h-4 inline mr-1.5" />
                    Pull Internal Context
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Use themes and feedback from your knowledge base (customer feedback, VoC data, existing insights)
                  </p>
                </div>
              </div>

              {/* External Context Checkbox */}
              <div className="flex items-start gap-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                <input
                  type="checkbox"
                  id="use-external"
                  checked={state.use_external_context}
                  onChange={e => onUseExternalContextChange(e.target.checked)}
                  className="w-5 h-5 mt-0.5 text-blue-500 border-gray-300 rounded focus:ring-blue-400"
                />
                <div className="flex-1">
                  <label htmlFor="use-external" className="block text-sm font-semibold text-gray-900 dark:text-white cursor-pointer">
                    <Globe className="w-4 h-4 inline mr-1.5" />
                    Pull External Context
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Research market data from Reddit discussions (customer pain points, market trends, competitor insights)
                  </p>
                </div>
              </div>

              {/* Product fields - shown only when external context is selected */}
              {state.use_external_context && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Product Information (for market research):
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Product Name <span className="text-gray-400 text-xs font-normal">(optional)</span>
                      </label>
                      <input
                        value={state.product_name}
                        onChange={e => onProductNameChange(e.target.value)}
                        placeholder="e.g. Acme SaaS (leave blank if pre-launch)"
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Product Description <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={state.product_description}
                        onChange={e => onProductDescriptionChange(e.target.value)}
                        placeholder="e.g. Meeting automation tool"
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Known Competitors <span className="text-gray-400 text-xs font-normal">(optional)</span>
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        value={competitorInput}
                        onChange={e => setCompetitorInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCompetitor())}
                        placeholder="Add competitor name"
                        className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-white"
                      />
                      <button
                        onClick={handleAddCompetitor}
                        className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {state.competitors.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {state.competitors.map(comp => (
                          <span
                            key={comp}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded-full text-xs font-medium"
                          >
                            {comp}
                            <button
                              onClick={() => handleRemoveCompetitor(comp)}
                              className="hover:text-blue-900 dark:hover:text-blue-100"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="beyond-idea"
                      checked={state.is_beyond_idea_phase}
                      onChange={e => onIsBeyondIdeaPhaseChange(e.target.checked)}
                      className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-400"
                    />
                    <label htmlFor="beyond-idea" className="text-sm text-gray-700 dark:text-gray-300">
                      My product is already launched (include product reviews in research)
                    </label>
                  </div>
                </div>
              )}

              {/* Pull Context CTAs */}
              {(state.use_internal_context || state.use_external_context) && (
                <div className="pt-3 space-y-3">
                  {state.use_internal_context && state.step === 1 && (
                    <button
                      onClick={onPullContext}
                      disabled={state.is_loading}
                      className="w-full px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                    >
                      {state.is_loading ? 'Pulling Internal Context...' : 'Pull Internal Context →'}
                    </button>
                  )}

                  {state.use_external_context && state.step === 1 && state.product_description && (
                    <button
                      onClick={onPullInternetData}
                      disabled={state.is_loading}
                      className="w-full px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {state.is_loading ? 'Researching Market...' : (
                        <>
                          <Globe className="w-4 h-4" />
                          Pull External Context →
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Context Review & Generate Options ─────────────────────────────── */}
        {state.step >= 2 && ((state.use_internal_context && state.context_themes.length > 0) || (state.use_external_context && state.market_data)) && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Context Collected
              </h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {state.use_internal_context && `${state.context_themes.length} themes · ${state.context_feedback.length} quotes`}
                {state.use_internal_context && state.use_external_context && ' • '}
                {state.use_external_context && state.market_data && `${(state.market_data.customer_pain_points?.length || 0)} data points`}
              </span>
            </div>

            {/* Internal Context Preview */}
            {state.use_internal_context && state.context_themes.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 mb-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  Internal Context:
                </h3>
                <div className="space-y-1 text-xs">
                  {state.context_themes.slice(0, 3).map((t: any) => (
                    <div key={t.id} className="flex items-center gap-2 py-1">
                      <span className="text-blue-500 dark:text-blue-300 font-medium">{t.title}</span>
                      <span className="text-gray-400">{t.feedback_count} items</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* External Context Preview */}
            {state.use_external_context && state.market_data && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 mb-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  External Context:
                </h3>
                {state.market_data.customer_pain_points?.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Top Pain Points:</p>
                    {state.market_data.customer_pain_points.slice(0, 3).map((p: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="text-red-500 mt-0.5">•</span>
                        <span className="text-gray-600 dark:text-gray-300 flex-1">{p.pain_point}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs flex-shrink-0 ${
                          p.frequency === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300' :
                          p.frequency === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {p.frequency}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* If using external context, need to generate personas first */}
            {state.use_external_context && state.market_data && state.generated_personas.length === 0 ? (
              <>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-3">
                  <p className="text-sm text-blue-900 dark:text-blue-300">
                    <strong>Why generate personas?</strong> When using external market data, we create personas from that research so they can vote on options. This ensures reliable, data-driven insights instead of hand-wavy recommendations.
                  </p>
                </div>
                <CheckpointApproval
                  title="Generate personas from market data?"
                  summary="We'll create data-driven personas from the market research. These personas will vote on the options to provide reliable insights based on real customer pain points and market trends."
                  onApprove={onGeneratePersonasFromMarket}
                  approveLabel={<span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> Generate Personas →</span>}
                  isLoading={state.is_loading && state.step === 3}
                  isApproved={state.generated_personas.length > 0}
                />
              </>
            ) : (
              <CheckpointApproval
                title="Ready to generate options?"
                summary={`Context collected from ${[
                  state.use_internal_context && 'internal knowledge base',
                  state.use_external_context && 'market research'
                ].filter(Boolean).join(' and ')}. ${state.use_external_context && state.generated_personas.length > 0 ? `Generated ${state.generated_personas.length} personas will vote on the options.` : 'Generate decision options?'}`}
                onApprove={onGenerateOptions}
                approveLabel="Generate Options →"
                isLoading={state.is_loading && state.step === 3}
                isApproved={state.step > 3}
              />
            )}
          </section>
        )}

        {/* ── Generated Personas (from external market research) ─────────────────────────────── */}
        {state.step >= 3 && state.generated_personas.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Generated Personas
              </h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {state.generated_personas.length} personas
              </span>
            </div>

            <div className="grid gap-3 mb-4">
              {state.generated_personas.map((persona: any, i: number) => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{persona.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{persona.segment}</p>
                    </div>
                    {persona.company_size_range && (
                      <span className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded">
                        {persona.company_size_range}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{persona.persona_summary}</p>
                  {persona.key_pain_points?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {persona.key_pain_points.slice(0, 3).map((pain: string, j: number) => (
                        <span key={j} className="text-xs px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-full">
                          {pain}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Save Personas Button */}
            <div className="mb-4">
              <button
                onClick={onSavePersonas}
                disabled={state.is_loading}
                className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {state.is_loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    Save Personas to Library
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                Save these personas to your persona library for future use across all decisions
              </p>
            </div>

            <CheckpointApproval
              title="Personas look good?"
              summary={`Generated ${state.generated_personas.length} data-driven personas from market research. Ready to generate roadmap options?`}
              onApprove={onGenerateOptions}
              approveLabel="Generate Options →"
              isLoading={state.is_loading && state.step === 4}
              isApproved={state.step > 4}
            />
          </section>
        )}

        {/* ── Options ────────────────────────────────── */}
        {state.step >= 3 && state.options.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Decision Options
              </h2>
              <button
                onClick={() => onRegenerate(localConstraints)}
                disabled={state.is_loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${state.is_loading ? 'animate-spin' : ''}`} />
                Regenerate
              </button>
            </div>

            {/* Constraint input for regeneration */}
            <div className="mb-4 flex gap-2">
              <input
                value={localConstraints}
                onChange={e => { setLocalConstraints(e.target.value); onConstraintsChange(e.target.value) }}
                placeholder="Add a constraint to regenerate (e.g. 'must include the SSO initiative')"
                className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              />
              <button
                onClick={() => onRegenerate(localConstraints)}
                disabled={state.is_loading || !localConstraints.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Apply
              </button>
            </div>

            {/* Option cards */}
            <div className="grid gap-4">
              {state.options.map(opt => (
                <OptionCard
                  key={opt.id}
                  option={opt}
                  selected={state.selected_option_id === opt.id}
                  onSelect={() => onSelectOption(opt.id)}
                  onThumbsUp={() => {}}
                  onThumbsDown={() => {}}
                />
              ))}
            </div>

            {/* Ask personas CTA */}
            {state.step < 5 && (
              <div className="mt-4">
                {votingProgress ? (
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-500 animate-pulse" />
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          Collecting Persona Votes...
                        </h3>
                      </div>
                      <span className="text-sm font-medium text-blue-500">
                        {votingProgress.current}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-blue-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${votingProgress.current}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Personas are voting in parallel. This should take less than 10 seconds...
                    </p>
                  </div>
                ) : (
                  <CheckpointApproval
                    title="Validate with Persona Twins?"
                    summary={state.generated_personas.length > 0
                      ? `Have the ${state.generated_personas.length} data-driven personas (generated from market research) vote on these options.`
                      : "Have your digital twin personas vote on these options and surface which segment benefits most."}
                    onApprove={onAskPersonas}
                    approveLabel="Ask Persona Twins →"
                    isLoading={state.is_loading && state.step === 5}
                    isApproved={state.step > 5}
                  />
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Persona votes ──────────────────────────────── */}
        {state.step >= 5 && state.persona_votes.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Persona Validation
              </h2>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              {/* Option headers */}
              <div className="flex items-center gap-3 pb-2 mb-2 border-b border-gray-100 dark:border-gray-800">
                <div className="w-24 flex-shrink-0 text-xs font-semibold text-gray-400 uppercase tracking-wide">Persona</div>
                <div className="flex-1 flex gap-1">
                  {state.options.map((opt, i) => (
                    <div key={opt.id} className="flex-1 text-center text-xs font-medium text-gray-700 dark:text-gray-300">
                      {String.fromCharCode(65 + i)}: {opt.title.substring(0, 15)}…
                    </div>
                  ))}
                </div>
                <div className="w-20 flex-shrink-0 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Prefers</div>
              </div>

              {state.persona_votes.map((vote: any, i: number) => (
                <PersonaVoteRow key={i} vote={vote} />
              ))}
            </div>

            {/* Generate brief CTA */}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowDecisionBrief(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors"
              >
                <FileText className="w-4 h-4" />
                Generate Decision Brief
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowVoteChart(true)}
                className="flex items-center gap-2 px-4 py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                View Chart
              </button>
              <button
                onClick={onFrameNewDecision}
                className="flex items-center gap-2 px-4 py-3 border border-blue-200 dark:border-blue-600 text-blue-500 dark:text-blue-300 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Frame New Decision
              </button>
            </div>
          </section>
        )}

          {/* Loading overlay */}
          {state.is_loading && (
            <div className="flex items-center gap-3 py-4 px-5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
              <span className="text-sm text-blue-600 dark:text-blue-300">
                {state.step === 2 ? 'Pulling relevant context from knowledge graph…' :
                 state.step === 3 ? 'Generating roadmap options with evidence…' :
                 state.step === 5 ? 'Asking persona twins to vote…' :
                 'Processing…'}
              </span>
            </div>
          )}
        </div>

      </div>

      {/* ── Vote Chart Modal ──────────────────────────────────────────────── */}
      {showVoteChart && state.persona_votes.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowVoteChart(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Persona Voting Results</h2>
              </div>
              <button onClick={() => setShowVoteChart(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Vote summary by option */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Votes by Option</h3>
                <div className="space-y-3">
                  {state.options.map((option: DecisionOption) => {
                    const votesForOption = state.persona_votes.filter((v: any) => v.top_choice === option.id).length
                    const percentage = state.persona_votes.length > 0 ? (votesForOption / state.persona_votes.length * 100) : 0

                    return (
                      <div key={option.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-900 dark:text-white">{option.title}</span>
                          <span className="text-gray-600 dark:text-gray-400">{votesForOption} votes ({percentage.toFixed(0)}%)</span>
                        </div>
                        <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-400 to-blue-500 flex items-center justify-end px-2 transition-all"
                            style={{ width: `${percentage}%` }}
                          >
                            {percentage > 15 && <span className="text-xs font-medium text-white">{votesForOption}</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Vote breakdown by persona */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Detailed Votes</h3>
                <div className="space-y-3">
                  {state.persona_votes.map((vote: any, i: number) => {
                    const topOption = state.options.find((opt: DecisionOption) => opt.id === vote.top_choice)
                    return (
                      <div key={i} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{vote.persona_name}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{vote.segment}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-blue-500 dark:text-blue-300">
                              Top Choice: {topOption?.title}
                            </div>
                            <div className="text-xs text-gray-500">Confidence: {(vote.confidence * 100).toFixed(0)}%</div>
                          </div>
                        </div>
                        {vote.votes && vote.votes.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {vote.votes.slice(0, 3).map((v: any, j: number) => (
                              <div key={j} className="flex items-center justify-between text-xs">
                                <span className="text-gray-600 dark:text-gray-400">{v.option_title}</span>
                                <span className="font-medium text-gray-900 dark:text-white">Score: {v.score.toFixed(1)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Decision Brief Modal ──────────────────────────────────────────── */}
      {showDecisionBrief && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDecisionBrief(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-500" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Decision Brief</h2>
              </div>
              <button onClick={() => setShowDecisionBrief(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Decision Overview */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Decision</h3>
                <p className="text-gray-600 dark:text-gray-400">{state.objective}</p>
              </div>

              {/* Context */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Context</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Target Segments:</span>
                    <span className="text-gray-900 dark:text-white">{state.segments.join(', ') || 'All segments'}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-600 dark:text-gray-400">Time Horizon:</span>
                    <span className="text-gray-900 dark:text-white">{state.time_horizon}</span>
                  </div>
                  {state.constraints && (
                    <div className="flex gap-2">
                      <span className="text-gray-600 dark:text-gray-400">Constraints:</span>
                      <span className="text-gray-900 dark:text-white">{state.constraints}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Recommended Option */}
              {state.persona_votes.length > 0 && (() => {
                const voteCounts = state.options.map((opt: DecisionOption) => ({
                  option: opt,
                  votes: state.persona_votes.filter((v: any) => v.top_choice === opt.id).length
                }))
                const topOption = voteCounts.reduce((max, curr) => curr.votes > max.votes ? curr : max, voteCounts[0])

                return (
                  <div className="bg-gradient-to-br from-blue-50 to-blue-50 dark:from-blue-900/20 dark:to-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3 mb-3">
                      <CheckCircle className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Recommended: {topOption.option.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{topOption.votes} out of {state.persona_votes.length} personas ({((topOption.votes / state.persona_votes.length) * 100).toFixed(0)}%) chose this option</p>
                      </div>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mb-3">{topOption.option.description}</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="font-semibold text-green-700 dark:text-green-400 mb-1">Pros</div>
                        <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                          {topOption.option.pros.slice(0, 3).map((pro: string, i: number) => (
                            <li key={i}>• {pro}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="font-semibold text-red-700 dark:text-red-400 mb-1">Cons</div>
                        <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                          {topOption.option.cons.slice(0, 3).map((con: string, i: number) => (
                            <li key={i}>• {con}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Voting Results Chart */}
              {state.persona_votes.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Voting Results</h3>
                  </div>
                  <div className="space-y-3">
                    {state.options.map((option: DecisionOption) => {
                      const votesForOption = state.persona_votes.filter((v: any) => v.top_choice === option.id).length
                      const percentage = state.persona_votes.length > 0 ? (votesForOption / state.persona_votes.length * 100) : 0

                      return (
                        <div key={option.id} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-900 dark:text-white">{option.title}</span>
                            <span className="text-gray-600 dark:text-gray-400">{votesForOption} votes ({percentage.toFixed(0)}%)</span>
                          </div>
                          <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-400 to-blue-500 flex items-center justify-end px-2 transition-all"
                              style={{ width: `${percentage}%` }}
                            >
                              {percentage > 15 && <span className="text-xs font-medium text-white">{votesForOption}</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* All Options Considered */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">All Options Evaluated</h3>
                <div className="space-y-3">
                  {state.options.map((option: DecisionOption, i: number) => {
                    const votesForOption = state.persona_votes.filter((v: any) => v.top_choice === option.id).length
                    return (
                      <div key={option.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-gray-900 dark:text-white">{option.title}</h4>
                          <span className="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded-full">
                            {votesForOption} votes
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{option.description}</p>
                        <div className="flex gap-4 text-xs">
                          <span className="text-gray-500">ARR Upside: ${(option.arr_upside / 1000).toFixed(0)}K</span>
                          <RiskBadge level={option.risk_level} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Next Steps */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Next Steps</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <li>Review this decision brief with key stakeholders</li>
                  <li>Validate assumptions with customer interviews</li>
                  <li>Create implementation plan for recommended option</li>
                  <li>Set success metrics and monitoring</li>
                  <li>Schedule follow-up review in {state.time_horizon}</li>
                </ol>
              </div>

              {/* Footer */}
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-4 border-t border-gray-200 dark:border-gray-800">
                Generated with Evols Decision Workbench • {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
