"use client"

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import {
  LayoutDashboard, FolderOpen, ClipboardList, Bell,
  Plus, Upload, FileText, Search, ArrowRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface SearchResult {
  id: string
  title: string
  type: 'project' | 'document' | 'review'
  href: string
  meta?: string
}

const quickActions = [
  { id: 'new-project',   label: 'New Project',       icon: Plus,        href: '/projects?new=1',  desc: 'Create a new research project' },
  { id: 'go-dashboard',  label: 'Go to Dashboard',   icon: LayoutDashboard, href: '/dashboard',   desc: 'Navigate to dashboard' },
  { id: 'go-projects',   label: 'Go to Projects',    icon: FolderOpen,  href: '/projects',         desc: 'Navigate to projects' },
  { id: 'go-reviews',    label: 'Go to Reviews',     icon: ClipboardList, href: '/reviews',        desc: 'Navigate to review queue' },
  { id: 'go-notifs',     label: 'Go to Inbox',       icon: Bell,        href: '/notifications',    desc: 'Navigate to notifications' },
]

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  // Search across projects + documents
  useEffect(() => {
    if (!search.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      const [projectsRes, docsRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, title')
          .ilike('title', `%${search}%`)
          .limit(4),
        supabase
          .from('documents')
          .select('id, title, project_id')
          .ilike('title', `%${search}%`)
          .limit(4),
      ])

      const projectResults: SearchResult[] = (projectsRes.data ?? []).map(p => ({
        id: p.id,
        title: p.title,
        type: 'project' as const,
        href: `/projects/${p.id}`,
        meta: 'Project',
      }))

      const docResults: SearchResult[] = (docsRes.data ?? []).map(d => ({
        id: d.id,
        title: d.title,
        type: 'document' as const,
        href: `/projects/${d.project_id}/documents/${d.id}`,
        meta: 'Document',
      }))

      setResults([...projectResults, ...docResults])
      setLoading(false)
    }, 100)

    return () => clearTimeout(timer)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const runAction = useCallback((href: string) => {
    onOpenChange(false)
    setSearch('')
    router.push(href)
  }, [router, onOpenChange])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false)
        setSearch('')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50 animate-fade-in"
        onClick={() => { onOpenChange(false); setSearch('') }}
      />

      {/* Palette */}
      <div className="fixed left-1/2 top-[20%] -translate-x-1/2 z-50 w-full max-w-[560px] px-4 animate-scale-in">
        <Command
          className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] shadow-xl overflow-hidden"
          shouldFilter={false}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)]">
            <Search className="h-4 w-4 text-[var(--text-tertiary)] flex-shrink-0" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search projects, documents… or try an action"
              className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] caret-[var(--accent-blue)]"
              autoFocus
            />
            {loading && (
              <div className="h-4 w-4 rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-blue)] animate-spin flex-shrink-0" />
            )}
            <kbd className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-inset)] border border-[var(--border-default)] rounded px-1.5 py-0.5 font-mono flex-shrink-0">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[380px] overflow-y-auto py-2">
            <Command.Empty className="py-8 text-center text-sm text-[var(--text-tertiary)]">
              No results found for &ldquo;{search}&rdquo;
            </Command.Empty>

            {/* Search results */}
            {results.length > 0 && (
              <Command.Group
                heading="Results"
                className="[&>[cmdk-group-heading]]:px-4 [&>[cmdk-group-heading]]:py-1.5 [&>[cmdk-group-heading]]:text-[11px] [&>[cmdk-group-heading]]:font-medium [&>[cmdk-group-heading]]:uppercase [&>[cmdk-group-heading]]:tracking-wide [&>[cmdk-group-heading]]:text-[var(--text-tertiary)]"
              >
                {results.map(r => (
                  <PaletteItem
                    key={r.id}
                    icon={r.type === 'project' ? FolderOpen : FileText}
                    label={r.title}
                    meta={r.meta}
                    onSelect={() => runAction(r.href)}
                  />
                ))}
              </Command.Group>
            )}

            {/* Quick actions — always shown */}
            <Command.Group
              heading="Actions"
              className="[&>[cmdk-group-heading]]:px-4 [&>[cmdk-group-heading]]:py-1.5 [&>[cmdk-group-heading]]:text-[11px] [&>[cmdk-group-heading]]:font-medium [&>[cmdk-group-heading]]:uppercase [&>[cmdk-group-heading]]:tracking-wide [&>[cmdk-group-heading]]:text-[var(--text-tertiary)]"
            >
              {quickActions
                .filter(a => !search || a.label.toLowerCase().includes(search.toLowerCase()))
                .map(action => (
                  <PaletteItem
                    key={action.id}
                    icon={action.icon}
                    label={action.label}
                    meta={action.desc}
                    onSelect={() => runAction(action.href)}
                  />
                ))}
            </Command.Group>
          </Command.List>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-inset)]">
            <span className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1">
              <kbd className="font-mono bg-[var(--bg-surface)] border border-[var(--border-default)] rounded px-1 text-[10px]">↑↓</kbd>
              navigate
            </span>
            <span className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1">
              <kbd className="font-mono bg-[var(--bg-surface)] border border-[var(--border-default)] rounded px-1 text-[10px]">↵</kbd>
              select
            </span>
            <span className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1">
              <kbd className="font-mono bg-[var(--bg-surface)] border border-[var(--border-default)] rounded px-1 text-[10px]">ESC</kbd>
              close
            </span>
          </div>
        </Command>
      </div>
    </>
  )
}

function PaletteItem({
  icon: Icon,
  label,
  meta,
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  meta?: string
  onSelect: () => void
}) {
  return (
    <Command.Item
      value={label}
      onSelect={onSelect}
      className={cn(
        'flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors duration-75',
        'data-[selected=true]:bg-[var(--bg-surface-active)]',
        'hover:bg-[var(--bg-surface-hover)]'
      )}
    >
      <div className="flex items-center justify-center h-6 w-6 rounded-md bg-[var(--bg-inset)] flex-shrink-0">
        <Icon className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-[var(--text-primary)] truncate">{label}</span>
        {meta && (
          <span className="text-xs text-[var(--text-tertiary)] ml-2">{meta}</span>
        )}
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-[var(--text-tertiary)] opacity-0 group-data-[selected=true]:opacity-100 flex-shrink-0" />
    </Command.Item>
  )
}
