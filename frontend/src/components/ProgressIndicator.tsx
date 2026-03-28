/**
 * ProgressIndicator
 * Shows live progress for long-running AI operations.
 * Polled from /api/v1/jobs/:id so the PM always knows what's happening.
 */

import { useEffect, useState, useRef } from 'react'
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react'

export interface JobProgress {
  job_id: string
  job_type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number          // 0.0 – 1.0
  current_step?: string
  total_steps?: number
  message?: string
  result?: any
  error?: string
}

interface ProgressIndicatorProps {
  job?: JobProgress | null
  onComplete?: (result: any) => void
  onError?: (error: string) => void
  /** Poll interval in ms (default 1500) */
  pollInterval?: number
  /** If provided, the component will poll this URL instead of using `job` prop */
  pollUrl?: string
  className?: string
}

const STEP_LABELS: Record<string, string> = {
  clustering: 'Clustering feedback',
  theme_generation: 'Generating themes',
  persona_generation: 'Building personas',
  decision_generation: 'Generating decision options',
  narrative_generation: 'Writing product narrative',
  data_ingestion: 'Ingesting data',
  export: 'Exporting',
}

export default function ProgressIndicator({
  job: initialJob,
  onComplete,
  onError,
  pollInterval = 1500,
  pollUrl,
  className = '',
}: ProgressIndicatorProps) {
  const [job, setJob] = useState<JobProgress | null>(initialJob || null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Poll when pollUrl is provided
  useEffect(() => {
    if (!pollUrl) return
    const poll = async () => {
      try {
        const res = await fetch(pollUrl, { credentials: 'include' })
        if (!res.ok) return
        const data: JobProgress = await res.json()
        setJob(data)
        if (data.status === 'completed') {
          onComplete?.(data.result)
          return
        }
        if (data.status === 'failed') {
          onError?.(data.error || 'Unknown error')
          return
        }
        timerRef.current = setTimeout(poll, pollInterval)
      } catch (_) {
        timerRef.current = setTimeout(poll, pollInterval * 2)
      }
    }
    poll()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [pollUrl])

  // Sync external job prop
  useEffect(() => {
    if (initialJob) setJob(initialJob)
  }, [initialJob])

  if (!job) return null

  const pct = Math.round(job.progress * 100)
  const isComplete = job.status === 'completed'
  const isFailed = job.status === 'failed'
  const isRunning = job.status === 'running' || job.status === 'pending'

  const label = STEP_LABELS[job.job_type] || job.job_type?.replace(/_/g, ' ')

  return (
    <div className={`rounded-xl border p-4 ${
      isComplete ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20' :
      isFailed   ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20' :
      'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
    } ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        {isComplete ? (
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
        ) : isFailed ? (
          <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
        ) : (
          <Loader2 className="w-4 h-4 text-blue-600 flex-shrink-0 animate-spin" />
        )}
        <span className="text-sm text-gray-800 dark:text-gray-200 capitalize">
          {label}
        </span>
        <span className={`ml-auto text-sm ${
          isComplete ? 'text-green-600' : isFailed ? 'text-red-600' : 'text-blue-600'
        }`}>
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-2">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${
            isComplete ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-blue-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Step message */}
      {job.message && (
        <p className="text-xs text-gray-600 dark:text-gray-400">{job.message}</p>
      )}

      {/* Error */}
      {isFailed && job.error && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{job.error}</p>
      )}
    </div>
  )
}

/**
 * Inline spinner variant for smaller contexts
 */
export function InlineSpinner({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
      <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
      {message && <span>{message}</span>}
    </div>
  )
}

/**
 * Multi-step progress timeline (for onboarding flows)
 */
interface Step { label: string; status: 'pending' | 'running' | 'done' | 'error' }

export function StepTimeline({ steps }: { steps: Step[] }) {
  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
            step.status === 'done'    ? 'bg-green-500' :
            step.status === 'running' ? 'bg-blue-500' :
            step.status === 'error'   ? 'bg-red-500' :
            'bg-gray-200 dark:bg-gray-700'
          }`}>
            {step.status === 'done' && <CheckCircle className="w-4 h-4 text-white" />}
            {step.status === 'running' && <Loader2 className="w-4 h-4 text-white animate-spin" />}
            {step.status === 'error' && <XCircle className="w-4 h-4 text-white" />}
            {step.status === 'pending' && <Clock className="w-3 h-3 text-gray-400" />}
          </div>
          <span className={`text-sm ${
            step.status === 'running' ? 'text-blue-600 dark:text-blue-400 font-medium' :
            step.status === 'done'    ? 'text-green-600 dark:text-green-400' :
            step.status === 'error'   ? 'text-red-600 dark:text-red-400' :
            'text-gray-400 dark:text-gray-500'
          }`}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  )
}
