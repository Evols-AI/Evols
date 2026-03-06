/**
 * CitationChip
 * Clickable citation badge that shows inline evidence.
 * Every AI-generated claim links back to source data via this component.
 */

import { useState, useRef, useEffect } from 'react'
import { ExternalLink, FileText, Users, TrendingUp, MessageSquare, Globe } from 'lucide-react'

export interface Citation {
  source_type: 'feedback' | 'theme' | 'account' | 'interview' | 'metric' | 'decision' | 'market_data'
  source_id: number | string
  quote?: string
  confidence: number
  metadata?: Record<string, any>
}

interface CitationChipProps {
  citations: Citation[]
  label?: string             // e.g. "47 items | $2.3M ARR"
  className?: string
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  feedback: <MessageSquare className="w-3 h-3" />,
  theme: <FileText className="w-3 h-3" />,
  account: <Users className="w-3 h-3" />,
  interview: <MessageSquare className="w-3 h-3" />,
  metric: <TrendingUp className="w-3 h-3" />,
  decision: <FileText className="w-3 h-3" />,
  market_data: <Globe className="w-3 h-3" />,
}

function buildAutoLabel(citations: Citation[]): string {
  const feedbackCount = citations.filter(c => c.source_type === 'feedback').length
  const accountCitations = citations.filter(c => c.source_type === 'account')
  const totalArr = accountCitations.reduce((sum, c) => sum + (c.metadata?.arr || 0), 0)
  const interviewCount = citations.filter(c => c.source_type === 'interview').length
  const marketDataCitations = citations.filter(c => c.source_type === 'market_data')
  const totalDataPoints = marketDataCitations.reduce((sum, c) => sum + (c.metadata?.data_points || 0), 0)

  const parts: string[] = []
  if (feedbackCount > 0) parts.push(`${feedbackCount} item${feedbackCount !== 1 ? 's' : ''}`)
  if (totalArr > 0) parts.push(`$${(totalArr / 1000).toFixed(0)}K ARR`)
  if (interviewCount > 0) parts.push(`${interviewCount} interview${interviewCount !== 1 ? 's' : ''}`)
  if (totalDataPoints > 0) parts.push(`${totalDataPoints} data points`)
  return parts.join(' | ')
}

export default function CitationChip({ citations, label, className = '' }: CitationChipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  if (!citations || citations.length === 0) return null

  const displayLabel = label || buildAutoLabel(citations)
  const avgConfidence = citations.reduce((s, c) => s + c.confidence, 0) / citations.length
  const confidenceColor =
    avgConfidence >= 0.8 ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300' :
    avgConfidence >= 0.5 ? 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300' :
    'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-700 dark:text-gray-300'

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${confidenceColor}`}
        title="Click to see evidence"
      >
        <span>[{displayLabel}]</span>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Evidence ({citations.length} source{citations.length !== 1 ? 's' : ''})
            </span>
            <span className="text-xs text-gray-400">
              {Math.round(avgConfidence * 100)}% confidence
            </span>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {citations.slice(0, 8).map((c, i) => {
              // Special handling for market_data citations
              const isMarketData = c.source_type === 'market_data'
              const displayTitle = isMarketData && c.metadata?.title
                ? c.metadata.title
                : `${c.source_type.replace('_', ' ')} #${c.source_id}`

              return (
                <div key={i} className="text-xs border-l-2 border-blue-400 pl-2">
                  <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                    {SOURCE_ICONS[c.source_type]}
                    <span className="capitalize font-medium">{displayTitle}</span>
                    {c.metadata?.account_name && (
                      <span className="text-gray-400">— {c.metadata.account_name}</span>
                    )}
                    {c.metadata?.arr && (
                      <span className="ml-auto text-green-600 font-medium">
                        ${(c.metadata.arr / 1000).toFixed(0)}K
                      </span>
                    )}
                  </div>
                  {/* Market data sources */}
                  {isMarketData && c.metadata?.sources && (
                    <p className="text-gray-600 dark:text-gray-300 text-xs mb-1">
                      Sources: {c.metadata.sources.join(', ')}
                    </p>
                  )}
                  {/* Data points count */}
                  {isMarketData && c.metadata?.data_points && (
                    <p className="text-gray-500 dark:text-gray-400 text-xs">
                      {c.metadata.data_points} data points collected
                    </p>
                  )}
                  {c.quote && (
                    <p className="text-gray-600 dark:text-gray-300 italic line-clamp-2">
                      "{c.quote}"
                    </p>
                  )}
                  {c.metadata?.segment && (
                    <span className="mt-1 inline-block px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs">
                      {c.metadata.segment}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {citations.length > 8 && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              +{citations.length - 8} more sources
            </p>
          )}
        </div>
      )}
    </div>
  )
}
