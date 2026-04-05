'use client'

import { useState, useMemo } from 'react'
import { X, History, Clock, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import {
  diffParagraphs,
  extractParagraphs,
  calculateDiffStats,
  type DiffBlock,
} from '@/lib/diff-utils'
import { toast } from 'sonner'

interface DocumentVersion {
  id: string
  document_id: string
  version_number: number
  content: Record<string, unknown> | null
  change_summary?: string | null
  created_by?: { id: string; full_name: string | null } | null
  created_at: string
  word_count?: number
  label?: string | null
  is_auto_save?: boolean
}

interface VersionHistoryProps {
  versions: DocumentVersion[]
  currentVersion: number
  currentContent: Record<string, unknown> | null
  onClose: () => void
  onRestore: (version: DocumentVersion) => Promise<void>
}

type ViewMode = 'list' | 'diff'

export function VersionHistory({
  versions,
  currentVersion,
  currentContent,
  onClose,
  onRestore,
}: VersionHistoryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)

  // Sort versions descending (newest first)
  const sortedVersions = useMemo(
    () => {
      const sorted = [...versions]
        .filter((v) => !v.is_auto_save) // Hide auto-saves by default
        .sort((a, b) => b.version_number - a.version_number)
      return sorted
    },
    [versions]
  )

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId),
    [versions, selectedVersionId]
  )

  const diffBlocks = useMemo(() => {
    if (!selectedVersion || !currentContent) return []

    const beforeParagraphs = extractParagraphs(selectedVersion.content)
    const afterParagraphs = extractParagraphs(currentContent)

    return diffParagraphs(beforeParagraphs, afterParagraphs)
  }, [selectedVersion, currentContent])

  const diffStats = useMemo(() => calculateDiffStats(diffBlocks), [diffBlocks])

  const handleRestore = async (version: DocumentVersion) => {
    if (version.version_number === currentVersion) {
      toast.error('Already on this version')
      return
    }

    const confirm = window.confirm(
      `Restore this document to version ${version.version_number}? This will create a new version.`
    )
    if (!confirm) return

    setRestoring(version.id)
    try {
      await onRestore(version)
      toast.success(`Restored to version ${version.version_number}`)
      setViewMode('list')
      setSelectedVersionId(null)
    } catch (err) {
      toast.error('Failed to restore version')
      console.error(err)
    } finally {
      setRestoring(null)
    }
  }

  return (
    <div className="w-96 border-l border-slate-200 bg-slate-50 flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between p-6 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-600" />
          <h3 className="font-black text-[10px] uppercase tracking-[0.15em] text-slate-500">Version History</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-slate-400 hover:text-slate-600"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* View mode tabs */}
      <div className="shrink-0 px-4 py-2 border-b border-slate-200 flex gap-2 bg-white">
        <Button
          size="sm"
          variant={viewMode === 'list' ? 'default' : 'outline'}
          onClick={() => {
            setViewMode('list')
            setSelectedVersionId(null)
          }}
          className="text-xs h-7 bg-white text-slate-700 border-slate-300 hover:border-slate-400"
        >
          Versions
        </Button>
        <Button
          size="sm"
          variant={viewMode === 'diff' ? 'default' : 'outline'}
          onClick={() => setViewMode('diff')}
          disabled={!selectedVersion}
          className="text-xs h-7 bg-white text-slate-700 border-slate-300 hover:border-slate-400"
        >
          Diff
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'list' ? (
          <VersionList
            versions={sortedVersions}
            currentVersion={currentVersion}
            selectedVersionId={selectedVersionId}
            onSelectVersion={setSelectedVersionId}
            onRestore={handleRestore}
            restoring={restoring}
          />
        ) : (
          <DiffView
            selectedVersion={selectedVersion}
            diffBlocks={diffBlocks}
            diffStats={diffStats}
          />
        )}
      </div>
    </div>
  )
}

/**
 * VersionList: Display all saved versions
 */
function VersionList({
  versions,
  currentVersion,
  selectedVersionId,
  onSelectVersion,
  onRestore,
  restoring,
}: {
  versions: DocumentVersion[]
  currentVersion: number
  selectedVersionId: string | null
  onSelectVersion: (id: string | null) => void
  onRestore: (v: DocumentVersion) => Promise<void>
  restoring: string | null
}) {
  if (versions.length === 0) {
    return (
      <div className="text-center p-6">
        <p className="text-sm text-slate-500">No saved versions yet</p>
        <p className="text-xs text-slate-400 mt-1">
          Click "Save Version" to create a manual snapshot
        </p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-slate-200">
      {versions.map((v) => (
        <li
          key={v.id}
          className="p-4 hover:bg-white cursor-pointer transition-colors"
          onClick={() => onSelectVersion(selectedVersionId === v.id ? null : v.id)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Version number + label */}
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-bold text-slate-900">
                  v{v.version_number}
                </p>
                {v.label && (
                  <span className="text-[9px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    {v.label}
                  </span>
                )}
                {v.version_number === currentVersion && (
                  <span className="text-[9px] bg-green-50 text-green-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    Current
                  </span>
                )}
              </div>

              {/* Metadata */}
              <div className="space-y-1 mt-2">
                {v.change_summary && (
                  <p className="text-xs text-slate-600 line-clamp-2">
                    {v.change_summary}
                  </p>
                )}

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(v.created_at)}
                  </div>
                  {v.created_by && (
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {v.created_by.full_name || 'Unknown'}
                    </div>
                  )}
                </div>

                {v.word_count && (
                  <p className="text-xs text-slate-500">
                    {v.word_count.toLocaleString()} words
                  </p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            {v.version_number !== currentVersion && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  onRestore(v)
                }}
                disabled={restoring === v.id}
                className="text-xs h-7 shrink-0 border-slate-300 text-slate-700 hover:bg-white"
              >
                {restoring === v.id ? 'Restoring...' : 'Restore'}
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

/**
 * DiffView: Show paragraph-level diff between versions
 */
function DiffView({
  selectedVersion,
  diffBlocks,
  diffStats,
}: {
  selectedVersion?: DocumentVersion
  diffBlocks: DiffBlock[]
  diffStats: {
    added: number
    removed: number
    unchanged: number
    changedPct: number
  }
}) {
  if (!selectedVersion) {
    return (
      <div className="text-center p-6">
        <p className="text-sm text-slate-500">
          Select a version to view differences
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 bg-green-50 rounded text-center border border-green-200">
          <p className="text-lg font-bold text-green-700">+{diffStats.added}</p>
          <p className="text-[10px] text-green-600 font-medium">Added</p>
        </div>
        <div className="p-2 bg-red-50 rounded text-center border border-red-200">
          <p className="text-lg font-bold text-red-700">
            -{diffStats.removed}
          </p>
          <p className="text-[10px] text-red-600 font-medium">Removed</p>
        </div>
        <div className="p-2 bg-slate-100 rounded text-center border border-slate-300">
          <p className="text-lg font-bold text-slate-700">
            {diffStats.changedPct}%
          </p>
          <p className="text-[10px] text-slate-600 font-medium">Changed</p>
        </div>
      </div>

      {/* Diff blocks */}
      <div className="space-y-2">
        {diffBlocks.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">
            No differences
          </p>
        ) : (
          diffBlocks.map((block, idx) => (
            <div
              key={idx}
              className={`p-3 rounded text-xs font-mono text-sm border-l-4 ${
                block.type === 'added'
                  ? 'bg-green-50 border-green-500 text-slate-900'
                  : block.type === 'removed'
                    ? 'bg-red-50 border-red-500 text-slate-900'
                    : 'bg-slate-50 border-slate-300 text-slate-500'
              }`}
            >
              {block.type === 'added' && (
                <span className="text-green-700 font-bold">+ </span>
              )}
              {block.type === 'removed' && (
                <span className="text-red-700 font-bold">- </span>
              )}
              <span className="break-words">{block.content}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
