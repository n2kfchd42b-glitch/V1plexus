'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CausalDAG, DAGEdge, AdjustmentSetResult } from '@/types/causal'

export function useCausalDAG(projectId: string, datasetId: string) {
  const supabase = createClient()
  const [dag, setDag] = useState<CausalDAG | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Subscribe to Realtime updates so the UI auto-updates when the background
  // PC algorithm task writes suggested_edges + status='suggested'
  useEffect(() => {
    if (!dag?.id) return
    const channel = supabase
      .channel(`causal_dag_${dag.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'causal_dags',
          filter: `id=eq.${dag.id}`,
        },
        (payload) => setDag(payload.new as CausalDAG)
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [dag?.id, supabase])

  const startDiscovery = useCallback(
    async (params: {
      versionId: string
      exposure: string
      outcome: string
      variableColumns: string[]
      alpha?: number
    }) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/causal/discover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, datasetId, ...params }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error ?? 'Failed to start causal discovery')
        }
        const { dagId } = await res.json()

        // Fetch the newly created record so the Realtime sub activates
        const { data: dagRecord } = await supabase
          .from('causal_dags')
          .select('*')
          .eq('id', dagId)
          .single()
        if (dagRecord) setDag(dagRecord as CausalDAG)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    },
    [projectId, datasetId, supabase]
  )

  const confirmDAG = useCallback(
    async (
      confirmedEdges: DAGEdge[],
      edgeDecisions: { from: string; to: string; action: string }[]
    ): Promise<AdjustmentSetResult | null> => {
      if (!dag) return null
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/causal/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dagId: dag.id,
            confirmedEdges,
            edgeDecisions,
            exposure: dag.exposure_variable,
            outcome: dag.outcome_variable,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error ?? 'Failed to confirm DAG')
        }
        const result = await res.json()
        return result as AdjustmentSetResult
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unknown error')
        return null
      } finally {
        setLoading(false)
      }
    },
    [dag]
  )

  const resetDAG = useCallback(() => {
    setDag(null)
    setError(null)
  }, [])

  return { dag, loading, error, startDiscovery, confirmDAG, resetDAG }
}
