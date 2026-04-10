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
import { createClient } from '@/lib/supabase/client'
import { cn, formatRelative, statusLabel } from '@/lib/utils'
import { toast } from 'sonner'
import type { Project } from '@/types/database'

// ── Types ──────────────────────────────────────────────────────────────────

interface ProjectWithCounts extends Project {
  dataset_count: number
  run_count: number
}

// ── Status dot ─────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color: Record<string, string> = {
    draft:     'bg-[var(--timeline-neutral)]',
    active:    'bg-[var(--accent-blue)]',
    completed: 'bg-[var(--timeline-verified)]',
    archived:  'bg-[var(--border-strong)]',
  }
  return (
    <span className={cn('status-dot', color[status] ?? color.draft)} />
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
  const isArchived = project.status === 'archived'

  return (
    <Link href={`/projects/${project.id}/overview`} className="block">
      <div className={cn('row-item group', isArchived && 'opacity-50')}>
        {/* Left — title + meta */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <StatusDot status={project.status} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate leading-snug">
              {project.title}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              {statusLabel(project.status)}
              {project.dataset_count > 0 && (
                <> · {project.dataset_count} dataset{project.dataset_count !== 1 ? 's' : ''}</>
              )}
              {project.run_count > 0 && (
                <> · {project.run_count} {project.run_count === 1 ? 'analysis' : 'analyses'}</>
              )}
            </p>
          </div>
        </div>

        {/* Right — last active + actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-[var(--text-tertiary)] row-action tabular-nums">
            {formatRelative(project.updated_at)}
          </span>

          <button
            onClick={e => {
              e.preventDefault()
              e.stopPropagation()
              onArchive(project.id, isArchived ? 'active' : 'archived')
            }}
            title={isArchived ? 'Unarchive' : 'Archive'}
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
    <div className="row-item pointer-events-none">
      <div className="flex items-center gap-3 flex-1">
        <div className="skeleton h-1.5 w-1.5 rounded-full flex-shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="skeleton h-3.5 w-48 rounded" />
          <div className="skeleton h-3 w-32 rounded" />
        </div>
      </div>
      <div className="skeleton h-3 w-16 rounded flex-shrink-0" />
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { profile, loading: authLoading } = useAuth()
  const { activeWorkspace } = useWorkspace()
  const searchParams = useSearchParams()

  const [projects, setProjects]         = useState<ProjectWithCounts[]>([])
  const [search, setSearch]             = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [showNew, setShowNew]           = useState(false)
  const [title, setTitle]               = useState('')
  const [description, setDescription]  = useState('')
  const [creating, setCreating]         = useState(false)
  const [loading, setLoading]           = useState(true)

  const supabase = useMemo(() => createClient(), [])

  // Open create dialog if ?new=1
  useEffect(() => {
    if (searchParams.get('new') === '1') setShowNew(true)
  }, [searchParams])

  const fetchProjects = useCallback(async () => {
    if (authLoading) return
    if (!profile) { setLoading(false); return }

    const { data: projectRows } = await supabase
      .from('projects')
      .select('*')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(200)

    if (!projectRows) { setLoading(false); return }

    // Fetch dataset and run counts in parallel
    const ids = projectRows.map(p => p.id)
    const [{ data: datasets }, { data: runs }] = await Promise.all([
      supabase.from('datasets').select('project_id').in('project_id', ids),
      supabase.from('analysis_runs').select('project_id').in('project_id', ids),
    ])

    const datasetCountMap: Record<string, number> = {}
    const runCountMap:     Record<string, number> = {}
    for (const d of datasets ?? []) datasetCountMap[d.project_id] = (datasetCountMap[d.project_id] ?? 0) + 1
    for (const r of runs ?? [])     runCountMap[r.project_id]     = (runCountMap[r.project_id]     ?? 0) + 1

    setProjects(projectRows.map(p => ({
      ...p,
      dataset_count: datasetCountMap[p.id] ?? 0,
      run_count:     runCountMap[p.id]     ?? 0,
    })))
    setLoading(false)
  }, [profile, authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

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

    const { data, error } = await supabase
      .from('projects')
      .insert({
        title: optimistic.title,
        description: optimistic.description,
        owner_id: profile.id,
        ...(activeWorkspace ? { workspace_id: activeWorkspace.id } : {}),
      })
      .select()
      .single()

    if (error) {
      setProjects(prev => prev.filter(p => p.id !== tempId))
      toast.error('Failed to create project')
    } else if (data) {
      setProjects(prev => prev.map(p => p.id === tempId
        ? { ...data, dataset_count: 0, run_count: 0 }
        : p
      ))
      toast.success('Project created')
    }
    setCreating(false)
  }

  // Archive / unarchive
  const handleArchive = async (id: string, status: Project['status']) => {
    const original = projects.find(p => p.id === id)
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    const { error } = await supabase.from('projects').update({ status }).eq('id', id)
    if (error) {
      if (original) setProjects(prev => prev.map(p => p.id === id ? original : p))
      toast.error('Failed to update project')
    } else {
      toast.success(status === 'archived' ? 'Project archived' : 'Project restored')
    }
  }

  // Derived lists
  const archivedCount = projects.filter(p => p.status === 'archived').length
  const activeCount   = projects.filter(p => p.status !== 'archived').length

  const filtered = projects.filter(p => {
    if (!showArchived && p.status === 'archived') return false
    return !search || p.title.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="page-shell">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Your Projects</h1>
          {!loading && (
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              {activeCount} active
              {archivedCount > 0 && ` · ${archivedCount} archived`}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[var(--accent-blue)] text-white text-xs font-medium hover:bg-blue-600 transition-colors btn-press"
        >
          <Plus className="h-3.5 w-3.5" />
          New Project
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-2 px-6 pb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)]" />
          <input
            type="text"
            placeholder="Search projects…"
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
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
        )}
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto">
        <div className="border-t border-[var(--border-row)]">

          {/* Loading */}
          {loading && (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          )}

          {/* Empty — no projects exist */}
          {!loading && projects.length === 0 && (
            <div className="empty-state">
              <FolderOpen className="empty-state-icon h-8 w-8" />
              <p className="empty-state-title">Start your first project</p>
              <p className="empty-state-description">
                Create a project to begin building your research record.
              </p>
              <button
                onClick={() => setShowNew(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[var(--accent-blue)] text-white text-xs font-medium hover:bg-blue-600 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New Project
              </button>
            </div>
          )}

          {/* Empty — search returned nothing */}
          {!loading && projects.length > 0 && filtered.length === 0 && (
            <div className="empty-state">
              <Search className="empty-state-icon h-7 w-7" />
              <p className="empty-state-title">No projects match</p>
              <p className="empty-state-description">
                Try a different search term.
              </p>
              <button
                onClick={() => setSearch('')}
                className="text-xs text-[var(--accent-blue)] hover:underline"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Rows */}
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
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>
              Give your research project a name to get started.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <Label className="text-xs font-medium text-[var(--text-secondary)]">
                Project title
              </Label>
              <input
                placeholder="e.g. Income and Health Outcomes Study"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
                className="mt-1.5 w-full h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-blue)]/20 placeholder:text-[var(--text-tertiary)] text-[var(--text-primary)] transition-all"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-[var(--text-secondary)]">
                Description <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
              </Label>
              <Textarea
                placeholder="What are you investigating?"
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
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !title.trim()}
              className="h-8 px-4 rounded-md bg-[var(--accent-blue)] text-white text-xs font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors btn-press"
            >
              {creating ? 'Creating…' : 'Create Project'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
