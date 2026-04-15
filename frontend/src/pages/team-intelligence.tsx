/**
 * Team Intelligence Dashboard
 * Token savings summary, knowledge graph feed, team activity
 */

import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
  Coins, BookOpen, Users, TrendingUp, Clock,
  Tag, ChevronRight, RefreshCw, BarChart3
} from 'lucide-react'
import { isAuthenticated } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card, StatCard, EmptyState, Loading } from '@/components/PageContainer'

// ── Types ──────────────────────────────────────────────────────────────────

interface QuotaSummary {
  period_days: number
  sessions: number
  tokens_used: number
  tokens_retrieved: number
  tokens_saved_estimate: number
  quota_extended_pct: number
  rate_limit_hits: number
  knowledge_entries_total: number
  knowledge_entries_new: number
}

interface KnowledgeEntry {
  id: number
  title: string
  role: string
  session_type: string
  entry_type: string
  tags: string[] | null
  product_area: string | null
  token_count: number | null
  created_at: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatCost(tokens: number): string {
  // ~$3 per 1M tokens (blended Claude estimate)
  const dollars = (tokens / 1_000_000) * 3
  if (dollars < 0.01) return '<$0.01'
  return `$${dollars.toFixed(2)}`
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

const ROLE_COLORS: Record<string, string> = {
  engineer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  pm: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  designer: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  qa: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  insight: 'Insight',
  decision: 'Decision',
  artifact: 'Artifact',
  research_finding: 'Research',
  pattern: 'Pattern',
  context: 'Context',
}

// ── Sub-components ─────────────────────────────────────────────────────────

function EntryCard({ entry, onClick }: { entry: KnowledgeEntry; onClick: () => void }) {
  const roleColor = ROLE_COLORS[entry.role] || ROLE_COLORS.other
  const typeLabel = ENTRY_TYPE_LABELS[entry.entry_type] || entry.entry_type

  return (
    <Card hover onClick={onClick} padding="sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColor}`}>
              {entry.role}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{typeLabel}</span>
            {entry.product_area && (
              <span className="text-xs text-gray-400 dark:text-gray-500">· {entry.product_area}</span>
            )}
          </div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-white leading-snug mb-1.5">
            {entry.title}
          </h4>
          {entry.tags && entry.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <Tag className="w-3 h-3 text-gray-400" />
              {entry.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-xs text-gray-500 dark:text-gray-400">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(entry.created_at)}</span>
          {entry.token_count && (
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
              {formatTokens(entry.token_count)} tok
            </span>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
        </div>
      </div>
    </Card>
  )
}

function EntryDetailModal({ entry, onClose }: { entry: KnowledgeEntry & { content?: string; retrieval_count?: number; last_retrieved_at?: string | null }; onClose: () => void }) {
  const roleColor = ROLE_COLORS[entry.role] || ROLE_COLORS.other

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColor}`}>
                {entry.role}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {ENTRY_TYPE_LABELS[entry.entry_type] || entry.entry_type}
              </span>
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{entry.title}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {timeAgo(entry.created_at)}
              {entry.token_count && ` · ${formatTokens(entry.token_count)} tokens`}
              {entry.retrieval_count !== undefined && ` · retrieved ${entry.retrieval_count}×`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {entry.content ? (
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {entry.content}
            </p>
          ) : (
            <p className="text-sm text-gray-400 italic">Loading content...</p>
          )}
          {entry.tags && entry.tags.length > 0 && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <Tag className="w-3.5 h-3.5 text-gray-400" />
              {entry.tags.map(tag => (
                <span key={tag} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function TeamIntelligence() {
  const router = useRouter()
  const [user, setUser] = useState<{ full_name?: string; email?: string } | null>(null)
  const [days, setDays] = useState(7)

  const [summary, setSummary] = useState<QuotaSummary | null>(null)
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [selectedEntry, setSelectedEntry] = useState<(KnowledgeEntry & { content?: string; retrieval_count?: number }) | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return }
    const stored = localStorage.getItem('user')
    if (stored) setUser(JSON.parse(stored))
    loadData()
  }, [days])

  async function loadData() {
    setLoadingSummary(true)
    setLoadingEntries(true)
    try {
      const [sumData, entData] = await Promise.all([
        api.get(`/team-knowledge/quota/summary?days=${days}`),
        api.get('/team-knowledge/entries?limit=50'),
      ])
      setSummary(sumData.data)
      setEntries(entData.data)
    } catch (e) {
      console.error('Failed to load team intelligence data', e)
    } finally {
      setLoadingSummary(false)
      setLoadingEntries(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  async function handleEntryClick(entry: KnowledgeEntry) {
    setSelectedEntry(entry)
    try {
      const detail = await api.get(`/team-knowledge/entries/${entry.id}`)
      setSelectedEntry(detail.data)
    } catch {
      // leave preview open with what we have
    }
  }

  return (
    <>
      <Head><title>Team Intelligence — Evols</title></Head>
      <div className="min-h-screen" style={{ background: 'hsl(var(--background))' }}>
        <Header user={user} currentPage="team-intelligence" />
        <PageContainer>
          <PageHeader
            title="Team Intelligence"
            description="Token savings, shared knowledge, and team activity across Claude Code sessions"
            icon={BarChart3}
            action={
              <div className="flex items-center gap-3">
                <select
                  value={days}
                  onChange={e => setDays(Number(e.target.value))}
                  className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value={7}>Last 7 days</option>
                  <option value={14}>Last 14 days</option>
                  <option value={30}>Last 30 days</option>
                </select>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="btn-secondary flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            }
          />

          {/* ── Section A: Token Savings Summary ── */}
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
              Token Savings — Last {days} days
            </h2>
            {loadingSummary ? (
              <Loading text="Loading summary..." />
            ) : summary ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard
                  title="Sessions"
                  value={summary.sessions}
                  subtitle="tracked"
                  icon={<Clock className="w-5 h-5" />}
                  color="blue"
                />
                <StatCard
                  title="Tokens Saved"
                  value={formatTokens(summary.tokens_saved_estimate)}
                  subtitle="vs. compiling fresh"
                  icon={<TrendingUp className="w-5 h-5" />}
                  color="green"
                />
                <StatCard
                  title="Cost Avoided"
                  value={formatCost(summary.tokens_saved_estimate)}
                  subtitle="est. at $3/1M tok"
                  icon={<Coins className="w-5 h-5" />}
                  color="green"
                />
                <StatCard
                  title="Quota Extended"
                  value={`${summary.quota_extended_pct}%`}
                  subtitle="effective capacity gain"
                  icon={<TrendingUp className="w-5 h-5" />}
                  color="purple"
                />
                <StatCard
                  title="Knowledge Entries"
                  value={summary.knowledge_entries_total}
                  subtitle={`+${summary.knowledge_entries_new} this period`}
                  icon={<BookOpen className="w-5 h-5" />}
                  color="orange"
                />
                <StatCard
                  title="Rate Limit Hits"
                  value={summary.rate_limit_hits}
                  subtitle="avoided via reuse"
                  icon={<Users className="w-5 h-5" />}
                  color={summary.rate_limit_hits > 0 ? 'red' : 'blue'}
                />
              </div>
            ) : (
              <Card>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No session data yet. Start a Claude Code session with the Evols plugin to begin tracking.
                </p>
              </Card>
            )}
          </section>

          {/* ── Section B: Knowledge Graph Feed ── */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Knowledge Graph — {entries.length} entries
              </h2>
            </div>
            {loadingEntries ? (
              <Loading text="Loading knowledge entries..." />
            ) : entries.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No knowledge entries yet"
                description="Complete a Claude Code session with the Evols plugin — the Stop hook will auto-sync your session knowledge into the team graph."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {entries.map(entry => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    onClick={() => handleEntryClick(entry)}
                  />
                ))}
              </div>
            )}
          </section>

        </PageContainer>
      </div>

      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </>
  )
}
