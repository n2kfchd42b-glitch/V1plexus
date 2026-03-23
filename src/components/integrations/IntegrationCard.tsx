'use client'

import { useState } from 'react'
import { RefreshCw, Pause, Play, Settings, Unplug, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { IntegrationConnection } from '@/types/database'

const PROVIDER_LABELS: Record<string, string> = {
  kobotoolbox: 'KoboToolbox',
  redcap: 'REDCap',
  odk_central: 'ODK Central',
  surveycto: 'SurveyCTO',
  commcare: 'CommCare',
  dhis2: 'DHIS2',
}

const PROVIDER_COLORS: Record<string, string> = {
  kobotoolbox: 'bg-teal-100 text-teal-700 border-teal-200',
  redcap: 'bg-red-100 text-red-700 border-red-200',
  odk_central: 'bg-blue-100 text-blue-700 border-blue-200',
  surveycto: 'bg-purple-100 text-purple-700 border-purple-200',
  commcare: 'bg-orange-100 text-orange-700 border-orange-200',
  dhis2: 'bg-green-100 text-green-700 border-green-200',
}

interface IntegrationCardProps {
  connection: IntegrationConnection
  onUpdated: () => void
  onSettings: () => void
}

export function IntegrationCard({ connection, onUpdated, onSettings }: IntegrationCardProps) {
  const supabase = createClient()
  const [syncing, setSyncing] = useState(false)

  const statusIcon =
    connection.status === 'active' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
    connection.status === 'paused' ? <Pause className="h-4 w-4 text-amber-500" /> :
    connection.status === 'error' ? <AlertCircle className="h-4 w-4 text-red-500" /> :
    <Unplug className="h-4 w-4 text-gray-400" />

  const statusLabel =
    connection.status === 'active' ? 'Connected' :
    connection.status === 'paused' ? 'Paused' :
    connection.status === 'error' ? 'Error' : 'Disconnected'

  const handleSync = async () => {
    setSyncing(true)
    try {
      const { error } = await supabase.functions.invoke('kobo-sync', {
        body: { action: 'sync', connection_id: connection.id },
      })
      if (error) throw error
      toast.success('Sync complete')
      onUpdated()
    } catch {
      toast.error('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleTogglePause = async () => {
    const newStatus = connection.status === 'paused' ? 'active' : 'paused'
    const { error } = await supabase
      .from('integration_connections')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', connection.id)
    if (error) { toast.error('Failed to update'); return }
    toast.success(newStatus === 'paused' ? 'Sync paused' : 'Sync resumed')
    onUpdated()
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnect this integration? Existing data will not be deleted.')) return
    const { error } = await supabase
      .from('integration_connections')
      .update({ status: 'disconnected', updated_at: new Date().toISOString() })
      .eq('id', connection.id)
    if (error) { toast.error('Failed to disconnect'); return }
    toast.success('Integration disconnected')
    onUpdated()
  }

  const providerLabel = PROVIDER_LABELS[connection.provider] ?? connection.provider

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${PROVIDER_COLORS[connection.provider] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
            {providerLabel}
          </span>
          <div className="flex items-center gap-1.5">
            {statusIcon}
            <span className="text-sm text-gray-600">{statusLabel}</span>
          </div>
        </div>
        <span className="text-xs text-gray-400 capitalize">{connection.sync_frequency}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {connection.last_sync_at
            ? `Last sync ${formatDistanceToNow(new Date(connection.last_sync_at), { addSuffix: true })}`
            : 'Never synced'
          }
        </span>
        <span>{connection.total_synced.toLocaleString()} records synced</span>
      </div>

      {connection.error_log && connection.status === 'error' && (
        <div className="mb-3 p-2 rounded bg-red-50 border border-red-100 text-xs text-red-700">
          {connection.error_log}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing || connection.status === 'disconnected'}
          className="text-xs h-7"
        >
          {syncing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          Sync Now
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTogglePause}
          disabled={connection.status === 'disconnected'}
          className="text-xs h-7"
        >
          {connection.status === 'paused'
            ? <><Play className="h-3 w-3 mr-1" />Resume</>
            : <><Pause className="h-3 w-3 mr-1" />Pause</>
          }
        </Button>
        <Button variant="outline" size="sm" onClick={onSettings} className="text-xs h-7">
          <Settings className="h-3 w-3 mr-1" />Settings
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
        >
          <Unplug className="h-3 w-3 mr-1" />Disconnect
        </Button>
      </div>
    </div>
  )
}
