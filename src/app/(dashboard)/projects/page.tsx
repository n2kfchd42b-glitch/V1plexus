import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Plus, FolderOpen, Clock } from "lucide-react";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: owned } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  const { data: memberRows } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", user.id);

  const memberProjectIds = memberRows?.map((r) => r.project_id) ?? [];
  const { data: memberProjects } = memberProjectIds.length
    ? await supabase
        .from("projects")
        .select("*")
        .in("id", memberProjectIds)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
    : { data: [] };

  const allProjects = [
    ...(owned ?? []),
    ...(memberProjects ?? []).filter(
      (p) => !owned?.some((o) => o.id === p.id)
    ),
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <Link
          href="/projects/new"
          className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New project
        </Link>
      </div>

      {allProjects.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <FolderOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="font-medium text-gray-700">No projects yet</h3>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            Create your first research project
          </p>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allProjects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}/overview`}
              className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{project.title}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    project.status === "active"
                      ? "bg-green-100 text-green-700"
                      : project.status === "completed"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {project.status.replace("_", " ")}
                </span>
              </div>
              {project.description && (
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                  {project.description}
                </p>
              )}
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="h-3 w-3" />
                Updated {formatDate(project.updated_at)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
"use client"

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Plus, FolderOpen, Search, MoreHorizontal, ArrowUp, ArrowDown,
  Clock, ChevronRight, Database, FileText, Users
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

// ─── Table View ───────────────────────────────────────────────────
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
      {/* Table header */}
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

      {/* Rows */}
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
              <div>
                <StatusBadge status={project.status} />
              </div>
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

// ─── Card View ───────────────────────────────────────────────────
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
              <span className="text-xs text-[var(--text-tertiary)]">
                {formatRelative(project.updated_at)}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

// ─── Kanban View ─────────────────────────────────────────────────
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
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <StatusBadge status={status} />
                <span className="text-xs text-[var(--text-tertiary)]">{cols.length}</span>
              </div>
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
                      <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-2 mb-2">
                        {project.title}
                      </p>
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

// ─── Main page ───────────────────────────────────────────────────
const PAGE_SIZE = 20

export default function ProjectsPage() {
  const { profile } = useAuth()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [showNew, setShowNew] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // Open new project dialog if ?new=1
  useEffect(() => {
    if (searchParams.get('new') === '1') setShowNew(true)
  }, [searchParams])

  const fetchProjects = useCallback(async () => {
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const supabase = createClient()

  const fetchProjects = async (pageNum = 0) => {
    if (!profile) return
    const from = pageNum * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, count } = await supabase
      .from('projects')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
    if (data) setProjects(data)
    setLoading(false)
  }, [profile]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchProjects() }, [fetchProjects])
      .range(from, to)
    if (data) {
      if (pageNum === 0) setProjects(data)
      else setProjects(prev => [...prev, ...data])
    }
    if (count !== null) {
      setTotalCount(count)
      setHasMore(from + PAGE_SIZE < count)
    }
    setPage(pageNum)
  }

  useEffect(() => { fetchProjects(0) }, [profile])

  const handleCreate = async () => {
    if (!title.trim() || !profile) return
    setCreating(true)

    // Optimistic
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
    if (data) {
      setProjects(prev => [data, ...prev])
      setTotalCount(prev => prev + 1)
    }
    setTitle(''); setDescription(''); setShowNew(false)
    setLoading(false)
  }

  const filtered = projects.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="px-6 py-5 max-w-6xl mx-auto space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">Projects</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">{totalCount} project{totalCount !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[var(--accent-blue)] text-white text-sm font-medium hover:bg-blue-600 transition-colors duration-150 btn-press"
        >
          <Plus className="h-3.5 w-3.5" />
          New Project
        </button>
      </div>

      {/* Toolbar */}
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

      {/* Content */}
      {loading ? (
        viewMode === 'cards' ? (
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
        ) : (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg overflow-hidden">
            <div className="bg-[var(--bg-inset)] h-10 border-b border-[var(--border-default)]" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-2.5 border-b border-[var(--border-subtle)]">
                <div className="skeleton h-4 w-48" />
                <div className="skeleton h-4 w-16 ml-auto" />
                <div className="skeleton h-4 w-24" />
              </div>
            ))}
          </div>
        )
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

      {/* New project dialog */}
      {/* Load More */}
      {hasMore && !search && (
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            onClick={() => fetchProjects(page + 1)}
          >
            Load More
          </Button>
        </div>
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
              <Label className="text-sm font-medium text-[var(--text-primary)]">Description <span className="text-[var(--text-tertiary)] font-normal">(optional)</span></Label>
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
