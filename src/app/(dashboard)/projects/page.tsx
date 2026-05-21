"use client"

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Plus, FolderOpen, Search, ChevronRight,
  Archive, ArchiveRestore, X,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { createClient } from '@/lib/supabase/client'
import {
  createProject,
  updateProjectStatus,
} from '@/lib/data'
import { getProjectsOffline } from '@/lib/offline'
import { logAudit } from '@/lib/audit'
import { cn, formatRelative } from '@/lib/utils'
import { useTranslations } from '@/i18n/useTranslations'
import { toast } from 'sonner'
import type { Project } from '@/types/database'

// ── Types ──────────────────────────────────────────────────────────────────

interface ProjectWithCounts extends Project {
  dataset_count: number
  run_count: number
}

// ── Hero globe SVG ─────────────────────────────────────────────────────────

function GlobeWireframe() {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute right-0 top-1/2 -translate-y-1/2 h-48 w-48 opacity-[0.07] pointer-events-none select-none"
      aria-hidden
    >
      <circle cx="100" cy="100" r="80" stroke="white" strokeWidth="1" />
      <ellipse cx="100" cy="100" rx="40" ry="80" stroke="white" strokeWidth="1" />
      <ellipse cx="100" cy="100" rx="80" ry="32" stroke="white" strokeWidth="1" />
      <ellipse cx="100" cy="100" rx="80" ry="60" stroke="white" strokeWidth="0.6" />
      <ellipse cx="100" cy="100" rx="60" ry="80" stroke="white" strokeWidth="0.6" />
      <line x1="20" y1="100" x2="180" y2="100" stroke="white" strokeWidth="0.6" />
      <line x1="100" y1="20" x2="100" y2="180" stroke="white" strokeWidth="0.6" />
    </svg>
  )
}

// ── Hero banner ────────────────────────────────────────────────────────────

function HeroBanner({ projects, loading }: { projects: ProjectWithCounts[]; loading: boolean }) {
  const { t } = useTranslations()
  const activeProjects  = projects.filter(p => p.status !== 'archived').length
  const totalDatasets   = projects.reduce((s, p) => s + p.dataset_count, 0)
  const totalAnalyses   = projects.reduce((s, p) => s + p.run_count, 0)
  const totalProjects   = projects.length

  const stats = [
    { label: t('projects.stat.activeProjects', 'Active Projects'), value: loading ? '—' : String(activeProjects) },
    { label: t('projects.stat.datasets',       'Datasets'),        value: loading ? '—' : String(totalDatasets) },
    { label: t('projects.stat.analyses',       'Analyses'),        value: loading ? '—' : String(totalAnalyses) },
    { label: t('projects.stat.total',          'Total Projects'),  value: loading ? '—' : String(totalProjects) },
  ]

  return (
    <div
      className="mx-3 sm:mx-6 mt-5 mb-4 rounded-xl overflow-hidden relative flex-shrink-0"
      style={{ background: 'var(--bg-sidebar)' }}
    >
      <GlobeWireframe />

      {/* Left-side accent glow */}
      <div
        className="absolute top-0 left-0 w-48 h-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top left, rgba(59,130,246,0.12) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 px-6 py-5">
        <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--text-sidebar)] mb-2">
          {t('projects.banner.eyebrow', 'Global Health Research Infrastructure')}
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-white font-manrope leading-none mb-1.5">
          {t('projects.banner.title', 'Research Projects')}
        </h2>
        <p className="text-sm text-[var(--text-sidebar)] mb-5 max-w-sm leading-relaxed">
          {t('projects.banner.subtitle', 'Design studies, manage datasets, and run statistical analyses — all in one auditable platform.')}
        </p>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-white/10 pt-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p
                className="text-xl font-bold text-white leading-none"
                style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
              >
                {stat.value}
              </p>
              <p className="text-[9px] uppercase tracking-[0.08em] text-[var(--text-sidebar)] mt-0.5">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Single project row ──────────────────────────────────────────────────────

function ProjectRow({
  project,
  onArchive,
}: {
  project: ProjectWithCounts
  onArchive: (id: string, status: Project['status']) => void
}) {
  const { t } = useTranslations()
  const isArchived = project.status === 'archived'
  const isDraft    = project.status === 'draft'

  return (
    <Link href={`/projects/${project.id}/overview`} className="block">
      <div className={cn('row-item group', isArchived && 'opacity-50')} style={{ minHeight: '60px', alignItems: 'flex-start', paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>

        {/* Icon container */}
        <div
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mr-3 mt-0.5"
          style={{ background: 'var(--accent-blue-subtle)' }}
        >
          <FolderOpen className="h-4 w-4 text-[var(--accent-blue)]" />
        </div>

        {/* Title + description + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate leading-snug">
              {project.title}
            </p>
            {isDraft && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0"
                style={{
                  background:   'var(--status-warning-bg)',
                  color:        'var(--status-warning-text)',
                  border:       '1px solid var(--border-status-warning)',
                }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--status-warning)' }} />
                {t('common.draft', 'Draft')}
              </span>
            )}
          </div>

          {project.description && (
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-1 line-clamp-2">
              {project.description}
            </p>
          )}

          <p className="data-mono-xs text-[var(--text-tertiary)]">
            {formatRelative(project.updated_at)}
            {project.dataset_count > 0 && (
              <> · {project.dataset_count} {t(project.dataset_count === 1 ? 'projects.datasetSingular' : 'projects.datasetPlural', project.dataset_count === 1 ? 'dataset' : 'datasets')}</>
            )}
            {project.run_count > 0 && (
              <> · {project.run_count} {t(project.run_count === 1 ? 'projects.analysisSingular' : 'projects.analysisPlural', project.run_count === 1 ? 'analysis' : 'analyses')}</>
            )}
          </p>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-2 flex-shrink-0 mt-1">
          <button
            onClick={e => {
              e.preventDefault()
              e.stopPropagation()
              onArchive(project.id, isArchived ? 'active' : 'archived')
            }}
            title={isArchived ? t('projects.unarchive', 'Unarchive') : t('projects.archive', 'Archive')}
            className={cn(
              'row-action flex items-center justify-center h-6 w-6 rounded-md transition-colors duration-150',
              isArchived
                ? 'text-[var(--accent-blue)] hover:bg-[var(--accent-blue-subtle)]'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-row-active)] hover:text-[var(--text-secondary)]'
            )}
          >
            {isArchived
              ? <ArchiveRestore className="h-3.5 w-3.5" />
              : <Archive className="h-3.5 w-3.5" />
            }
          </button>

          <ChevronRight className="row-action h-4 w-4 text-[var(--text-tertiary)]" />
        </div>
      </div>
    </Link>
  )
}

// ── Loading skeleton row ────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="row-item pointer-events-none" style={{ minHeight: '60px', alignItems: 'flex-start', paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
      <div className="skeleton w-9 h-9 rounded-lg flex-shrink-0 mr-3" />
      <div className="flex-1 space-y-1.5">
        <div className="skeleton h-3.5 w-48 rounded" />
        <div className="skeleton h-3 w-64 rounded" />
        <div className="skeleton h-3 w-32 rounded" />
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { profile, loading: authLoading } = useAuth()
  const { activeWorkspace } = useWorkspace()
  const { t } = useTranslations()
  const searchParams = useSearchParams()

  const [projects, setProjects]         = useState<ProjectWithCounts[]>([])
  const [search, setSearch]             = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [showNew, setShowNew]           = useState(false)
  const [title, setTitle]               = useState('')
  const [description, setDescription]  = useState('')
  const [creating, setCreating]         = useState(false)
  const [loading, setLoading]           = useState(true)
  const [isStale, setIsStale]           = useState(false)

  const { isOnline } = useOnlineStatus()
  const supabase = useMemo(() => createClient(), [])

  // Open create dialog if ?new=1
  useEffect(() => {
    if (searchParams.get('new') === '1') setShowNew(true)
  }, [searchParams])

  const fetchProjects = useCallback(async () => {
    if (authLoading) return
    if (!profile) { setLoading(false); return }

    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8_000)
      )
      const result = await Promise.race([getProjectsOffline(supabase), timeout])
      if (result.data) {
        setProjects(result.data as unknown as ProjectWithCounts[])
        setIsStale(result.source === 'cache')
      }
    } catch {
      // network/IDB timeout or error — show empty state
    } finally {
      setLoading(false)
    }
  }, [profile, authLoading, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchProjects() }, [fetchProjects])

  // Create project
  const handleCreate = async () => {
    if (!title.trim() || !profile) return
    setCreating(true)

    const tempId   = `temp-${Date.now()}`
    const optimistic: ProjectWithCounts = {
      id: tempId, title: title.trim(),
      description: description.trim() || null,
      owner_id: profile.id, status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      dataset_count: 0, run_count: 0,
    } as ProjectWithCounts

    setProjects(prev => [optimistic, ...prev])
    setTitle(''); setDescription(''); setShowNew(false)

    const result = await createProject(supabase, {
      title: optimistic.title,
      description: optimistic.description,
      owner_id: profile.id,
      ...(activeWorkspace ? { workspace_id: activeWorkspace.id } : {}),
    })

    if (result.status === 'error') {
      setProjects(prev => prev.filter(p => p.id !== tempId))
      toast.error(t('projects.toastCreateFailed', 'Failed to create project'))
    } else if (result.data) {
      setProjects(prev => prev.map(p => p.id === tempId
        ? { ...result.data!, dataset_count: 0, run_count: 0 }
        : p
      ))
      toast.success(t('projects.toastCreated', 'Project created'))
    }
    setCreating(false)
  }

  // Archive / unarchive
  const handleArchive = async (id: string, status: Project['status']) => {
    const original = projects.find(p => p.id === id)
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    const result = await updateProjectStatus(supabase, id, status)
    if (result.status === 'error') {
      if (original) setProjects(prev => prev.map(p => p.id === id ? original : p))
      toast.error(t('projects.toastUpdateFailed', 'Failed to update project'))
      return
    }
    const action = status === 'archived' ? 'project.archived' : 'project.updated'
    await logAudit(
      action,
      'project',
      id,
      {
        summary: `${status === 'archived' ? 'Archived' : 'Restored'} project "${original?.title ?? id}"`,
        operation: { status_before: original?.status, status_after: status },
      },
      id,
    )
    toast.success(status === 'archived' ? t('projects.toastArchived', 'Project archived') : t('projects.toastRestored', 'Project restored'))
  }

  const archivedCount = projects.filter(p => p.status === 'archived').length

  const filtered = projects.filter(p => {
    if (!showArchived && p.status === 'archived') return false
    return !search || p.title.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="page-shell">

      {/* Hero banner */}
      <HeroBanner projects={projects} loading={loading} />

      {/* Cached data indicator */}
      {isStale && !isOnline && (
        <div className="flex items-center gap-1.5 px-6 pb-1">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
            style={{
              background: 'rgba(180,83,9,0.08)',
              color: '#b45309',
              border: '1px solid rgba(180,83,9,0.2)',
            }}
          >
            {t('projects.cachedData', 'Cached data · connect to refresh')}
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 sm:px-6 pb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)]" />
          <input
            type="text"
            placeholder={t('projects.searchPlaceholder', 'Search projects…')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs bg-[var(--bg-inset)] border border-transparent rounded-md outline-none focus:border-[var(--border-focus)] focus:bg-[var(--bg-surface)] placeholder:text-[var(--text-tertiary)] text-[var(--text-primary)] transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {archivedCount > 0 && (
          <button
            onClick={() => setShowArchived(v => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs transition-colors duration-150',
              showArchived
                ? 'bg-[var(--bg-row-active)] border-[var(--border-strong)] text-[var(--text-primary)]'
                : 'bg-transparent border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            )}
          >
            <Archive className="h-3.5 w-3.5" />
            {showArchived ? t('projects.hideArchived', 'Hide archived') : t('projects.showArchived', 'Show archived')}
          </button>
        )}

        <button
          onClick={() => setShowNew(true)}
          className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-white text-xs font-medium btn-press btn-primary"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('projects.newProject', 'New Project')}
        </button>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto">
        <div className="border-t border-[var(--border-row)]">

          {loading && (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          )}

          {!loading && projects.length === 0 && (
            <div className="empty-state">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--accent-blue-subtle)' }}>
                <FolderOpen className="h-6 w-6 text-[var(--accent-blue)]" />
              </div>
              <p className="empty-state-title">{t('projects.emptyTitle', 'Start your first project')}</p>
              <p className="empty-state-description">
                {t('projects.emptyDesc', 'Create a project to begin building your research record.')}
              </p>
              <button
                onClick={() => setShowNew(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-white text-xs font-medium btn-primary"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('projects.newProject', 'New Project')}
              </button>
            </div>
          )}

          {!loading && projects.length > 0 && filtered.length === 0 && (
            <div className="empty-state">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: 'var(--bg-inset)' }}>
                <Search className="h-5 w-5 text-[var(--text-tertiary)]" />
              </div>
              <p className="empty-state-title">{t('projects.noMatchTitle', 'No projects match')}</p>
              <p className="empty-state-description">{t('projects.noMatchDesc', 'Try a different search term.')}</p>
              <button
                onClick={() => setSearch('')}
                className="text-xs text-[var(--accent-blue)] hover:underline"
              >
                {t('projects.clearSearch', 'Clear search')}
              </button>
            </div>
          )}

          {!loading && filtered.map(project => (
            <ProjectRow
              key={project.id}
              project={project}
              onArchive={handleArchive}
            />
          ))}

        </div>
      </div>

      {/* Create project dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('projects.dialogTitle', 'New Project')}</DialogTitle>
            <DialogDescription>
              {t('projects.dialogDesc', 'Give your research project a name to get started.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <Label className="text-xs font-medium text-[var(--text-secondary)]">
                {t('projects.fieldTitle', 'Project title')}
              </Label>
              <input
                placeholder={t('projects.titlePlaceholder', 'e.g. Income and Health Outcomes Study')}
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
                className="mt-1.5 w-full h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-blue)]/20 placeholder:text-[var(--text-tertiary)] text-[var(--text-primary)] transition-all"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-[var(--text-secondary)]">
                {t('projects.fieldDesc', 'Description')} <span className="text-[var(--text-tertiary)] font-normal">{t('common.optional', '(optional)')}</span>
              </Label>
              <Textarea
                placeholder={t('projects.descPlaceholder', 'What are you investigating?')}
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="mt-1.5 resize-none text-sm"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <button
              onClick={() => { setShowNew(false); setTitle(''); setDescription('') }}
              className="h-8 px-3 rounded-md text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-default)] transition-colors"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !title.trim()}
              className="h-8 px-4 rounded-md text-white text-xs font-medium disabled:cursor-not-allowed btn-press btn-primary"
            >
              {creating ? t('projects.creating', 'Creating…') : t('projects.createBtn', 'Create Project')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
