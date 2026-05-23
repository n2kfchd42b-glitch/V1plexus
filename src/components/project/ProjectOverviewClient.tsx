'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  Shield, ArrowRight, ChevronRight, RefreshCw, X,
  Sparkles, BarChart2, BookOpen, Calendar, Trash2,
} from 'lucide-react'
import { VerifyBadge } from '@/components/ui/verify-badge'
import type { GanttPhase } from '@/components/project/ProjectGantt'

// ── Exported types ────────────────────────────────────────────────────────────

export interface ActivityLog {
  id: string
  timestamp: string
  action: string
  details: Record<string, unknown>
  actor: { full_name: string | null } | null
}

export interface ProjectMember {
  user_id: string
  role: string
  user: { full_name: string | null } | null
}

export interface DbTask {
  id: string
  text: string
  due_date: string | null
  done: boolean
  created_at: string
}

export interface SupervisorMilestone {
  id: string
  title: string
  due_date: string | null
  status: string
  phase: string | null
}

export interface RecentDoc {
  id: string
  title: string
  document_type: string
  updated_at: string
}

export interface LatestRun {
  id: string
  title: string | null
  analysis_type: string
  status: string
  interpretation: string | null
  created_at: string
}

export interface ProjectOverviewClientProps {
  id: string
  project: { title: string; description: string | null; status: string; created_at: string }
  completedCount: number
  nextMilestoneKey: string | null
  initialPhases: GanttPhase[]
  activityLogs: ActivityLog[]
  supervisorLogs: ActivityLog[]
  hasSupervisor: boolean
  initialTasks: DbTask[]
  supervisorMilestones: SupervisorMilestone[]
  recentDocs: RecentDoc[]
  latestRun: LatestRun | null
  aiEnabled?: boolean
}

// ── Phase mapping ─────────────────────────────────────────────────────────────

const GANTT_TO_PHASEBAR: Record<string, string> = {
  concept: 'concept', protocol: 'protocol', ethics: 'ethics',
  data_collection: 'data', analysis: 'analysis', writing: 'writing', publication: 'publication',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getActivityColor(action: string): string {
  if (action.startsWith('dataset'))                                   return 'var(--phase-data)'
  if (action.startsWith('analysis'))                                  return 'var(--phase-analysis)'
  if (action.includes('document') || action.includes('chapter') ||
      action.includes('writing'))                                     return 'var(--phase-writing)'
  if (action.includes('approv') || action.includes('ethics'))        return 'var(--status-success)'
  if (action.includes('note') || action.includes('comment'))         return 'var(--accent-blue)'
  if (action.includes('milestone'))                                   return 'var(--status-warning)'
  return 'var(--text-tertiary)'
}

function formatActivityLabel(action: string, details: Record<string, unknown>): string {
  if (action === 'progress.note' && details.note) {
    const text = String(details.note)
    return `"${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`
  }
  return action
    .replace(/\./g, ' · ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const min  = Math.floor(diff / 60_000)
  const h    = Math.floor(diff / 3_600_000)
  const d    = Math.floor(diff / 86_400_000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  if (h   < 24) return `${h}h`
  if (d < 7) return `${d}d`
  return `${Math.floor(d / 7)}w`
}

function truncateHash(id: string): string {
  const clean = id.replace(/-/g, '')
  return `${clean.slice(0, 4)}…${clean.slice(-4)}`
}

function formatDocType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatAnalysisType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d    = new Date(dateStr)
  const now  = new Date()
  const diff = Math.ceil((d.getTime() - now.setHours(0,0,0,0)) / 86_400_000)
  if (diff < 0)   return `${Math.abs(diff)}d overdue`
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff < 7)   return `${diff}d`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function isDueSoon(dateStr: string | null): boolean {
  if (!dateStr) return false
  const diff = Math.ceil((new Date(dateStr).getTime() - new Date().setHours(0,0,0,0)) / 86_400_000)
  return diff <= 3
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr).getTime() < new Date().setHours(0,0,0,0)
}

// ── Action Center Card ────────────────────────────────────────────────────────
// Unified: personal tasks + supervisor notes + milestone alerts — one ranked list

function ActionCenterCard({
  projectId,
  hasSupervisor,
  supervisorMilestones,
  supervisorLogs,
  tasks,
  onToggle,
  onAdd,
  onDelete,
}: {
  projectId: string
  hasSupervisor: boolean
  supervisorMilestones: SupervisorMilestone[]
  supervisorLogs: ActivityLog[]
  tasks: DbTask[]
  onToggle: (id: string, done: boolean) => void
  onAdd:    (text: string, due_date: string | null) => void
  onDelete: (id: string) => void
}) {
  const [adding,  setAdding]  = useState(false)
  const [draft,   setDraft]   = useState('')
  const [dueDate, setDueDate] = useState('')

  function submit() {
    const text = draft.trim()
    if (!text) return
    onAdd(text, dueDate || null)
    setDraft('')
    setDueDate('')
    setAdding(false)
  }

  const revisions       = supervisorMilestones.filter(m => m.status === 'revision_requested')
  const pendingMilestones = supervisorMilestones.filter(m => m.status !== 'revision_requested')
  const pendingTasks    = tasks
    .filter(t => !t.done)
    .sort((a, b) => {
      const aOver = isOverdue(a.due_date) ? 0 : 1
      const bOver = isOverdue(b.due_date) ? 0 : 1
      if (aOver !== bOver) return aOver - bOver
      if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      if (a.due_date) return -1
      if (b.due_date) return 1
      return 0
    })

  const recentLogs     = hasSupervisor ? supervisorLogs.slice(0, 2) : []
  const supervisorName = supervisorLogs[0]?.actor?.full_name ?? 'Supervisor'
  const urgentCount    = revisions.length + tasks.filter(t => !t.done && isOverdue(t.due_date)).length
  const isEmpty        = revisions.length === 0 && recentLogs.length === 0 &&
                         pendingMilestones.length === 0 && pendingTasks.length === 0 && !adding

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-xs)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border-default)' }}
      >
        <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          Action center
        </span>
        {urgentCount > 0 && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ background: 'var(--status-error-bg)', color: 'var(--status-error-text)', border: '1px solid var(--border-status-error)' }}
          >
            {urgentCount} urgent
          </span>
        )}
        <button
          onClick={() => setAdding(a => !a)}
          className="ml-auto flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium transition-colors hover:bg-[var(--bg-surface-hover)]"
          style={{ color: 'var(--text-tertiary)' }}
        >
          + add
        </button>
      </div>

      <div className="flex flex-col">

        {/* Revision requests — highest urgency */}
        {revisions.map(m => (
          <Link
            key={m.id}
            href="/student/milestones"
            className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:opacity-90"
            style={{ background: 'var(--status-error-bg)', borderBottom: '1px solid var(--border-status-error)' }}
          >
            <div className="rounded-sm flex-shrink-0" style={{ width: 6, height: 6, background: 'var(--status-error-text)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--status-error-text)' }}>
                Revision: {m.title}
              </p>
              {m.due_date && (
                <p className="data-mono text-[10px]" style={{ color: 'var(--status-error-text)', opacity: 0.75 }}>
                  Due {new Date(m.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </p>
              )}
            </div>
            <ChevronRight className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--status-error-text)', opacity: 0.7 }} />
          </Link>
        ))}

        {/* Supervisor notes */}
        {recentLogs.length > 0 && (
          <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div
              className="flex items-center gap-2 px-4 py-1.5"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <div
                className="flex items-center justify-center rounded-full text-white font-mono font-semibold flex-shrink-0"
                style={{ width: 14, height: 14, background: 'var(--accent-primary)', fontSize: 7 }}
              >
                {supervisorName.charAt(0).toUpperCase()}
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                From {supervisorName}
              </span>
            </div>
            {recentLogs.map((log, i) => (
              <div
                key={log.id}
                className="flex items-start gap-3 px-4 py-2"
                style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}
              >
                <div
                  className="rounded-full flex-shrink-0 mt-1.5"
                  style={{ width: 5, height: 5, background: 'var(--accent-blue)' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] truncate" style={{ color: 'var(--text-primary)' }}>
                    {formatActivityLabel(log.action, log.details)}
                  </p>
                  <p className="data-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    {formatRelativeTime(log.timestamp)}
                  </p>
                </div>
              </div>
            ))}
            <div className="px-4 py-2">
              <Link
                href={`/projects/${projectId}/documents`}
                className="text-[11px] font-semibold flex items-center gap-1 hover:underline"
                style={{ color: 'var(--accent-blue)' }}
              >
                Reply in documents <ChevronRight className="h-2.5 w-2.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Pending milestones */}
        {pendingMilestones.length > 0 && (
          <Link
            href="/student/milestones"
            className="flex items-center gap-2 px-4 py-2.5 transition-colors hover:opacity-80"
            style={{ background: 'var(--accent-blue-subtle)', borderBottom: '1px solid var(--border-status-info)' }}
          >
            <div className="rounded-sm flex-shrink-0" style={{ width: 6, height: 6, background: 'var(--accent-blue)' }} />
            <span className="flex-1 text-[12px] font-medium" style={{ color: 'var(--accent-blue)' }}>
              {pendingMilestones.length} milestone{pendingMilestones.length !== 1 ? 's' : ''} pending
            </span>
            <ChevronRight className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--accent-blue)' }} />
          </Link>
        )}

        {/* Personal tasks */}
        <div className="px-4 py-2 flex flex-col gap-1.5">
          {pendingTasks.map(task => {
            const overdue  = isOverdue(task.due_date)
            const dueSoon  = isDueSoon(task.due_date)
            const dueLabel = formatDueDate(task.due_date)
            return (
              <div
                key={task.id}
                className="group flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors hover:bg-[var(--bg-surface-hover)]"
                style={{
                  border:     overdue ? '1px solid var(--border-status-error)' : '1px solid var(--border-default)',
                  background: overdue ? 'var(--status-error-bg)' : 'transparent',
                }}
              >
                <div
                  className="flex items-center justify-center rounded flex-shrink-0"
                  style={{
                    width:      16,
                    height:     16,
                    border:     `1.5px solid ${overdue ? 'var(--status-error)' : 'var(--border-strong)'}`,
                    background: 'transparent',
                    cursor:     'pointer',
                  }}
                  onClick={() => onToggle(task.id, true)}
                >
                  <svg className="opacity-0 group-hover:opacity-100 transition-opacity" width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3l2 2 4-4" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>

                <span className="flex-1 text-[13px]" style={{ color: overdue ? 'var(--status-error-text)' : 'var(--text-primary)' }}>
                  {task.text}
                </span>

                {dueLabel && (
                  <span
                    className="data-mono text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 flex items-center gap-1"
                    style={{
                      background: overdue ? 'var(--status-error-bg)' : dueSoon ? 'var(--status-warning-bg)' : 'var(--bg-surface-active)',
                      color:      overdue ? 'var(--status-error-text)' : dueSoon ? 'var(--status-warning-text)' : 'var(--text-tertiary)',
                      border:     `1px solid ${overdue ? 'var(--border-status-error)' : dueSoon ? '#FCD34D' : 'var(--border-default)'}`,
                    }}
                  >
                    <Calendar className="h-2.5 w-2.5 flex-shrink-0" />
                    {dueLabel}
                  </span>
                )}

                <button
                  onClick={() => onDelete(task.id)}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 flex items-center justify-center rounded"
                  style={{ color: 'var(--text-tertiary)' }}
                  title="Delete task"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )
          })}

          {pendingTasks.length === 0 && !isEmpty && !adding && (
            <div className="py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              No personal tasks — tap + add to create one
            </div>
          )}

          {isEmpty && (
            <div className="py-4 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
              All clear — add a task to get started
            </div>
          )}
        </div>

        {/* Add task form */}
        {adding && (
          <div
            className="flex flex-col gap-2 px-4 pb-3 pt-1"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submit()
                if (e.key === 'Escape') { setAdding(false); setDraft(''); setDueDate('') }
              }}
              placeholder="New task…"
              className="flex-1 h-8 px-2.5 rounded text-[13px] outline-none"
              style={{
                border:     '1px solid var(--border-focus)',
                boxShadow:  '0 0 0 3px var(--accent-blue-subtle)',
                background: 'var(--bg-surface)',
                color:      'var(--text-primary)',
              }}
            />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 flex-1">
                <Calendar className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="flex-1 h-7 px-2 rounded text-[12px] outline-none"
                  style={{
                    border:     '1px solid var(--border-default)',
                    background: 'var(--bg-surface)',
                    color:      dueDate ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  }}
                />
              </div>
              <button
                onClick={submit}
                className="h-7 px-3 rounded text-[12px] font-medium text-white flex-shrink-0"
                style={{ background: 'var(--accent-primary)' }}
              >
                Add
              </button>
              <button
                onClick={() => { setAdding(false); setDraft(''); setDueDate('') }}
                className="h-7 w-7 flex items-center justify-center rounded transition-colors hover:bg-[var(--bg-surface-hover)]"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Recent Work Card ──────────────────────────────────────────────────────────

function RecentWorkCard({ docs, projectId }: { docs: RecentDoc[]; projectId: string }) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-xs)' }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border-default)' }}
      >
        <BookOpen className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--phase-writing)' }} />
        <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          Recent work
        </span>
        <Link
          href={`/projects/${projectId}/documents`}
          className="ml-auto text-[11px] font-medium flex items-center gap-0.5 transition-colors hover:opacity-80"
          style={{ color: 'var(--accent-blue)' }}
        >
          All documents <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {docs.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>No documents yet</p>
          <Link
            href={`/projects/${projectId}/documents`}
            className="text-xs font-semibold transition-colors hover:opacity-80"
            style={{ color: 'var(--accent-blue)' }}
          >
            Start writing →
          </Link>
        </div>
      ) : (
        <div>
          {docs.map((doc, i) => (
            <Link
              key={doc.id}
              href={`/projects/${projectId}/documents`}
              className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--bg-surface-hover)]"
              style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}
            >
              <div
                className="flex items-center justify-center rounded flex-shrink-0"
                style={{
                  width:      28,
                  height:     28,
                  background: 'color-mix(in srgb, var(--phase-writing) 10%, transparent)',
                }}
              >
                <BookOpen className="h-3.5 w-3.5" style={{ color: 'var(--phase-writing)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {doc.title}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {formatDocType(doc.document_type)} · edited {formatRelativeTime(doc.updated_at)} ago
                </p>
              </div>
              <ChevronRight
                className="h-3.5 w-3.5 flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity"
                style={{ color: 'var(--text-tertiary)' }}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Latest Analysis Card ──────────────────────────────────────────────────────

function LatestAnalysisCard({ run, projectId }: { run: LatestRun | null; projectId: string }) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-xs)' }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <BarChart2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--phase-analysis)' }} />
        <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          Latest analysis
        </span>
        {run && (
          <Link
            href={`/projects/${projectId}/analysis`}
            className="ml-auto text-[11px] font-medium flex items-center gap-0.5 transition-colors hover:opacity-80"
            style={{ color: 'var(--accent-blue)' }}
          >
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {!run ? (
        <div className="px-4 py-6 text-center">
          <div
            className="w-8 h-8 rounded-lg mx-auto mb-3 flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--phase-analysis) 10%, transparent)' }}
          >
            <BarChart2 className="h-4 w-4" style={{ color: 'var(--phase-analysis)', opacity: 0.5 }} />
          </div>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>No analysis completed yet</p>
          <Link
            href={`/projects/${projectId}/analysis`}
            className="text-xs font-semibold transition-colors hover:opacity-80"
            style={{ color: 'var(--accent-blue)' }}
          >
            Go to Analysis →
          </Link>
        </div>
      ) : (
        <Link
          href={`/projects/${projectId}/analysis`}
          className="group block px-4 py-3 transition-colors hover:bg-[var(--bg-surface-hover)]"
        >
          <div className="flex items-start gap-2.5 mb-2">
            <div
              className="flex items-center justify-center rounded flex-shrink-0 mt-0.5"
              style={{
                width:      26,
                height:     26,
                background: 'color-mix(in srgb, var(--phase-analysis) 12%, transparent)',
              }}
            >
              <BarChart2 className="h-3 w-3" style={{ color: 'var(--phase-analysis)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {run.title ?? formatAnalysisType(run.analysis_type)}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                  style={{
                    background: 'var(--status-success-bg)',
                    color:      'var(--status-success-text)',
                    border:     '1px solid var(--border-status-success)',
                  }}
                >
                  {formatAnalysisType(run.analysis_type)}
                </span>
                <span className="data-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                  {formatRelativeTime(run.created_at)} ago
                </span>
              </div>
            </div>
            <ChevronRight
              className="h-3.5 w-3.5 flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity mt-1"
              style={{ color: 'var(--text-tertiary)' }}
            />
          </div>

          {run.interpretation && (
            <p
              className="text-[12px] leading-relaxed line-clamp-3 pl-[34px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              {run.interpretation}
            </p>
          )}
        </Link>
      )}
    </div>
  )
}

// ── AI Suggestion Card (compact) ──────────────────────────────────────────────

function AISuggestionCard({
  id,
  state,
  text,
  onRefresh,
  onAddTask,
}: {
  id: string
  state: 'loading' | 'loaded' | 'error'
  text: string
  onRefresh: () => void
  onAddTask: (text: string) => void
}) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-xs)' }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <Sparkles className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--accent-blue)' }} />
        <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          Plexus suggests
        </span>
        <button
          onClick={onRefresh}
          title="Refresh suggestion"
          className="ml-auto flex items-center justify-center h-5 w-5 rounded transition-colors hover:bg-[var(--bg-surface-hover)]"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      <div className="px-4 py-3">
        {state === 'loading' && (
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[0, 0.15, 0.3].map((delay, i) => (
                <div
                  key={i}
                  className="rounded-full"
                  style={{ width: 4, height: 4, background: 'var(--accent-blue)', animation: `aiPulse 1.2s ease-in-out ${delay}s infinite` }}
                />
              ))}
            </div>
            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Reading your project…</span>
          </div>
        )}

        {state === 'error' && (
          <span className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: 'var(--text-tertiary)' }}>Premium</span>
        )}

        {state === 'loaded' && text && (
          <>
            <p className="text-[12px] leading-relaxed mb-2.5" style={{ color: 'var(--text-primary)' }}>
              {text}
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={`/projects/${id}/documents`}
                className="flex items-center gap-1 h-6 px-2.5 rounded text-[11px] font-semibold text-white transition-colors hover:opacity-90"
                style={{ background: 'var(--accent-primary)' }}
              >
                Open writing <ArrowRight className="h-2.5 w-2.5" />
              </Link>
              <button
                onClick={() => onAddTask(text.slice(0, 80))}
                className="h-6 px-2 rounded text-[11px] font-medium transition-colors hover:bg-[var(--bg-surface-hover)]"
                style={{ color: 'var(--text-tertiary)', background: 'transparent' }}
              >
                Add to tasks
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes aiPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1);   }
        }
      `}</style>
    </div>
  )
}

// ── Progress Panel (pull-tab drawer) ─────────────────────────────────────────

function ProgressPanel({
  phases,
  completedCount,
  onClose,
  panelRef,
}: {
  phases: GanttPhase[]
  completedCount: number
  onClose: () => void
  panelRef: React.RefObject<HTMLDivElement | null>
}) {
  const total    = phases.filter(p => !p.disabled).length || 7
  const pct      = Math.round((completedCount / total) * 100)
  const allDone  = completedCount === total

  return (
    <div
      ref={panelRef}
      className="fixed top-0 right-0 bottom-0 flex flex-col"
      style={{
        width:      280,
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-default)',
        boxShadow:  '-4px 0 20px rgba(0,0,0,0.06)',
        zIndex:     39,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-default)' }}
      >
        <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Progress</span>
        <span className="data-mono text-[11px] ml-1" style={{ color: 'var(--text-tertiary)' }}>
          {completedCount}/{total} phases
        </span>
        <button
          onClick={onClose}
          className="ml-auto flex items-center justify-center h-6 w-6 rounded transition-colors hover:bg-[var(--bg-surface-hover)]"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Big percentage */}
      <div
        className="px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-end gap-1 mb-2">
          <span
            className="data-mono font-bold leading-none"
            style={{ fontSize: 34, color: allDone ? 'var(--status-success-text)' : 'var(--text-primary)' }}
          >
            {pct}
          </span>
          <span className="data-mono text-base font-semibold mb-0.5" style={{ color: 'var(--text-tertiary)' }}>%</span>
          <span className="text-[11px] mb-1 ml-1" style={{ color: 'var(--text-tertiary)' }}>complete</span>
        </div>
        <div className="w-full rounded-full overflow-hidden" style={{ height: 5, background: 'var(--bg-inset)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width:      `${pct}%`,
              background: allDone ? 'var(--status-success)' : 'var(--accent-blue)',
            }}
          />
        </div>
      </div>

      {/* Phase list */}
      <div className="flex-1 overflow-y-auto">
        {phases.filter(p => !p.disabled).map((phase, i) => {
          const phaseKey = GANTT_TO_PHASEBAR[phase.phase_key] ?? 'concept'
          const done     = !!phase.completed_at
          return (
            <div
              key={phase.phase_key}
              className="flex items-center gap-3 px-4 py-2.5"
              style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}
            >
              <div
                className="flex items-center justify-center rounded flex-shrink-0"
                style={{
                  width:      16,
                  height:     16,
                  border:     done ? 'none' : `1.5px solid var(--phase-${phaseKey})`,
                  background: done ? `var(--phase-${phaseKey})` : 'transparent',
                }}
              >
                {done && (
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[12px] font-medium"
                  style={{
                    color:          done ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    textDecoration: done ? 'line-through' : 'none',
                  }}
                >
                  {phase.name}
                </p>
                {(phase.start_date || phase.end_date) && (
                  <p className="data-mono text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {phase.start_date
                      ? new Date(phase.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                      : '—'}
                    {phase.end_date
                      ? ` → ${new Date(phase.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                      : ''}
                  </p>
                )}
              </div>
              {done && phase.completed_at && (
                <span className="data-mono text-[9px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                  {formatRelativeTime(phase.completed_at)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Ledger Drawer (⌘L) ────────────────────────────────────────────────────────

function LedgerDrawer({ logs, id, onClose }: { logs: ActivityLog[]; id: string; onClose: () => void }) {
  return (
    <div
      className="fixed top-0 right-0 bottom-0 flex flex-col"
      style={{
        width:      340,
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-default)',
        boxShadow:  '-4px 0 20px rgba(0,0,0,0.06)',
        zIndex:     50,
      }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-default)' }}
      >
        <Shield className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--status-success-text)' }} />
        <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Ledger</span>
        <span
          className="px-1.5 py-0.5 rounded text-[10px]"
          style={{ background: 'var(--bg-inset)', color: 'var(--text-tertiary)' }}
        >
          this project
        </span>
        <span className="ml-auto data-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>⌘L</span>
        <button
          onClick={onClose}
          className="flex items-center justify-center h-6 w-6 rounded transition-colors hover:bg-[var(--bg-surface-hover)]"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        className="flex gap-1.5 flex-wrap px-4 py-2.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        {['All', 'Data', 'Edits', 'Analysis', 'Approvals'].map((chip, i) => (
          <span
            key={chip}
            className="text-[10px] font-medium px-2 py-0.5 rounded cursor-pointer transition-colors hover:bg-[var(--bg-surface-hover)]"
            style={
              i === 0
                ? { background: 'var(--accent-blue-subtle)', color: 'var(--accent-blue)', border: '1px solid var(--border-status-info)' }
                : { background: 'var(--bg-inset)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }
            }
          >
            {chip}
          </span>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {logs.length === 0 ? (
          <div className="py-8 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
            No entries yet
          </div>
        ) : (
          <div>
            {logs.map((log, i) => {
              const actor   = log.actor?.full_name ?? 'System'
              const label   = formatActivityLabel(log.action, log.details)
              const timeAgo = formatRelativeTime(log.timestamp)
              const color   = getActivityColor(log.action)
              const hash    = truncateHash(log.id)

              return (
                <div
                  key={log.id}
                  className="flex gap-2.5 py-2.5"
                  style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}
                >
                  <div className="flex flex-col items-center" style={{ width: 18 }}>
                    <div
                      className="rounded-sm flex-shrink-0"
                      style={{ width: 8, height: 8, background: color, marginTop: 5 }}
                    />
                    {i < logs.length - 1 && (
                      <div
                        className="flex-1 mt-1"
                        style={{ width: 1, background: 'var(--border-default)', minHeight: 12 }}
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[12px] leading-snug overflow-hidden text-ellipsis whitespace-nowrap"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span className="font-semibold">{actor}</span>{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="data-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        {timeAgo} · {hash}
                      </span>
                      <VerifyBadge className="text-[8px]" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div
        className="flex gap-2 px-4 py-3 flex-shrink-0"
        style={{ borderTop: '1px solid var(--border-default)' }}
      >
        <Link
          href={`/projects/${id}/audit`}
          className="flex-1 flex items-center justify-center h-7 rounded text-xs font-medium transition-colors hover:bg-[var(--bg-surface-hover)]"
          style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
        >
          Export
        </Link>
        <Link
          href={`/projects/${id}/audit`}
          className="flex-1 flex items-center justify-center h-7 rounded text-xs font-medium transition-colors hover:bg-[var(--bg-surface-hover)]"
          style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
        >
          Verify chain
        </Link>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProjectOverviewClient({
  id,
  project: _project,
  completedCount,
  nextMilestoneKey: _nextMilestoneKey,
  initialPhases,
  activityLogs,
  supervisorLogs,
  hasSupervisor,
  initialTasks,
  supervisorMilestones,
  recentDocs,
  latestRun,
  aiEnabled = false,
}: ProjectOverviewClientProps) {

  const [aiState, setAiState] = useState<'loading' | 'loaded' | 'error'>(() => aiEnabled ? 'loading' : 'error')
  const [aiText,  setAiText]  = useState('')

  const loadAI = useCallback(async () => {
    if (!aiEnabled) { setAiState('error'); return }
    setAiState('loading')
    try {
      const res  = await fetch(`/api/projects/${id}/suggestion`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.unavailable || !data.suggestion) { setAiState('error'); return }
      setAiText(data.suggestion)
      setAiState('loaded')
    } catch {
      setAiState('error')
    }
  }, [id, aiEnabled])

  useEffect(() => { loadAI() }, [loadAI])

  const [tasks, setTasks] = useState<DbTask[]>(initialTasks)

  async function handleAddTask(text: string, due_date: string | null) {
    const res = await fetch(`/api/projects/${id}/tasks`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text, due_date }),
    })
    if (res.ok) {
      const created: DbTask = await res.json()
      setTasks(ts => [...ts, created])
    }
  }

  async function handleToggleTask(taskId: string, done: boolean) {
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, done } : t))
    await fetch(`/api/projects/${id}/tasks`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ taskId, done }),
    })
  }

  async function handleDeleteTask(taskId: string) {
    setTasks(ts => ts.filter(t => t.id !== taskId))
    await fetch(`/api/projects/${id}/tasks?taskId=${taskId}`, { method: 'DELETE' })
  }

  // ── Portal mount guard (avoids SSR mismatch) ────────────────────────────────
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // ── Ledger drawer (⌘L) ──────────────────────────────────────────────────────
  const [ledgerOpen, setLedgerOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault()
        setLedgerOpen(l => !l)
        setProgressOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Progress pull-tab ────────────────────────────────────────────────────────
  const [progressOpen, setProgressOpen] = useState(false)
  const progressTabRef   = useRef<HTMLButtonElement>(null)
  const progressPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!progressOpen) return
    function handleClick(e: MouseEvent) {
      const t = e.target as Node
      if (progressTabRef.current?.contains(t) || progressPanelRef.current?.contains(t)) return
      setProgressOpen(false)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [progressOpen])

  const progressTotal = initialPhases.filter(p => !p.disabled).length || 7

  return (
    <>
      {/* ── Page content ───────────────────────────────────────────────────── */}
      <div className="px-7 py-6 pb-16" style={{ background: 'var(--bg-app)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, maxWidth: 1200, margin: '0 auto' }}>

          {/* LEFT ─ Action Center + Recent Work ─────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <ActionCenterCard
              projectId={id}
              hasSupervisor={hasSupervisor}
              supervisorMilestones={supervisorMilestones}
              supervisorLogs={supervisorLogs}
              tasks={tasks}
              onToggle={handleToggleTask}
              onAdd={handleAddTask}
              onDelete={handleDeleteTask}
            />

            <RecentWorkCard docs={recentDocs} projectId={id} />

          </div>

          {/* RIGHT ─ Latest Analysis + AI ────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <LatestAnalysisCard run={latestRun} projectId={id} />

            <AISuggestionCard
              id={id}
              state={aiState}
              text={aiText}
              onRefresh={loadAI}
              onAddTask={text => handleAddTask(text.slice(0, 80), null)}
            />

          </div>
        </div>
      </div>

      {/* ── Pull-tab + overlay panels via portal (fixed, viewport-level) ── */}
      {mounted && createPortal(
        <>
          {/* Pull-tab button — always visible on right edge */}
          <button
            ref={progressTabRef}
            onClick={() => {
              setProgressOpen(p => !p)
              if (ledgerOpen) setLedgerOpen(false)
            }}
            title="Phase progress"
            style={{
              position:      'fixed',
              right:         0,
              top:           '45%',
              transform:     'translateY(-50%)',
              display:       'flex',
              flexDirection: 'column',
              alignItems:    'center',
              gap:           6,
              padding:       '10px 0',
              width:         28,
              background:    progressOpen ? 'var(--bg-surface-active)' : 'var(--bg-surface)',
              border:        '1px solid var(--border-default)',
              borderRight:   'none',
              borderRadius:  '6px 0 0 6px',
              cursor:        'pointer',
              zIndex:        37,
              boxShadow:     '-2px 0 8px rgba(0,0,0,0.06)',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-primary)', writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: 'monospace' }}>
              {completedCount}/{progressTotal}
            </span>
            <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-primary)', writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              phases
            </span>
          </button>

          {progressOpen && (
            <ProgressPanel
              phases={initialPhases}
              completedCount={completedCount}
              onClose={() => setProgressOpen(false)}
              panelRef={progressPanelRef}
            />
          )}
          {ledgerOpen && (
            <LedgerDrawer logs={activityLogs} id={id} onClose={() => setLedgerOpen(false)} />
          )}
        </>,
        document.body
      )}
    </>
  )
}
