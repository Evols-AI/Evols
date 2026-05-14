import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { ShieldCheck, AlertCircle, RefreshCw, CheckCircle, XCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { isAuthenticated, getCurrentUser } from '@/utils/auth'
import Header from '@/components/Header'
import { Loading } from '@/components/PageContainer'

interface AuthLogEntry {
  id: number
  email: string
  user_id: number | null
  method: string
  success: boolean
  failure_reason: string | null
  ip_address: string | null
  user_agent: string | null
  timestamp: string
}

const METHOD_LABELS: Record<string, string> = {
  email: 'Email',
  google: 'Google',
  github: 'GitHub',
  password_reset: 'Reset',
}

const METHOD_COLORS: Record<string, string> = {
  email: 'bg-chart-2/15 text-chart-2',
  google: 'bg-chart-4/15 text-chart-4',
  github: 'bg-muted text-muted-foreground',
  password_reset: 'bg-chart-5/15 text-chart-5',
}

const PAGE_SIZE = 100

export default function AuthLogsAdmin() {
  const router = useRouter()
  const [logs, setLogs] = useState<AuthLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [user, setUser] = useState<any>(null)
  const [emailFilter, setEmailFilter] = useState('')
  const [successFilter, setSuccessFilter] = useState<'all' | 'success' | 'failure'>('all')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const loadLogs = useCallback(async (pageNum: number, email: string, success: 'all' | 'success' | 'failure') => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE + 1),
        offset: String(pageNum * PAGE_SIZE),
      })
      if (email.trim()) params.set('email', email.trim())
      if (success === 'success') params.set('success', 'true')
      if (success === 'failure') params.set('success', 'false')

      const response = await fetch(`${apiUrl}/api/v1/admin/auth-logs?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) throw new Error('Failed to load auth logs')

      const data: AuthLogEntry[] = await response.json()
      setHasMore(data.length > PAGE_SIZE)
      setLogs(data.slice(0, PAGE_SIZE))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
      return
    }
    const userData = getCurrentUser()
    setUser(userData)
    if (userData?.role !== 'SUPER_ADMIN') {
      setError('Access denied. This page is only for SUPER_ADMIN users.')
      setLoading(false)
      return
    }
    loadLogs(0, '', 'all')
  }, [router, loadLogs])

  const handleSearch = () => {
    setPage(0)
    loadLogs(0, emailFilter, successFilter)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleFilterChange = (val: 'all' | 'success' | 'failure') => {
    setSuccessFilter(val)
    setPage(0)
    loadLogs(0, emailFilter, val)
  }

  const handlePageChange = (delta: number) => {
    const next = page + delta
    setPage(next)
    loadLogs(next, emailFilter, successFilter)
  }

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts)
    return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
  }

  if (!loading && error && user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="max-w-md p-6 bg-card rounded-lg shadow-lg">
          <div className="flex items-center gap-3 text-destructive mb-4">
            <AlertCircle className="w-6 h-6" />
            <h2 className="text-xl">Access Denied</h2>
          </div>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-lg hover:bg-primary/85"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Auth Logs - Evols</title>
      </Head>

      <Header user={user} currentPage="auth-logs" />

      <div className="min-h-screen bg-muted/30 py-8">
        <div className="container mx-auto px-6">
          {/* Page header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl text-foreground mb-1">Auth Audit Logs</h1>
              <p className="text-muted-foreground text-sm">All authentication attempts — email, Google, GitHub</p>
            </div>
            <button
              onClick={() => loadLogs(page, emailFilter, successFilter)}
              className="flex items-center gap-2 bg-muted text-muted-foreground px-3 py-2 rounded-lg hover:bg-muted/70 text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {/* Filters */}
          <div className="bg-card rounded-lg border border-border p-4 mb-4 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-48">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                placeholder="Filter by email..."
                value={emailFilter}
                onChange={e => setEmailFilter(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>

            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              {(['all', 'success', 'failure'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => handleFilterChange(opt)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    successFilter === opt
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>

            <button
              onClick={handleSearch}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:bg-primary/85"
            >
              Search
            </button>
          </div>

          {/* Table */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loading text="Loading auth logs..." />
              </div>
            ) : error ? (
              <div className="flex items-center gap-3 text-destructive p-6">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-16">
                <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No auth logs found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Email</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Method</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">IP Address</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Date / Time (UTC)</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Failure Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          {log.success ? (
                            <span className="flex items-center gap-1.5 text-chart-3">
                              <CheckCircle className="w-4 h-4" />
                              <span className="text-xs font-medium">Success</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-destructive">
                              <XCircle className="w-4 h-4" />
                              <span className="text-xs font-medium">Failed</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-foreground font-mono text-xs">{log.email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${METHOD_COLORS[log.method] ?? 'bg-muted text-muted-foreground'}`}>
                            {METHOD_LABELS[log.method] ?? log.method}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{log.ip_address ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs whitespace-nowrap">{formatTimestamp(log.timestamp)}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{log.failure_reason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {!loading && logs.length > 0 && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>
                Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + logs.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(-1)}
                  disabled={page === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/70 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>
                <span className="px-2">Page {page + 1}</span>
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={!hasMore}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/70 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
