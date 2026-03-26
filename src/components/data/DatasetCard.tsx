'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Database, GitBranch, Rows, Columns, Clock, ArrowRight, Trash2, Archive, ArchiveRestore, X, Check } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Dataset } from '@/types/database'

const SOURCE_LABELS: Record<string, string> = {
  upload: 'Upload',
  merge: 'Merged',
  append: 'Appended',
  clean: 'Cleaned',
  branch: 'Branch',
  kobo: 'KoboToolbox',
  redcap: 'REDCap',
}

const SOURCE_COLORS: Record<string, string> = {
  upload: 'bg-blue-100 text-blue-700',
  merge: 'bg-purple-100 text-purple-700',
  append: 'bg-green-100 text-green-700',
  clean: 'bg-orange-100 text-orange-700',
  branch: 'bg-yellow-100 text-yellow-700',
  kobo: 'bg-teal-100 text-teal-700',
  redcap: 'bg-pink-100 text-pink-700',
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

  return (
    <div className="group relative">
      <Link href={href} className="block">
        <div className={`bg-white border rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all ${isArchived ? 'border-gray-200 opacity-60' : 'border-gray-200'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`p-2 rounded-lg shrink-0 ${isArchived ? 'bg-gray-100' : 'bg-blue-50'}`}>
                <Database className={`h-5 w-5 ${isArchived ? 'text-gray-400' : 'text-blue-600'}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                    {dataset.name}
                  </h3>
                  {isArchived && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">
                      Archived
                    </span>
                  )}
                </div>
                {dataset.description && (
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{dataset.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                  {version && (
                    <>
                      <span className="flex items-center gap-1">
                        <Rows className="h-3 w-3" />
                        {version.row_count.toLocaleString()} rows
                      </span>
                      <span className="flex items-center gap-1">
                        <Columns className="h-3 w-3" />
                        {version.column_count} cols
                      </span>
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        v{version.version_number}
                      </span>
                    </>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(dataset.updated_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${SOURCE_COLORS[dataset.source] ?? 'bg-gray-100 text-gray-700'}`}>
                {SOURCE_LABELS[dataset.source] ?? dataset.source}
              </span>
              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div>
          </div>
        </div>
      </Link>

      {/* Action buttons (shown on hover) */}
      <div className="absolute top-3 right-10 flex items-center gap-1">
        {confirmingDelete ? (
          <>
            <span className="text-[11px] text-red-600 font-medium mr-1">Delete?</span>
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete?.(dataset.id); setConfirmingDelete(false) }}
              className="flex items-center justify-center h-6 w-6 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
              title="Confirm delete"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirmingDelete(false) }}
              className="flex items-center justify-center h-6 w-6 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
              title="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            {onArchive && (
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); onArchive(dataset.id, !isArchived) }}
                className="flex items-center justify-center h-6 w-6 rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
                title={isArchived ? 'Unarchive dataset' : 'Archive dataset'}
              >
                {isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
              </button>
            )}
            {onDelete && (
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirmingDelete(true) }}
                className="flex items-center justify-center h-6 w-6 rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
                title="Delete dataset"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
