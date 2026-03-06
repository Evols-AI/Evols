/**
 * Trade-off Voting Tab
 * Allows users to pose trade-off questions and get persona votes
 * Moved from personas page to workbench
 */

import { useState } from 'react'
import { Scale, Users, Loader2, Plus, X } from 'lucide-react'
import { api } from '@/services/api'

interface TradeOffVotingTabProps {
  personas: any[]
}

export default function TradeOffVotingTab({ personas }: TradeOffVotingTabProps) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [votes, setVotes] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [votingProgress, setVotingProgress] = useState<{ current: number; total: number } | null>(null)

  const addOption = () => setOptions([...options, ''])
  const removeOption = (index: number) => setOptions(options.filter((_, i) => i !== index))
  const updateOption = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const handleVote = async () => {
    const validOptions = options.filter(o => o.trim())
    if (!question.trim() || validOptions.length < 2) {
      alert('Please enter a question and at least 2 options')
      return
    }

    setLoading(true)
    setVotingProgress({ current: 0, total: advisorPersonas.length })

    try {
      // Format options for backend
      const formattedOptions = validOptions.map((opt, idx) => ({
        id: String.fromCharCode(65 + idx), // A, B, C, D...
        description: opt
      }))

      let completed = 0
      const allVotes: any[] = []

      // Call backend once per persona to get real-time progress
      const votePromises = advisorPersonas.map(async (persona) => {
        try {
          const result = await api.personaVote({
            persona_ids: [persona.id], // Single persona per call
            question: question,
            options: formattedOptions,
          })

          // Extract the vote for this persona
          const votes = result.data.votes || []

          // Update progress in real-time
          completed++
          setVotingProgress({ current: completed, total: advisorPersonas.length })

          return votes
        } catch (error) {
          console.error(`Error getting vote from persona ${persona.name}:`, error)

          // Update progress even on error
          completed++
          setVotingProgress({ current: completed, total: advisorPersonas.length })

          return []
        }
      })

      const voteResultsArray = await Promise.all(votePromises)

      // Flatten all votes into single array
      const votesData = voteResultsArray.flat()

      // Show completion briefly before hiding
      setTimeout(() => setVotingProgress(null), 500)

      // Calculate results
      const voteResults = validOptions.map((option, idx) => {
        const optionId = String.fromCharCode(65 + idx)

        // Handle both 'choice' and 'selected_option_id' field names
        const votesForOption = votesData.filter((v: any) =>
          v.choice === optionId || v.selected_option_id === optionId
        )

        return {
          option,
          votes: votesForOption.length,
          percentage: Math.round((votesForOption.length / advisorPersonas.length) * 100),
          personas: votesForOption.map((v: any) => v.persona_name),
          reasoning: votesForOption.map((v: any) => ({
            persona: v.persona_name,
            reason: v.reasoning
          }))
        }
      })

      // Sort by votes descending
      voteResults.sort((a, b) => b.votes - a.votes)

      setVotes(voteResults)
    } catch (error: any) {
      console.error('Error getting votes:', error)
      setVotingProgress(null)
      const errorMsg = error.response?.data?.detail || error.message || 'Unknown error'
      alert(`Failed to get persona votes: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  // Filter to only advisor personas
  const advisorPersonas = personas.filter(p => p.status === 'advisor')

  if (advisorPersonas.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <Scale className="w-16 h-16" />
        </div>
        <h3 className="empty-state-title">No Personas Available</h3>
        <p className="empty-state-description">
          You need advisor personas to conduct trade-off voting. Create or import personas first.
        </p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Trade-off Voting</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Pose trade-off questions with multiple options and let your personas vote.
          Get AI-powered consensus on product priorities and decisions.
        </p>
      </div>

      {/* Trade-off Form Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        {/* Question Input */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Trade-off Question
          </label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="E.g., What should we prioritize next quarter?"
            className="input"
          />
        </div>

        {/* Options */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Options
          </label>
          <div className="space-y-3">
            {options.map((option, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(idx, e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                  className="input flex-1"
                />
                {options.length > 2 && (
                  <button
                    onClick={() => removeOption(idx)}
                    className="btn-secondary px-3"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button onClick={addOption} className="btn-secondary">
              + Add Option
            </button>
          </div>
        </div>
      </div>

      {/* Get Votes Button / Progress */}
      {votingProgress ? (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600 animate-pulse" />
              <h3 className="font-semibold text-heading">
                Collecting Persona Votes...
              </h3>
            </div>
            <span className="text-sm font-medium text-purple-600">
              {votingProgress.current}/{votingProgress.total}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-purple-600 to-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${(votingProgress.current / votingProgress.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-body mt-2">
            Receiving votes in real-time as personas respond...
          </p>
        </div>
      ) : (
        <button
          onClick={handleVote}
          disabled={loading || !question.trim() || options.filter(o => o.trim()).length < 2}
          className="btn-primary w-full disabled:opacity-50"
        >
          {loading ? 'Getting Votes...' : 'Get Persona Votes'}
        </button>
      )}

      {/* Vote Results */}
      {votes && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-heading">Voting Results</h3>
          {votes.map((result: any, idx: number) => (
            <div key={idx} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-heading">{result.option}</div>
                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  {result.percentage}%
                </div>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                <div
                  className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all"
                  style={{ width: `${result.percentage}%` }}
                />
              </div>
              <div className="text-xs text-body">
                Voted by: {result.personas.join(', ') || 'No votes'}
              </div>

              {/* Show reasoning if available */}
              {result.reasoning && result.reasoning.length > 0 && (
                <div className="mt-3 space-y-2">
                  {result.reasoning.map((r: any, ridx: number) => (
                    r.reason && (
                      <div key={ridx} className="text-xs text-muted border-l-2 border-indigo-300 dark:border-indigo-700 pl-2">
                        <span className="font-medium">{r.persona}:</span> {r.reason}
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
