/**
 * DecisionCanvas — Center pane of the Decision Workbench
 * Steps: Frame → Context → Options → Compare → Personas
 */

import { useState } from 'react'
import {
  ChevronRight, RefreshCw, ThumbsUp, ThumbsDown, Users,
  ArrowRight, AlertTriangle, CheckCircle, Loader2, FileText, BarChart3
} from 'lucide-react'
import CitationChip from '@/components/CitationChip'
import CheckpointApproval from '@/components/CheckpointApproval'
import type { WorkbenchState, DecisionOption } from '@/pages/workbench/index'

// ── Props ─────────────────────────────────────────────────────────────────

interface DecisionCanvasProps {
  state: WorkbenchState
  votingProgress: { current: number; total: number } | null
  onObjectiveChange: (v: string) => void
  onSegmentsChange: (v: string[]) => void
  onTimeHorizonChange: (v: string) => void
  onConstraintsChange: (v: string) => void
  onPullContext: () => void
  onGenerateOptions: () => void
  onAskPersonas: () => void
  onRegenerate: (constraints: string) => void
  onSelectOption: (id: string) => void
}

// ── Step indicator ────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: 'Frame' },
  { n: 2, label: 'Context' },
  { n: 3, label: 'Options' },
  { n: 4, label: 'Compare' },
  { n: 5, label: 'Personas' },
]

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 px-6 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center gap-1">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            s.n < current ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
            s.n === current ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
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
            <span key={s} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-xs">
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Pros / Cons toggle */}
      <button
        onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline mb-2"
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
        <span className="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full font-medium">
          Votes {vote.top_choice}
        </span>
      </div>
    </div>
  )
}

// ── Main canvas ───────────────────────────────────────────────────────────

export default function DecisionCanvas({
  state, votingProgress, onObjectiveChange, onSegmentsChange, onTimeHorizonChange,
  onConstraintsChange, onPullContext, onGenerateOptions,
  onAskPersonas, onRegenerate, onSelectOption,
}: DecisionCanvasProps) {
  const [localConstraints, setLocalConstraints] = useState('')

  const SEGMENT_OPTIONS = ['Enterprise', 'Mid-Market', 'SMB', 'Startup', 'All Segments']

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      <StepBar current={state.step} />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ── Step 1: Frame the question ─────────────────────────── */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            1 · Frame Your Decision
          </h2>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                What are you trying to decide?
              </label>
              <textarea
                value={state.objective}
                onChange={e => onObjectiveChange(e.target.value)}
                placeholder="e.g. What should we prioritize for Q3 for Mid-Market customers?"
                rows={2}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Target segments
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SEGMENT_OPTIONS.map(seg => (
                    <button
                      key={seg}
                      onClick={() => {
                        const cur = state.segments
                        onSegmentsChange(cur.includes(seg) ? cur.filter(s => s !== seg) : [...cur, seg])
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        state.segments.includes(seg)
                          ? 'bg-blue-600 text-white'
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
                  Time horizon
                </label>
                <input
                  value={state.time_horizon}
                  onChange={e => onTimeHorizonChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                />
              </div>
            </div>

            <CheckpointApproval
              title="Pull Context"
              summary={state.objective
                ? `Auto-pull themes and feedback relevant to: "${state.objective.substring(0, 60)}…"`
                : 'Enter your objective above first'}
              onApprove={onPullContext}
              onEdit={() => {}}
              approveLabel="Pull Context →"
              isLoading={state.is_loading && state.step === 2}
              isApproved={state.step > 2}
            />
          </div>
        </section>

        {/* ── Step 2: Context review ─────────────────────────────── */}
        {state.step >= 2 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                2 · Context Auto-Pulled
              </h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {state.context_themes.length} themes · {state.context_feedback.length} quotes
              </span>
            </div>

            <CheckpointApproval
              title="Context looks right?"
              summary={`Found ${state.context_themes.length} related themes (${
                state.context_themes.reduce((s: number, t: any) => s + (t.total_arr || 0), 0) > 0
                  ? '$' + (state.context_themes.reduce((s: number, t: any) => s + (t.total_arr || 0), 0) / 1000).toFixed(0) + 'K ARR'
                  : 'ARR unknown'
              }) and ${state.context_feedback.length} top customer quotes.`}
              details={
                <div className="space-y-1 text-xs">
                  {state.context_themes.slice(0, 3).map((t: any) => (
                    <div key={t.id} className="flex items-center gap-2 py-1">
                      <span className="text-blue-600 dark:text-blue-400 font-medium">{t.title}</span>
                      <span className="text-gray-400">{t.feedback_count} items</span>
                    </div>
                  ))}
                </div>
              }
              onApprove={onGenerateOptions}
              approveLabel="Generate Options →"
              isLoading={state.is_loading && state.step === 3}
              isApproved={state.step > 3}
            />
          </section>
        )}

        {/* ── Step 3 / 4: Options ────────────────────────────────── */}
        {state.step >= 4 && state.options.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                3 · AI-Proposed Options
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
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
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
                        <Users className="w-5 h-5 text-purple-600 animate-pulse" />
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          Collecting Persona Votes...
                        </h3>
                      </div>
                      <span className="text-sm font-medium text-purple-600">
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
                    summary="Have your digital twin personas vote on these options and surface which segment benefits most."
                    onApprove={onAskPersonas}
                    onEdit={() => {}}
                    approveLabel="Ask Persona Twins →"
                    isLoading={state.is_loading && state.step === 5}
                    isApproved={state.step > 5}
                  />
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Step 5: Persona votes ──────────────────────────────── */}
        {state.step >= 5 && state.persona_votes.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                4 · Persona Vote Matrix
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
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors">
                <FileText className="w-4 h-4" />
                Generate Decision Brief
                <ArrowRight className="w-4 h-4" />
              </button>
              <button className="flex items-center gap-2 px-4 py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <BarChart3 className="w-4 h-4" />
                View Chart
              </button>
            </div>
          </section>
        )}

        {/* Loading overlay */}
        {state.is_loading && (
          <div className="flex items-center gap-3 py-4 px-5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              {state.step === 2 ? 'Pulling relevant context from knowledge graph…' :
               state.step === 3 ? 'Generating roadmap options with evidence…' :
               state.step === 5 ? 'Asking persona twins to vote…' :
               'Processing…'}
            </span>
          </div>
        )}
      </div>
    </main>
  )
}
