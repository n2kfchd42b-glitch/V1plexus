'use client'

import { formatDistanceToNow } from 'date-fns'
import { CheckCircle2, AlertCircle, Pause, RefreshCw, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { IntegrationConnection } from '@/types/database'

const PROVIDER_LABELS: Record<string, string> = {
  kobotoolbox: 'KoboToolbox',
  redcap: 'REDCap',
  odk_central: 'ODK Central',
  surveycto: 'SurveyCTO',
  commcare: 'CommCare',
  dhis2: 'DHIS2',
  zotero: 'Zotero',
  mendeley: 'Mendeley',
}

const PROVIDER_DOT: Record<string, string> = {
  kobotoolbox: 'bg-teal-500',
  redcap: 'bg-red-500',
  odk_central: 'bg-blue-500',
  surveycto: 'bg-purple-500',
  commcare: 'bg-orange-500',
  dhis2: 'bg-green-600',
  zotero: 'bg-orange-500',
  mendeley: 'bg-indigo-500',
}

interface ActiveConnectionsListProps {
  connections: IntegrationConnection[]
  onSyncNow?: (conn: IntegrationConnection) => void
  onSettings?: (conn: IntegrationConnection) => void
}

export function ActiveConnectionsList({ connections, onSyncNow, onSettings }: ActiveConnectionsListProps) {
  const active = connections.filter(c => c.status !== 'disconnected')

  if (active.length === 0) return null

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
          Active Connections ({active.length})
        </h3>
      </div>
      <div className="divide-y divide-gray-100">
        {active.map(conn => {
          const label = conn.display_name ?? conn.config?.dataset_name as string ?? PROVIDER_LABELS[conn.provider] ?? conn.provider
          const providerLabel = PROVIDER_LABELS[conn.provider] ?? conn.provider
          const dotClass = PROVIDER_DOT[conn.provider] ?? 'bg-gray-400'

          return (
            <div key={conn.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
              {/* Status indicator */}
              <div className="flex-shrink-0">
                {conn.status === 'active' && <div className={`h-2 w-2 rounded-full ${dotClass} ring-2 ring-offset-1 ring-opacity-30 ring-current`} />}
                {conn.status === 'paused' && <Pause className="h-3.5 w-3.5 text-amber-500" />}
                {conn.status === 'error' && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-gray-800 truncate">{providerLabel}</span>
                  <span className="text-gray-300">→</span>
                  <span className="text-sm text-gray-600 truncate">{label}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {conn.status === 'active' ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" />
                      {conn.last_sync_at
                        ? `Synced ${formatDistanceToNow(new Date(conn.last_sync_at), { addSuffix: true })}`
                        : 'Pending first sync'
                      }
                    </span>
                  ) : conn.status === 'error' ? (
                    <span className="text-xs text-red-600 truncate">{conn.error_log ?? 'Error'}</span>
                  ) : (
                    <span className="text-xs text-amber-600">Paused</span>
                  )}
                  <span className="text-xs text-gray-400 capitalize">{conn.sync_frequency}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {onSyncNow && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSyncNow(conn)}
                    className="h-6 w-6 p-0 text-gray-400 hover:text-gray-700"
                    title="Sync now"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                )}
                {onSettings && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSettings(conn)}
                    className="h-6 w-6 p-0 text-gray-400 hover:text-gray-700"
                    title="Settings"
                  >
                    <Settings className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
