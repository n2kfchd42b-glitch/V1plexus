'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Upload, Database, Archive, ArchiveRestore, Trash2, ChevronRight } from 'lucide-react'
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

const listVariants: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }
const itemVariants: Variants = { hidden: { opacity: 0, y: 4 }, visible: { opacity: 1, y: 0, transition: { duration: 0.15 } } }

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

  if (authLoading || !user) return null

  return (
    <div className="flex flex-row h-full min-h-0 bg-[var(--bg-app)] overflow-hidden">

      {/* ── LEFT PANEL — dataset list ─────────────────────────────────────── */}
      <div className="w-64 shrink-0 flex flex-col border-r border-[var(--border-row)] overflow-hidden">

        {/* Header */}
        <div className="px-4 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="page-title">Dataset Hub</h1>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                {datasets.length} {datasets.length === 1 ? 'dataset' : 'datasets'}
                {archivedCount > 0 && ` · ${archivedCount} archived`}
              </p>
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-white bg-[var(--accent-blue)] hover:bg-[var(--accent-blue-hover)] transition-colors shrink-0"
            >
              <Upload className="h-3 w-3" />
              Import
            </button>
          </div>
          {archivedCount > 0 && (
            <button
              onClick={() => setShowArchived(v => !v)}
              className={`mt-2 w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                showArchived
                  ? 'text-[var(--status-warning-text)] border-[var(--border-status-warning)]'
                  : 'border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-row-hover)]'
              }`}
              style={showArchived ? { background: 'var(--status-warning-bg)' } : undefined}
            >
              {showArchived ? 'View Active' : `View ${archivedCount} Archived`}
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto border-t border-[var(--border-row)]">
          {listLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-4 py-3 border-b border-[var(--border-row)]">
                <div className="skeleton h-3.5 w-36 rounded mb-1.5" />
                <div className="skeleton h-3 w-24 rounded" />
              </div>
            ))
          ) : datasets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 px-4 text-center">
              <Database className="h-6 w-6 text-[var(--text-tertiary)] mb-2" />
              <p className="text-xs text-[var(--text-secondary)] font-medium">
                {showArchived ? 'No archived datasets' : 'No datasets yet'}
              </p>
              {!showArchived && (
                <button onClick={() => setShowUpload(true)} className="mt-2 text-xs text-[var(--accent-blue)] hover:underline">
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
                    isSelected={ds.id === selectedId}
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

      {/* ── RIGHT PANEL ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {!selectedId ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-1" style={{ background: 'var(--bg-inset)' }}>
              <Database className="h-6 w-6 text-[var(--text-tertiary)]" />
            </div>
            <p className="text-sm font-semibold text-[var(--text-secondary)]">Select a dataset</p>
            <p className="text-xs text-[var(--text-tertiary)] max-w-xs leading-relaxed">
              Choose a dataset from the left to view its schema, raw data, explorations, and quality metrics.
            </p>
          </div>
        ) : (
          <DatasetDetailPanel
            key={selectedId}
            datasetId={selectedId}
            projectId={projectId}
          />
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
  isSelected: boolean
  isArchived: boolean
  onSelect: () => void
  onDelete: (id: string) => void
  onArchive: (id: string, archived: boolean) => void
}

function DatasetListItem({ dataset, isSelected, isArchived, onSelect, onDelete, onArchive }: DatasetListItemProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const version = dataset.latest_version

  if (confirmingDelete) {
    return (
      <div className="px-4 py-3 border-b border-[var(--border-row)] flex items-center gap-2">
        <span className="text-xs text-[var(--timeline-flagged)] flex-1 min-w-0 truncate">
          Delete &ldquo;{dataset.name}&rdquo;?
        </span>
        <button
          onClick={() => { onDelete(dataset.id); setConfirmingDelete(false) }}
          className="px-2 py-1 rounded text-xs font-medium bg-[var(--timeline-flagged)] text-white hover:opacity-90 shrink-0"
        >
          Delete
        </button>
        <button
          onClick={() => setConfirmingDelete(false)}
          className="px-2 py-1 rounded text-xs font-medium border border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-row-hover)] shrink-0"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group relative border-b border-[var(--border-row)] last:border-0 cursor-pointer transition-colors',
        isArchived && 'opacity-60'
      )}
      style={isSelected ? {
        background:  'var(--accent-blue-subtle)',
        borderLeft:  '3px solid var(--accent-blue)',
      } : undefined}
      onClick={onSelect}
    >
      <div className={cn('py-3 flex items-start gap-2.5', isSelected ? 'pl-3 pr-3' : 'px-4')}>
        {/* Icon container */}
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
          style={isSelected
            ? { background: 'rgba(59,130,246,0.15)' }
            : { background: 'var(--bg-inset)' }
          }
        >
          <Database className={cn(
            'h-3.5 w-3.5',
            isSelected ? 'text-[var(--accent-blue)]' : 'text-[var(--text-tertiary)]'
          )} />
        </div>

        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-xs truncate leading-snug',
            isSelected ? 'font-bold text-[var(--accent-blue)]' : 'font-semibold text-[var(--text-primary)]'
          )}>
            {dataset.name}
          </p>
          <p className="data-mono-xs text-[var(--text-tertiary)] mt-0.5 truncate">
            {version
              ? `${version.row_count.toLocaleString()} rows · ${version.column_count} cols`
              : 'Processing…'}
          </p>
        </div>

        <div
          className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => onArchive(dataset.id, !isArchived)}
            className="h-5 w-5 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            title={isArchived ? 'Unarchive' : 'Archive'}
          >
            {isArchived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
          </button>
          <button
            onClick={() => setConfirmingDelete(true)}
            className="h-5 w-5 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:text-[var(--timeline-flagged)] transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
