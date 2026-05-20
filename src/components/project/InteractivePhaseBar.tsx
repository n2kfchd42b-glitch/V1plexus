'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Check, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GanttPhase } from '@/components/project/ProjectGantt'

// ── Phase config ──────────────────────────────────────────────────────────────

const PHASES = [
  { key: 'concept',         label: 'Concept',         short: 'Con', color: '#A1A1AA' },
  { key: 'protocol',        label: 'Protocol',         short: 'Pro', color: '#3B82F6' },
  { key: 'ethics',          label: 'Ethics',           short: 'Eth', color: '#F59E0B' },
  { key: 'data_collection', label: 'Data Collection',  short: 'Dat', color: '#8B5CF6' },
  { key: 'analysis',        label: 'Analysis',         short: 'Ana', color: '#EC4899' },
  { key: 'writing',         label: 'Writing',          short: 'Wri', color: '#14B8A6' },
  { key: 'publication',     label: 'Publication',      short: 'Pub', color: '#22C55E' },
] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMs(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// Returns 0-1 fill for a phase based on today vs its date window
function computeFill(phase: GanttPhase): number {
  if (phase.completed_at) return 1
  if (!phase.start_date || !phase.end_date) return 0
  const start = toMs(phase.start_date)
  const end   = toMs(phase.end_date)
  const now   = Date.now()
  if (now <= start) return 0
  if (now >= end)   return 1
  return (now - start) / (end - start)
}

function isOverdue(phase: GanttPhase): boolean {
  if (phase.completed_at || !phase.end_date) return false
  return Date.now() > toMs(phase.end_date)
}

async function writeAudit(
  userId: string, projectId: string,
  action: string, details: Record<string, unknown>,
) {
  await fetch('/api/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actor_id: userId, action,
      resource_type: 'project', resource_id: projectId, project_id: projectId,
      details,
    }),
  })
}

// ── Popover ───────────────────────────────────────────────────────────────────

interface PopoverProps {
  cfg:       typeof PHASES[number]
  phase:     GanttPhase
  projectId: string
  userId:    string
  onSave:    (updated: GanttPhase) => void
  onClose:   () => void
}

function PhasePopover({ cfg, phase, projectId, userId, onSave, onClose }: PopoverProps) {
  const [start,   setStart]   = useState(phase.start_date ?? '')
  const [end,     setEnd]     = useState(phase.end_date   ?? '')
  const [note,    setNote]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [tab,     setTab]     = useState<'dates' | 'note'>('dates')
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const handleSaveDates = useCallback(async () => {
    if (!start || !end) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/phases`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase_key: cfg.key,
          start_date: start,
          end_date: end,
          completed_at: phase.completed_at,
        }),
      })
      if (!res.ok) return
      await writeAudit(userId, projectId, 'phase.scheduled', {
        phase: cfg.key, phase_label: cfg.label,
        start_date: start, end_date: end,
        summary: `Scheduled ${cfg.label}: ${start} → ${end}`,
      })
      onSave({ ...phase, start_date: start, end_date: end })
    } finally {
      setSaving(false)
    }
  }, [cfg, start, end, phase, projectId, userId, onSave])

  const handleSaveNote = useCallback(async () => {
    if (!note.trim()) return
    setSaving(true)
    try {
      await writeAudit(userId, projectId, 'phase.note', {
        phase: cfg.key, phase_label: cfg.label,
        summary: note.trim(),
      })
      setNote('')
      setTab('dates')
    } finally {
      setSaving(false)
    }
  }, [cfg, note, projectId, userId])

  const handleToggleComplete = useCallback(async () => {
    setSaving(true)
    const completed_at = phase.completed_at ? null : new Date().toISOString()
    try {
      const res = await fetch(`/api/projects/${projectId}/phases`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...phase, completed_at }),
      })
      if (!res.ok) return
      const action = completed_at ? 'phase.completed' : 'phase.reopened'
      await writeAudit(userId, projectId, action, {
        phase: cfg.key, phase_label: cfg.label, completed_at,
        summary: completed_at ? `Marked ${cfg.label} as complete` : `Reopened ${cfg.label}`,
      })
      onSave({ ...phase, completed_at })
    } finally {
      setSaving(false)
    }
  }, [cfg, phase, projectId, userId, onSave])

  const fill = computeFill(phase)
  const overdue = isOverdue(phase)

  return (
    <div
      ref={ref}
      className="absolute z-50 top-[calc(100%+8px)] left-1/2 -translate-x-1/2 animate-snappy-in"
      style={{
        width: 280,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {cfg.label}
          </span>
          {overdue && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ background: 'var(--status-error-bg)', color: 'var(--status-error-text)' }}
            >
              Overdue
            </span>
          )}
          {phase.completed_at && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ background: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}
            >
              Complete
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />}
          <button
            onClick={onClose}
            className="h-6 w-6 rounded flex items-center justify-center hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            <X style={{ width: 12, height: 12, color: 'var(--text-tertiary)' }} />
          </button>
        </div>
      </div>

      {/* Progress line */}
      {phase.start_date && phase.end_date && (
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="data-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              {fmtDate(phase.start_date)}
            </span>
            <span className="data-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              {fmtDate(phase.end_date)}
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-inset)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round(fill * 100)}%`,
                background: overdue ? 'var(--status-error)' : cfg.color,
              }}
            />
          </div>
          <p className="data-mono text-[10px] text-right mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {Math.round(fill * 100)}%
          </p>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex px-4 pt-3 gap-3">
        {(['dates', 'note'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'text-xs pb-1.5 border-b-2 transition-colors duration-150 capitalize',
              tab === t
                ? 'font-semibold border-[var(--accent-blue)]'
                : 'font-medium border-transparent'
            )}
            style={{
              color: tab === t ? 'var(--text-primary)' : 'var(--text-tertiary)',
            }}
          >
            {t === 'dates' ? 'Set dates' : 'Add note'}
          </button>
        ))}
      </div>

      {/* Dates tab */}
      {tab === 'dates' && (
        <div className="px-4 py-3">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                Start
              </label>
              <input
                type="date"
                value={start}
                onChange={e => setStart(e.target.value)}
                className="data-mono text-sm h-8 w-full px-2.5 rounded border"
                style={{
                  borderColor: 'var(--border-default)',
                  background: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontSize: 13,
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                Deadline
              </label>
              <input
                type="date"
                value={end}
                min={start}
                onChange={e => setEnd(e.target.value)}
                className="data-mono text-sm h-8 w-full px-2.5 rounded border"
                style={{
                  borderColor: 'var(--border-default)',
                  background: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontSize: 13,
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleSaveDates}
              disabled={saving || !start || !end}
              className="h-7 flex-1 rounded text-xs font-medium text-white disabled:opacity-40 transition-opacity"
              style={{ background: cfg.color }}
            >
              Save dates
            </button>
            <button
              onClick={handleToggleComplete}
              disabled={saving}
              title={phase.completed_at ? 'Reopen phase' : 'Mark complete'}
              className="h-7 w-7 rounded border flex items-center justify-center flex-shrink-0 transition-colors"
              style={{
                borderColor: phase.completed_at ? cfg.color : 'var(--border-default)',
                background: phase.completed_at ? cfg.color : 'transparent',
              }}
            >
              <Check
                style={{
                  width: 12, height: 12,
                  color: phase.completed_at ? 'white' : 'var(--text-tertiary)',
                  strokeWidth: 3,
                }}
              />
            </button>
          </div>
        </div>
      )}

      {/* Note tab */}
      {tab === 'note' && (
        <div className="px-4 py-3">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Progress, decisions, observations…"
            rows={3}
            className="w-full text-sm rounded border px-3 py-2 resize-none"
            style={{
              borderColor: 'var(--border-default)',
              background: 'var(--bg-app)',
              color: 'var(--text-primary)',
              outline: 'none',
              fontSize: 13,
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveNote()
            }}
          />
          <button
            onClick={handleSaveNote}
            disabled={saving || !note.trim()}
            className="mt-2 h-7 w-full rounded text-xs font-medium text-white disabled:opacity-40 transition-opacity"
            style={{ background: 'var(--accent-blue)' }}
          >
            Save to ledger
          </button>
        </div>
      )}

      {/* Footer hint */}
      <div
        className="px-4 py-2 border-t text-[10px]"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}
      >
        All changes are recorded in the immutable research ledger.
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  projectId:     string
  userId:        string
  initialPhases: GanttPhase[]
  height?:       number
  className?:    string
}

export function InteractivePhaseBar({
  projectId, userId, initialPhases, height = 6, className,
}: Props) {
  const [phases, setPhases] = useState<GanttPhase[]>(() =>
    PHASES.map(cfg => {
      const found = initialPhases.find(p => p.phase_key === cfg.key)
      return found ?? { phase_key: cfg.key, start_date: null, end_date: null, completed_at: null }
    })
  )
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [hoverKey,  setHoverKey]  = useState<string | null>(null)

  const handleUpdate = useCallback((updated: GanttPhase) => {
    setPhases(prev => prev.map(p => p.phase_key === updated.phase_key ? updated : p))
    // keep popover open unless completed toggled
  }, [])

  const handleSaveAndClose = useCallback((updated: GanttPhase) => {
    setPhases(prev => prev.map(p => p.phase_key === updated.phase_key ? updated : p))
    setActiveKey(null)
  }, [])

  return (
    <div className={cn('w-full', className)}>

      {/* ── Segments ────────────────────────────────────────────────────────── */}
      <div className="flex gap-0.5" style={{ height, position: 'relative' }}>
        {PHASES.map((cfg, i) => {
          const phase  = phases[i]
          const fill   = computeFill(phase)
          const overdue = isOverdue(phase)
          const hasData = !!(phase.start_date && phase.end_date)
          const isActive = activeKey === cfg.key
          const isHover  = hoverKey === cfg.key

          // Background: gradient split at fill point
          let bg: string
          if (!hasData && !phase.completed_at) {
            bg = '#E4E4E7'
          } else if (fill === 0) {
            bg = `${cfg.color}33` // planned but not started
          } else if (fill === 1) {
            bg = cfg.color
          } else {
            bg = `linear-gradient(to right, ${cfg.color} ${fill * 100}%, ${cfg.color}33 ${fill * 100}%)`
          }

          return (
            <div
              key={cfg.key}
              className="relative flex-1"
              style={{ zIndex: isActive ? 40 : 'auto' }}
            >
              {/* Clickable segment */}
              <button
                onClick={() => setActiveKey(isActive ? null : cfg.key)}
                onMouseEnter={() => setHoverKey(cfg.key)}
                onMouseLeave={() => setHoverKey(null)}
                className="w-full transition-all duration-150"
                style={{
                  height,
                  background: bg,
                  borderRadius: i === 0 ? '2px 0 0 2px' : i === PHASES.length - 1 ? '0 2px 2px 0' : 2,
                  outline: isActive ? `2px solid ${cfg.color}` : 'none',
                  outlineOffset: 1,
                  transform: isHover || isActive ? 'scaleY(1.3)' : 'scaleY(1)',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: overdue && fill < 1 ? 'visible' : 'hidden',
                }}
              >
                {/* Overdue pulse */}
                {overdue && !phase.completed_at && (
                  <div
                    className="absolute inset-0 animate-pulse"
                    style={{
                      background: 'var(--status-error)',
                      opacity: 0.25,
                      borderRadius: 'inherit',
                    }}
                  />
                )}
              </button>

              {/* Hover tooltip */}
              {isHover && !isActive && (
                <div
                  className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap z-30"
                  style={{
                    background: 'var(--text-primary)',
                    color: 'white',
                    borderRadius: 'var(--radius-sm)',
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  {cfg.label}
                  {phase.start_date && phase.end_date && (
                    <span className="data-mono opacity-70 ml-1.5">
                      {fmtDate(phase.start_date)} → {fmtDate(phase.end_date)}
                    </span>
                  )}
                  {!phase.start_date && (
                    <span className="opacity-60 ml-1">· click to set dates</span>
                  )}
                </div>
              )}

              {/* Popover */}
              {isActive && (
                <PhasePopover
                  cfg={cfg}
                  phase={phase}
                  projectId={projectId}
                  userId={userId}
                  onSave={handleUpdate}
                  onClose={() => setActiveKey(null)}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* ── Labels ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-0.5 mt-1">
        {PHASES.map((cfg, i) => {
          const phase    = phases[i]
          const isActive = activeKey === cfg.key
          return (
            <div key={cfg.key} className="flex-1">
              <button
                onClick={() => setActiveKey(isActive ? null : cfg.key)}
                className="text-[9px] font-medium w-full text-left transition-colors duration-150"
                style={{
                  color: isActive
                    ? cfg.color
                    : phase.start_date
                      ? 'var(--text-secondary)'
                      : 'var(--text-tertiary)',
                  fontWeight: isActive || phase.start_date ? 600 : 400,
                }}
              >
                {cfg.short}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
