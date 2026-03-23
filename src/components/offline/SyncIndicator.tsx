'use client'

import { RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { useSyncStatus } from '@/lib/offline/connectivity'
import { cn } from '@/lib/utils'

interface SyncIndicatorProps {
  collapsed?: boolean
}

export function SyncIndicator({ collapsed }: SyncIndicatorProps) {
  const { syncStatus, lastSyncedAt, pendingCount, sync } = useSyncStatus()

  const label =
    syncStatus === 'syncing' ? 'Syncing…' :
    syncStatus === 'error' ? 'Sync failed' :
    pendingCount > 0 ? `${pendingCount} pending` :
    syncStatus === 'synced' ? 'Synced' :
    lastSyncedAt ? `Synced ${formatRelative(lastSyncedAt)}` : 'Up to date'

  const icon = syncStatus === 'syncing' ? (
    <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-400 flex-shrink-0" />
  ) : syncStatus === 'error' ? (
    <AlertCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
  ) : pendingCount > 0 ? (
    <Clock className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
  ) : (
    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
  )

  return (
    <button
      onClick={() => sync()}
      title={collapsed ? label : undefined}
      className={cn(
        'flex items-center gap-2 h-7 rounded-md transition-colors duration-150 text-[#71717A] hover:text-white hover:bg-[#27272A] w-full',
        collapsed ? 'justify-center px-0' : 'px-2.5'
      )}
    >
      {icon}
      {!collapsed && (
        <span className="text-xs truncate">{label}</span>
      )}
    </button>
  )
}

function formatRelative(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}
