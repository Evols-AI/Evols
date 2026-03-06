/**
 * Decision Workbench — the "IDE for product decisions"
 * 3-pane layout: Context Rail | Decision Canvas | AI Copilot
 * Follows the UX flow: Frame → Auto-Pull Context → Generate Options → Compare → Influence → Ask Personas
 */

import { useState, useCallback, useEffect } from 'react'
import Head from 'next/head'
import Header from '@/components/Header'
import { getCurrentUser } from '@/utils/auth'
import ContextRail from '@/components/workbench/ContextRail'
import DecisionCanvas from '@/components/workbench/DecisionCanvas'
import { api } from '@/services/api'
import { FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { StatCard } from '@/components/PageContainer'

// ── Types ──────────────────────────────────────────────────────────────────

export interface DecisionOption {
  id: string
  title: string
  description: string
  pros: string[]
  cons: string[]
  segments_served: string[]
  arr_upside: number
  risk_level: 'low' | 'medium' | 'high'
  citations: any[]
}

export interface WorkbenchState {
  step: 1 | 2 | 3 | 4 | 5
  objective: string
  segments: string[]
  time_horizon: string
  constraints: string
  context_themes: any[]
  context_feedback: any[]
  options: DecisionOption[]
  selected_option_id: string | null
  persona_votes: any[]
  job_id: string | null
  is_loading: boolean
}

const INITIAL_STATE: WorkbenchState = {
  step: 1,
  objective: '',
  segments: [],
  time_horizon: 'Q3 2025',
  constraints: '',
  context_themes: [],
  context_feedback: [],
  options: [],
  selected_option_id: null,
  persona_votes: [],
  job_id: null,
  is_loading: false,
}

// ── Main component ──────────────────────────────────────────────────────────

export default function WorkbenchPage() {
  const user = getCurrentUser()
  const [state, setState] = useState<WorkbenchState>(INITIAL_STATE)
  const [votingProgress, setVotingProgress] = useState<{ current: number; total: number } | null>(null)
  const [decisions, setDecisions] = useState<any[]>([])
  const [loadingDecisions, setLoadingDecisions] = useState(false)

  const update = useCallback((patch: Partial<WorkbenchState>) => {
    setState(prev => ({ ...prev, ...patch }))
  }, [])

  // Load decisions on mount
  useEffect(() => {
    const loadDecisions = async () => {
      try {
        setLoadingDecisions(true)
        const response = await api.getDecisions()
        setDecisions(response.data.items || response.data || [])
      } catch (error) {
        console.error('Error loading decisions:', error)
      } finally {
        setLoadingDecisions(false)
      }
    }
    loadDecisions()
  }, [])

  // Step 2: Auto-pull context from backend
  const pullContext = useCallback(async () => {
    if (!state.objective) return
    update({ is_loading: true, step: 2 })
    try {
      const res = await api.post('/workbench/context', {
        objective: state.objective,
        segments: state.segments,
        time_horizon: state.time_horizon,
      })
      update({
        context_themes: res.data.themes || [],
        context_feedback: res.data.feedback || [],
        is_loading: false,
      })
    } catch {
      update({ is_loading: false })
    }
  }, [state.objective, state.segments, state.time_horizon])

  // Step 3: Generate options
  const generateOptions = useCallback(async () => {
    update({ is_loading: true, step: 3 })
    try {
      const res = await api.post('/workbench/generate-options', {
        objective: state.objective,
        segments: state.segments,
        time_horizon: state.time_horizon,
        constraints: state.constraints,
        theme_ids: state.context_themes.map((t: any) => t.id),
      })
      update({
        options: res.data.options || [],
        job_id: res.data.job_id || null,
        is_loading: false,
        step: 4,
      })
    } catch {
      update({ is_loading: false })
    }
  }, [state])

  // Step 4: Ask personas to vote
  const askPersonas = useCallback(async () => {
    update({ is_loading: true, step: 5 })
    setVotingProgress({ current: 0, total: 100 })

    try {
      // Start progress animation (simulated since backend runs in parallel)
      const progressInterval = setInterval(() => {
        setVotingProgress(prev => {
          if (!prev || prev.current >= 90) return prev
          return { current: prev.current + 10, total: 100 }
        })
      }, 500)

      const res = await api.post('/workbench/persona-votes', {
        options: state.options.map(o => ({ id: o.id, title: o.title, description: o.description })),
      })

      clearInterval(progressInterval)
      setVotingProgress({ current: 100, total: 100 })

      // Show completion briefly before hiding
      setTimeout(() => setVotingProgress(null), 500)

      update({
        persona_votes: res.data.votes || [],
        is_loading: false,
      })
    } catch (error) {
      setVotingProgress(null)
      update({ is_loading: false })
    }
  }, [state.options])

  // Regenerate with updated constraints
  const regenerate = useCallback(async (constraints: string) => {
    update({ constraints, is_loading: true })
    try {
      const res = await api.post('/workbench/generate-options', {
        objective: state.objective,
        segments: state.segments,
        time_horizon: state.time_horizon,
        constraints,
        theme_ids: state.context_themes.map((t: any) => t.id),
      })
      update({ options: res.data.options || [], is_loading: false })
    } catch {
      update({ is_loading: false })
    }
  }, [state])

  // Calculate decision stats
  const getDecisionStats = () => {
    const approved = decisions.filter(d => d.status === 'approved').length
    const inReview = decisions.filter(d => d.status === 'in_review').length
    const draft = decisions.filter(d => d.status === 'draft').length
    return { total: decisions.length, approved, inReview, draft }
  }

  const stats = getDecisionStats()

  return (
    <>
      <Head>
        <title>Decision Workbench — ProductOS</title>
      </Head>

      <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
        <Header user={user} currentPage="workbench" />

        {/* Decision Summary Stats */}
        <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                title="Total Decisions"
                value={stats.total}
                icon={<FileText className="w-5 h-5" />}
                color="blue"
              />
              <StatCard
                title="Approved"
                value={stats.approved}
                icon={<CheckCircle className="w-5 h-5" />}
                color="green"
              />
              <StatCard
                title="In Review"
                value={stats.inReview}
                icon={<Clock className="w-5 h-5" />}
                color="orange"
              />
              <StatCard
                title="Draft"
                value={stats.draft}
                icon={<AlertCircle className="w-5 h-5" />}
                color="purple"
              />
            </div>
          </div>
        </div>

        {/* 3-pane layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left pane — Context Rail (w-72) */}
          <ContextRail
            themes={state.context_themes}
            feedback={state.context_feedback}
            isLoading={state.is_loading && state.step === 2}
            step={state.step}
          />

          {/* Center pane — Decision Canvas (flex-1) */}
          <DecisionCanvas
            state={state}
            votingProgress={votingProgress}
            onObjectiveChange={v => update({ objective: v })}
            onSegmentsChange={v => update({ segments: v })}
            onTimeHorizonChange={v => update({ time_horizon: v })}
            onConstraintsChange={v => update({ constraints: v })}
            onPullContext={pullContext}
            onGenerateOptions={generateOptions}
            onAskPersonas={askPersonas}
            onRegenerate={regenerate}
            onSelectOption={id => update({ selected_option_id: id })}
          />
        </div>
      </div>
    </>
  )
}
