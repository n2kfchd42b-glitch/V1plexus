'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Check, X, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DndContext, closestCenter, DragEndEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, horizontalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { GanttPhase } from '@/components/project/ProjectGantt'

// ── Default template & palette ────────────────────────────────────────────────

const DEFAULT_PHASES = [
  { phase_key: 'concept',         name: 'Concept',         color: '#A1A1AA', sort_order: 0 },
  { phase_key: 'protocol',        name: 'Protocol',        color: '#3B82F6', sort_order: 1 },
  { phase_key: 'ethics',          name: 'Ethics',          color: '#F59E0B', sort_order: 2 },
  { phase_key: 'data_collection', name: 'Data Collection', color: '#8B5CF6', sort_order: 3 },
  { phase_key: 'analysis',        name: 'Analysis',        color: '#EC4899', sort_order: 4 },
  { phase_key: 'writing',         name: 'Writing',         color: '#14B8A6', sort_order: 5 },
  { phase_key: 'publication',     name: 'Publication',     color: '#22C55E', sort_order: 6 },
]

const COLOR_PALETTE = [
  '#A1A1AA', '#3B82F6', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#22C55E', '#EF4444',
  '#F97316', '#06B6D4', '#84CC16', '#6366F1',
]

// ── Internal phase type (richer than GanttPhase — all fields resolved) ────────

interface PhaseItem {
  phase_key:    string
  name:         string
  color:        string
  start_date:   string | null
  end_date:     string | null
  completed_at: string | null
  sort_order:   number
}

function toItem(p: GanttPhase, idx: number): PhaseItem {
  const def = DEFAULT_PHASES.find(d => d.phase_key === p.phase_key)
  return {
    phase_key:    p.phase_key,
    name:         p.name  ?? def?.name  ?? p.phase_key,
    color:        p.color ?? def?.color ?? '#A1A1AA',
    start_date:   p.start_date,
    end_date:     p.end_date,
    completed_at: p.completed_at,
    sort_order:   p.sort_order ?? idx,
  }
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function putPhase(projectId: string, phase: PhaseItem) {
  return fetch(`/api/projects/${projectId}/phases`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phase_key:    phase.phase_key,
      name:         phase.name,
      color:        phase.color,
      sort_order:   phase.sort_order,
      disabled:     false,
      start_date:   phase.start_date,
      end_date:     phase.end_date,
      completed_at: phase.completed_at,
    }),
  })
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

function computeFill(p: PhaseItem): number {
  if (p.completed_at) return 1
  if (!p.start_date || !p.end_date) return 0
  const start = toMs(p.start_date), end = toMs(p.end_date), now = Date.now()
  if (now <= start) return 0
  if (now >= end)   return 1
  return (now - start) / (end - start)
}

function isOverdue(p: PhaseItem): boolean {
  if (p.completed_at || !p.end_date) return false
  return Date.now() > toMs(p.end_date)
}

// ── Popover ───────────────────────────────────────────────────────────────────

interface PopoverProps {
  phase:      PhaseItem
  projectId:  string
  userId:     string
  onSave:     (updated: PhaseItem) => void
  onClose:    () => void
  anchorRect: DOMRect
}

function PhasePopover({ phase, projectId, userId, onSave, onClose, anchorRect }: PopoverProps) {
  const [start,     setStart]     = useState(phase.start_date ?? '')
  const [end,       setEnd]       = useState(phase.end_date   ?? '')
  const [note,      setNote]      = useState('')
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [tab,       setTab]       = useState<'dates' | 'note'>('dates')
  const ref = useRef<HTMLDivElement>(null)

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
    setSaveError(null)
    try {
      const updated = { ...phase, start_date: start, end_date: end }
      const res = await putPhase(projectId, updated)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setSaveError(body.error ?? 'Failed to save — please try again')
        return
      }
      await writeAudit(userId, projectId, 'phase.scheduled', {
        phase: phase.phase_key, phase_label: phase.name,
        start_date: start, end_date: end,
        summary: `Scheduled ${phase.name}: ${start} → ${end}`,
      })
      onSave(updated)
    } finally { setSaving(false) }
  }, [phase, start, end, projectId, userId, onSave])

  const handleSaveNote = useCallback(async () => {
    if (!note.trim()) return
    setSaving(true)
    try {
      await writeAudit(userId, projectId, 'phase.note', {
        phase: phase.phase_key, phase_label: phase.name, summary: note.trim(),
      })
      setNote('')
      setTab('dates')
    } finally { setSaving(false) }
  }, [phase, note, projectId, userId])

  const handleToggleComplete = useCallback(async () => {
    setSaving(true)
    setSaveError(null)
    const completed_at = phase.completed_at ? null : new Date().toISOString()
    try {
      const updated = { ...phase, completed_at }
      const res = await putPhase(projectId, updated)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setSaveError(body.error ?? 'Failed to save — please try again')
        return
      }
      await writeAudit(userId, projectId, completed_at ? 'phase.completed' : 'phase.reopened', {
        phase: phase.phase_key, phase_label: phase.name, completed_at,
        summary: completed_at ? `Marked ${phase.name} as complete` : `Reopened ${phase.name}`,
      })
      onSave(updated)
    } finally { setSaving(false) }
  }, [phase, projectId, userId, onSave])

  const fill    = computeFill(phase)
  const overdue = isOverdue(phase)

  const left = Math.max(8, Math.min(
    anchorRect.left + anchorRect.width / 2 - 140,
    window.innerWidth - 288,
  ))

  return (
    <div
      ref={ref}
      className="animate-snappy-in"
      style={{
        position: 'fixed',
        top:      anchorRect.bottom + 8,
        left,
        width:    280,
        zIndex:   9999,
        background:   'var(--bg-surface)',
        border:       '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        boxShadow:    'var(--shadow-lg)',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: phase.color }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{phase.name}</span>
          {overdue && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--status-error-bg)', color: 'var(--status-error-text)' }}>Overdue</span>}
          {phase.completed_at && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}>Complete</span>}
        </div>
        <div className="flex items-center gap-1">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />}
          <button onClick={onClose} className="h-6 w-6 rounded flex items-center justify-center hover:bg-[var(--bg-surface-hover)] transition-colors">
            <X style={{ width: 12, height: 12, color: 'var(--text-tertiary)' }} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {phase.start_date && phase.end_date && (
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="data-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{fmtDate(phase.start_date)}</span>
            <span className="data-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{fmtDate(phase.end_date)}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-inset)' }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round(fill * 100)}%`, background: overdue ? 'var(--status-error)' : phase.color }} />
          </div>
          <p className="data-mono text-[10px] text-right mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{Math.round(fill * 100)}%</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex px-4 pt-3 gap-3">
        {(['dates', 'note'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('text-xs pb-1.5 border-b-2 transition-colors duration-150 capitalize', tab === t ? 'font-semibold border-[var(--accent-blue)]' : 'font-medium border-transparent')}
            style={{ color: tab === t ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
          >
            {t === 'dates' ? 'Set dates' : 'Add note'}
          </button>
        ))}
      </div>

      {/* Dates tab */}
      {tab === 'dates' && (
        <div className="px-4 py-3">
          <div className="flex flex-col gap-2">
            {([
              { label: 'Start',    value: start, onChange: setStart, min: undefined },
              { label: 'Deadline', value: end,   onChange: setEnd,   min: start },
            ] as const).map(f => (
              <div key={f.label} className="flex flex-col gap-1">
                <label className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{f.label}</label>
                <input type="date" value={f.value} min={f.min} onChange={e => f.onChange(e.target.value)}
                  className="data-mono text-sm h-8 w-full px-2.5 rounded border"
                  style={{ borderColor: 'var(--border-default)', background: 'var(--bg-app)', color: 'var(--text-primary)', outline: 'none', fontSize: 13 }}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={handleSaveDates} disabled={saving || !start || !end}
              className="h-7 flex-1 rounded text-xs font-medium text-white disabled:opacity-40 transition-opacity"
              style={{ background: phase.color }}
            >Save dates</button>
            <button onClick={handleToggleComplete} disabled={saving}
              title={phase.completed_at ? 'Reopen phase' : 'Mark complete'}
              className="h-7 w-7 rounded border flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ borderColor: phase.completed_at ? phase.color : 'var(--border-default)', background: phase.completed_at ? phase.color : 'transparent' }}
            >
              <Check style={{ width: 12, height: 12, color: phase.completed_at ? 'white' : 'var(--text-tertiary)', strokeWidth: 3 }} />
            </button>
          </div>
          {saveError && (
            <p className="mt-2 text-[11px] font-medium rounded px-2 py-1.5" style={{ background: 'var(--status-error-bg)', color: 'var(--status-error-text)', border: '1px solid var(--border-status-error)' }}>
              {saveError}
            </p>
          )}
        </div>
      )}

      {/* Note tab */}
      {tab === 'note' && (
        <div className="px-4 py-3">
          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="Progress, decisions, observations…"
            rows={3} className="w-full text-sm rounded border px-3 py-2 resize-none"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-app)', color: 'var(--text-primary)', outline: 'none', fontSize: 13 }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveNote() }}
          />
          <button onClick={handleSaveNote} disabled={saving || !note.trim()}
            className="mt-2 h-7 w-full rounded text-xs font-medium text-white disabled:opacity-40 transition-opacity"
            style={{ background: 'var(--accent-blue)' }}
          >Save to ledger</button>
        </div>
      )}

      <div className="px-4 py-2 border-t text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}>
        All changes are recorded in the immutable research ledger.
      </div>
    </div>
  )
}

// ── Sortable segment ──────────────────────────────────────────────────────────

interface SegmentProps {
  phase:     PhaseItem
  height:    number
  isFirst:   boolean
  isLast:    boolean
  isActive:  boolean
  isHover:   boolean
  readOnly:  boolean
  onHover:   (key: string | null) => void
  onClick:   (key: string) => void
  projectId: string
  userId:    string
  onSave:    (p: PhaseItem) => void
  onClose:   () => void
}

function SortableSegment({
  phase, height, isFirst, isLast, isActive, isHover,
  readOnly, onHover, onClick, projectId, userId, onSave, onClose,
}: SegmentProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: phase.phase_key, disabled: readOnly,
  })
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (isActive && wrapperRef.current) {
      setAnchorRect(wrapperRef.current.getBoundingClientRect())
    } else {
      setAnchorRect(null)
    }
  }, [isActive])

  const fill    = computeFill(phase)
  const overdue = isOverdue(phase)
  const hasData = !!(phase.start_date && phase.end_date)

  let bg: string
  if (!hasData && !phase.completed_at)  bg = '#E4E4E7'
  else if (fill === 0)                  bg = `${phase.color}33`
  else if (fill === 1)                  bg = phase.color
  else                                  bg = `linear-gradient(to right, ${phase.color} ${fill * 100}%, ${phase.color}33 ${fill * 100}%)`

  return (
    <div
      ref={(el) => { setNodeRef(el); wrapperRef.current = el }}
      {...attributes}
      style={{ flex: 1, position: 'relative', zIndex: isDragging ? 50 : isActive ? 40 : undefined, transform: CSS.Transform.toString(transform), transition }}
    >
      <div
        {...(readOnly ? {} : listeners)}
        role={readOnly ? undefined : 'button'}
        onClick={readOnly ? undefined : () => onClick(phase.phase_key)}
        onMouseEnter={() => onHover(phase.phase_key)}
        onMouseLeave={() => onHover(null)}
        className="w-full transition-all duration-150"
        style={{
          height,
          background:   bg,
          borderRadius: isFirst ? '2px 0 0 2px' : isLast ? '0 2px 2px 0' : 2,
          outline:      isActive ? `2px solid ${phase.color}` : 'none',
          outlineOffset: 1,
          transform:    isHover || isActive ? 'scaleY(1.3)' : 'scaleY(1)',
          cursor:       readOnly ? 'default' : isDragging ? 'grabbing' : 'grab',
          opacity:      isDragging ? 0.6 : 1,
          position:     'relative',
          overflow:     overdue && fill < 1 ? 'visible' : 'hidden',
        }}
      >
        {overdue && !phase.completed_at && (
          <div className="absolute inset-0 animate-pulse" style={{ background: 'var(--status-error)', opacity: 0.25, borderRadius: 'inherit' }} />
        )}
      </div>

      {/* Hover tooltip */}
      {isHover && !isActive && !isDragging && (
        <div
          className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap z-30"
          style={{ background: 'var(--text-primary)', color: 'white', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: 11, fontWeight: 500 }}
        >
          {phase.name}
          {phase.start_date && phase.end_date && (
            <span className="data-mono opacity-70 ml-1.5">{fmtDate(phase.start_date)} → {fmtDate(phase.end_date)}</span>
          )}
          {!phase.start_date && !readOnly && (
            <span className="opacity-60 ml-1">· drag to reorder · click to set dates</span>
          )}
        </div>
      )}

      {/* Edit popover — portaled to body so it escapes parent stacking contexts */}
      {isActive && !readOnly && anchorRect && createPortal(
        <PhasePopover phase={phase} projectId={projectId} userId={userId} onSave={onSave} onClose={onClose} anchorRect={anchorRect} />,
        document.body,
      )}
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
  readOnly?:     boolean
}

export function InteractivePhaseBar({
  projectId, userId, initialPhases, height = 6, className, readOnly = false,
}: Props) {
  const [phases, setPhases] = useState<PhaseItem[]>(() => {
    if (initialPhases.length > 0) {
      return initialPhases
        .map((p, i) => toItem(p, i))
        .sort((a, b) => a.sort_order - b.sort_order)
    }
    return DEFAULT_PHASES.map(d => ({ ...d, start_date: null, end_date: null, completed_at: null }))
  })

  const [activeKey,       setActiveKey]       = useState<string | null>(null)
  const [hoverKey,        setHoverKey]        = useState<string | null>(null)
  const [editingLabelKey, setEditingLabelKey] = useState<string | null>(null)
  const [editLabelValue,  setEditLabelValue]  = useState('')
  const [showAddForm,     setShowAddForm]     = useState(false)
  const [addName,         setAddName]         = useState('')
  const [addColor,        setAddColor]        = useState(COLOR_PALETTE[1])
  const addFormRef  = useRef<HTMLDivElement>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Seed defaults the first time a project has no phases
  useEffect(() => {
    if (readOnly || initialPhases.length > 0) return
    DEFAULT_PHASES.forEach(d =>
      fetch(`/api/projects/${projectId}/phases`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...d, disabled: false, start_date: null, end_date: null, completed_at: null }),
      })
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close add form on outside click
  useEffect(() => {
    if (!showAddForm) return
    function handler(e: MouseEvent) {
      if (addFormRef.current && !addFormRef.current.contains(e.target as Node)) {
        setShowAddForm(false)
        setAddName('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showAddForm])

  // Focus name input when add form opens
  useEffect(() => {
    if (showAddForm) setTimeout(() => addInputRef.current?.focus(), 40)
  }, [showAddForm])

  const handleUpdate = useCallback((updated: PhaseItem) => {
    setPhases(prev => prev.map(p => p.phase_key === updated.phase_key ? updated : p))
  }, [])

  const handleDelete = useCallback(async (phaseKey: string) => {
    setPhases(prev => prev.filter(p => p.phase_key !== phaseKey))
    setActiveKey(k => k === phaseKey ? null : k)
    await fetch(`/api/projects/${projectId}/phases/${phaseKey}`, { method: 'DELETE' })
  }, [projectId])

  const handleRenameCommit = useCallback(async (phaseKey: string, newName: string) => {
    const trimmed = newName.trim()
    setEditingLabelKey(null)
    if (!trimmed) return
    const phase = phases.find(p => p.phase_key === phaseKey)
    if (!phase || phase.name === trimmed) return
    const updated = { ...phase, name: trimmed }
    setPhases(prev => prev.map(p => p.phase_key === phaseKey ? updated : p))
    await putPhase(projectId, updated)
  }, [phases, projectId])

  const handleAdd = useCallback(async () => {
    const trimmed = addName.trim()
    if (!trimmed) return
    const phase_key = `phase_${Date.now().toString(36)}`
    const newPhase: PhaseItem = {
      phase_key, name: trimmed, color: addColor,
      start_date: null, end_date: null, completed_at: null,
      sort_order: phases.length,
    }
    setPhases(prev => [...prev, newPhase])
    setAddName('')
    setAddColor(COLOR_PALETTE[1])
    setShowAddForm(false)
    const res = await putPhase(projectId, newPhase)
    if (!res.ok) {
      setPhases(prev => prev.filter(p => p.phase_key !== phase_key))
    }
  }, [addName, addColor, phases.length, projectId])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const keys     = phases.map(p => p.phase_key)
    const newOrder = arrayMove(phases, keys.indexOf(active.id as string), keys.indexOf(over.id as string))
      .map((p, i) => ({ ...p, sort_order: i }))
    setPhases(newOrder)
    await Promise.all(newOrder.map(p => putPhase(projectId, p)))
  }, [phases, projectId])

  return (
    <div className={cn('w-full', className)}>

      {/* ── Draggable segments ───────────────────────────────────────────────── */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={phases.map(p => p.phase_key)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-0.5" style={{ height, position: 'relative' }}>
            {phases.map((phase, i) => (
              <SortableSegment
                key={phase.phase_key}
                phase={phase}
                height={height}
                isFirst={i === 0}
                isLast={i === phases.length - 1}
                isActive={activeKey === phase.phase_key}
                isHover={hoverKey === phase.phase_key}
                readOnly={readOnly}
                onHover={setHoverKey}
                onClick={key => setActiveKey(activeKey === key ? null : key)}
                projectId={projectId}
                userId={userId}
                onSave={handleUpdate}
                onClose={() => setActiveKey(null)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* ── Labels row ───────────────────────────────────────────────────────── */}
      <div className="flex gap-0.5 mt-1 items-start">
        {phases.map(phase => {
          const isEditing = editingLabelKey === phase.phase_key
          return (
            <div key={phase.phase_key} className="flex-1 relative group/lbl min-w-0">
              {isEditing ? (
                <input
                  autoFocus
                  value={editLabelValue}
                  onChange={e => setEditLabelValue(e.target.value)}
                  onBlur={() => handleRenameCommit(phase.phase_key, editLabelValue)}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  handleRenameCommit(phase.phase_key, editLabelValue)
                    if (e.key === 'Escape') setEditingLabelKey(null)
                  }}
                  className="text-[9px] font-semibold w-full rounded-sm px-0.5 outline-none"
                  style={{
                    color:      phase.color,
                    background: `${phase.color}18`,
                    border:     `1px solid ${phase.color}66`,
                  }}
                />
              ) : (
                <span
                  title={readOnly ? phase.name : `${phase.name} — click to rename`}
                  onClick={readOnly ? undefined : () => {
                    setEditingLabelKey(phase.phase_key)
                    setEditLabelValue(phase.name)
                  }}
                  className="text-[9px] font-medium block truncate transition-colors duration-150"
                  style={{
                    color:      phase.start_date ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                    fontWeight: phase.start_date ? 600 : 400,
                    cursor:     readOnly ? 'default' : 'text',
                  }}
                >
                  {phase.name}
                </span>
              )}

              {/* Delete — appears on hover, edit mode only */}
              {!readOnly && !isEditing && (
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(phase.phase_key) }}
                  title={`Delete ${phase.name}`}
                  className="absolute -top-1.5 right-0 w-3 h-3 rounded-full hidden group-hover/lbl:flex items-center justify-center transition-colors"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-tertiary)' }}
                >
                  <X style={{ width: 6, height: 6 }} />
                </button>
              )}
            </div>
          )
        })}

        {/* Add phase button + form */}
        {!readOnly && (
          <div ref={addFormRef} className="relative flex-shrink-0 ml-1">
            <button
              onClick={() => setShowAddForm(v => !v)}
              title="Add a phase"
              className="h-4 px-1.5 rounded inline-flex items-center gap-0.5 transition-colors"
              style={{
                border:     '1px dashed var(--border-default)',
                background: showAddForm ? 'var(--bg-surface-hover)' : 'transparent',
                color:      'var(--text-tertiary)',
                fontSize:   9,
                fontWeight: 500,
              }}
            >
              <Plus style={{ width: 8, height: 8 }} />
              Add
            </button>

            {showAddForm && (
              <div
                className="absolute top-[calc(100%+6px)] right-0 z-50 p-3"
                style={{
                  width: 220,
                  background:   'var(--bg-surface)',
                  border:       '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow:    'var(--shadow-lg)',
                }}
                onClick={e => e.stopPropagation()}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  New phase
                </p>
                <input
                  ref={addInputRef}
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  handleAdd()
                    if (e.key === 'Escape') { setShowAddForm(false); setAddName('') }
                  }}
                  placeholder="e.g. Field Work, Pilot Study…"
                  className="w-full h-7 px-2.5 rounded border text-sm mb-2.5 outline-none"
                  style={{ borderColor: 'var(--border-default)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: 12 }}
                />
                <p className="text-[9px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>Colour</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {COLOR_PALETTE.map(c => (
                    <button
                      key={c}
                      onClick={() => setAddColor(c)}
                      className="w-4 h-4 rounded-full transition-transform hover:scale-110 flex-shrink-0"
                      style={{ background: c, outline: addColor === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }}
                    />
                  ))}
                </div>
                <button
                  onClick={handleAdd}
                  disabled={!addName.trim()}
                  className="w-full h-7 rounded text-xs font-semibold text-white disabled:opacity-40 transition-opacity"
                  style={{ background: addColor }}
                >
                  Add phase
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
