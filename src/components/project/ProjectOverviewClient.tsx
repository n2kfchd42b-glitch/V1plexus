'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Shield, ArrowRight, ChevronRight, RefreshCw, X,
  Sparkles, Database, BarChart2, BookOpen, Calendar, Trash2,
} from 'lucide-react'
import { VerifyBadge } from '@/components/ui/verify-badge'
import { PhasePill } from '@/components/ui/phase-bar'
import { cn } from '@/lib/utils'
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

export interface ProjectOverviewClientProps {
  id: string
  project: { title: string; description: string | null; status: string; created_at: string }
  completedCount: number
  nextMilestoneKey: string | null
  nextMilestoneStartDate: string | null
  datasetCount: number
  runCount: number
  auditCount: number
  initialPhases: GanttPhase[]
  activityLogs: ActivityLog[]
  supervisorLogs: ActivityLog[]
  userId: string
  hasSupervisor: boolean
  initialTasks: DbTask[]
  supervisorMilestones: SupervisorMilestone[]
}

// ── Phase mapping ─────────────────────────────────────────────────────────────

const GANTT_PHASE_ORDER = [
  'concept', 'protocol', 'ethics', 'data_collection',
  'analysis', 'writing', 'publication',
] as const

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

function getActionLink(action: string, projectId: string): string | null {
  if (action.startsWith('dataset'))                                   return `/projects/${projectId}/data`
  if (action.startsWith('analysis'))                                  return `/projects/${projectId}/analysis`
  if (action.includes('document') || action.includes('chapter') ||
      action.includes('writing'))                                     return `/projects/${projectId}/documents`
  if (action.includes('approv') || action.includes('milestone'))     return `/projects/${projectId}/timeline`
  return null
}

function getActionLabel(action: string): string | null {
  if (action.startsWith('dataset'))                                   return 'view →'
  if (action.startsWith('analysis'))                                  return 'view →'
  if (action.includes('document') || action.includes('chapter'))     return 'continue →'
  if (action.includes('comment') || action.includes('note'))         return 'respond →'
  if (action.includes('approv') || action.includes('milestone'))     return 'view →'
  return null
}

function isActionUrgent(action: string): boolean {
  return action.includes('comment') || action.includes('note')
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

// ── AI Card ───────────────────────────────────────────────────────────────────

function AICard({
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
      style={{
        background:  'var(--bg-surface)',
        border:      '1px solid var(--border-status-info)',
        boxShadow:   'var(--shadow-xs)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{
          background:    'linear-gradient(135deg, var(--accent-blue-subtle) 0%, var(--bg-surface) 100%)',
          borderBottom:  '1px solid var(--border-status-info)',
        }}
      >
        <div
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ width: 32, height: 32, background: 'var(--accent-blue)', color: '#fff', fontSize: 16 }}
        >
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            AI suggestion
          </div>
          <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            based on your project activity
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 h-7 px-3 rounded text-xs font-medium transition-colors hover:bg-[var(--bg-surface-hover)]"
          style={{
            background:  'var(--bg-surface)',
            color:       'var(--text-secondary)',
            border:      '1px solid var(--border-default)',
          }}
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-4">
        {state === 'loading' && (
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {[0, 0.2, 0.4].map((delay, i) => (
                <div
                  key={i}
                  className="rounded-full"
                  style={{
                    width: 6, height: 6,
                    background:      'var(--accent-blue)',
                    animation:       `aiPulse 1.2s ease-in-out ${delay}s infinite`,
                  }}
                />
              ))}
            </div>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Plexus is reading your project…
            </span>
          </div>
        )}

        {state === 'error' && (
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            AI unavailable — try refreshing
          </span>
        )}

        {state === 'loaded' && text && (
          <div>
            <p
              className="text-[13px] leading-relaxed mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              {text}
            </p>
            <div className="flex gap-2 flex-wrap">
              <Link
                href={`/projects/${id}/documents`}
                className="flex items-center gap-1.5 h-7 px-3 rounded text-xs font-semibold text-white transition-colors hover:opacity-90"
                style={{ background: 'var(--accent-primary)' }}
              >
                Open writing <ArrowRight className="h-3 w-3" />
              </Link>
              <button
                onClick={onRefresh}
                className="h-7 px-3 rounded text-xs font-medium transition-colors hover:bg-[var(--bg-surface-hover)]"
                style={{
                  background: 'var(--bg-surface)',
                  color:      'var(--text-secondary)',
                  border:     '1px solid var(--border-default)',
                }}
              >
                Different suggestion
              </button>
              <button
                onClick={() => onAddTask(text.slice(0, 80))}
                className="h-7 px-3 rounded text-xs font-medium transition-colors hover:bg-[var(--bg-surface-hover)]"
                style={{ background: 'transparent', color: 'var(--text-secondary)' }}
              >
                Add to tasks
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes aiPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

// ── Tasks Card ────────────────────────────────────────────────────────────────

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

function MilestoneStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; text: string; border: string }> = {
    pending:            { label: 'Pending',         bg: 'var(--bg-surface-active)', text: 'var(--text-secondary)',      border: 'var(--border-default)' },
    under_review:       { label: 'Under review',    bg: 'var(--accent-blue-subtle)',text: 'var(--accent-blue)',          border: 'var(--border-status-info)' },
    revision_requested: { label: 'Revision needed', bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)', border: 'var(--border-status-warning)' },
    submitted:          { label: 'Submitted',       bg: 'var(--status-success-bg)', text: 'var(--status-success-text)', border: 'var(--border-status-success)' },
  }
  const style = map[status] ?? map.pending
  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
    >
      {style.label}
    </span>
  )
}

function TasksCard({
  projectId,
  hasSupervisor,
  supervisorMilestones,
  tasks,
  onToggle,
  onAdd,
  onDelete,
}: {
  projectId: string
  hasSupervisor: boolean
  supervisorMilestones: SupervisorMilestone[]
  tasks: DbTask[]
  onToggle:  (id: string, done: boolean) => void
  onAdd:     (text: string, due_date: string | null) => void
  onDelete:  (id: string) => void
}) {
  const [adding,   setAdding]  = useState(false)
  const [draft,    setDraft]   = useState('')
  const [dueDate,  setDueDate] = useState('')

  const title = hasSupervisor ? 'Work queue' : 'My tasks'

  function submit() {
    const text = draft.trim()
    if (!text) return
    onAdd(text, dueDate || null)
    setDraft('')
    setDueDate('')
    setAdding(false)
  }

  const pendingTasks = tasks.filter(t => !t.done)
  const doneTasks    = tasks.filter(t => t.done)

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
          {title}
        </span>
        <button
          onClick={() => setAdding(a => !a)}
          className="ml-auto flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium transition-colors hover:bg-[var(--bg-surface-hover)]"
          style={{ color: 'var(--text-tertiary)', background: 'transparent' }}
        >
          + add
        </button>
      </div>

      <div className="px-4 py-3 flex flex-col gap-1.5">

        {/* Supervisor milestone nudge — slim link only */}
        {hasSupervisor && supervisorMilestones.length > 0 && (
          <Link
            href="/student/milestones"
            className="flex items-center gap-2 px-2.5 py-2 rounded-md mb-1 transition-colors hover:opacity-80"
            style={{
              background: supervisorMilestones.some(m => m.status === 'revision_requested')
                ? 'var(--status-warning-bg)'
                : 'var(--accent-blue-subtle)',
              border: supervisorMilestones.some(m => m.status === 'revision_requested')
                ? '1px solid var(--border-status-warning)'
                : '1px solid var(--border-status-info)',
            }}
          >
            <div
              className="rounded-sm flex-shrink-0"
              style={{ width: 6, height: 6, background: supervisorMilestones.some(m => m.status === 'revision_requested') ? 'var(--status-warning-text)' : 'var(--accent-blue)' }}
            />
            <span
              className="flex-1 text-[12px] font-medium"
              style={{ color: supervisorMilestones.some(m => m.status === 'revision_requested') ? 'var(--status-warning-text)' : 'var(--accent-blue)' }}
            >
              {supervisorMilestones.some(m => m.status === 'revision_requested')
                ? `${supervisorMilestones.filter(m => m.status === 'revision_requested').length} revision${supervisorMilestones.filter(m => m.status === 'revision_requested').length !== 1 ? 's' : ''} requested`
                : `${supervisorMilestones.length} supervisor milestone${supervisorMilestones.length !== 1 ? 's' : ''} pending`
              }
            </span>
            <ChevronRight className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          </Link>
        )}

        {/* Personal tasks */}
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
              {/* Checkbox */}
              <div
                className="flex items-center justify-center rounded flex-shrink-0 transition-colors"
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

              <span
                className="flex-1 text-[13px]"
                style={{ color: overdue ? 'var(--status-error-text)' : 'var(--text-primary)' }}
              >
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

        {pendingTasks.length === 0 && !adding && (
          <div className="py-3 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
            No pending tasks — add one above
          </div>
        )}

        {/* Done tasks (collapsed summary) */}
        {doneTasks.length > 0 && (
          <div className="flex items-center gap-2 mt-1 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              {doneTasks.length} completed
            </span>
            {doneTasks.slice(0, 2).map(task => (
              <div
                key={task.id}
                className="flex items-center gap-1.5 cursor-pointer"
                onClick={() => onToggle(task.id, false)}
                title="Unmark as done"
              >
                <div
                  className="flex items-center justify-center rounded flex-shrink-0"
                  style={{ width: 14, height: 14, border: '1.5px solid var(--status-success)', background: 'var(--status-success)' }}
                >
                  <svg width="7" height="5" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-[11px] line-through max-w-[120px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                  {task.text}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Add task input */}
        {adding && (
          <div className="flex flex-col gap-2 mt-1 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setAdding(false); setDraft(''); setDueDate('') } }}
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

// ── Activity Stream ───────────────────────────────────────────────────────────

function ActivityCard({ logs, projectId }: { logs: ActivityLog[]; projectId: string }) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-xs)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border-default)' }}
      >
        <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          Activity
        </span>
        <span
          className="data-mono text-[10px] px-1.5 py-0.5 rounded"
          style={{ background: 'var(--bg-inset)', color: 'var(--text-tertiary)' }}
        >
          last 7 days
        </span>
        <div className="ml-auto">
          <VerifyBadge className="text-[9px]" />
        </div>
      </div>

      {/* Stream rows */}
      {logs.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
          No recent activity
        </div>
      ) : (
        <div>
          {logs.map((log, i) => {
            const actor      = log.actor?.full_name ?? 'System'
            const label      = formatActivityLabel(log.action, log.details)
            const timeAgo    = formatRelativeTime(log.timestamp)
            const color      = getActivityColor(log.action)
            const actionLink = getActionLink(log.action, projectId)
            const actionLabel= getActionLabel(log.action)
            const urgent     = isActionUrgent(log.action)

            return (
              <div
                key={log.id}
                className="flex items-start gap-2.5 px-4 py-3"
                style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}
              >
                {/* Dot */}
                <div
                  className="rounded-sm flex-shrink-0 mt-1.5"
                  style={{ width: 8, height: 8, background: color }}
                />
                {/* Time */}
                <span
                  className="data-mono text-[11px] flex-shrink-0 w-7 mt-0.5 text-right"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {timeAgo}
                </span>
                {/* Text */}
                <div className="flex-1 min-w-0 text-[13px] leading-relaxed">
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{actor}</span>
                  <span className="ml-1" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                </div>
                {/* Action button */}
                {actionLink && actionLabel ? (
                  <Link href={actionLink}>
                    <button
                      className="flex-shrink-0 h-6 px-2 rounded text-[11px] font-medium transition-colors hover:bg-[var(--bg-surface-hover)]"
                      style={{
                        background:  urgent ? 'var(--bg-surface)' : 'transparent',
                        color:       urgent ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                        border:      urgent ? '1px solid #FCD34D' : 'none',
                        fontWeight:  urgent ? 600 : 400,
                      }}
                    >
                      {actionLabel}
                    </button>
                  </Link>
                ) : (
                  <VerifyBadge className="flex-shrink-0 text-[9px] mt-0.5" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Three Spaces Card ─────────────────────────────────────────────────────────

function ThreeSpacesCard({
  id,
  datasetCount,
  runCount,
}: {
  id: string
  datasetCount: number
  runCount: number
}) {
  const spaces = [
    {
      label:    'Data',
      sub:      `${datasetCount} dataset${datasetCount !== 1 ? 's' : ''}`,
      color:    'var(--phase-data)',
      verified: datasetCount > 0,
      href:    `/projects/${id}/data`,
      icon:    Database,
    },
    {
      label:    'Analysis',
      sub:      `${runCount} run${runCount !== 1 ? 's' : ''} completed`,
      color:    'var(--phase-analysis)',
      verified: runCount > 0,
      href:    `/projects/${id}/analysis`,
      icon:    BarChart2,
    },
    {
      label:    'Writing',
      sub:      'Manuscript & documents',
      color:    'var(--phase-writing)',
      verified: false,
      href:    `/projects/${id}/documents`,
      icon:    BookOpen,
      current: true,
    },
  ]

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-xs)' }}
    >
      <div
        className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider"
        style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}
      >
        Three Spaces
      </div>

      {spaces.map((space, i) => {
        const Icon = space.icon
        return (
          <Link
            key={space.label}
            href={space.href}
            className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-surface-hover)]"
            style={{
              borderTop:  i > 0 ? '1px solid var(--border-subtle)' : 'none',
              background: space.current ? 'linear-gradient(135deg, color-mix(in srgb, var(--phase-writing) 6%, transparent) 0%, transparent 100%)' : undefined,
            }}
          >
            <div
              className="flex items-center justify-center rounded flex-shrink-0"
              style={{
                width:      28,
                height:     28,
                background: `color-mix(in srgb, ${space.color} 12%, transparent)`,
              }}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: space.color }} />
            </div>

            <div className="flex-1 min-w-0">
              <div
                className="text-[13px] font-medium"
                style={{ color: space.current ? space.color : 'var(--text-primary)', fontWeight: space.current ? 600 : 500 }}
              >
                {space.label}
                {space.current && (
                  <span className="ml-1.5 text-[10px] font-normal" style={{ color: 'var(--text-tertiary)' }}>
                    ← current
                  </span>
                )}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{space.sub}</div>
            </div>

            {space.verified
              ? <VerifyBadge className="flex-shrink-0 text-[9px]" />
              : <VerifyBadge variant="pending" className="flex-shrink-0 text-[9px]" />
            }
            <ChevronRight
              className="h-3.5 w-3.5 flex-shrink-0 opacity-0 group-hover:opacity-50 transition-opacity"
              style={{ color: 'var(--text-tertiary)' }}
            />
          </Link>
        )
      })}
    </div>
  )
}

// ── From Supervisor Card ──────────────────────────────────────────────────────

function SupervisorCard({ logs, projectId }: { logs: ActivityLog[]; projectId: string }) {
  const supervisorName = logs[0]?.actor?.full_name ?? 'Your supervisor'

  function getInitials(name: string | null): string {
    if (!name) return '?'
    const parts = name.trim().split(' ')
    return (parts[0][0] + (parts[parts.length - 1][0] ?? '')).toUpperCase()
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-xs)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div
          className="flex items-center justify-center rounded-full text-white font-mono font-semibold flex-shrink-0"
          style={{ width: 22, height: 22, background: 'var(--accent-primary)', fontSize: 9 }}
        >
          {getInitials(supervisorName)}
        </div>
        <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          From {supervisorName}
        </span>
        {logs.length > 0 && (
          <span
            className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ background: 'var(--status-warning-bg)', color: 'var(--status-warning-text)', border: '1px solid #FCD34D' }}
          >
            {logs.length} unread
          </span>
        )}
      </div>

      {/* Entries */}
      {logs.length === 0 ? (
        <div className="px-4 py-5 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
          No notes yet — supervisor feedback will appear here
        </div>
      ) : (
        <div>
          {logs.slice(0, 3).map((log, i) => (
            <div
              key={log.id}
              className="px-4 py-2.5 relative"
              style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}
            >
              {/* Unread dot */}
              <div
                className="absolute rounded-full"
                style={{ left: 7, top: 14, width: 6, height: 6, background: 'var(--accent-blue)' }}
              />
              <div className="pl-3">
                <div className="text-[12px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {formatActivityLabel(log.action, log.details)}
                </div>
                <div
                  className="data-mono text-[10px] mt-0.5"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {formatRelativeTime(log.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-2.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <Link
          href={`/projects/${projectId}/documents`}
          className="text-[11px] font-semibold flex items-center gap-1 hover:underline"
          style={{ color: 'var(--accent-blue)' }}
        >
          Open project to reply <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}

// ── Ledger Mini Card ──────────────────────────────────────────────────────────

function LedgerMiniCard({
  auditCount,
  completedCount,
  id,
  onOpen,
}: {
  auditCount: number
  completedCount: number
  id: string
  onOpen: () => void
}) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: 'linear-gradient(180deg, var(--status-success-bg) 0%, var(--bg-surface) 100%)',
        border:     '1px solid var(--border-status-success)',
        boxShadow:  'var(--shadow-xs)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Shield className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--status-success-text)' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--status-success-text)' }}>Ledger</span>
        <span className="ml-auto data-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>⌘L</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div
            className="data-mono font-semibold leading-none"
            style={{ fontSize: 24, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
          >
            {auditCount}
          </div>
          <div className="text-[10px] mt-1 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
            entries
          </div>
        </div>
        <div>
          <div
            className="data-mono font-semibold leading-none"
            style={{ fontSize: 24, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
          >
            {completedCount}
          </div>
          <div className="text-[10px] mt-1 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
            phases done
          </div>
        </div>
      </div>

      <button
        onClick={onOpen}
        className="flex items-center justify-center gap-1.5 w-full h-7 rounded text-xs font-semibold transition-colors hover:bg-[#dcfce7]"
        style={{
          background: 'var(--status-success-bg)',
          color:      'var(--status-success-text)',
          border:     '1px solid var(--border-status-success)',
        }}
      >
        View chain <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  )
}

// ── Ledger Drawer ─────────────────────────────────────────────────────────────

function LedgerDrawer({ logs, id, onClose }: { logs: ActivityLog[]; id: string; onClose: () => void }) {
  return (
    <div
      className="absolute top-0 right-0 bottom-0 flex flex-col"
      style={{
        width:      340,
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-default)',
        boxShadow:  '-4px 0 20px rgba(0,0,0,0.06)',
        zIndex:     20,
      }}
    >
      {/* Header */}
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

      {/* Filter chips */}
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

      {/* Entry list */}
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
                  {/* Timeline column */}
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

                  {/* Content */}
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

      {/* Footer */}
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
  project,
  completedCount,
  nextMilestoneKey,
  datasetCount,
  runCount,
  auditCount,
  initialPhases,
  activityLogs,
  supervisorLogs,
  hasSupervisor,
  initialTasks,
  supervisorMilestones,
}: ProjectOverviewClientProps) {

  // Derive current phase
  const currentGanttPhase = GANTT_PHASE_ORDER.find(
    key => !initialPhases.find(p => p.phase_key === key)?.completed_at
  ) ?? 'publication'
  const currentPhase = GANTT_TO_PHASEBAR[currentGanttPhase] ?? 'concept'

  // AI suggestion state
  const [aiState, setAiState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [aiText,  setAiText]  = useState('')

  const loadAI = useCallback(async () => {
    setAiState('loading')
    try {
      const res  = await fetch(`/api/projects/${id}/suggestion`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.unavailable || !data.suggestion) {
        setAiState('error')
        return
      }
      setAiText(data.suggestion)
      setAiState('loaded')
    } catch {
      setAiState('error')
    }
  }, [id])

  useEffect(() => { loadAI() }, [loadAI])

  // Task state — persisted to DB
  const [tasks, setTasks] = useState<DbTask[]>(initialTasks)

  async function handleAddTask(text: string, due_date: string | null) {
    const res = await fetch(`/api/projects/${id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, due_date }),
    })
    if (res.ok) {
      const created: DbTask = await res.json()
      setTasks(ts => [...ts, created])
    }
  }

  async function handleToggleTask(taskId: string, done: boolean) {
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, done } : t))
    await fetch(`/api/projects/${id}/tasks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, done }),
    })
  }

  async function handleDeleteTask(taskId: string) {
    setTasks(ts => ts.filter(t => t.id !== taskId))
    await fetch(`/api/projects/${id}/tasks?taskId=${taskId}`, { method: 'DELETE' })
  }

  // Ledger drawer
  const [ledgerOpen, setLedgerOpen] = useState(false)

  // ⌘L keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault()
        setLedgerOpen(l => !l)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="relative flex-1 overflow-y-auto" style={{ background: 'var(--bg-app)' }}>
      <div className="px-7 py-6 pb-16" style={{ maxWidth: 1200 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>

          {/* LEFT ─ AI + Tasks + Activity ─────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <AICard
              id={id}
              state={aiState}
              text={aiText}
              onRefresh={loadAI}
              onAddTask={text => handleAddTask(text.slice(0, 80), null)}
            />

            <TasksCard
              projectId={id}
              hasSupervisor={hasSupervisor}
              supervisorMilestones={supervisorMilestones}
              tasks={tasks}
              onToggle={handleToggleTask}
              onAdd={handleAddTask}
              onDelete={handleDeleteTask}
            />

            <ActivityCard logs={activityLogs} projectId={id} />

          </div>

          {/* RIGHT ─ Three Spaces + Supervisor + Ledger ───────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <ThreeSpacesCard id={id} datasetCount={datasetCount} runCount={runCount} />

            {hasSupervisor && <SupervisorCard logs={supervisorLogs} projectId={id} />}

            <LedgerMiniCard
              auditCount={auditCount}
              completedCount={completedCount}
              id={id}
              onOpen={() => setLedgerOpen(true)}
            />

            {/* Phase progress */}
            <div
              className="rounded-lg p-4"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-xs)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                  Phases
                </span>
                <span className="data-mono text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                  {completedCount} / 7
                </span>
              </div>
              <div className="flex items-end gap-0.5 mb-2">
                <span className="data-mono font-bold leading-none" style={{ fontSize: 28, color: 'var(--text-primary)' }}>
                  {Math.round((completedCount / 7) * 100)}
                </span>
                <span className="data-mono text-base font-semibold mb-0.5" style={{ color: 'var(--text-tertiary)' }}>%</span>
              </div>
              <div className="w-full rounded-full overflow-hidden mb-3" style={{ height: 5, background: 'var(--bg-inset)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width:      `${(completedCount / 7) * 100}%`,
                    background: completedCount === 7 ? 'var(--status-success)' : 'var(--accent-blue)',
                  }}
                />
              </div>
              <PhasePill phase={currentPhase} />
            </div>

          </div>
        </div>
      </div>

      {/* Ledger drawer */}
      {ledgerOpen && (
        <LedgerDrawer logs={activityLogs} id={id} onClose={() => setLedgerOpen(false)} />
      )}
    </div>
  )
}
