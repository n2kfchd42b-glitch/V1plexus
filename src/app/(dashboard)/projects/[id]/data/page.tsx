'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Upload, Database, Archive, ArchiveRestore, Trash2, ChevronDown, Check } from 'lucide-react'
import { motion, type Variants } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DatasetUpload } from '@/components/data/DatasetUpload'
import { DatasetDetailPanel } from '@/components/data/DatasetDetailPanel'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { logAudit } from '@/lib/audit'
import { cn } from '@/lib/utils'
import type { Dataset, DatasetVersion } from '@/types/database'

// ─── Animations ───────────────────────────────────────────────────────────────

const listVariants: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }
const itemVariants: Variants = { hidden: { opacity: 0, y: 3 }, visible: { opacity: 1, y: 0, transition: { duration: 0.12 } } }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDataPage() {
  const params    = useParams()
  const router    = useRouter()
  const projectId = params.id as string
  const { user, loading: authLoading } = useAuth()
  const supabase  = createClient()

  const [datasets,      setDatasets]      = useState<Dataset[]>([])
  const [archivedCount, setArchivedCount] = useState(0)
  const [listLoading,   setListLoading]   = useState(true)
  const [showArchived,  setShowArchived]  = useState(false)
  const [showUpload,    setShowUpload]    = useState(false)
  const [selectedId,    setSelectedId]    = useState<string | null>(null)
  const [pickerOpen,    setPickerOpen]    = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  const fetchDatasets = useCallback(async () => {
    if (!user) return
    setListLoading(true)
    try {
      const query = showArchived
        ? supabase.from('datasets').select('*').eq('project_id', projectId).is('deleted_at', null).not('archived_at', 'is', null).order('updated_at', { ascending: false })
        : supabase.from('datasets').select('*').eq('project_id', projectId).is('deleted_at', null).is('archived_at', null).order('updated_at', { ascending: false })

      const [datasetsRes, archivedRes] = await Promise.all([
        query,
        supabase.from('datasets').select('id', { count: 'exact', head: true }).eq('project_id', projectId).is('deleted_at', null).not('archived_at', 'is', null),
      ])

      setArchivedCount(archivedRes.count ?? 0)
      if (!datasetsRes.data?.length) { setDatasets([]); return }

      const datasetList: Dataset[] = datasetsRes.data
      const versionsRes = await supabase
        .from('dataset_versions').select('*')
        .in('dataset_id', datasetList.map(d => d.id))
        .order('version_number', { ascending: false })

      const latestMap = new Map<string, DatasetVersion>()
      for (const v of (versionsRes.data ?? []) as DatasetVersion[]) {
        if (!latestMap.has(v.dataset_id)) latestMap.set(v.dataset_id, v)
      }
      setDatasets(datasetList.map(ds => ({ ...ds, latest_version: latestMap.get(ds.id) ?? undefined })))
    } finally {
      setListLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, showArchived, user])

  useEffect(() => { fetchDatasets() }, [fetchDatasets])

  const handleUploadSuccess = (datasetId: string) => {
    setShowUpload(false)
    fetchDatasets().then(() => setSelectedId(datasetId))
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('datasets').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error('Failed to delete dataset'); return }
    setDatasets(prev => prev.filter(d => d.id !== id))
    if (selectedId === id) setSelectedId(null)
    logAudit('dataset.deleted', 'dataset', id, {}, projectId)
    toast.success('Dataset deleted')
  }

  const handleArchive = async (id: string, archive: boolean) => {
    const { error } = await supabase.from('datasets').update({ archived_at: archive ? new Date().toISOString() : null }).eq('id', id)
    if (error) { toast.error(archive ? 'Failed to archive' : 'Failed to unarchive'); return }
    setDatasets(prev => prev.filter(d => d.id !== id))
    if (selectedId === id) setSelectedId(null)
    logAudit(archive ? 'dataset.archived' : 'dataset.unarchived', 'dataset', id, {}, projectId)
    toast.success(archive ? 'Dataset archived' : 'Dataset unarchived')
  }

  const selectedDataset = datasets.find(d => d.id === selectedId) ?? null

  if (authLoading || !user) return null

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--bg-app)] overflow-hidden">

      {/* ── PAGE HEADER ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-[var(--border-row)] bg-[var(--bg-surface)] flex-shrink-0">

        {/* Left — title or dataset picker */}
        {selectedDataset ? (
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 min-w-0 group">
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedId(null) }}
                  className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors shrink-0 font-medium"
                >
                  Dataset Hub
                </button>
                <span className="text-[var(--border-default)] shrink-0">/</span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)] truncate">
                  <Database className="h-3.5 w-3.5 text-[var(--accent-blue)] shrink-0" />
                  <span className="truncate">{selectedDataset.name}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0 group-hover:text-[var(--text-secondary)] transition-colors" />
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="p-1 w-72 shadow-[var(--shadow-lg)]"
              style={{ border: '1px solid var(--border-default)' }}
            >
              {/* All datasets group */}
              <div className="px-2 pt-1.5 pb-1">
                <p className="section-label">Switch dataset</p>
              </div>
              <div>
                {datasets.map(ds => (
                  <button
                    key={ds.id}
                    onClick={() => { setSelectedId(ds.id); setPickerOpen(false) }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors',
                      ds.id === selectedId
                        ? 'bg-[var(--bg-surface-active)]'
                        : 'hover:bg-[var(--bg-row-hover)]'
                    )}
                  >
                    <Database className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-medium text-[var(--text-primary)] truncate">{ds.name}</span>
                      {ds.latest_version && (
                        <span className="data-mono text-[10px] text-[var(--text-tertiary)]">
                          {ds.latest_version.row_count.toLocaleString()} rows · {ds.latest_version.column_count} cols
                        </span>
                      )}
                    </span>
                    {ds.id === selectedId && (
                      <Check className="h-3.5 w-3.5 text-[var(--accent-blue)] shrink-0" />
                    )}
                  </button>
                ))}
              </div>
              {archivedCount > 0 && (
                <>
                  <div className="border-t border-[var(--border-subtle)] my-1" />
                  <button
                    onClick={() => { setShowArchived(v => !v); setPickerOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left hover:bg-[var(--bg-row-hover)] transition-colors"
                  >
                    <Archive className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0" />
                    <span className="text-xs text-[var(--text-secondary)]">
                      {showArchived ? 'View active datasets' : `View ${archivedCount} archived`}
                    </span>
                  </button>
                </>
              )}
            </PopoverContent>
          </Popover>
        ) : (
          <div>
            <h1 className="page-title">Dataset Hub</h1>
            {!listLoading && (
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                {datasets.length} {datasets.length === 1 ? 'dataset' : 'datasets'}
                {archivedCount > 0 && ` · ${archivedCount} archived`}
              </p>
            )}
          </div>
        )}

        {/* Right — import button */}
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white shrink-0 btn-primary"
        >
          <Upload className="h-3 w-3" />
          Import
        </button>
      </div>

      {/* ── MAIN CONTENT ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {selectedId ? (
          /* ── Detail panel (full-width) ── */
          <DatasetDetailPanel
            key={selectedId}
            datasetId={selectedId}
            projectId={projectId}
            isArchived={!!selectedDataset?.archived_at}
            onArchive={() => {
              if (selectedId) handleArchive(selectedId, !selectedDataset?.archived_at)
            }}
            onDelete={() => {
              if (selectedId) handleDelete(selectedId)
            }}
          />
        ) : (
          /* ── Hub list (full-width) ── */
          <div className="h-full overflow-y-auto">

            {/* Archive toggle strip */}
            {archivedCount > 0 && (
              <div className="flex items-center gap-1 px-6 pt-4 pb-0">
                <button
                  onClick={() => setShowArchived(false)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    !showArchived
                      ? 'bg-[var(--bg-surface-active)] text-[var(--text-primary)]'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-row-hover)]'
                  )}
                >
                  Active
                </button>
                <button
                  onClick={() => setShowArchived(true)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    showArchived
                      ? 'bg-[var(--bg-surface-active)] text-[var(--text-primary)]'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-row-hover)]'
                  )}
                >
                  Archived
                  <span className="ml-1.5 data-mono text-[10px] text-[var(--text-tertiary)]">{archivedCount}</span>
                </button>
              </div>
            )}

            {/* Dataset rows */}
            <div className="px-6 py-4">
              {listLoading ? (
                <div className="space-y-px">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-0 py-3 border-b border-[var(--border-row)]">
                      <div className="skeleton h-7 w-7 rounded-md shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="skeleton h-3 w-48 rounded" />
                        <div className="skeleton h-2.5 w-32 rounded" />
                      </div>
                      <div className="skeleton h-2.5 w-20 rounded" />
                    </div>
                  ))}
                </div>
              ) : datasets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-12 h-12 rounded-xl bg-[var(--bg-inset)] flex items-center justify-center mb-3">
                    <Database className="h-5 w-5 text-[var(--text-tertiary)]" />
                  </div>
                  <p className="text-sm font-semibold text-[var(--text-secondary)]">
                    {showArchived ? 'No archived datasets' : 'No datasets yet'}
                  </p>
                  {!showArchived && (
                    <button
                      onClick={() => setShowUpload(true)}
                      className="mt-3 text-xs text-[var(--accent-blue)] hover:underline"
                    >
                      Import your first dataset
                    </button>
                  )}
                </div>
              ) : (
                <motion.div initial="hidden" animate="visible" variants={listVariants}>
                  {datasets.map(ds => (
                    <motion.div key={ds.id} variants={itemVariants}>
                      <DatasetListItem
                        dataset={ds}
                        isArchived={!!ds.archived_at}
                        onSelect={() => setSelectedId(ds.id)}
                        onDelete={handleDelete}
                        onArchive={handleArchive}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Upload dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Dataset</DialogTitle>
          </DialogHeader>
          <DatasetUpload
            projectId={projectId}
            onSuccess={handleUploadSuccess}
            onCancel={() => setShowUpload(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Dataset list item ────────────────────────────────────────────────────────

interface DatasetListItemProps {
  dataset: Dataset
  isArchived: boolean
  onSelect: () => void
  onDelete: (id: string) => void
  onArchive: (id: string, archived: boolean) => void
}

function DatasetListItem({ dataset, isArchived, onSelect, onDelete, onArchive }: DatasetListItemProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const version = dataset.latest_version

  if (confirmingDelete) {
    return (
      <div className="flex items-center gap-3 py-3 border-b border-[var(--border-row)]">
        <Database className="h-3.5 w-3.5 text-[var(--status-error)] shrink-0" />
        <span className="text-xs text-[var(--status-error-text)] flex-1 min-w-0 truncate">
          Delete &ldquo;{dataset.name}&rdquo;?
        </span>
        <button
          onClick={() => { onDelete(dataset.id); setConfirmingDelete(false) }}
          className="px-2.5 py-1 rounded text-xs font-medium bg-[var(--status-error)] text-white hover:bg-[var(--status-error-hover)] transition-colors shrink-0"
        >
          Delete
        </button>
        <button
          onClick={() => setConfirmingDelete(false)}
          className="px-2.5 py-1 rounded text-xs font-medium border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-row-hover)] transition-colors shrink-0"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-3 py-3 border-b border-[var(--border-row)] last:border-0 cursor-pointer hover:bg-[var(--bg-row-hover)] transition-colors rounded-sm -mx-1 px-1',
        isArchived && 'opacity-60'
      )}
      onClick={onSelect}
    >
      {/* Icon */}
      <div className="w-7 h-7 rounded-md bg-[var(--bg-inset)] flex items-center justify-center shrink-0">
        <Database className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate leading-snug">{dataset.name}</p>
        <p className="data-mono text-[10px] text-[var(--text-tertiary)] mt-0.5 truncate">
          {version
            ? `${version.row_count.toLocaleString()} rows · ${version.column_count} cols · v${version.version_number}`
            : 'Processing…'}
        </p>
      </div>

      {/* Archived badge */}
      {isArchived && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border border-[var(--border-status-warning)] shrink-0">
          Archived
        </span>
      )}

      {/* Hover actions */}
      <div
        className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => onArchive(dataset.id, !isArchived)}
          className="h-6 w-6 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-active)] transition-colors"
          title={isArchived ? 'Unarchive' : 'Archive'}
        >
          {isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={() => setConfirmingDelete(true)}
          className="h-6 w-6 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)] transition-colors"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
