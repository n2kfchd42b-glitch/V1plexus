'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CounterData {
  received: number
  pending: number
  flagged: number
  quality: number
}

interface SubmissionCounterProps {
  projectId: string
}

export function SubmissionCounter({ projectId }: SubmissionCounterProps) {
  const supabase = createClient()
  const [data, setData] = useState<CounterData>({ received: 0, pending: 0, flagged: 0, quality: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      // Get today's date
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Count quality issues for the project's datasets
      const { data: datasets } = await supabase
        .from('datasets')
        .select('id')
        .eq('project_id', projectId)
        .is('deleted_at', null)

      const datasetIds = (datasets ?? []).map((d: { id: string }) => d.id)

      let errorCount = 0
      let qualityScore = 100

      if (datasetIds.length > 0) {
        const { data: scores } = await supabase
          .from('data_quality_scores')
          .select('overall_score, errors_count')
          .in('dataset_id', datasetIds)
          .order('created_at', { ascending: false })
          .limit(datasetIds.length)

        if (scores?.length) {
          errorCount = scores.reduce((sum: number, s: { errors_count: number }) => sum + (s.errors_count ?? 0), 0)
          qualityScore = Math.round(scores.reduce((sum: number, s: { overall_score: number }) => sum + s.overall_score, 0) / scores.length)
        }
      }

      // Get sync totals for today from integration connections
      const { data: connections } = await supabase
        .from('integration_connections')
        .select('total_synced')
        .eq('project_id', projectId)
        .eq('status', 'active')

      const totalSynced = (connections ?? []).reduce((sum: number, c: { total_synced: number }) => sum + (c.total_synced ?? 0), 0)

      setData({
        received: totalSynced,
        pending: 0,
        flagged: errorCount,
        quality: qualityScore,
      })
      setLoading(false)
    }
    load()

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`field-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'data_quality_scores' }, load)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [projectId, supabase])

  const cards = [
    { label: 'received', value: data.received, color: 'text-blue-600' },
    { label: 'pending', value: data.pending, color: 'text-amber-500' },
    { label: 'flagged', value: data.flagged, color: 'text-red-500' },
    { label: 'quality', value: `${data.quality}%`, color: data.quality >= 90 ? 'text-emerald-600' : data.quality >= 70 ? 'text-amber-500' : 'text-red-500' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map(card => (
        <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center">
          <span className={`text-3xl font-bold ${card.color}`}>
            {loading ? '—' : card.value}
          </span>
          <span className="text-xs text-gray-500 mt-1">{card.label}</span>
        </div>
      ))}
    </div>
  )
}
