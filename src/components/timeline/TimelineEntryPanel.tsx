"use client"

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { AuditLog } from '@/types/database'
import { describeEntry, typeBadgeClass, fmtTime } from './timelineUtils'

interface Props {
  entry: AuditLog
  onClose: () => void
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-[var(--panel-border)] last:border-0">
      <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium">{label}</p>
      <p className="text-xs text-[var(--text-primary)] break-words">{value}</p>
    </div>
  )
}

export function TimelineEntryPanel({ entry, onClose }: Props) {
  const { typeLabel, title } = describeEntry(entry)
  const d    = entry.details ?? {}
  const actor = entry.actor as { full_name?: string; email?: string } | null | undefined

  const timestamp = new Date(entry.timestamp)
  const dateStr   = timestamp.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const timeStr   = fmtTime(entry.timestamp)

  // Collect meaningful detail rows from the details object
  const detailRows: { label: string; value: string }[] = []
  if (d.analysis_type)   detailRows.push({ label: 'Analysis type',   value: String(d.analysis_type) })
  if (d.filename || d.name) detailRows.push({ label: 'File',         value: String(d.filename ?? d.name) })
  if (d.dataset_name)    detailRows.push({ label: 'Dataset',         value: String(d.dataset_name) })
  if (d.rows_before != null && d.rows_after != null)
    detailRows.push({ label: 'Rows',   value: `${d.rows_before} → ${d.rows_after}` })
  if (d.version_before != null && d.version_after != null)
    detailRows.push({ label: 'Version', value: `v${d.version_before} → v${d.version_after}` })
  if (d.columns_affected && Array.isArray(d.columns_affected))
    detailRows.push({ label: 'Variables', value: (d.columns_affected as string[]).join(', ') })
  if (d.justification)   detailRows.push({ label: 'Justification',   value: String(d.justification) })

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0,   opacity: 1 }}
      exit={{    x: 320, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
      className="context-panel flex-shrink-0"
    >
      {/* Panel header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-[var(--panel-border)]">
        <div className="flex-1 min-w-0">
          <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mb-1.5 ${typeBadgeClass(typeLabel)}`}>
            {typeLabel}
          </span>
          <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">{title}</p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 ml-2 h-6 w-6 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-row-hover)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Panel body */}
      <div className="context-panel-body">

        {/* Timestamp + actor */}
        <div className="mb-3">
          <p className="text-xs text-[var(--text-secondary)]">{dateStr} · {timeStr}</p>
          {actor?.full_name && (
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">by {actor.full_name}</p>
          )}
        </div>

        {/* Summary / description from details */}
        {!!d.summary && (
          <div className="surface-inset mb-3">
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{String(d.summary)}</p>
          </div>
        )}

        {/* Detail rows */}
        {detailRows.length > 0 && (
          <div className="mb-3">
            <p className="subsection-label">Details</p>
            {detailRows.map(({ label, value }) => (
              <DetailRow key={label} label={label} value={value} />
            ))}
          </div>
        )}

        {/* Verification / integrity */}
        <div className="mb-3">
          <p className="subsection-label">Integrity</p>
          <div className="py-2 border-b border-[var(--panel-border)]">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="status-dot status-dot--verified" />
              <span className="text-xs text-[var(--text-secondary)] font-medium">Verified</span>
            </div>
            {entry.entry_hash && (
              <p className="data-mono-xs text-[var(--text-tertiary)] break-all">
                {entry.entry_hash.slice(0, 12)}…{entry.entry_hash.slice(-8)}
              </p>
            )}
          </div>
        </div>

        {/* Raw action (for power users) */}
        <div>
          <p className="subsection-label">Event</p>
          <p className="data-mono-xs text-[var(--text-tertiary)]">{entry.action}</p>
          <p className="data-mono-xs text-[var(--text-tertiary)] mt-0.5">{entry.resource_type}</p>
        </div>

      </div>
    </motion.div>
  )
}
