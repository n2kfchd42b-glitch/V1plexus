"use client"

import { formatDateTime } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import type { AuditLog } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Keyed by the actual action strings from AuditAction in src/types/audit.ts
const ACTION_COLORS: Record<string, string> = {
  // Dataset lifecycle
  'dataset.imported':                      'text-violet-700 bg-violet-50 border-violet-200',
  'dataset.deleted':                       'text-red-700 bg-red-50 border-red-200',
  'dataset.archived':                      'text-orange-700 bg-orange-50 border-orange-200',
  'dataset.unarchived':                    'text-green-700 bg-green-50 border-green-200',
  // Dataset versions & branches
  'dataset.version.created':              'text-indigo-700 bg-indigo-50 border-indigo-200',
  'dataset.version.committed':            'text-indigo-700 bg-indigo-50 border-indigo-200',
  'dataset.branch.created':               'text-cyan-700 bg-cyan-50 border-cyan-200',
  'dataset.branch.merged':                'text-teal-700 bg-teal-50 border-teal-200',
  // Dataset cleaning
  'dataset.rows.dropped':                 'text-red-700 bg-red-50 border-red-200',
  'dataset.column.recoded':               'text-blue-700 bg-blue-50 border-blue-200',
  'dataset.imputation.mice':              'text-purple-700 bg-purple-50 border-purple-200',
  'dataset.duplicates.resolved':          'text-amber-700 bg-amber-50 border-amber-200',
  // Dataset re-entry
  'dataset.reentry.validated':            'text-teal-700 bg-teal-50 border-teal-200',
  'dataset.reentry.initiated':            'text-cyan-700 bg-cyan-50 border-cyan-200',
  'dataset.reentry.discrepancy.resolved': 'text-amber-700 bg-amber-50 border-amber-200',
  'dataset.exploration.created':          'text-blue-700 bg-blue-50 border-blue-200',
  // Dataset approvals
  'dataset.approved':                     'text-green-700 bg-green-50 border-green-200',
  'dataset.approval.requested':           'text-yellow-700 bg-yellow-50 border-yellow-200',
  'dataset.approval.rejected':            'text-red-700 bg-red-50 border-red-200',
  'dataset.approval.revision_requested':  'text-orange-700 bg-orange-50 border-orange-200',
  'dataset.verification.token_created':   'text-blue-700 bg-blue-50 border-blue-200',
  // Analysis
  'analysis.run.saved':                   'text-indigo-700 bg-indigo-50 border-indigo-200',
  'analysis.run.deleted':                 'text-red-700 bg-red-50 border-red-200',
  'analysis.run.started':                 'text-blue-700 bg-blue-50 border-blue-200',
  'analysis.run.completed':               'text-green-700 bg-green-50 border-green-200',
  'analysis.run.failed':                  'text-red-700 bg-red-50 border-red-200',
  'analysis.assumption.acknowledged':     'text-teal-700 bg-teal-50 border-teal-200',
  'analysis.reasoning_added':             'text-blue-700 bg-blue-50 border-blue-200',
  // Output
  'output.checklist.generated':           'text-purple-700 bg-purple-50 border-purple-200',
  'output.methods.generated':             'text-purple-700 bg-purple-50 border-purple-200',
  'output.package.generated':             'text-violet-700 bg-violet-50 border-violet-200',
  // Document
  'document.created':                     'text-green-700 bg-green-50 border-green-200',
  'document.deleted':                     'text-red-700 bg-red-50 border-red-200',
  'document.edited':                      'text-blue-700 bg-blue-50 border-blue-200',
  'document.generated':                   'text-purple-700 bg-purple-50 border-purple-200',
  'document.exported':                    'text-purple-700 bg-purple-50 border-purple-200',
  'document.submitted':                   'text-yellow-700 bg-yellow-50 border-yellow-200',
  'document.approved':                    'text-green-700 bg-green-50 border-green-200',
  'document.revision_requested':          'text-orange-700 bg-orange-50 border-orange-200',
  'document.rejected':                    'text-red-700 bg-red-50 border-red-200',
  'document.version_saved':               'text-indigo-700 bg-indigo-50 border-indigo-200',
  'document.version_restored':            'text-teal-700 bg-teal-50 border-teal-200',
  // Project
  'project.created':                      'text-green-700 bg-green-50 border-green-200',
  'project.updated':                      'text-blue-700 bg-blue-50 border-blue-200',
  'project.archived':                     'text-orange-700 bg-orange-50 border-orange-200',
  'project.deleted':                      'text-red-700 bg-red-50 border-red-200',
  'project.member.added':                 'text-cyan-700 bg-cyan-50 border-cyan-200',
  'project.member.removed':               'text-orange-700 bg-orange-50 border-orange-200',
  'project.member.invited':               'text-cyan-700 bg-cyan-50 border-cyan-200',
  'project.share_link.generated':         'text-blue-700 bg-blue-50 border-blue-200',
  'project.share_link.revoked':           'text-orange-700 bg-orange-50 border-orange-200',
  'progress.note':                        'text-slate-700 bg-slate-50 border-slate-200',
  // Profile & portfolio
  'profile.updated':                      'text-blue-700 bg-blue-50 border-blue-200',
  'portfolio.certificate.added':          'text-teal-700 bg-teal-50 border-teal-200',
  'portfolio.publication.added':          'text-teal-700 bg-teal-50 border-teal-200',
  // Auth
  'auth.login':                           'text-slate-700 bg-slate-50 border-slate-200',
  'auth.logout':                          'text-slate-700 bg-slate-50 border-slate-200',
  'auth.password.changed':                'text-amber-700 bg-amber-50 border-amber-200',
}

interface AuditEntryProps {
  entry: AuditLog
  showHash?: boolean
}

export function AuditEntry({ entry, showHash = false }: AuditEntryProps) {
  const actorName = entry.actor?.full_name ?? entry.actor?.email ?? entry.actor_id?.slice(0, 8) ?? 'System'
  const actionColor = ACTION_COLORS[entry.action] ?? 'text-gray-700 bg-gray-50 border-gray-200'
  const details = entry.details as Record<string, unknown> | null | undefined
  const summary = typeof details?.summary === 'string' ? details.summary : null

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
          <span className="text-xs text-muted-foreground capitalize">{entry.resource_type.replace(/_/g, ' ')}</span>
        </div>

        {summary && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{summary}</p>
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
