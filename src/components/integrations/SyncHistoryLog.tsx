'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, RefreshCw, Webhook } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { SyncLog } from '@/types/database'

interface SyncHistoryLogProps {
  connectionId: string
}

export function SyncHistoryLog({ connectionId }: SyncHistoryLogProps) {
  const supabase = createClient()
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('sync_log')
        .select('*')
        .eq('connection_id', connectionId)
        .order('started_at', { ascending: false })
        .limit(20)
      setLogs((data ?? []) as SyncLog[])
      setLoading(false)
    }
    load()
  }, [connectionId, supabase])

  if (loading) return <div className="text-sm text-gray-400 py-4 text-center">Loading…</div>
  if (!logs.length) return <div className="text-sm text-gray-400 py-4 text-center">No sync history yet.</div>

  const typeIcon = (t: string) =>
    t === 'webhook' ? <Webhook className="h-3.5 w-3.5 text-purple-500" /> :
    t === 'manual' ? <RefreshCw className="h-3.5 w-3.5 text-blue-500" /> :
    <RefreshCw className="h-3.5 w-3.5 text-gray-400" />

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead>
          <tr className="text-gray-400 border-b border-gray-100">
            <th className="pb-2 font-medium pr-4">When</th>
            <th className="pb-2 font-medium pr-4">Type</th>
            <th className="pb-2 font-medium pr-4">New</th>
            <th className="pb-2 font-medium pr-4">Updated</th>
            <th className="pb-2 font-medium pr-4">Issues</th>
            <th className="pb-2 font-medium pr-4">Duration</th>
            <th className="pb-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2 pr-4 text-gray-500">
                {formatDistanceToNow(new Date(log.started_at), { addSuffix: true })}
              </td>
              <td className="py-2 pr-4">
                <span className="flex items-center gap-1">
                  {typeIcon(log.sync_type)}
                  <span className="capitalize">{log.sync_type}</span>
                </span>
              </td>
              <td className="py-2 pr-4 font-medium text-emerald-600">+{log.records_new}</td>
              <td className="py-2 pr-4 text-blue-600">~{log.records_updated}</td>
              <td className="py-2 pr-4 text-amber-600">{log.quality_issues}</td>
              <td className="py-2 pr-4 text-gray-500">
                {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '—'}
              </td>
              <td className="py-2">
                {log.status === 'completed' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
