'use client'

/**
 * Focused audit timeline for thesis workflow events.
 *
 * Reads /api/audit?project_id=X&action_prefix=thesis.|supervisor.|chapter.|
 * deadline.|workflow., filtered to actions emitted by the thesis layer.
 * The general project audit ledger ([components/audit/ProjectAuditLedger])
 * still covers everything; this is the curated "what changed in the
 * workflow" view a supervisor or coordinator wants to skim.
 */

import { useEffect, useState, useCallback } from 'react'
import {
  History, ChevronDown, ChevronRight, Loader2,
  GitBranch, ShieldCheck, AlertCircle, CheckCircle2,
  Clock, BellRing, Users, BookOpen, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuditEntry {
  id: string
  timestamp: string
  action: string
  resource_type: string
  resource_id: string
  details: {
    summary?: string
    operation?: Record<string, unknown>
    [key: string]: unknown
  }
  actor_name?: string
  actor_initials?: string
}

interface Props {
  projectId: string
  /**
   * When true, render only the heading + last few entries with a
   * "view all" link. Useful as a sidebar widget.
   */
  compact?: boolean
}

const THESIS_PREFIXES = ['thesis.', 'supervisor.assignment.', 'supervisor.capacity.']

interface ActionMeta {
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

const ACTION_META: Record<string, ActionMeta> = {
  'thesis.state.transitioned':        { label: 'State changed',           icon: GitBranch,    color: 'text-blue-600' },
  'thesis.state.force_transitioned':  { label: 'State force-changed',     icon: GitBranch,    color: 'text-amber-600' },
  'thesis.policy.created':            { label: 'Policy created',          icon: ShieldCheck,  color: 'text-purple-600' },
  'thesis.policy.updated':            { label: 'Policy updated',          icon: ShieldCheck,  color: 'text-purple-600' },
  'thesis.chapter.submitted':         { label: 'Chapter submitted',       icon: BookOpen,     color: 'text-indigo-600' },
  'thesis.chapter.decided':           { label: 'Chapter decided',         icon: CheckCircle2, color: 'text-green-600' },
  'thesis.defense.scheduled':         { label: 'Defense scheduled',       icon: Clock,        color: 'text-blue-600' },
  'thesis.defense.outcome_recorded':  { label: 'Defense outcome',         icon: CheckCircle2, color: 'text-green-600' },
  'thesis.deadline.reminder_sent':    { label: 'Reminder sent',           icon: BellRing,     color: 'text-amber-600' },
  'thesis.deadline.escalated':        { label: 'Escalated',               icon: AlertCircle,  color: 'text-red-600' },
  'supervisor.assignment.created':    { label: 'Supervisor request',      icon: Users,        color: 'text-blue-600' },
  'supervisor.assignment.accepted':   { label: 'Supervisor accepted',     icon: Users,        color: 'text-green-600' },
  'supervisor.assignment.declined':   { label: 'Supervisor declined',     icon: Users,        color: 'text-amber-600' },
  'supervisor.assignment.ended':      { label: 'Supervision ended',       icon: Users,        color: 'text-gray-600' },
  'supervisor.assignment.cancelled':  { label: 'Supervisor request cancelled', icon: Users,   color: 'text-gray-600' },
  'supervisor.capacity.changed':      { label: 'Capacity changed',        icon: Users,        color: 'text-blue-600' },
}

function metaFor(action: string): ActionMeta {
  return ACTION_META[action] ?? {
    label: action,
    icon: FileText,
    color: 'text-gray-500',
  }
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatDay(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (dayKey(d.toISOString()) === dayKey(today.toISOString())) return 'Today'
  if (dayKey(d.toISOString()) === dayKey(yesterday.toISOString())) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ThesisAuditTimeline({ projectId, compact = false }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const results = await Promise.all(
        THESIS_PREFIXES.map(p =>
          fetch(`/api/audit?project_id=${encodeURIComponent(projectId)}&action_prefix=${encodeURIComponent(p)}&limit=100`),
        ),
      )
      const all: AuditEntry[] = []
      for (const res of results) {
        if (!res.ok) continue
        const body = await res.json() as { entries: AuditEntry[] }
        all.push(...body.entries)
      }
      all.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      const limited = compact ? all.slice(0, 5) : all
      setEntries(limited)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load timeline')
    } finally {
      setLoading(false)
    }
  }, [projectId, compact])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading timeline…
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-xs py-2" style={{ color: 'var(--text-tertiary)' }}>
        {error}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="text-xs py-6" style={{ color: 'var(--text-tertiary)' }}>
        No workflow events yet.
      </div>
    )
  }

  // Group entries by day
  const grouped = new Map<string, AuditEntry[]>()
  for (const entry of entries) {
    const key = dayKey(entry.timestamp)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(entry)
  }

  return (
    <div className="space-y-5">
      {Array.from(grouped.entries()).map(([day, items]) => (
        <div key={day}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-tertiary)' }}>
            {formatDay(items[0].timestamp)}
          </div>
          <div className="space-y-1.5">
            {items.map(entry => {
              const meta = metaFor(entry.action)
              const Icon = meta.icon
              const isExpanded = expandedId === entry.id
              const hasDetails = entry.details && (entry.details.operation || Object.keys(entry.details).length > 1)

              return (
                <div
                  key={entry.id}
                  className="rounded-md border p-2.5 text-xs"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}
                >
                  <div className="flex items-start gap-2.5">
                    <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', meta.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {entry.details?.summary ?? meta.label}
                        </span>
                        <span className="flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>
                      <div className="mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        {entry.actor_name ?? 'System'} · {meta.label}
                      </div>
                      {hasDetails && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          className="mt-1.5 flex items-center gap-1 text-[11px] font-medium transition-colors"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          {isExpanded ? 'Hide details' : 'Details'}
                        </button>
                      )}
                      {isExpanded && hasDetails && (
                        <pre
                          className="mt-2 p-2 rounded text-[11px] overflow-x-auto font-mono"
                          style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-secondary)' }}
                        >
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {compact && entries.length >= 5 && (
        <div className="text-center">
          <a
            href={`/projects/${projectId}/audit`}
            className="text-xs font-medium"
            style={{ color: 'var(--accent-blue)' }}
          >
            View full audit ledger →
          </a>
        </div>
      )}
    </div>
  )
}

export function ThesisAuditTimelineCard({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(true)

  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between mb-3"
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Workflow Timeline
          </h3>
        </div>
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
          style={{ color: 'var(--text-tertiary)' }}
        />
      </button>
      {open && <ThesisAuditTimeline projectId={projectId} />}
    </div>
  )
}
