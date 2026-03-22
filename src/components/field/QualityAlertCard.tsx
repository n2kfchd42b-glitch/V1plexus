'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { DataQualityResult } from '@/types/database'

export function QualityAlertCard({ projectId }: { projectId: string }) {
  const supabase = createClient()
  const [alerts, setAlerts] = useState<DataQualityResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: datasets } = await supabase
        .from('datasets')
        .select('id')
        .eq('project_id', projectId)
        .is('deleted_at', null)

      const ids = (datasets ?? []).map((d: { id: string }) => d.id)
      if (!ids.length) { setLoading(false); return }

      const { data } = await supabase
        .from('data_quality_results')
        .select('*, rule:data_quality_rules(name, severity, column_name)')
        .in('dataset_id', ids)
        .eq('status', 'active')
        .gt('violations_count', 0)
        .order('created_at', { ascending: false })
        .limit(5)

      setAlerts((data ?? []) as DataQualityResult[])
      setLoading(false)
    }
    load()
  }, [projectId, supabase])

  if (loading) return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-400">Loading alerts…</div>
  )

  if (!alerts.length) return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700 flex items-center gap-2">
      <span className="text-lg">✓</span> No quality alerts — data looks good!
    </div>
  )

  return (
    <div className="space-y-2">
      {alerts.map(alert => (
        <div key={alert.id} className="bg-white border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800">
                <span className="font-medium">{alert.violations_count} entries</span> with {alert.rule?.name}
              </p>
              <Link
                href={`/projects/${projectId}/data`}
                className="text-xs text-blue-600 hover:underline mt-1 inline-block"
              >
                Review →
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
