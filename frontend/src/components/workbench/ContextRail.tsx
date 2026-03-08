/**
 * ContextRail — Left pane of the Decision Workbench
 * Auto-pulled evidence: themes, feedback, past decisions
 * Updates dynamically as the PM types their objective
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, TrendingUp, MessageSquare, Lightbulb, History } from 'lucide-react'
import CitationChip from '@/components/CitationChip'
import { InlineSpinner } from '@/components/ProgressIndicator'

interface ContextRailProps {
  themes: any[]
  feedback: any[]
  marketData?: any
  isLoading: boolean
  step: number
  decisions?: any[]
  onDecisionClick?: (decisionId: number) => void
}

function SectionHeader({
  icon, title, count, expanded, onToggle
}: { icon: React.ReactNode; title: string; count?: number; expanded: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
    >
      {icon}
      <span className="flex-1 text-left">{title}</span>
      {count !== undefined && (
        <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-300 normal-case font-medium">
          {count}
        </span>
      )}
      {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
    </button>
  )
}

export default function ContextRail({ themes, feedback, marketData, isLoading, step, decisions = [], onDecisionClick }: ContextRailProps) {
  const [sectionsOpen, setSectionsOpen] = useState({ themes: true, feedback: true, market: true, past: true })
  const toggle = (key: keyof typeof sectionsOpen) =>
    setSectionsOpen(s => ({ ...s, [key]: !s[key] }))

  return (
    <aside className="w-72 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Context</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {step < 2 ? 'Auto-pulled once you frame your objective' : 'Evidence supporting this decision'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Loading state */}
        {isLoading && (
          <div className="px-3 py-4">
            <InlineSpinner message="Pulling relevant context…" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && step < 2 && (
          <div className="px-3 py-6 text-center">
            <Lightbulb className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Type your objective in the canvas to auto-pull relevant themes and feedback
            </p>
          </div>
        )}

        {/* Themes section */}
        {themes.length > 0 && (
          <div>
            <SectionHeader
              icon={<TrendingUp className="w-3 h-3" />}
              title="Related Themes"
              count={themes.length}
              expanded={sectionsOpen.themes}
              onToggle={() => toggle('themes')}
            />
            {sectionsOpen.themes && (
              <div className="space-y-1 mt-1">
                {themes.map((theme: any) => (
                  <div
                    key={theme.id}
                    className="mx-1 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-medium text-gray-900 dark:text-white line-clamp-1">
                        {theme.title}
                      </p>
                      {theme.urgency_score && (
                        <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          theme.urgency_score > 0.7 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          theme.urgency_score > 0.4 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {theme.urgency_score > 0.7 ? 'High' : theme.urgency_score > 0.4 ? 'Med' : 'Low'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{theme.feedback_count || 0} items</span>
                      {theme.total_arr > 0 && (
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          ${(theme.total_arr / 1000).toFixed(0)}K ARR
                        </span>
                      )}
                    </div>
                    {theme.citations && theme.citations.length > 0 && (
                      <div className="mt-1.5">
                        <CitationChip citations={theme.citations} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Feedback quotes section */}
        {feedback.length > 0 && (
          <div>
            <SectionHeader
              icon={<MessageSquare className="w-3 h-3" />}
              title="Top Quotes"
              count={feedback.length}
              expanded={sectionsOpen.feedback}
              onToggle={() => toggle('feedback')}
            />
            {sectionsOpen.feedback && (
              <div className="space-y-1 mt-1">
                {feedback.slice(0, 6).map((item: any) => (
                  <div
                    key={item.id}
                    className="mx-1 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                  >
                    <p className="text-xs text-gray-600 dark:text-gray-300 italic line-clamp-3">
                      "{item.content}"
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400">
                      {item.customer_name && <span className="font-medium">{item.customer_name}</span>}
                      {item.customer_segment && (
                        <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded">
                          {item.customer_segment}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Market Data section (external context) */}
        {marketData && (marketData.customer_pain_points?.length > 0 || marketData.market_trends?.length > 0) && (
          <div>
            <SectionHeader
              icon={<Lightbulb className="w-3 h-3" />}
              title="Market Data"
              count={(marketData.customer_pain_points?.length || 0) + (marketData.market_trends?.length || 0)}
              expanded={sectionsOpen.market}
              onToggle={() => toggle('market')}
            />
            {sectionsOpen.market && (
              <div className="space-y-1 mt-1">
                {/* Pain Points */}
                {marketData.customer_pain_points?.slice(0, 5).map((pain: any, i: number) => (
                  <div
                    key={i}
                    className="mx-1 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5 flex-shrink-0">•</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 dark:text-white line-clamp-2">
                          {pain.pain_point}
                        </p>
                        {pain.description && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                            {pain.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            pain.frequency === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            pain.frequency === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          }`}>
                            {pain.frequency || 'unknown'} frequency
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Market Trends */}
                {marketData.market_trends?.slice(0, 3).map((trend: any, i: number) => (
                  <div
                    key={i}
                    className="mx-1 px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30"
                  >
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-300">
                      {trend.trend}
                    </p>
                    {trend.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {trend.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Past decisions */}
        <div>
          <SectionHeader
            icon={<History className="w-3 h-3" />}
            title="Past Decisions"
            count={decisions.length}
            expanded={sectionsOpen.past}
            onToggle={() => toggle('past')}
          />
          {sectionsOpen.past && (
            <div className="space-y-1 mt-1">
              {decisions.length === 0 ? (
                <div className="mx-1 px-3 py-3 text-xs text-gray-400 dark:text-gray-500 italic">
                  No past decisions yet
                </div>
              ) : (
                decisions.slice(0, 10).map((decision: any) => (
                  <button
                    key={decision.id}
                    onClick={() => onDecisionClick?.(decision.id)}
                    className="w-full mx-1 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left"
                  >
                    <div className="text-xs font-medium text-gray-900 dark:text-white line-clamp-2 mb-1">
                      {decision.objective || 'Untitled Decision'}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      {decision.created_at && (
                        <span>{new Date(decision.created_at).toLocaleDateString()}</span>
                      )}
                      {(decision.use_internal_context || decision.use_external_context) && (
                        <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                          {decision.use_internal_context && decision.use_external_context
                            ? 'Internal + External'
                            : decision.use_internal_context
                            ? 'Internal'
                            : 'External'}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
