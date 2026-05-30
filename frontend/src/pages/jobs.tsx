/**
 * Job History
 * ───────────
 * Lists recent background jobs for the tenant with status, progress, and
 * actions. Failed/cancelled retryable jobs can be re-run (creates a new linked
 * job); pending/running jobs can be cancelled. Auto-refreshes while any job is
 * still in flight.
 */

import Head from 'next/head'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { Activity, RefreshCw, RotateCcw, XCircle } from 'lucide-react'
import { isAuthenticated, getCurrentUser } from '@/utils/auth'
import { api } from '@/services/api'
import Header from '@/components/Header'
import { PageContainer, PageHeader, Card, EmptyState, Loading } from '@/components/PageContainer'

interface Job {
  job_id: string
  job_type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  current_step?: string | null
  message?: string | null
  error?: string | null
  created_at?: string | null
  updated_at?: string | null
}

// Job types that the backend can actually re-dispatch today.
const RETRYABLE_TYPES = new Set(['PROJECT_GENERATION'])

const STATUS_STYLES: Record<Job['status'], string> = {
  completed: 'bg-chart-3/15 text-chart-3',
  failed: 'bg-destructive/10 text-destructive',
  running: 'bg-primary/10 text-primary',
  pending: 'bg-muted text-muted-foreground',
  cancelled: 'bg-muted text-muted-foreground',
}

function prettyType(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function JobsPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ full_name?: string; email?: string } | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadJobs = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    try {
      const res = await api.listJobs({ limit: 50 })
      setJobs(res.data || [])
    } catch (e) {
      console.error('Failed to load jobs', e)
    } finally {
      setLoading(false)
      if (showSpinner) setRefreshing(false)
    }
  }, [])

  // Auth guard + initial load
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    setUser(getCurrentUser())
    loadJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-refresh every 5s while any job is pending/running.
  const hasActive = jobs.some((j) => j.status === 'pending' || j.status === 'running')
  useEffect(() => {
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(() => loadJobs(), 5000)
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [hasActive, loadJobs])

  const handleRetry = async (jobId: string) => {
    setBusyId(jobId)
    try {
      await api.retryJob(jobId)
      await loadJobs(true)
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Failed to retry job')
    } finally {
      setBusyId(null)
    }
  }

  const handleCancel = async (jobId: string) => {
    setBusyId(jobId)
    try {
      await api.cancelJob(jobId)
      await loadJobs(true)
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Failed to cancel job')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <Head><title>Job History · Evols</title></Head>
      <div className="min-h-screen bg-background">
        <Header user={user} currentPage="jobs" />

        <PageContainer>
          <PageHeader
            title="Job History"
            icon={Activity}
            subtitle="Background jobs for your team — generation, refresh, and exports."
            action={{
              label: refreshing ? 'Refreshing…' : 'Refresh',
              onClick: () => loadJobs(true),
              icon: RefreshCw,
            }}
          />

          {loading ? (
            <Loading text="Loading jobs…" />
          ) : jobs.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No jobs yet"
              description="Background jobs you start (like project generation) will show up here with live progress and status."
            />
          ) : (
            <Card padding="none" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Progress</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {jobs.map((job) => {
                      const canRetry =
                        (job.status === 'failed' || job.status === 'cancelled') &&
                        RETRYABLE_TYPES.has(job.job_type)
                      const canCancel = job.status === 'pending' || job.status === 'running'
                      const isBusy = busyId === job.job_id
                      return (
                        <tr key={job.job_id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-foreground">{prettyType(job.job_type)}</div>
                            {(job.message || job.error) && (
                              <div className={`text-xs mt-0.5 max-w-md truncate ${job.error ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {job.error || job.message}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-xs rounded-full font-medium capitalize ${STATUS_STYLES[job.status]}`}>
                              {job.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 w-40">
                            {job.status === 'running' || (job.progress > 0 && job.progress < 1) ? (
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full transition-[width] duration-500"
                                    style={{ width: `${Math.round((job.progress || 0) * 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {Math.round((job.progress || 0) * 100)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {job.status === 'completed' ? '100%' : '—'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(job.created_at)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {canRetry && (
                                <button
                                  onClick={() => handleRetry(job.job_id)}
                                  disabled={isBusy}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Retry
                                </button>
                              )}
                              {canCancel && (
                                <button
                                  onClick={() => handleCancel(job.job_id)}
                                  disabled={isBusy}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Cancel
                                </button>
                              )}
                              {!canRetry && !canCancel && (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </PageContainer>
      </div>
    </>
  )
}
