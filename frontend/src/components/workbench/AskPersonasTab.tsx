/**
 * Ask Personas Tab
 * Allows users to ask questions to personas and get AI-powered responses
 * Moved from personas page to workbench
 */

import { useState } from 'react'
import { MessageSquare, Loader2 } from 'lucide-react'
import { api } from '@/services/api'

interface AskPersonasTabProps {
  personas: any[]
}

export default function AskPersonasTab({ personas }: AskPersonasTabProps) {
  const [question, setQuestion] = useState('')
  const [selectedPersonas, setSelectedPersonas] = useState<number[]>([])
  const [responses, setResponses] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [askingProgress, setAskingProgress] = useState<{ current: number; total: number } | null>(null)

  const togglePersona = (personaId: number) => {
    setSelectedPersonas(prev =>
      prev.includes(personaId)
        ? prev.filter(id => id !== personaId)
        : [...prev, personaId]
    )
  }

  const handleAsk = async () => {
    if (!question.trim() || selectedPersonas.length === 0) {
      alert('Please enter a question and select at least one persona')
      return
    }

    setLoading(true)
    setResponses([])
    setAskingProgress({ current: 0, total: selectedPersonas.length })

    try {
      // Call backend once per persona for real-time progress
      let completed = 0
      const responsePromises = selectedPersonas.map(async (personaId) => {
        try {
          const result = await api.askPersona({
            persona_id: personaId,
            question: question,
          })

          // Update progress
          completed++
          setAskingProgress({ current: completed, total: selectedPersonas.length })

          // Add response to state as it arrives
          const personaData = personas.find(p => p.id === personaId)
          const answer = result.data
          if (answer) {
            setResponses(prev => [...prev, {
              personaName: personaData?.name || 'Unknown',
              response: answer.response,
              confidence: answer.confidence,
              reasoning: answer.reasoning,
            }])
          }

          return answer
        } catch (error) {
          console.error(`Error asking persona ${personaId}:`, error)
          completed++
          setAskingProgress({ current: completed, total: selectedPersonas.length })
          return null
        }
      })

      await Promise.all(responsePromises)

      // Show completion briefly
      setTimeout(() => setAskingProgress(null), 500)
    } catch (error: any) {
      console.error('Error asking personas:', error)
      alert(`Failed to ask personas: ${error.message || 'Unknown error'}`)
      setAskingProgress(null)
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
          <MessageSquare className="w-16 h-16" />
        </div>
        <h3 className="empty-state-title">No Personas Available</h3>
        <p className="empty-state-description">
          You need advisor personas to ask questions. Create or import personas first.
        </p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Ask Personas</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Ask your personas anything about features, priorities, pain points, or product decisions.
          Get AI-powered responses based on their profile and preferences.
        </p>
      </div>

      {/* Question Form Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        {/* Question Input */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Your Question
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask your personas anything about features, priorities, pain points..."
            rows={4}
            className="input"
          />
        </div>

        {/* Persona Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Select Personas to Ask
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {advisorPersonas.map(persona => (
              <button
                key={persona.id}
                onClick={() => togglePersona(persona.id)}
                className={`p-3 rounded-lg border-2 transition ${
                  selectedPersonas.includes(persona.id)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="text-sm font-medium text-heading">{persona.name}</div>
                <div className="text-xs text-body">{persona.segment}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ask Button / Progress */}
      {askingProgress ? (
        <div className="bg-gradient-to-r from-blue-50 to-blue-50 dark:from-blue-900/20 dark:to-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600 animate-pulse" />
              <h3 className="font-semibold text-heading">
                Asking Personas...
              </h3>
            </div>
            <span className="text-sm font-medium text-blue-600">
              {askingProgress.current}/{askingProgress.total}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-blue-600 to-blue-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${(askingProgress.current / askingProgress.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-body mt-2">
            Receiving responses in real-time as personas respond...
          </p>
        </div>
      ) : (
        <button
          onClick={handleAsk}
          disabled={loading || !question.trim() || selectedPersonas.length === 0}
          className="btn-primary w-full disabled:opacity-50"
        >
          {loading ? 'Asking Personas...' : 'Ask Personas'}
        </button>
      )}

      {/* Responses */}
      {responses.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-heading">Responses (AI-Powered Digital Twins)</h3>
          {responses.map((response, idx) => (
            <div key={idx} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="font-semibold text-heading">{response.personaName}</div>
                {response.confidence !== undefined && (
                  <div className="text-xs text-body">
                    Confidence: {(response.confidence * 100).toFixed(0)}%
                  </div>
                )}
              </div>
              <p className="text-sm text-body mb-2">{response.response}</p>
              {response.reasoning && (
                <div className="text-xs text-muted mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="font-medium">Based on:</span> {response.reasoning}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
