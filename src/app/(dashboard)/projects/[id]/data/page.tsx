'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Upload, Database, Archive, ArchiveRestore, Trash2,
  ChevronsLeft, ChevronsRight,
} from 'lucide-react'
import { motion, type Variants } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  const [panelOpen,     setPanelOpen]     = useState(true)

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

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setPanelOpen(false)
  }

  const handleUploadSuccess = (datasetId: string) => {
    setShowUpload(false)
    fetchDatasets().then(() => handleSelect(datasetId))
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('datasets').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error('Failed to delete dataset'); return }
    setDatasets(prev => prev.filter(d => d.id !== id))
    if (selectedId === id) { setSelectedId(null); setPanelOpen(true) }
    logAudit('dataset.deleted', 'dataset', id, {}, projectId)
    toast.success('Dataset deleted')
  }

  const handleArchive = async (id: string, archive: boolean) => {
    const { error } = await supabase.from('datasets').update({ archived_at: archive ? new Date().toISOString() : null }).eq('id', id)
    if (error) { toast.error(archive ? 'Failed to archive' : 'Failed to unarchive'); return }
    setDatasets(prev => prev.filter(d => d.id !== id))
    if (selectedId === id) { setSelectedId(null); setPanelOpen(true) }
    logAudit(archive ? 'dataset.archived' : 'dataset.unarchived', 'dataset', id, {}, projectId)
    toast.success(archive ? 'Dataset archived' : 'Dataset unarchived')
  }

  const selectedDataset = datasets.find(d => d.id === selectedId) ?? null

  if (authLoading || !user) return null

  return (
    <div className="flex flex-row h-full min-h-0 bg-[var(--bg-app)] overflow-hidden">

      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <div className={cn(
        'flex flex-col border-r border-[var(--border-row)] bg-[var(--bg-surface)] shrink-0 overflow-hidden transition-all duration-200',
        panelOpen ? 'w-96' : 'w-10'
      )}>
        {panelOpen ? (
          <>
            {/* Panel header */}
            <div className="flex items-center justify-between px-3 pt-4 pb-3 shrink-0 border-b border-[var(--border-subtle)]">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">Datasets</p>
                {!listLoading && (
                  <p className="text-[10px] text-[var(--text-tertiary)]">
                    {datasets.length} {showArchived ? 'archived' : 'active'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setShowUpload(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--accent-blue)] text-[var(--text-inverse)] text-[11px] font-semibold hover:opacity-90 transition-opacity"
                >
                  <Upload className="h-3 w-3" />
                  Import
                </button>
                <button
                  onClick={() => setPanelOpen(false)}
                  className="h-6 w-6 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                  title="Collapse panel"
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Archive toggle */}
            {archivedCount > 0 && (
              <div className="flex items-center gap-0.5 px-2 pb-2 shrink-0">
                <button
                  onClick={() => setShowArchived(false)}
                  className={cn(
                    'flex-1 py-1 rounded text-[10px] font-medium transition-colors',
                    !showArchived
                      ? 'bg-[var(--bg-surface-active)] text-[var(--text-primary)]'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  )}
                >
                  Active
                </button>
                <button
                  onClick={() => setShowArchived(true)}
                  className={cn(
                    'flex-1 py-1 rounded text-[10px] font-medium transition-colors',
                    showArchived
                      ? 'bg-[var(--bg-surface-active)] text-[var(--text-primary)]'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  )}
                >
                  Archived <span className="opacity-60">{archivedCount}</span>
                </button>
              </div>
            )}

            {/* Dataset list */}
            <div className="flex-1 overflow-y-auto border-t border-[var(--border-subtle)]">
              {listLoading ? (
                <div className="space-y-px p-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-2.5">
                      <div className="skeleton h-6 w-6 rounded shrink-0" />
                      <div className="flex-1 space-y-1">
                        <div className="skeleton h-2.5 w-28 rounded" />
                        <div className="skeleton h-2 w-20 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : datasets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-3 text-center gap-2">
                  <Database className="h-5 w-5 text-[var(--text-tertiary)]" />
                  <p className="text-xs text-[var(--text-secondary)] font-medium">
                    {showArchived ? 'No archived datasets' : 'No datasets yet'}
                  </p>
                  {!showArchived && (
                    <button onClick={() => setShowUpload(true)} className="text-xs text-[var(--accent-blue)] hover:underline">
                      Import first dataset
                    </button>
                  )}
                </div>
              ) : (
                <motion.div initial="hidden" animate="visible" variants={listVariants} className="py-1">
                  {datasets.map(ds => (
                    <motion.div key={ds.id} variants={itemVariants}>
                      <PanelListItem
                        dataset={ds}
                        isSelected={ds.id === selectedId}
                        isArchived={!!ds.archived_at}
                        onSelect={() => handleSelect(ds.id)}
                        onDelete={handleDelete}
                        onArchive={handleArchive}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          </>
        ) : (
          /* ── Collapsed strip ── */
          <div className="flex flex-col items-center pt-3 gap-2">
            <button
              onClick={() => setPanelOpen(true)}
              className="h-7 w-7 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
              title="Expand panel"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="h-7 w-7 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] hover:bg-[var(--accent-blue-subtle)] transition-colors"
              title="Import dataset"
            >
              <Upload className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── RIGHT: detail or empty state ───────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {selectedId ? (
          <DatasetDetailPanel
            key={selectedId}
            datasetId={selectedId}
            projectId={projectId}
            isArchived={!!selectedDataset?.archived_at}
            onExpandPanel={() => setPanelOpen(true)}
            onArchive={() => { if (selectedId) handleArchive(selectedId, !selectedDataset?.archived_at) }}
            onDelete={() => { if (selectedId) handleDelete(selectedId) }}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
            <div className="w-12 h-12 rounded-xl bg-[var(--bg-inset)] flex items-center justify-center">
              <Database className="h-5 w-5 text-[var(--text-tertiary)]" />
            </div>
            <p className="text-sm font-semibold text-[var(--text-secondary)]">Select a dataset</p>
            <p className="text-xs text-[var(--text-tertiary)] max-w-xs leading-relaxed">
              Choose a dataset from the panel to view schema, clean data, check quality, and explore.
            </p>
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

// ─── Panel list item ──────────────────────────────────────────────────────────

interface PanelListItemProps {
  dataset: Dataset
  isSelected: boolean
  isArchived: boolean
  onSelect: () => void
  onDelete: (id: string) => void
  onArchive: (id: string, archived: boolean) => void
}

function PanelListItem({ dataset, isSelected, isArchived, onSelect, onDelete, onArchive }: PanelListItemProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const version = dataset.latest_version

  if (confirmingDelete) {
    return (
      <div className="mx-1 mb-0.5 rounded-md px-2 py-2 bg-[var(--status-error-bg)] border border-[var(--border-status-error)]">
        <p className="text-[10px] text-[var(--status-error-text)] font-medium truncate mb-1.5">Delete &ldquo;{dataset.name}&rdquo;?</p>
        <div className="flex gap-1">
          <button
            onClick={() => { onDelete(dataset.id); setConfirmingDelete(false) }}
            className="flex-1 py-0.5 rounded text-[10px] font-semibold bg-[var(--status-error)] text-white hover:bg-[var(--status-error-hover)] transition-colors"
          >
            Delete
          </button>
          <button
            onClick={() => setConfirmingDelete(false)}
            className="flex-1 py-0.5 rounded text-[10px] font-medium border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-row-hover)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group relative mx-1 mb-0.5 rounded-md px-2 py-2 cursor-pointer transition-colors',
        isSelected
          ? 'bg-[var(--bg-row-active)]'
          : 'hover:bg-[var(--bg-row-hover)]',
        isArchived && 'opacity-60'
      )}
      onClick={onSelect}
    >
      {/* Active indicator */}
      {isSelected && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[var(--accent-blue)] rounded-full" />
      )}

      <div className="flex items-start gap-2">
        <Database className={cn(
          'h-3.5 w-3.5 mt-0.5 shrink-0',
          isSelected ? 'text-[var(--accent-blue)]' : 'text-[var(--text-tertiary)]'
        )} />
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-xs font-medium truncate leading-snug',
            isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
          )}>
            {dataset.name}
          </p>
          {version && (
            <p className="data-mono text-[9px] text-[var(--text-tertiary)] mt-0.5 truncate">
              {version.row_count.toLocaleString()} · {version.column_count} cols
            </p>
          )}
        </div>

        {/* Hover actions */}
        <div
          className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => onArchive(dataset.id, !isArchived)}
            className="h-5 w-5 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-active)] transition-colors"
            title={isArchived ? 'Unarchive' : 'Archive'}
          >
            {isArchived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
          </button>
          <button
            onClick={() => setConfirmingDelete(true)}
            className="h-5 w-5 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)] transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
