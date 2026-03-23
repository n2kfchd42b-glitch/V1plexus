'use client'

import Link from 'next/link'
import { AlertTriangle, CheckCircle, Clock, ExternalLink } from 'lucide-react'
import { cn, formatDate, daysUntil } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { Grant } from '@/types/database'

interface GrantCardProps {
  grant: Grant & { _projectCount?: number; _nextReport?: { title: string; due_date: string } }
}

const statusConfig = {
  applied:   { label: 'Applied',   class: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  active:    { label: 'Active',    class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  completed: { label: 'Completed', class: 'bg-blue-50 text-blue-700 border-blue-200' },
  closed:    { label: 'Closed',    class: 'bg-gray-100 text-gray-600 border-gray-200' },
  rejected:  { label: 'Rejected',  class: 'bg-red-50 text-red-700 border-red-200' },
}

function formatAmount(amount: number | null, currency: string): string {
  if (!amount) return '—'
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency + ' '
  if (amount >= 1_000_000) return `${sym}${(amount / 1_000_000).toFixed(2)}M`
  if (amount >= 1_000) return `${sym}${(amount / 1_000).toFixed(0)}K`
  return `${sym}${amount.toLocaleString()}`
}

export function GrantCard({ grant }: GrantCardProps) {
  const status = statusConfig[grant.status] ?? statusConfig.active
  const days = grant._nextReport ? daysUntil(grant._nextReport.due_date) : null
  const isUrgent = days !== null && days <= 30 && days >= 0

  return (
    <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-[var(--text-tertiary)]">{grant.funder_name}</span>
            {grant.grant_number && (
              <span className="text-xs text-[var(--text-tertiary)]">— {grant.grant_number}</span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-snug mb-2">
            {grant.title}
          </h3>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-tertiary)]">
            <span className="font-medium text-[var(--text-secondary)]">{formatAmount(grant.amount, grant.currency)}</span>
            {grant.start_date && grant.end_date && (
              <span>{formatDate(grant.start_date)} – {formatDate(grant.end_date)}</span>
            )}
            {grant.pi && (
              <span>PI: {grant.pi.full_name ?? grant.pi.email}</span>
            )}
            {grant._projectCount !== undefined && (
              <span>{grant._projectCount} linked project{grant._projectCount !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        <span className={cn('flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border', status.class)}>
          {status.label}
        </span>
      </div>

      {/* Next report */}
      {grant._nextReport && (
        <div className={cn(
          'mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg',
          isUrgent
            ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : 'bg-[var(--bg-inset)] text-[var(--text-tertiary)]'
        )}>
          {isUrgent ? (
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          ) : (
            <Clock className="h-3.5 w-3.5 flex-shrink-0" />
          )}
          <span>
            Next report: <span className="font-medium">{grant._nextReport.title}</span>
            {' '}— due {formatDate(grant._nextReport.due_date)}
            {days !== null && ` (${days > 0 ? `${days} days` : 'today'})`}
          </span>
        </div>
      )}

      {!grant._nextReport && grant.status === 'active' && (
        <div className="mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-[var(--bg-inset)] text-[var(--text-tertiary)]">
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
          <span>All reports submitted</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        <Link
          href={`/institution/grants/${grant.id}`}
          className="text-xs font-medium text-[var(--accent-blue)] hover:underline"
        >
          View Details
        </Link>
        <span className="text-[var(--border-default)]">·</span>
        <Link
          href={`/institution/grants/${grant.id}?tab=report`}
          className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline"
        >
          Generate Report
        </Link>
      </div>
    </div>
  )
}
