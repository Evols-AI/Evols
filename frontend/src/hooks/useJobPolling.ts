/**
 * useJobPolling Hook
 * Polls a background job until completion
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/services/api'

export interface JobStatus {
  job_id: string
  job_type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  current_step?: string
  message?: string
  result?: any
  error?: string
  created_at?: string
  updated_at?: string
}

export interface UseJobPollingOptions {
  jobId: string | null
  onComplete?: (result: any) => void
  onError?: (error: string) => void
  pollInterval?: number
}

export function useJobPolling({
  jobId,
  onComplete,
  onError,
  pollInterval = 2000,
}: UseJobPollingOptions) {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsPolling(false)
  }, [])

  const pollJob = useCallback(async () => {
    if (!jobId) return

    try {
      const response = await api.getJob(jobId)
      const status: JobStatus = response.data

      setJobStatus(status)

      // Check if job is complete
      if (status.status === 'completed') {
        stopPolling()
        if (onComplete) {
          onComplete(status.result)
        }
      } else if (status.status === 'failed') {
        stopPolling()
        if (onError) {
          onError(status.error || 'Job failed with unknown error')
        }
      } else if (status.status === 'cancelled') {
        stopPolling()
      }
    } catch (error: any) {
      console.error('Error polling job:', error)
      stopPolling()
      if (onError) {
        onError(error.response?.data?.detail || error.message || 'Failed to check job status')
      }
    }
  }, [jobId, onComplete, onError, stopPolling])

  // Start polling when jobId changes
  useEffect(() => {
    if (jobId && !intervalRef.current) {
      setIsPolling(true)
      // Poll immediately
      pollJob()
      // Then poll at interval
      intervalRef.current = setInterval(pollJob, pollInterval)
    }

    // Cleanup on unmount or when jobId changes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [jobId, pollJob, pollInterval])

  return {
    jobStatus,
    isPolling,
    stopPolling,
  }
}
