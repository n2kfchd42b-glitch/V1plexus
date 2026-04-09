'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DataPortrait } from '@/types/analyticsIntelligence'

export function useDataPortrait(datasetId: string | null, projectId: string | null, versionId: string | null) {
  const [portrait, setPortrait] = useState<DataPortrait | null>(null)
  const [loading, setLoading] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchPortrait = useCallback(async () => {
    if (!datasetId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics/portrait/${datasetId}`)
      const json = await res.json()
      setPortrait(json.portrait ?? null)
    } catch {
      setError('Failed to load data portrait')
    } finally {
      setLoading(false)
    }
  }, [datasetId])

  const triggerPortrait = useCallback(async () => {
    if (!datasetId || !projectId || !versionId) return
    setTriggering(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/portrait/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetId, projectId, versionId }),
      })
      if (!res.ok) throw new Error('Trigger failed')
      const json = await res.json()
      setPortrait(prev => prev ? { ...prev, status: 'running' } : { id: json.portrait_id, status: 'running', dataset_id: datasetId, project_id: projectId, variable_profiles: [], imputation_recommendations: [], analysis_recommendations: [] } as unknown as DataPortrait)
    } catch {
      setError('Failed to trigger portrait generation')
    } finally {
      setTriggering(false)
    }
  }, [datasetId, projectId, versionId])

  // Subscribe to realtime updates on portrait status
  useEffect(() => {
    if (!datasetId) return
    fetchPortrait()

    const channel = supabase
      .channel(`portrait:${datasetId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dataset_portraits',
        filter: `dataset_id=eq.${datasetId}`,
      }, (payload) => {
        if (payload.new && typeof payload.new === 'object') {
          const updated = payload.new as DataPortrait
          if (updated.status === 'complete') {
            // Fetch full portrait (realtime payload may not include all columns)
            fetchPortrait()
          } else {
            setPortrait(updated)
          }
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [datasetId, fetchPortrait])

  return { portrait, loading, triggering, error, triggerPortrait, refetch: fetchPortrait }
}
