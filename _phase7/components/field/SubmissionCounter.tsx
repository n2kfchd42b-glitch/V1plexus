'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CounterData {
  received: number
  pending: number
}

interface SubmissionCounterProps {
  projectId: string
}

export function SubmissionCounter({ projectId }: SubmissionCounterProps) {
  const supabase = createClient()
  const [data, setData] = useState<CounterData>({ received: 0, pending: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: connections } = await supabase
        .from('integration_connections')
        .select('total_synced')
        .eq('project_id', projectId)
        .eq('status', 'active')

      const totalSynced = (connections ?? []).reduce(
        (sum: number, c: { total_synced: number }) => sum + (c.total_synced ?? 0), 0
      )

      setData({ received: totalSynced, pending: 0 })
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel(`field-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'integration_connections' }, load)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [projectId, supabase])

  const cards = [
    { label: 'received', value: data.received, color: 'text-blue-600' },
    { label: 'pending', value: data.pending, color: 'text-amber-500' },
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
