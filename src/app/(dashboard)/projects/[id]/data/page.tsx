'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Upload, Database, Archive, ArchiveRestore, Trash2,
  ChevronsLeft, ChevronsRight, ArrowLeft,
} from 'lucide-react'
import { motion, type Variants } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DatasetUpload } from '@/components/data/DatasetUpload'
import { DatasetDetailPanel } from '@/components/data/DatasetDetailPanel'
import { useAuth } from '@/hooks/useAuth'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { createClient } from '@/lib/supabase/client'
import {
  countArchivedProjectDatasets,
  softDeleteDataset,
  setDatasetArchived,
} from '@/lib/data'
import {
  getActiveProjectDatasetsOffline,
  getArchivedProjectDatasetsOffline,
} from '@/lib/offline'
import { toast } from 'sonner'
import { logAudit } from '@/lib/audit'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/useTranslations'
import type { Dataset } from '@/types/database'

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
  const { t }     = useTranslations()

  const [datasets,      setDatasets]      = useState<Dataset[]>([])
  const [archivedCount, setArchivedCount] = useState(0)
  const [listLoading,   setListLoading]   = useState(true)
  const [showArchived,  setShowArchived]  = useState(false)
  const [showUpload,    setShowUpload]    = useState(false)
  const [selectedId,    setSelectedId]    = useState<string | null>(null)
  const [panelOpen,     setPanelOpen]     = useState(true)
  const [isStale,       setIsStale]       = useState(false)

  const { isOnline } = useOnlineStatus()

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  const fetchDatasets = useCallback(async () => {
    if (!user) return
    setListLoading(true)
    try {
      const [datasetsResult, archivedCountResult] = await Promise.all([
        showArchived
          ? getArchivedProjectDatasetsOffline(supabase, projectId)
          : getActiveProjectDatasetsOffline(supabase, projectId),
        countArchivedProjectDatasets(supabase, projectId),
      ])

      setArchivedCount(archivedCountResult.data ?? 0)
      setIsStale(datasetsResult.source === 'cache')

      if (!datasetsResult.data?.length) { setDatasets([]); return }

      // latest_version is now embedded in the dataset record from the offline layer
      setDatasets(datasetsResult.data as unknown as Dataset[])
    } finally {
      setListLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, showArchived, user])

  useEffect(() => { fetchDatasets() }, [fetchDatasets])

  const handleSelect = (id: string) => {
    setSelectedId(id)
    // On desktop: collapse the list panel to give detail more space
    // On mobile: the CSS already switches to showing detail full-width
    if (window.innerWidth >= 768) {
      setPanelOpen(false)
    }
  }

  const handleUploadSuccess = (datasetId: string) => {
    setShowUpload(false)
    fetchDatasets().then(() => handleSelect(datasetId))
  }

  const handleDelete = async (id: string) => {
    const target = datasets.find(d => d.id === id)
    const result = await softDeleteDataset(supabase, id)
    if (result.status === 'error') { toast.error(t('data.toastDeleteFailed')); return }
    setDatasets(prev => prev.filter(d => d.id !== id))
    if (selectedId === id) { setSelectedId(null); setPanelOpen(true) }
    const res = await logAudit(
      'dataset.deleted',
      'dataset',
      id,
      {
        summary: `Deleted dataset "${target?.name ?? id}"`,
        operation: { soft_delete: true, dataset_name: target?.name ?? null },
      },
      projectId,
    )
    if (!res.success) toast.warning(t('data.toastAuditFailed'))
    toast.success(t('data.toastDeleted'))
  }

  const handleArchive = async (id: string, archive: boolean) => {
    const target = datasets.find(d => d.id === id)
    const result = await setDatasetArchived(supabase, id, archive)
    if (result.status === 'error') { toast.error(archive ? t('data.toastArchiveFailed') : t('data.toastUnarchiveFailed')); return }
    setDatasets(prev => prev.filter(d => d.id !== id))
    if (selectedId === id) { setSelectedId(null); setPanelOpen(true) }
    const res = await logAudit(
      archive ? 'dataset.archived' : 'dataset.unarchived',
      'dataset',
      id,
      {
        summary: `${archive ? 'Archived' : 'Unarchived'} dataset "${target?.name ?? id}"`,
        operation: { dataset_name: target?.name ?? null },
      },
      projectId,
    )
    if (!res.success) toast.warning(t('data.toastAuditFailed'))
    toast.success(archive ? t('data.toastArchived') : t('data.toastUnarchived'))
  }

  const selectedDataset = datasets.find(d => d.id === selectedId) ?? null

  if (authLoading || !user) return null

  // On mobile: show only the list pane, or only the detail pane (not both)
  const showMobileList   = !selectedId
  const showMobileDetail = !!selectedId

  return (
    <div className="flex flex-col md:flex-row bg-[var(--bg-app)] overflow-hidden h-[calc(100vh-6.5rem)]">

      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      {/* Desktop: always visible (collapses to icon strip). Mobile: only when no dataset selected */}
      <div className={cn(
        'flex flex-col border-r border-[var(--border-row)] bg-[var(--bg-surface)] overflow-hidden transition-all duration-200',
        // Mobile: full width when showing list, hidden when detail is open
        showMobileList  ? 'flex' : 'hidden',
        // Tablet/desktop: always shown, collapses to icon strip
        'md:flex md:shrink-0',
        panelOpen ? 'md:w-64' : 'md:w-10',
        // Mobile takes full width
        'w-full md:w-auto'
      )}>
        {panelOpen ? (
          <>
            {/* Panel header */}
            <div className="flex items-center justify-between px-3 pt-4 pb-3 shrink-0 border-b border-[var(--border-subtle)]">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{t('data.datasets')}</p>
                {!listLoading && (
                  <p className="text-[10px] text-[var(--text-tertiary)]">
                    {datasets.length} {showArchived ? t('common.inactive', 'archived') : t('common.active')}
                    {isStale && !isOnline && (
                      <span
                        className="ml-1.5 inline-flex items-center px-1.5 rounded-full"
                        style={{
                          background: 'rgba(180,83,9,0.08)',
                          color: '#b45309',
                          border: '1px solid rgba(180,83,9,0.2)',
                          fontSize: 9,
                          fontWeight: 600,
                        }}
                      >
                        {t('data.cached')}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setShowUpload(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--accent-primary)] text-[var(--text-inverse)] text-[11px] font-semibold hover:opacity-90 transition-opacity"
                >
                  <Upload className="h-3 w-3" />
                  {t('data.import')}
                </button>
                <button
                  onClick={() => setPanelOpen(false)}
                  className="h-6 w-6 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                  title={t('data.collapsePanel')}
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
                  {t('common.active')}
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
                  {t('projects.archive', 'Archived')} <span className="opacity-60">{archivedCount}</span>
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
                    {showArchived ? t('data.noArchivedDatasets') : t('data.noDatasetsYet')}
                  </p>
                  {!showArchived && (
                    <button onClick={() => setShowUpload(true)} className="text-xs text-[var(--accent-blue)] hover:underline">
                      {t('data.importFirstDataset')}
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
              title={t('data.expandPanel')}
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="h-7 w-7 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] hover:bg-[var(--accent-blue-subtle)] transition-colors"
              title={t('data.importDataset')}
            >
              <Upload className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── RIGHT: detail or empty state ───────────────────────────────────── */}
      {/* Mobile: only shown when a dataset is selected. Desktop: always shown */}
      <div className={cn(
        'flex-1 min-w-0 overflow-hidden flex flex-col',
        showMobileDetail ? 'flex' : 'hidden',
        'md:flex'
      )}>
        {/* Mobile back button */}
        {selectedId && (
          <button
            onClick={() => { setSelectedId(null); setPanelOpen(true) }}
            className="md:hidden flex items-center gap-2 px-4 h-11 border-b border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('data.backToDatasets')}
          </button>
        )}

        <div className="flex-1 min-h-0 overflow-hidden">
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
              <p className="text-sm font-semibold text-[var(--text-secondary)]">{t('data.selectDataset')}</p>
              <p className="text-xs text-[var(--text-tertiary)] max-w-xs leading-relaxed">
                {t('data.selectDatasetDesc')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Upload dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('data.importDataset')}</DialogTitle>
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
  const { t } = useTranslations()
  const version = dataset.latest_version

  if (confirmingDelete) {
    return (
      <div className="mx-1 mb-0.5 rounded-md px-2 py-2 bg-[var(--status-error-bg)] border border-[var(--border-status-error)]">
        <p className="text-[10px] text-[var(--status-error-text)] font-medium truncate mb-1.5">{t('common.delete')} &ldquo;{dataset.name}&rdquo;?</p>
        <div className="flex gap-1">
          <button
            onClick={() => { onDelete(dataset.id); setConfirmingDelete(false) }}
            className="flex-1 py-0.5 rounded text-[10px] font-semibold bg-[var(--status-error)] text-white hover:bg-[var(--status-error-hover)] transition-colors"
          >
            {t('common.delete')}
          </button>
          <button
            onClick={() => setConfirmingDelete(false)}
            className="flex-1 py-0.5 rounded text-[10px] font-medium border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-row-hover)] transition-colors"
          >
            {t('common.cancel')}
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
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[var(--accent-primary)] rounded-full" />
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
          {version && !isSelected && (
            <p className="data-mono text-[9px] text-[var(--text-tertiary)] mt-0.5 truncate">
              {version.row_count.toLocaleString()} · {version.column_count} cols
            </p>
          )}
          {version && isSelected && (() => {
            const schema = version.schema_info ?? []
            const totalCells = version.row_count * schema.length
            const totalMissing = schema.reduce((s: number, c: { null_count?: number }) => s + (c.null_count ?? 0), 0)
            const missingPct = totalCells > 0 ? ((totalMissing / totalCells) * 100).toFixed(1) : '0.0'
            const integrityPct = totalCells > 0 ? (100 - (totalMissing / totalCells) * 100).toFixed(1) : '100.0'
            return (
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-2 pr-1">
                {[
                  { label: t('data.statRows'),      value: version.row_count.toLocaleString(), color: 'text-[var(--accent-blue)]' },
                  { label: t('data.statCols'),      value: String(version.column_count),        color: 'text-[var(--accent-blue)]' },
                  { label: t('data.statMissing'),   value: `${missingPct}%`,                    color: parseFloat(missingPct) > 0 ? 'text-[var(--status-error)]' : 'text-[var(--accent-blue)]' },
                  { label: t('data.statIntegrity'), value: `${integrityPct}%`,                  color: 'text-[var(--accent-blue)]' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex flex-col">
                    <span className={`data-mono text-[11px] font-bold tabular-nums leading-none ${color}`}>{value}</span>
                    <span className="text-[9px] text-[var(--text-tertiary)] leading-none mt-0.5">{label}</span>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

        {/* Hover actions */}
        <div
          className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => onArchive(dataset.id, !isArchived)}
            className="h-5 w-5 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-active)] transition-colors"
            title={isArchived ? t('data.unarchive') : t('common.archive', 'Archive')}
          >
            {isArchived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
          </button>
          <button
            onClick={() => setConfirmingDelete(true)}
            className="h-5 w-5 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)] transition-colors"
            title={t('common.delete')}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
