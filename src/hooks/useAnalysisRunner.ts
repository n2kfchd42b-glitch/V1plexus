'use client'

import { useState, useCallback } from 'react'
import { useOnlineStatus } from './useOnlineStatus'
import { queueAnalysis } from '@/lib/offline/analysisQueue'

export type AnalysisRunState = 'idle' | 'running' | 'queued' | 'completed' | 'failed'

export type AnalysisRunResult = {
  state: AnalysisRunState
  run_id: string | null
  job_id: string | null
  error: string | null
  queued: boolean
}

export function useAnalysisRunner(opts: {
  project_id: string
  dataset_id: string
  version_id: string
  created_by: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runAnalysisFn: (payload: any) => Promise<{ run_id: string } | null>
}) {
  const { isOnline } = useOnlineStatus()
  const [state, setState] = useState<AnalysisRunState>('idle')
  const [result, setResult] = useState<AnalysisRunResult>({
    state: 'idle',
    run_id: null,
    job_id: null,
    error: null,
    queued: false,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runAnalysis = useCallback(async (analysisConfig: any) => {
    setState('running')

    if (isOnline) {
      try {
        const res = await opts.runAnalysisFn(analysisConfig)
        const next: AnalysisRunResult = {
          state: 'completed',
          run_id: res?.run_id ?? null,
          job_id: null,
          error: null,
          queued: false,
        }
        setState('completed')
        setResult(next)
        return next
      } catch (err) {
        const job_id = await queueAnalysis({
          project_id: opts.project_id,
          dataset_id: opts.dataset_id,
          version_id: opts.version_id,
          analysis_type: analysisConfig.analysis_type,
          payload: analysisConfig,
          created_by: opts.created_by,
        })
        const next: AnalysisRunResult = {
          state: 'queued',
          run_id: null,
          job_id,
          error: String(err),
          queued: true,
        }
        setState('queued')
        setResult(next)
        return next
      }
    }

    // Offline — queue
    const job_id = await queueAnalysis({
      project_id: opts.project_id,
      dataset_id: opts.dataset_id,
      version_id: opts.version_id,
      analysis_type: analysisConfig.analysis_type,
      payload: analysisConfig,
      created_by: opts.created_by,
    })
    const next: AnalysisRunResult = {
      state: 'queued',
      run_id: null,
      job_id,
      error: null,
      queued: true,
    }
    setState('queued')
    setResult(next)
    return next
  }, [isOnline, opts])

  const reset = useCallback(() => {
    setState('idle')
    setResult({ state: 'idle', run_id: null, job_id: null, error: null, queued: false })
  }, [])

  return { state, result, runAnalysis, reset }
}
