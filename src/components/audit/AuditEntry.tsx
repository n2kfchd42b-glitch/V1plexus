"use client"

import { formatDateTime } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import type { AuditLog } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const ACTION_COLORS: Record<string, string> = {
  'project.create': 'text-green-700 bg-green-50 border-green-200',
  'project.update': 'text-blue-700 bg-blue-50 border-blue-200',
  'project.member_add': 'text-cyan-700 bg-cyan-50 border-cyan-200',
  'project.member_remove': 'text-orange-700 bg-orange-50 border-orange-200',
  'document.create': 'text-green-700 bg-green-50 border-green-200',
  'document.edit': 'text-blue-700 bg-blue-50 border-blue-200',
  'document.version_save': 'text-indigo-700 bg-indigo-50 border-indigo-200',
  'document.export': 'text-purple-700 bg-purple-50 border-purple-200',
  'review.submit': 'text-yellow-700 bg-yellow-50 border-yellow-200',
  'review.approve': 'text-green-700 bg-green-50 border-green-200',
  'review.reject': 'text-red-700 bg-red-50 border-red-200',
  'review.delegate': 'text-orange-700 bg-orange-50 border-orange-200',
  'ethics.create': 'text-teal-700 bg-teal-50 border-teal-200',
  'ethics.update': 'text-teal-700 bg-teal-50 border-teal-200',
  'ethics.amendment': 'text-amber-700 bg-amber-50 border-amber-200',
  'dataset.upload': 'text-violet-700 bg-violet-50 border-violet-200',
  'dataset.delete': 'text-red-700 bg-red-50 border-red-200',
  'analysis.run': 'text-indigo-700 bg-indigo-50 border-indigo-200',
  'gate.approve': 'text-green-700 bg-green-50 border-green-200',
  'ai.assist': 'text-primary bg-primary/10 border-primary/20',
}

interface AuditEntryProps {
  entry: AuditLog
  showHash?: boolean
}

export function AuditEntry({ entry, showHash = false }: AuditEntryProps) {
  const actorName = entry.actor?.full_name ?? entry.actor?.email ?? entry.actor_id?.slice(0, 8) ?? 'System'
  const actionColor = ACTION_COLORS[entry.action] ?? 'text-gray-700 bg-gray-50 border-gray-200'

  return (
    <div className="flex items-start gap-3 py-3 px-4 hover:bg-muted/30 transition-colors">
      {/* Avatar */}
      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0 mt-0.5">
        {getInitials(entry.actor?.full_name)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{actorName}</span>
          <Badge className={cn('text-[10px] border px-1.5 py-0', actionColor)}>
            {entry.action}
          </Badge>
          <span className="text-xs text-muted-foreground capitalize">{entry.resource_type}</span>
        </div>

        {Object.keys(entry.details).length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {Object.entries(entry.details)
              .filter(([k]) => !['actor_id', 'entry_hash'].includes(k))
              .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
              .join(' · ')
              .slice(0, 120)}
          </p>
        )}

        <p className="text-[11px] text-muted-foreground mt-0.5">{formatDateTime(entry.timestamp)}</p>

        {showHash && (
          <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5 truncate">
            #{entry.entry_hash.slice(0, 16)}…
          </p>
        )}
      </div>
    </div>
  )
}
