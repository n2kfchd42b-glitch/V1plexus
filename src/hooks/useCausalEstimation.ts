'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  EstimationResult, EValueResult, NarrativeResult,
} from '@/types/causalEstimation'

export function useCausalEstimation(dagId: string | null) {
  const supabase = createClient()
  const [results, setResults] = useState<EstimationResult[]>([])
  const [evalue, setEvalue] = useState<EValueResult | null>(null)
  const [narrative, setNarrative] = useState<NarrativeResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Realtime subscription — updates per-method rows as background tasks complete
  useEffect(() => {
    if (!dagId) return
    const channel = supabase
      .channel(`causal_estimation_${dagId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'causal_estimation_results',
          filter: `dag_id=eq.${dagId}`,
        },
        (payload) => {
          const updated = payload.new as EstimationResult
          setResults((prev) => {
            const idx = prev.findIndex((r) => r.method === updated.method)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = updated
              return next
            }
            return [...prev, updated]
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [dagId, supabase])

  const startEstimation = useCallback(
    async (datasetId: string, versionId: string) => {
      if (!dagId) return
      setLoading(true)
      setError(null)
      setResults([])
      setEvalue(null)
      setNarrative(null)
      try {
        const res = await fetch('/api/causal/estimate/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dagId, datasetId, versionId }),
        })
        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.error ?? 'Failed to start estimation')
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    },
    [dagId]
  )

  const computeEvalue = useCallback(
    async (ate: number, ciLower: number | null, ciUpper: number | null, baselineRisk = 0.3) => {
      if (!dagId) return
      setLoading(true)
      setError(null)
      try {
        const drResult = results.find((r) => r.method === 'doubly_robust')
        const res = await fetch('/api/causal/estimate/evalue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dagId,
            estimationId: drResult?.id ?? null,
            ate,
            ciLower,
            ciUpper,
            baselineRisk,
          }),
        })
        if (!res.ok) throw new Error('Failed to compute E-value')
        setEvalue(await res.json())
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    },
    [dagId, results]
  )

  const generateNarrative = useCallback(async () => {
    if (!dagId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/causal/estimate/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dagId }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to generate narrative')
      }
      setNarrative(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [dagId])

  const pushNarrativeToDocument = useCallback(
    async (narrativeId: string, documentId: string) => {
      if (!dagId) return false
      setLoading(true)
      try {
        const res = await fetch('/api/causal/estimate/narrative', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ narrativeId, documentId, dagId }),
        })
        if (!res.ok) throw new Error('Failed to push narrative')
        setNarrative((prev) =>
          prev ? { ...prev, narrative_components: { ...prev.narrative_components } } : prev
        )
        return true
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unknown error')
        return false
      } finally {
        setLoading(false)
      }
    },
    [dagId]
  )

  const allComplete = results.length === 3 && results.every((r) => r.status === 'complete')
  const anyFailed = results.some((r) => r.status === 'failed')
  const isRunning = results.some((r) => r.status === 'running' || r.status === 'pending')
  const drResult = results.find((r) => r.method === 'doubly_robust') ?? null

  return {
    results,
    drResult,
    evalue,
    narrative,
    loading,
    error,
    allComplete,
    anyFailed,
    isRunning,
    startEstimation,
    computeEvalue,
    generateNarrative,
    pushNarrativeToDocument,
  }
}
