'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Database, Clock, Trash2, Archive, ArchiveRestore, X, Check } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Dataset } from '@/types/database'

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

/** Deterministic sparkline heights (3–9px) seeded from dataset ID */
function getSparklineHeights(id: string): number[] {
  return Array.from({ length: 8 }, (_, i) => {
    const code = id.charCodeAt(i % id.length)
    return 3 + ((code * (i + 3) * 7) % 7)
  })
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
  const sparkHeights = getSparklineHeights(dataset.id)

  return (
    <div className={`bg-white rounded-xl shadow-[0_20px_50px_rgba(0,24,72,0.04)] hover:shadow-[0_20px_50px_rgba(0,24,72,0.10)] hover:-translate-y-0.5 transition-all ${isArchived ? 'opacity-70' : ''}`}>
      <Link href={href} className="block p-6">
        {/* Header: source icon + version badge */}
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-[#003d9b]/5 rounded-lg text-[#003d9b]">
            <Database className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-2">
            {isArchived && (
              <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant text-[10px] font-bold rounded font-mono">
                ARCHIVED
              </span>
            )}
            {version && (
              <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant text-[10px] font-bold rounded font-mono">
                v{version.version_number}
              </span>
            )}
          </div>
        </div>

        {/* Title + description */}
        <h3 className="font-bold text-lg mb-1 font-manrope text-[#191c1e] hover:text-[#003d9b] transition-colors leading-tight">
          {dataset.name}
        </h3>
        {dataset.description ? (
          <p className="text-xs text-on-surface-variant mb-6 line-clamp-2">{dataset.description}</p>
        ) : (
          <p className="text-xs text-on-surface-variant/40 mb-6 italic">No description</p>
        )}

        {/* Stats + sparkline */}
        <div className="flex justify-between items-end mb-4">
          <div className="flex gap-4">
            {version ? (
              <>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Records</span>
                  <span className="text-sm font-mono font-medium text-[#191c1e]">
                    {version.row_count.toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Columns</span>
                  <span className="text-sm font-mono font-medium text-[#191c1e]">
                    {version.column_count}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
                <span className="text-sm font-mono font-medium text-on-surface-variant">Processing</span>
              </div>
            )}
          </div>

          {/* Mini sparkline */}
          <div className="flex items-end gap-[2px]">
            {sparkHeights.map((h, i) => (
              <div
                key={i}
                className="w-1 rounded-full bg-[#003d9b]"
                style={{
                  height: `${h * 3}px`,
                  opacity: 0.12 + (i / sparkHeights.length) * 0.88,
                }}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-outline-variant/10 flex justify-between items-center">
          <span className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(dataset.updated_at), { addSuffix: true }).toUpperCase()}
          </span>
          <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant text-[10px] font-bold rounded font-mono">
            {SOURCE_LABELS[dataset.source] ?? dataset.source.toUpperCase()}
          </span>
        </div>
      </Link>

      {/* Action bar — always visible */}
      {(onArchive || onDelete) && (
        <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-2">
          {confirmingDelete ? (
            <>
              <span className="text-xs text-red-600 font-medium flex-1">Delete this dataset?</span>
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete?.(dataset.id); setConfirmingDelete(false) }}
                className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
                Confirm
              </button>
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirmingDelete(false) }}
                className="flex items-center gap-1 h-7 px-2.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </>
          ) : (
            <>
              {onArchive && (
                <button
                  onClick={e => { e.preventDefault(); e.stopPropagation(); onArchive(dataset.id, !isArchived) }}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                >
                  {isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                  {isArchived ? 'Unarchive' : 'Archive'}
                </button>
              )}
              {onDelete && (
                <button
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirmingDelete(true) }}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors ml-auto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
