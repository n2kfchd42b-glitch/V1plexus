'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Database, Trash2, Archive, ArchiveRestore, X, Check, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Dataset } from '@/types/database'
import { cn } from '@/lib/utils'

const SOURCE_LABELS: Record<string, string> = {
  upload:  'Upload',
  merge:   'Merged',
  append:  'Appended',
  clean:   'Cleaned',
  branch:  'Branch',
  kobo:    'KoboToolbox',
  redcap:  'REDCap',
  csv:     'CSV',
  excel:   'Excel',
  spss:    'SPSS',
}

interface DatasetCardProps {
  dataset: Dataset
  projectId: string
  onDelete?: (id: string) => void
  onArchive?: (id: string, archived: boolean) => void
}

export function DatasetCard({ dataset, projectId, onDelete, onArchive }: DatasetCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const version = dataset.latest_version
  const href = `/projects/${projectId}/data/${dataset.id}`
  const isArchived = !!dataset.archived_at

  const updatedAt = formatDistanceToNow(new Date(dataset.updated_at), { addSuffix: true })

  return (
    <div className={cn('group border-b border-[var(--border-row)] last:border-0', isArchived && 'opacity-60')}>
      {confirmingDelete ? (
        /* Confirm delete inline */
        <div className="row-item">
          <Database className="h-3.5 w-3.5 text-[var(--timeline-flagged)] flex-shrink-0" />
          <span className="text-xs text-[var(--timeline-flagged)] flex-1">Delete &ldquo;{dataset.name}&rdquo;? This cannot be undone.</span>
          <button
            onClick={() => { onDelete?.(dataset.id); setConfirmingDelete(false) }}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-[var(--timeline-flagged)] text-white hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <Check className="h-3 w-3" />
            Delete
          </button>
          <button
            onClick={() => setConfirmingDelete(false)}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-row-hover)] transition-colors flex-shrink-0"
          >
            <X className="h-3 w-3" />
            Cancel
          </button>
        </div>
      ) : (
        <Link href={href} className="block">
          <div className="row-item">
            {/* Icon */}
            <Database className="h-3.5 w-3.5 text-[var(--text-tertiary)] flex-shrink-0" />

            {/* Name + meta */}
            <div className="flex-1 min-w-0 px-2">
              <p className="text-sm text-[var(--text-primary)] truncate leading-snug">{dataset.name}</p>
              <p className="data-mono-xs text-[var(--text-tertiary)] mt-0.5 truncate">
                {version
                  ? `${version.row_count.toLocaleString()} rows · ${version.column_count} cols · v${version.version_number}`
                  : 'Processing…'}
                {' · '}{SOURCE_LABELS[dataset.source] ?? dataset.source}
              </p>
            </div>

            {/* Timestamp */}
            <span className="data-mono-xs text-[var(--text-tertiary)] flex-shrink-0 hidden sm:block">
              {updatedAt}
            </span>

            {/* Archived badge */}
            {isArchived && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 flex-shrink-0">
                Archived
              </span>
            )}

            {/* Hover actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1">
              {onArchive && (
                <button
                  onClick={e => { e.preventDefault(); e.stopPropagation(); onArchive(dataset.id, !isArchived) }}
                  className="h-6 w-6 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:bg-[var(--bg-row-hover)] hover:text-[var(--text-secondary)] transition-colors"
                  title={isArchived ? 'Unarchive' : 'Archive'}
                >
                  {isArchived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                </button>
              )}
              {onDelete && (
                <button
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirmingDelete(true) }}
                  className="h-6 w-6 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:bg-[var(--bg-row-hover)] hover:text-[var(--timeline-flagged)] transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>

            <ChevronRight className="row-action h-3.5 w-3.5 text-[var(--text-tertiary)] flex-shrink-0" />
          </div>
        </Link>
      )}
    </div>
  )
}
