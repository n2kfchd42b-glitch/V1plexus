"use client"

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Plus, FolderOpen, Search, ArrowUp, ArrowDown,
  Clock, ChevronRight
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ViewToggle, type ViewMode } from '@/components/ui/view-toggle'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspace } from '@/hooks/useWorkspace'
import { createClient } from '@/lib/supabase/client'
import { cn, formatRelative, statusLabel } from '@/lib/utils'
import { toast } from 'sonner'
import type { Project } from '@/types/database'

const STATUS_OPTIONS: Project['status'][] = ['draft', 'active', 'completed', 'archived']

const statusStyles: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  draft:     { bg: 'bg-slate-50',    text: 'text-slate-500',   dot: 'bg-slate-400',   border: 'border-slate-200' },
  active:    { bg: 'bg-blue-50',     text: 'text-blue-600',    dot: 'bg-blue-500',    border: 'border-blue-100' },
  completed: { bg: 'bg-green-50',    text: 'text-green-600',   dot: 'bg-green-500',   border: 'border-green-100' },
  archived:  { bg: 'bg-slate-50',    text: 'text-slate-400',   dot: 'bg-slate-300',   border: 'border-slate-200' },
}

function StatusBadge({ status }: { status: string }) {
  const s = statusStyles[status] ?? statusStyles.draft
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase border',
      s.bg, s.text, s.border
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', s.dot)} />
      {statusLabel(status)}
    </span>
  )
}

function TableView({ projects }: { projects: Project[] }) {
  const [sortKey, setSortKey] = useState<'title' | 'status' | 'updated_at'>('updated_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sorted = [...projects].sort((a, b) => {
    const av = a[sortKey] ?? '', bv = b[sortKey] ?? ''
    if (sortDir === 'asc') return av > bv ? 1 : -1
    return av < bv ? 1 : -1
  })

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ k }: { k: typeof sortKey }) =>
    sortKey === k
      ? sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      : null

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="grid grid-cols-[1fr_120px_140px_36px] gap-4 px-6 py-3 bg-slate-50/50 border-b border-slate-200">
        {[
          { key: 'title' as const,      label: 'Title' },
          { key: 'status' as const,     label: 'Status' },
          { key: 'updated_at' as const, label: 'Last updated' },
        ].map(col => (
          <button
            key={col.key}
            onClick={() => toggleSort(col.key)}
            className="flex items-center gap-1 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            {col.label}
            <SortIcon k={col.key} />
          </button>
        ))}
        <div />
      </div>
      <div className="divide-y divide-slate-100">
        {sorted.map((project, i) => (
          <Link key={project.id} href={`/projects/${project.id}`}>
            <div className={cn(
              "grid grid-cols-[1fr_120px_140px_36px] gap-4 px-6 py-3 items-center hover:bg-blue-50/30 transition-colors duration-100 group",
              i % 2 === 1 && "bg-slate-50/50"
            )}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-6 w-6 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="h-3.5 w-3.5 text-[#0052CC]" />
                </div>
                <span className="text-sm text-slate-900 truncate font-medium">{project.title}</span>
              </div>
              <StatusBadge status={project.status} />
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatRelative(project.updated_at)}
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function CardView({ projects }: { projects: Project[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {projects.map(project => (
        <Link key={project.id} href={`/projects/${project.id}`}>
          <div className="group bg-white border border-slate-200 rounded-xl p-5 shadow-sm cursor-pointer h-full transition-all duration-150 hover:shadow-md hover:-translate-y-px">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <FolderOpen className="h-4 w-4 text-[#0052CC]" />
              </div>
              <StatusBadge status={project.status} />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1 line-clamp-2 leading-tight">
              {project.title}
            </h3>
            {project.description && (
              <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                {project.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-auto pt-2 border-t border-slate-100">
              <Clock className="h-3 w-3 text-slate-400" />
              <span className="text-xs text-slate-400">{formatRelative(project.updated_at)}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

function KanbanView({ projects, onStatusChange }: {
  projects: Project[]
  onStatusChange: (id: string, status: Project['status']) => void
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STATUS_OPTIONS.map(status => {
        const cols = projects.filter(p => p.status === status)
        return (
          <div key={status} className="flex-shrink-0 w-64">
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={status} />
              <span className="text-xs text-[var(--text-tertiary)]">{cols.length}</span>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {cols.length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-xl py-8 text-center">
                  <p className="text-xs text-slate-400">No projects</p>
                </div>
              ) : (
                cols.map(project => (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-px">
                      <p className="text-sm font-medium text-slate-900 line-clamp-2 mb-2">{project.title}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelative(project.updated_at)}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ProjectsPage() {
  const { profile, loading: authLoading } = useAuth()
  const { activeWorkspace } = useWorkspace()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [showNew, setShowNew] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (searchParams.get('new') === '1') setShowNew(true)
  }, [searchParams])

  const fetchProjects = useCallback(async () => {
    if (authLoading) return
    if (!profile) { setLoading(false); return }
    let query = supabase.from('projects').select('*')
    if (activeWorkspace) query = query.eq('workspace_id', activeWorkspace.id)
    const { data } = await query.order('updated_at', { ascending: false })
    if (data) setProjects(data)
    setLoading(false)
  }, [profile, authLoading, activeWorkspace]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const handleCreate = async () => {
    if (!title.trim() || !profile) return
    setCreating(true)

    const tempId = `temp-${Date.now()}`
    const optimistic: Project = {
      id: tempId,
      title: title.trim(),
      description: description.trim() || null,
      owner_id: profile.id,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Project
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
      setProjects(prev => prev.map(p => p.id === tempId ? data : p))
      toast.success('Project created')
    }
    setCreating(false)
  }

  const handleStatusChange = async (id: string, status: Project['status']) => {
    const original = projects.find(p => p.id === id)
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    const { error } = await supabase.from('projects').update({ status }).eq('id', id)
    if (error) {
      if (original) setProjects(prev => prev.map(p => p.id === id ? original : p))
      toast.error('Failed to update status')
    }
  }

  const filtered = projects.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="px-8 py-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-headline">Projects</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 py-2.5 px-5 rounded-lg bg-[#0052CC] text-white text-sm font-headline font-bold hover:bg-[#0040a2] transition-all btn-press"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-9 pr-4 text-xs focus:ring-1 focus:ring-[#0052CC] focus:border-[#0052CC] transition-all outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="ml-auto">
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 h-36 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="skeleton h-8 w-8 rounded-lg" />
                <div className="skeleton h-5 w-16 rounded" />
              </div>
              <div className="skeleton h-4 w-3/4 mb-2" />
              <div className="skeleton h-3.5 w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-16 text-center shadow-sm">
          <FolderOpen className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-base font-bold text-slate-900 mb-1">
            {search ? 'No projects match your search' : 'Create your first project'}
          </p>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-5">
            {search
              ? 'Try a different search term or clear the filter.'
              : 'Start a research project to organize your data, documents, and analysis.'}
          </p>
          {!search && (
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-2 py-2.5 px-5 rounded-lg bg-[#0052CC] text-white text-sm font-bold hover:bg-[#0040a2] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Project
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <TableView projects={filtered} />
      ) : viewMode === 'kanban' ? (
        <KanbanView projects={filtered} onStatusChange={handleStatusChange} />
      ) : (
        <CardView projects={filtered} />
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>Create a new research project workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm font-medium text-[var(--text-primary)]">Project Title</Label>
              <input
                placeholder="e.g. Cognitive Load in Online Learning"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                className="mt-1.5 w-full h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-blue)]/20 placeholder:text-[var(--text-tertiary)] text-[var(--text-primary)] transition-all"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-[var(--text-primary)]">
                Description <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
              </Label>
              <Textarea
                placeholder="Brief description of the research project…"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="mt-1.5 resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <button
              onClick={() => setShowNew(false)}
              className="h-8 px-3 rounded-md text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-default)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !title.trim()}
              className="h-8 px-4 rounded-md bg-[var(--accent-blue)] text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-press"
            >
              {creating ? 'Creating…' : 'Create Project'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
