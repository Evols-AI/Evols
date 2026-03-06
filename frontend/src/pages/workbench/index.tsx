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
import AskPersonasTab from '@/components/workbench/AskPersonasTab'
import TradeOffVotingTab from '@/components/workbench/TradeOffVotingTab'
import { api } from '@/services/api'
import { FileText, CheckCircle, Clock, AlertCircle, Briefcase, MessageSquare, Scale } from 'lucide-react'
import { StatCard } from '@/components/PageContainer'
import { useProducts } from '@/hooks/useProducts'

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

  // Decision framing
  objective: string
  segments: string[]
  time_horizon: string
  constraints: string

  // Context selection (flexible - choose what you need)
  use_internal_context: boolean  // Pull from knowledge base (themes & feedback)
  use_external_context: boolean  // Pull from Reddit (market research)

  // Internal context (from knowledge base)
  context_themes: any[]
  context_feedback: any[]

  // External context (from Reddit)
  market_data: any
  product_name: string
  product_description: string
  competitors: string[]
  is_beyond_idea_phase: boolean

  // Generated personas (from either context)
  generated_personas: any[]

  // Decision options & validation
  options: DecisionOption[]
  selected_option_id: string | null
  persona_votes: any[]
  job_id: string | null
  is_loading: boolean

  // Decision metadata
  decision_id: number | null
}

const INITIAL_STATE: WorkbenchState = {
  step: 1,

  // Decision framing
  objective: '',
  segments: [],
  time_horizon: 'Next quarter',
  constraints: '',

  // Context selection (flexible)
  use_internal_context: false,
  use_external_context: false,

  // Internal context
  context_themes: [],
  context_feedback: [],

  // External context
  market_data: null,
  product_name: '',
  product_description: '',
  competitors: [],
  is_beyond_idea_phase: false,

  // Generated personas
  generated_personas: [],

  // Decision options & validation
  options: [],
  selected_option_id: null,
  persona_votes: [],
  job_id: null,
  is_loading: false,

  // Decision metadata
  decision_id: null,
}

// ── Main component ──────────────────────────────────────────────────────────

export default function WorkbenchPage() {
  const user = getCurrentUser()
  const { selectedProductIds } = useProducts()
  const [activeTab, setActiveTab] = useState<'decision' | 'ask' | 'vote'>('decision')
  const [state, setState] = useState<WorkbenchState>(INITIAL_STATE)
  const [votingProgress, setVotingProgress] = useState<{ current: number; total: number } | null>(null)
  const [decisions, setDecisions] = useState<any[]>([])
  const [loadingDecisions, setLoadingDecisions] = useState(false)
  const [availableSegments, setAvailableSegments] = useState<string[]>([])
  const [personas, setPersonas] = useState<any[]>([])
  const [loadingPersonas, setLoadingPersonas] = useState(false)

  const update = useCallback((patch: Partial<WorkbenchState>) => {
    setState(prev => ({ ...prev, ...patch }))
  }, [])

  // Load past decisions from database
  const loadDecisions = useCallback(async () => {
    try {
      setLoadingDecisions(true)
      const response = await api.listWorkbenchDecisions()
      setDecisions(response.data || [])
    } catch (error) {
      console.error('Error loading decisions:', error)
    } finally {
      setLoadingDecisions(false)
    }
  }, [])

  // Load personas
  const loadPersonas = useCallback(async () => {
    try {
      setLoadingPersonas(true)
      const productIdsParam = selectedProductIds.length > 0 ? selectedProductIds.join(',') : undefined
      const response = await api.getPersonas(productIdsParam)
      setPersonas(response.data || [])
    } catch (error) {
      console.error('Error loading personas:', error)
    } finally {
      setLoadingPersonas(false)
    }
  }, [selectedProductIds])

  // Load decisions and segments on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [segmentsResponse] = await Promise.all([
          api.getSegments(),
          loadDecisions(),
          loadPersonas(),
        ])
        setAvailableSegments(segmentsResponse.data || [])
      } catch (error) {
        console.error('Error loading data:', error)
      }
    }
    loadData()
  }, [loadDecisions, loadPersonas])

  // Step 2: Auto-pull context from backend (PM Mode)
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

  // Step 2: Pull internet data (Founder Mode)
  const pullInternetData = useCallback(async () => {
    // Product name is optional - can pull market data using just description for pre-launch products
    if (!state.product_description && !state.product_name) {
      console.warn('Need at least product description or product name to pull market data')
      return
    }
    update({ is_loading: true, step: 2 })
    try {
      const res = await api.post('/workbench/pull-internet-data', {
        product_name: state.product_name || '',
        product_description: state.product_description,
        competitors: state.competitors,
        is_beyond_idea_phase: state.is_beyond_idea_phase,
      })
      update({
        market_data: res.data.market_data || {},
        is_loading: false,
      })
    } catch (error) {
      console.error('Failed to pull market data:', error)
      update({ is_loading: false })
    }
  }, [state.product_name, state.product_description, state.competitors, state.is_beyond_idea_phase])

  // Step 3: Generate personas from market data (Founder Mode)
  const generatePersonasFromMarket = useCallback(async () => {
    if (!state.market_data) return
    update({ is_loading: true, step: 3 })
    try {
      const res = await api.post('/workbench/generate-personas-from-market', {
        market_data: state.market_data,
        product_name: state.product_name,
        target_market: state.segments.join(', '),
      })
      update({
        generated_personas: res.data.personas || [],
        is_loading: false,
      })
    } catch (error) {
      console.error('Failed to generate personas:', error)
      update({ is_loading: false })
    }
  }, [state.market_data, state.product_name, state.segments])

  // Step 3: Generate options (uses whatever context was pulled)
  const generateOptions = useCallback(async () => {
    update({ is_loading: true, step: 3 })
    try {
      const payload: any = {
        objective: state.objective,
        segments: state.segments,
        time_horizon: state.time_horizon,
        constraints: state.constraints,
        use_internal_context: state.use_internal_context,
        use_external_context: state.use_external_context,
      }

      // Add internal context if selected
      if (state.use_internal_context) {
        payload.theme_ids = state.context_themes.map((t: any) => t.id)
      }

      // Add external context if selected
      if (state.use_external_context) {
        payload.market_data = state.market_data
        payload.product_name = state.product_name
        payload.product_description = state.product_description
      }

      const res = await api.post('/workbench/generate-options', payload)
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

      // Use generated personas if available (from external context), otherwise use library personas
      const payload: any = {
        options: state.options.map(o => ({ id: o.id, title: o.title, description: o.description })),
      }

      if (state.generated_personas.length > 0) {
        payload.generated_personas = state.generated_personas
      }

      const res = await api.post('/workbench/persona-votes', payload)

      clearInterval(progressInterval)
      setVotingProgress({ current: 100, total: 100 })

      // Show completion briefly before hiding
      setTimeout(() => setVotingProgress(null), 500)

      const votes = res.data.votes || []
      update({
        persona_votes: votes,
        is_loading: false,
      })

      // Auto-save decision after getting votes
      if (votes.length > 0) {
        await saveDecision(votes)
      }
    } catch (error) {
      setVotingProgress(null)
      update({ is_loading: false })
    }
  }, [state.options, state.generated_personas, state.objective, state.segments, state.time_horizon, state.constraints])

  // Save decision to database
  const saveDecision = useCallback(async (votes: any[]) => {
    try {
      const res = await api.saveDecision({
        objective: state.objective,
        segments: state.segments,
        time_horizon: state.time_horizon,
        constraints: state.constraints,
        options: state.options,
        persona_votes: votes,
        use_internal_context: state.use_internal_context,
        use_external_context: state.use_external_context,
      })
      update({ decision_id: res.data.id })
      // Reload decisions list
      await loadDecisions()
    } catch (error) {
      console.error('Failed to save decision:', error)
    }
  }, [state.objective, state.segments, state.time_horizon, state.constraints, state.options, state.use_internal_context, state.use_external_context, loadDecisions])

  // Load a past decision
  const loadDecision = useCallback(async (decisionId: number) => {
    try {
      const res = await api.getDecision(decisionId)
      const decision = res.data

      setState({
        ...INITIAL_STATE,
        objective: decision.objective,
        segments: decision.segments || [],
        time_horizon: decision.time_horizon,
        constraints: decision.constraints || '',
        options: decision.options || [],
        persona_votes: decision.persona_votes || [],
        decision_id: decision.id,
        use_internal_context: decision.use_internal_context || false,
        use_external_context: decision.use_external_context || false,
        step: 5, // Go to final step
      })
    } catch (error) {
      console.error('Failed to load decision:', error)
    }
  }, [])

  // Frame a new decision (reset)
  const frameNewDecision = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

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

  // Save generated personas to database
  const savePersonas = useCallback(async () => {
    if (!state.generated_personas || state.generated_personas.length === 0) return
    update({ is_loading: true })
    try {
      const res = await api.saveGeneratedPersonas({
        personas: state.generated_personas,
        product_id: null,  // Can be extended to support product association
      })
      alert(`Successfully saved ${res.data.saved_count} personas to your persona library!`)
      update({ is_loading: false })
    } catch (error) {
      console.error('Failed to save personas:', error)
      alert('Failed to save personas. Please try again.')
      update({ is_loading: false })
    }
  }, [state.generated_personas])

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
        <title>Decision Workbench — Evols</title>
      </Head>

      <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
        <Header user={user} currentPage="workbench" />

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center px-6">
            <button
              onClick={() => setActiveTab('decision')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${
                activeTab === 'decision'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-medium'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              Frame Decision
            </button>
            <button
              onClick={() => setActiveTab('ask')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${
                activeTab === 'ask'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-medium'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Ask Personas
            </button>
            <button
              onClick={() => setActiveTab('vote')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${
                activeTab === 'vote'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-medium'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Scale className="w-4 h-4" />
              Trade-off Voting
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'decision' ? (
          /* 3-pane layout for decision framing */
          <div className="flex flex-1 overflow-hidden">
            {/* Left pane — Context Rail (w-72) */}
            <ContextRail
              themes={state.context_themes}
              feedback={state.context_feedback}
              marketData={state.market_data}
              isLoading={state.is_loading && state.step === 2}
              step={state.step}
              decisions={decisions}
              onDecisionClick={loadDecision}
            />

            {/* Center pane — Decision Canvas (flex-1) */}
            <DecisionCanvas
              state={state}
              votingProgress={votingProgress}
              availableSegments={availableSegments}
              onObjectiveChange={v => update({ objective: v })}
              onSegmentsChange={v => update({ segments: v })}
              onTimeHorizonChange={v => update({ time_horizon: v })}
              onConstraintsChange={v => update({ constraints: v })}
              onUseInternalContextChange={v => update({ use_internal_context: v })}
              onUseExternalContextChange={v => update({ use_external_context: v })}
              onProductNameChange={v => update({ product_name: v })}
              onProductDescriptionChange={v => update({ product_description: v })}
              onCompetitorsChange={v => update({ competitors: v })}
              onIsBeyondIdeaPhaseChange={v => update({ is_beyond_idea_phase: v })}
              onPullContext={pullContext}
              onPullInternetData={pullInternetData}
              onGeneratePersonasFromMarket={generatePersonasFromMarket}
              onGenerateOptions={generateOptions}
              onAskPersonas={askPersonas}
              onRegenerate={regenerate}
              onSelectOption={id => update({ selected_option_id: id })}
              onSavePersonas={savePersonas}
              onFrameNewDecision={frameNewDecision}
            />
          </div>
        ) : activeTab === 'ask' ? (
          /* Ask Personas Tab */
          <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">
            <AskPersonasTab personas={personas} />
          </div>
        ) : (
          /* Trade-off Voting Tab */
          <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">
            <TradeOffVotingTab personas={personas} />
          </div>
        )}
      </div>
    </>
  )
}
