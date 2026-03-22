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
import { createClient } from '@/lib/supabase/client'
import { cn, formatRelative, statusLabel } from '@/lib/utils'
import { toast } from 'sonner'
import type { Project } from '@/types/database'

const STATUS_OPTIONS: Project['status'][] = ['draft', 'active', 'completed', 'archived']

const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
  draft:     { bg: 'bg-[#F4F4F5]', text: 'text-[#71717A]', dot: 'bg-[#A1A1AA]' },
  active:    { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', dot: 'bg-[#3B82F6]' },
  completed: { bg: 'bg-[#F0FDF4]', text: 'text-[#16A34A]', dot: 'bg-[#22C55E]' },
  archived:  { bg: 'bg-[#FAFAFA]', text: 'text-[#A1A1AA]', dot: 'bg-[#D4D4D8]' },
}

function StatusBadge({ status }: { status: string }) {
  const s = statusStyles[status] ?? statusStyles.draft
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium',
      s.bg, s.text
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
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1fr_120px_140px_36px] gap-4 px-4 py-2.5 bg-[var(--bg-inset)] border-b border-[var(--border-default)]">
        {[
          { key: 'title' as const,      label: 'Title' },
          { key: 'status' as const,     label: 'Status' },
          { key: 'updated_at' as const, label: 'Last updated' },
        ].map(col => (
          <button
            key={col.key}
            onClick={() => toggleSort(col.key)}
            className="flex items-center gap-1 text-left text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            {col.label}
            <SortIcon k={col.key} />
          </button>
        ))}
        <div />
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {sorted.map(project => (
          <Link key={project.id} href={`/projects/${project.id}`}>
            <div className="grid grid-cols-[1fr_120px_140px_36px] gap-4 px-4 py-2.5 items-center hover:bg-[var(--bg-surface-hover)] transition-colors duration-100 group">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-6 w-6 rounded bg-[var(--accent-blue-subtle)] flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                </div>
                <span className="text-sm text-[var(--text-primary)] truncate font-medium">{project.title}</span>
              </div>
              <StatusBadge status={project.status} />
              <div className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatRelative(project.updated_at)}
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)]" />
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
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {projects.map(project => (
        <Link key={project.id} href={`/projects/${project.id}`}>
          <div className="group bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4 card-hover cursor-pointer h-full">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-[var(--accent-blue-subtle)] flex items-center justify-center flex-shrink-0">
                <FolderOpen className="h-4 w-4 text-[var(--accent-blue)]" />
              </div>
              <StatusBadge status={project.status} />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1 line-clamp-2 leading-tight">
              {project.title}
            </h3>
            {project.description && (
              <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-3">
                {project.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-auto pt-2 border-t border-[var(--border-subtle)]">
              <Clock className="h-3 w-3 text-[var(--text-tertiary)]" />
              <span className="text-xs text-[var(--text-tertiary)]">{formatRelative(project.updated_at)}</span>
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
                <div className="border-2 border-dashed border-[var(--border-default)] rounded-lg py-8 text-center">
                  <p className="text-xs text-[var(--text-tertiary)]">No projects</p>
                </div>
              ) : (
                cols.map(project => (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3 card-hover cursor-pointer">
                      <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-2 mb-2">{project.title}</p>
                      <p className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
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
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false })
    if (data) setProjects(data)
    setLoading(false)
  }, [profile, authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

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
      .insert({ title: optimistic.title, description: optimistic.description, owner_id: profile.id })
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
    <div className="px-6 py-5 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">Projects</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[var(--accent-blue)] text-white text-sm font-medium hover:bg-blue-600 transition-colors duration-150 btn-press"
        >
          <Plus className="h-3.5 w-3.5" />
          New Project
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)]" />
          <input
            type="text"
            placeholder="Search projects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-sm bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-blue)]/20 placeholder:text-[var(--text-tertiary)] text-[var(--text-primary)] transition-all duration-100"
          />
        </div>
        <div className="ml-auto">
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4 h-36">
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
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg py-16 text-center">
          <FolderOpen className="h-12 w-12 mx-auto text-[var(--text-tertiary)] mb-3" />
          <p className="text-base font-semibold text-[var(--text-primary)] mb-1">
            {search ? 'No projects match your search' : 'Create your first project'}
          </p>
          <p className="text-sm text-[var(--text-secondary)] max-w-sm mx-auto mb-5">
            {search
              ? 'Try a different search term or clear the filter.'
              : 'Start a research project to organize your data, documents, and analysis.'}
          </p>
          {!search && (
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-1.5 h-8 px-4 rounded-md bg-[var(--accent-blue)] text-white text-sm font-medium hover:bg-blue-600 transition-colors"
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
