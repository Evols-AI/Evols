import React, { useState, useEffect } from 'react'
import { BarChart, Users, DollarSign, MessageSquare, FileText, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react'
import { api } from '@/services/api'

interface InitiativeEvidenceProps {
  initiativeId: number
  onUpdate?: () => void
}

export function InitiativeEvidence({ initiativeId, onUpdate }: InitiativeEvidenceProps) {
  const [evidence, setEvidence] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadEvidence()
  }, [initiativeId])

  const loadEvidence = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await api.context.getInitiativeEvidence(initiativeId)
      setEvidence(response.data)
    } catch (err: any) {
      if (err.response?.status === 404) {
        // No evidence yet
        setEvidence(null)
      } else {
        setError(err.response?.data?.detail || 'Failed to load evidence')
      }
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value}`
  }

  const getSentimentIcon = (sentiment: number | null) => {
    if (sentiment === null) return <Minus className="w-4 h-4 text-gray-400" />
    if (sentiment > 0.2) return <TrendingUp className="w-4 h-4 text-green-500" />
    if (sentiment < -0.2) return <TrendingDown className="w-4 h-4 text-red-500" />
    return <Minus className="w-4 h-4 text-yellow-500" />
  }

  const getSentimentLabel = (sentiment: number | null) => {
    if (sentiment === null) return 'Neutral'
    if (sentiment > 0.2) return 'Positive'
    if (sentiment < -0.2) return 'Negative'
    return 'Neutral'
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  if (!evidence || evidence.total_mentions === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Evidence Linked Yet
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Link extracted entities to this initiative to build supporting evidence
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Evidence Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Evidence Summary
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Total Mentions</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{evidence.total_mentions}</p>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-xs font-medium text-green-600 dark:text-green-400">ARR Impacted</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(evidence.total_arr_impacted)}
            </p>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Avg Confidence</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {evidence.confidence_avg ? `${Math.round(evidence.confidence_avg * 100)}%` : 'N/A'}
            </p>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              {getSentimentIcon(evidence.sentiment_avg)}
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Sentiment</span>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {getSentimentLabel(evidence.sentiment_avg)}
            </p>
          </div>
        </div>

        {/* Customer Segments */}
        {evidence.customer_segments && Object.keys(evidence.customer_segments).length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Customer Segments
            </h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(evidence.customer_segments).map(([segment, count]: [string, any]) => (
                <span
                  key={segment}
                  className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  {segment}: {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sources */}
        {evidence.sources && evidence.sources.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Sources
            </h4>
            <div className="space-y-2">
              {evidence.sources.map((source: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {source.name || `Source ${source.source_id}`}
                      </p>
                      {source.source_type && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {source.source_type.replace(/_/g, ' ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                    {source.mention_count} {source.mention_count === 1 ? 'mention' : 'mentions'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Representative Quotes */}
      {evidence.representative_quotes && evidence.representative_quotes.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Representative Quotes
          </h3>
          <div className="space-y-4">
            {evidence.representative_quotes.map((quote: any, index: number) => (
              <div
                key={index}
                className="border-l-4 border-blue-500 pl-4 py-2"
              >
                <p className="text-sm text-gray-700 dark:text-gray-300 italic mb-2">
                  "{quote.text}"
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  {quote.customer_name && (
                    <span className="font-medium">{quote.customer_name}</span>
                  )}
                  {quote.speaker_role && (
                    <span>{quote.speaker_role}</span>
                  )}
                  {quote.customer_segment && (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">
                      {quote.customer_segment}
                    </span>
                  )}
                  {quote.customer_arr && (
                    <span className="text-green-600 dark:text-green-400">
                      {formatCurrency(quote.customer_arr)} ARR
                    </span>
                  )}
                  {quote.confidence && (
                    <span className="text-purple-600 dark:text-purple-400">
                      {Math.round(quote.confidence * 100)}% confidence
                    </span>
                  )}
                </div>
                {quote.source_name && (
                  <div className="mt-1 text-xs text-gray-400">
                    Source: {quote.source_name}
                    {quote.date && ` • ${new Date(quote.date).toLocaleDateString()}`}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Updated */}
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Last updated: {new Date(evidence.last_updated_at).toLocaleString()}
      </div>
    </div>
  )
}
