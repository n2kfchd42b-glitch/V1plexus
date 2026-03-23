'use client'

import { CheckCircle2, AlertCircle, Pause, Unplug } from 'lucide-react'
import type { IntegrationStatus } from '@/types/database'

interface SyncStatusBadgeProps {
  status: IntegrationStatus
  score?: number | null
}

export function SyncStatusBadge({ status, score }: SyncStatusBadgeProps) {
  const config = {
    active: { icon: CheckCircle2, label: 'Synced', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    paused: { icon: Pause, label: 'Paused', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    error: { icon: AlertCircle, label: 'Error', cls: 'bg-red-100 text-red-700 border-red-200' },
    disconnected: { icon: Unplug, label: 'Disconnected', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  }[status] ?? { icon: Unplug, label: status, cls: 'bg-gray-100 text-gray-600 border-gray-200' }

  const Icon = config.icon

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border ${config.cls}`}>
      <Icon className="h-3 w-3" />
      {config.label}
      {score !== null && score !== undefined && (
        <span className="ml-1 font-semibold">{Math.round(score)}/100</span>
      )}
    </span>
  )
}
