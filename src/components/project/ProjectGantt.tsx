'use client'

import { useState, useRef, useEffect } from 'react'
import { CheckCircle2, Circle, Menu, X, Send, Calendar, StickyNote } from 'lucide-react'
import { formatRelative } from '@/lib/utils'

// ── Phase config ─────────────────────────────────────────────────────────────
const PHASE_CONFIG = [
  { key: 'concept',         label: 'Concept',          color: 'var(--phase-concept)' },
  { key: 'protocol',        label: 'Protocol',         color: 'var(--phase-protocol)' },
  { key: 'ethics',          label: 'Ethics Review',    color: 'var(--phase-ethics)' },
  { key: 'data_collection', label: 'Data Collection',  color: 'var(--phase-data)' },
  { key: 'analysis',        label: 'Analysis',         color: 'var(--phase-analysis)' },
  { key: 'writing',         label: 'Writing',          color: 'var(--phase-writing)' },
  { key: 'publication',     label: 'Publication',      color: 'var(--phase-publication)' },
] as const

type ZoomLevel = 'day' | 'week' | 'month'

export interface GanttPhase {
  phase_key: string
  start_date: string | null
  end_date: string | null
  completed_at: string | null
}

export interface GanttNote {
  id: string
  timestamp: string
  details: { summary?: string; operation?: { phase?: string } }
  actor: { full_name?: string } | null
}

interface Props {
  projectId: string
  userId: string
  initialPhases: GanttPhase[]
  initialNotes: GanttNote[]
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function fmtDate(s: string): string {
  return parseDate(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getVisibleRange(phases: GanttPhase[], zoom: ZoomLevel): { start: Date; end: Date } {
  const today = new Date()
  if (zoom === 'day') {
    const s = new Date(today); s.setDate(today.getDate() - 10)
    const e = new Date(today); e.setDate(today.getDate() + 10)
    return { start: s, end: e }
  }
  if (zoom === 'week') {
    const s = new Date(today); s.setDate(today.getDate() - 42)
    const e = new Date(today); e.setDate(today.getDate() + 42)
    return { start: s, end: e }
  }
  // month = full span of all phases
  const set = phases.filter(p => p.start_date && p.end_date)
  if (set.length === 0) {
    return {
      start: new Date(today.getFullYear(), 0, 1),
      end:   new Date(today.getFullYear(), 11, 31),
    }
  }
  const starts = set.map(p => parseDate(p.start_date!).getTime())
  const ends   = set.map(p => parseDate(p.end_date!).getTime())
  const s = new Date(Math.min(...starts)); s.setDate(s.getDate() - 14)
  const e = new Date(Math.max(...ends));   e.setDate(e.getDate() + 14)
  return { start: s, end: e }
}

function pct(date: Date, start: Date, end: Date): number {
  const total  = end.getTime()  - start.getTime()
  const offset = date.getTime() - start.getTime()
  return Math.max(0, Math.min(100, (offset / total) * 100))
}

function monthTicks(start: Date, end: Date): { label: string; pct: number }[] {
  const ticks: { label: string; pct: number }[] = []
  const cur = new Date(start.getFullYear(), start.getMonth(), 1)
  const fmtFn = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' })
  while (cur <= end) {
    const p = pct(cur, start, end)
    if (p >= 0 && p <= 100) ticks.push({ label: fmtFn.format(cur), pct: p })
    cur.setMonth(cur.getMonth() + 1)
  }
  return ticks
}

function weekTicks(start: Date, end: Date): { label: string; pct: number }[] {
  const ticks: { label: string; pct: number }[] = []
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  // Advance to next Monday
  const day = cur.getDay()
  if (day !== 1) cur.setDate(cur.getDate() + ((8 - day) % 7))
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
  while (cur <= end) {
    const p = pct(cur, start, end)
    if (p >= 0 && p <= 100) ticks.push({ label: fmt.format(cur), pct: p })
    cur.setDate(cur.getDate() + 7)
  }
  return ticks
}

function dayTicks(start: Date, end: Date): { label: string; pct: number }[] {
  const ticks: { label: string; pct: number }[] = []
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
  while (cur <= end) {
    const p = pct(cur, start, end)
    if (p >= 0 && p <= 100) ticks.push({ label: fmt.format(cur), pct: p })
    cur.setDate(cur.getDate() + 1)
  }
  return ticks
}

const MS_PER_DAY = 86_400_000

const SIDEBAR_W = 220

// ── Component ─────────────────────────────────────────────────────────────────

export function ProjectGantt({ projectId, userId, initialPhases, initialNotes }: Props) {
  const [phases, setPhases] = useState<GanttPhase[]>(() =>
    PHASE_CONFIG.map(cfg => {
      const found = initialPhases.find(p => p.phase_key === cfg.key)
      return found ?? { phase_key: cfg.key, start_date: null, end_date: null, completed_at: null }
    })
  )
  const [zoom,         setZoom]         = useState<ZoomLevel>('month')
  const [editingKey,   setEditingKey]   = useState<string | null>(null)
  const [editStart,    setEditStart]    = useState('')
  const [editEnd,      setEditEnd]      = useState('')
  const [savingPhase,  setSavingPhase]  = useState<string | null>(null)
  const [notes,        setNotes]        = useState<GanttNote[]>(initialNotes)

  // ── Logs panel state ─────────────────────────────────────────────────────
  const [logsPanelKey, setLogsPanelKey] = useState<string | null>(null)
  const [panelNote,    setPanelNote]    = useState('')
  const [panelSaving,  setPanelSaving]  = useState(false)
  const [saveError,    setSaveError]    = useState<string | null>(null)

  // ── Scroll ref ────────────────────────────────────────────────────────────
  const mainScrollRef = useRef<HTMLDivElement>(null)

  const { start: rangeStart, end: rangeEnd } = getVisibleRange(phases, zoom)
  const today    = new Date()
  const todayPct = pct(today, rangeStart, rangeEnd)
  const ticks    = zoom === 'day'
    ? dayTicks(rangeStart, rangeEnd)
    : zoom === 'week'
    ? weekTicks(rangeStart, rangeEnd)
    : monthTicks(rangeStart, rangeEnd)
  const hasAnyDates = phases.some(p => p.start_date && p.end_date)

  // Canvas pixel width — fixed physical size per zoom level
  const totalDays   = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / MS_PER_DAY)
  const pxPerDay    = zoom === 'day' ? 70 : zoom === 'week' ? 22 : 8
  const canvasWidth = Math.max(900, totalDays * pxPerDay)

  // Scroll so TODAY sits at ~10% from the left of the visible area on mount + zoom change
  useEffect(() => {
    const el = mainScrollRef.current
    if (!el) return
    const todayPx      = (todayPct / 100) * canvasWidth
    const visibleWidth = el.clientWidth
    el.scrollLeft      = Math.max(0, todayPx - visibleWidth * 0.10)
  }, [zoom, canvasWidth, todayPct])

  const logsCfg   = PHASE_CONFIG.find(c => c.key === logsPanelKey)
  const panelNotes = notes.filter(n => n.details.operation?.phase === logsPanelKey)

  // ── Handlers ─────────────────────────────────────────────────────────────

  function openEdit(phase: GanttPhase) {
    setSaveError(null)
    if (editingKey === phase.phase_key) {
      setEditingKey(null)
    } else {
      setEditingKey(phase.phase_key)
      setEditStart(phase.start_date ?? '')
      setEditEnd(phase.end_date ?? '')
      // Close logs panel if open
      setLogsPanelKey(null)
    }
  }

  function openLogsPanel(phaseKey: string) {
    if (logsPanelKey === phaseKey) {
      setLogsPanelKey(null)
      setPanelNote('')
    } else {
      setLogsPanelKey(phaseKey)
      setPanelNote('')
    }
  }

  async function savePhase() {
    if (!editingKey) return
    setSaveError(null)
    setSavingPhase(editingKey)
    try {
      const current = phases.find(p => p.phase_key === editingKey)
      const res = await fetch(`/api/projects/${projectId}/phases`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          phase_key:    editingKey,
          start_date:   editStart   || null,
          end_date:     editEnd     || null,
          completed_at: current?.completed_at ?? null,
        }),
      })
      if (res.ok) {
        setPhases(prev => prev.map(p =>
          p.phase_key === editingKey
            ? { ...p, start_date: editStart || null, end_date: editEnd || null }
            : p
        ))
        setEditingKey(null)
      } else {
        const body = await res.json().catch(() => ({}))
        setSaveError(body.error ?? `Server error ${res.status}`)
      }
    } catch (err) {
      setSaveError('Network error — check your connection')
    } finally {
      setSavingPhase(null)
    }
  }

  async function toggleComplete(phaseKey: string) {
    const phase = phases.find(p => p.phase_key === phaseKey)
    if (!phase) return
    const completed_at = phase.completed_at ? null : new Date().toISOString()
    setSavingPhase(phaseKey)
    try {
      const res = await fetch(`/api/projects/${projectId}/phases`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...phase, completed_at }),
      })
      if (res.ok) {
        setPhases(prev => prev.map(p =>
          p.phase_key === phaseKey ? { ...p, completed_at } : p
        ))
      }
    } finally {
      setSavingPhase(null)
    }
  }

  async function saveNote() {
    if (!panelNote.trim() || !logsPanelKey) return
    setPanelSaving(true)
    try {
      const res = await fetch('/api/audit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          actor_id:      userId,
          action:        'progress.note',
          resource_type: 'project',
          resource_id:   projectId,
          project_id:    projectId,
          details: {
            summary:   panelNote.trim(),
            operation: { phase: logsPanelKey },
          },
        }),
      })
      if (res.ok) {
        const newNote: GanttNote = {
          id:        crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          details:   { summary: panelNote.trim(), operation: { phase: logsPanelKey } },
          actor:     null,
        }
        setNotes(prev => [newNote, ...prev])
        setPanelNote('')
      }
    } finally {
      setPanelSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full" style={{ overflow: 'clip' }}>

      {/* ── Header bar ───────────────────────────────────────────────────────── */}
      <div
        className="flex items-center flex-shrink-0"
        style={{ height: 44, borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div
          className="flex items-center px-4 gap-2 h-full flex-shrink-0"
          style={{
            width:       SIDEBAR_W,
            borderRight: '1px solid var(--border-subtle)',
            background:  'var(--bg-inset)',
          }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-tertiary)', letterSpacing: '0.09em' }}
          >
            My Deliverables
          </span>
          <span
            className="data-mono text-[9px] rounded px-1.5 py-0.5 font-semibold ml-auto"
            style={{ background: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}
          >
            {phases.filter(p => p.completed_at).length} / 7
          </span>
        </div>
        <div className="flex-1 flex items-center justify-end px-4">
          <div
            className="flex items-center gap-0.5 rounded-md p-0.5"
            style={{ background: 'var(--bg-inset)' }}
          >
            {(['day', 'week', 'month'] as ZoomLevel[]).map(z => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className="px-2.5 py-1 rounded text-[10px] font-medium transition-all duration-150 capitalize"
                style={zoom === z ? {
                  background: 'var(--bg-surface)',
                  color:      'var(--text-primary)',
                  boxShadow:  'var(--shadow-xs)',
                } : { color: 'var(--text-tertiary)' }}
              >
                {z}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Two-column body (+ logs panel overlay) ───────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">

        {/* LEFT — deliverable list */}
        <div
          className="flex-shrink-0 flex flex-col overflow-y-auto"
          style={{
            width:       SIDEBAR_W,
            borderRight: '1px solid var(--border-subtle)',
            background:  'var(--bg-inset)',
          }}
        >
          {/* Ruler spacer */}
          <div
            className="flex-shrink-0"
            style={{ height: 40, borderBottom: '1px solid var(--border-subtle)' }}
          />

          {PHASE_CONFIG.map((cfg, idx) => {
            const phase      = phases.find(p => p.phase_key === cfg.key)!
            const isComplete = !!phase.completed_at
            const hasBar     = !!(phase.start_date && phase.end_date)
            const isEditing  = editingKey   === cfg.key
            const isLogsOpen = logsPanelKey === cfg.key
            const noteCount  = notes.filter(n => n.details.operation?.phase === cfg.key).length

            return (
              <div
                key={cfg.key}
                className="flex items-center gap-0 group cursor-pointer select-none flex-shrink-0 relative"
                style={{
                  height:       48,
                  borderBottom: '1px solid var(--border-row)',
                  background:   isEditing
                    ? `color-mix(in srgb, ${cfg.color} 8%, var(--bg-surface))`
                    : 'transparent',
                  transition:   'background 150ms ease-out',
                }}
                onClick={() => openEdit(phase)}
              >
                {/* Phase colour left accent stripe */}
                <div
                  className="flex-shrink-0 self-stretch"
                  style={{
                    width:      3,
                    background: isComplete ? 'var(--status-success)' : hasBar ? cfg.color : 'var(--border-subtle)',
                    opacity:    isComplete ? 0.6 : hasBar ? 0.5 : 0.35,
                  }}
                />

                <div className="flex items-center gap-2 px-2 flex-1 min-w-0">
                  {/* Number */}
                  <span
                    className="data-mono text-[10px] font-semibold flex-shrink-0"
                    style={{ color: 'var(--text-tertiary)', minWidth: 16 }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  {/* Status icon */}
                  <button
                    onClick={e => { e.stopPropagation(); toggleComplete(cfg.key) }}
                    disabled={!!savingPhase}
                    title={isComplete ? 'Mark incomplete' : 'Mark complete'}
                    className="flex-shrink-0 transition-opacity duration-150 hover:opacity-70"
                  >
                    {isComplete ? (
                      <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--status-success)' }} />
                    ) : hasBar ? (
                      <div className="rounded-full" style={{ width: 9, height: 9, background: cfg.color }} />
                    ) : (
                      <Circle className="h-3.5 w-3.5" style={{ color: 'var(--border-default)' }} />
                    )}
                  </button>

                  {/* Label + date range */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-medium truncate leading-tight"
                      style={{
                        color:          isComplete ? 'var(--text-tertiary)' : 'var(--text-primary)',
                        textDecoration: isComplete ? 'line-through' : 'none',
                      }}
                    >
                      {cfg.label}
                    </p>
                    {hasBar ? (
                      <p className="data-mono text-[9px] leading-tight mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        {fmtDate(phase.start_date!)} → {fmtDate(phase.end_date!)}
                      </p>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); openEdit(phase) }}
                        className="flex items-center gap-0.5 text-[9px] font-semibold leading-tight mt-0.5 transition-opacity duration-150"
                        style={{ color: cfg.color, opacity: isEditing ? 1 : 0.7 }}
                      >
                        <Calendar className="h-2.5 w-2.5" />
                        {isEditing ? 'Setting dates…' : 'Add dates'}
                      </button>
                    )}
                  </div>

                  {/* ≡ Logs button */}
                  <button
                    onClick={e => { e.stopPropagation(); openLogsPanel(cfg.key) }}
                    title="View notes & logs"
                    className="flex-shrink-0 flex items-center justify-center rounded transition-all duration-150 relative"
                    style={{
                      width:      28,
                      height:     28,
                      background: isLogsOpen
                        ? `color-mix(in srgb, ${cfg.color} 15%, transparent)`
                        : 'transparent',
                    }}
                  >
                    <Menu
                      className="h-3.5 w-3.5"
                      style={{ color: isLogsOpen ? cfg.color : 'var(--text-tertiary)' }}
                    />
                    {/* Note count badge */}
                    {noteCount > 0 && (
                      <span
                        className="absolute -top-0.5 -right-0.5 data-mono text-[8px] font-bold rounded-full flex items-center justify-center text-white"
                        style={{
                          width:      14,
                          height:     14,
                          background: cfg.color,
                          fontSize:    8,
                        }}
                      >
                        {noteCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* RIGHT — timeline track */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative">

          {/* Main scrollable area — sticky ruler + rows, always-visible scrollbar */}
          <div
            ref={mainScrollRef}
            className="flex-1 overflow-x-scroll overflow-y-auto relative gantt-scroll-top"
          >
            <div style={{ minWidth: canvasWidth, position: 'relative' }}>

          {/* Sticky ruler */}
          <div
            className="sticky top-0 z-20"
            style={{
              height:       40,
              background:   'var(--bg-surface)',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            {ticks.map((tick, i) => (
              <span
                key={i}
                className="absolute top-0 bottom-0 flex items-center pointer-events-none"
                style={{
                  left:       `${tick.pct}%`,
                  paddingLeft: 6,
                  fontSize:   10,
                  fontFamily: 'var(--font-mono)',
                  color:      'var(--text-tertiary)',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}
              >
                {tick.label}
              </span>
            ))}
            {todayPct >= 1 && todayPct <= 99 && (
              <div
                className="absolute top-0 bottom-0 flex items-center justify-center pointer-events-none"
                style={{ left: `${todayPct}%`, transform: 'translateX(-50%)' }}
              >
                <div
                  className="text-white font-bold rounded px-1.5 py-0.5"
                  style={{ background: 'var(--accent-blue)', fontSize: 9, letterSpacing: '0.06em' }}
                >
                  TODAY
                </div>
              </div>
            )}
          </div>

          {/* Phase rows */}
          <div className="relative">
            {ticks.map((tick, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{ left: `${tick.pct}%`, width: 1, background: 'var(--border-row)' }}
              />
            ))}
            {todayPct >= 1 && todayPct <= 99 && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-10"
                style={{ left: `${todayPct}%`, width: 1, background: 'var(--accent-blue)', opacity: 0.3 }}
              />
            )}

            {PHASE_CONFIG.map((cfg, idx) => {
              const phase      = phases.find(p => p.phase_key === cfg.key)!
              const hasBar     = !!(phase.start_date && phase.end_date)
              const isComplete = !!phase.completed_at
              const isEditing  = editingKey   === cfg.key
              const isLogsOpen = logsPanelKey === cfg.key
              const isEven     = idx % 2 === 0

              let barLeft = 0, barWidth = 0
              if (hasBar) {
                barLeft  = pct(parseDate(phase.start_date!), rangeStart, rangeEnd)
                barWidth = pct(parseDate(phase.end_date!),   rangeStart, rangeEnd) - barLeft
              }

              const dots = notes
                .filter(n => n.details.operation?.phase === cfg.key)
                .slice(0, 6)
                .map(n => ({ id: n.id, dp: pct(new Date(n.timestamp), rangeStart, rangeEnd), s: n.details.summary ?? '' }))
                .filter(d => d.dp >= 0 && d.dp <= 100)

              return (
                <div
                  key={cfg.key}
                  className="relative"
                  style={{
                    height:       48,
                    borderBottom: '1px solid var(--border-row)',
                    background:   isEditing || isLogsOpen
                      ? `color-mix(in srgb, ${cfg.color} 6%, var(--bg-surface))`
                      : isEven
                      ? 'var(--bg-surface)'
                      : 'var(--bg-row-hover)',
                    transition:   'background 150ms ease-out',
                  }}
                >
                  {hasBar ? (
                    <button
                      onClick={() => openEdit(phase)}
                      title={`${phase.start_date} → ${phase.end_date}`}
                      className="absolute top-1/2 -translate-y-1/2 transition-all duration-150 hover:brightness-110 active:scale-y-95"
                      style={{
                        left:         `${Math.max(0.5, barLeft)}%`,
                        width:        `${Math.max(2, barWidth)}%`,
                        height:        22,
                        borderRadius:  9999,
                        background:   isComplete ? 'var(--status-success)' : cfg.color,
                        opacity:      isComplete ? 0.65 : 0.85,
                        zIndex:        1,
                        boxShadow:    `0 1px 4px color-mix(in srgb, ${cfg.color} 50%, transparent)`,
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => openEdit(phase)}
                      className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center gap-1.5 transition-opacity duration-150 opacity-50 hover:opacity-90"
                      style={{
                        left:         '5%',
                        right:        '5%',
                        height:        22,
                        borderRadius:  9999,
                        border:       `1.5px dashed color-mix(in srgb, ${cfg.color} 40%, var(--border-default))`,
                        color:        `color-mix(in srgb, ${cfg.color} 60%, var(--text-tertiary))`,
                        fontSize:      10,
                        background:   `color-mix(in srgb, ${cfg.color} 4%, transparent)`,
                      }}
                    >
                      <Calendar className="h-2.5 w-2.5" />
                      Set dates for {cfg.label}
                    </button>
                  )}

                  {/* Annotation dots */}
                  {dots.map(d => (
                    <div
                      key={d.id}
                      title={d.s}
                      className="absolute top-1/2 -translate-y-1/2 rounded-full pointer-events-none z-20"
                      style={{
                        left:       `${d.dp}%`,
                        width:       7,
                        height:      7,
                        marginLeft: -3.5,
                        background:  cfg.color,
                        boxShadow:  '0 0 0 2px white',
                      }}
                    />
                  ))}
                </div>
              )
            })}

            {/* Empty state overlay */}
            {!hasAnyDates && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30"
                style={{ background: 'rgba(247,249,251,0.75)' }}
              >
                <Calendar className="h-6 w-6 mb-2" style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
                <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  Click any phase to set start & end dates
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>
                  Bars will appear here as you build your timeline
                </p>
              </div>
            )}
          </div>{/* end phase rows */}

            </div>{/* end canvas */}
          </div>{/* end mainScrollRef */}
        </div>{/* end right panel */}

        {/* ── Notes & Logs slide-in panel ───────────────────────────────────── */}
        {logsPanelKey && logsCfg && (
          <>
            {/* Backdrop */}
            <div
              className="absolute inset-0 z-30"
              style={{ background: 'rgba(24,24,27,0.18)' }}
              onClick={() => { setLogsPanelKey(null); setPanelNote('') }}
            />

            {/* Panel */}
            <div
              className="absolute top-0 right-0 bottom-0 z-40 flex flex-col animate-slide-in-right"
              style={{
                width:      300,
                background: 'var(--bg-surface)',
                borderLeft: '1px solid var(--border-default)',
                boxShadow:  'var(--shadow-xl)',
              }}
            >
              {/* Panel header */}
              <div
                className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <div
                  className="rounded-full flex-shrink-0"
                  style={{ width: 8, height: 8, background: logsCfg.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-manrope)' }}>
                    My Notes &amp; Logs
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    {logsCfg.label}
                  </p>
                </div>
                <button
                  onClick={() => { setLogsPanelKey(null); setPanelNote('') }}
                  className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded transition-colors duration-150"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Notes list */}
              <div className="flex-1 overflow-y-auto">
                {panelNotes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                    <StickyNote className="h-8 w-8 mb-3" style={{ color: 'var(--text-tertiary)', opacity: 0.35 }} />
                    <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                      No notes yet
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>
                      Add your first progress log below
                    </p>
                  </div>
                ) : (
                  <div className="px-4 py-3 flex flex-col gap-2.5">
                    {panelNotes.map((note, i) => (
                      <div
                        key={note.id}
                        className="rounded-lg p-3 animate-fade-up"
                        style={{
                          background:       'var(--bg-inset)',
                          border:           '1px solid var(--border-subtle)',
                          animationDelay:   `${i * 30}ms`,
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div
                            className="rounded-full flex-shrink-0"
                            style={{ width: 5, height: 5, background: logsCfg.color }}
                          />
                          <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                            {note.actor?.full_name ?? 'Personal Log'}
                          </span>
                          <span className="data-mono text-[10px] ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                            · {formatRelative(note.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                          {note.details.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Note input footer */}
              <div
                className="flex-shrink-0 px-4 py-3"
                style={{ borderTop: '1px solid var(--border-subtle)' }}
              >
                <textarea
                  value={panelNote}
                  onChange={e => setPanelNote(e.target.value)}
                  placeholder="Add a personal update or note…"
                  rows={3}
                  className="w-full text-xs rounded-lg px-3 py-2.5 outline-none resize-none mb-2.5"
                  style={{
                    color:      'var(--text-primary)',
                    border:     '1px solid var(--border-default)',
                    background: 'var(--bg-inset)',
                    fontFamily: 'inherit',
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveNote() }}
                />
                <button
                  onClick={saveNote}
                  disabled={panelSaving || !panelNote.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold text-white transition-all duration-150 disabled:opacity-40 active:scale-[0.98]"
                  style={{ background: 'var(--accent-primary)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-blue)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent-primary)')}
                >
                  <Send className="h-3 w-3" />
                  {panelSaving ? 'Saving…' : 'Save Note'}
                </button>
                <p className="text-center text-[10px] mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                  ⌘↵ to save
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Bottom date-edit bar ─────────────────────────────────────────────── */}
      {editingKey && (
        <div
          className="flex-shrink-0 animate-slide-up px-4 py-3"
          style={{
            borderTop:  '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
          }}
        >
          {(() => {
            const cfg = PHASE_CONFIG.find(c => c.key === editingKey)!
            return (
              <div className="flex items-start gap-3">
                <div
                  className="rounded-full flex-shrink-0 mt-0.5"
                  style={{ width: 3, height: 40, background: cfg.color }}
                />
                <div className="flex-1 flex flex-col gap-2">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-tertiary)', letterSpacing: '0.07em' }}
                  >
                    Set dates · {cfg.label}
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>Start</label>
                      <input
                        type="date"
                        value={editStart}
                        onChange={e => { setEditStart(e.target.value); setSaveError(null) }}
                        className="text-xs rounded-md px-2.5 py-1.5 outline-none"
                        style={{
                          color:      'var(--text-primary)',
                          border:     `1px solid ${saveError ? 'var(--status-error)' : 'var(--border-default)'}`,
                          background: 'var(--bg-inset)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      />
                    </div>
                    <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>→</span>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>End</label>
                      <input
                        type="date"
                        value={editEnd}
                        onChange={e => { setEditEnd(e.target.value); setSaveError(null) }}
                        className="text-xs rounded-md px-2.5 py-1.5 outline-none"
                        style={{
                          color:      'var(--text-primary)',
                          border:     `1px solid ${saveError ? 'var(--status-error)' : 'var(--border-default)'}`,
                          background: 'var(--bg-inset)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={savePhase}
                        disabled={!!savingPhase || !editStart || !editEnd}
                        className="px-3 py-1.5 rounded text-xs font-medium text-white transition-colors duration-150 disabled:opacity-40"
                        style={{ background: 'var(--accent-primary)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-blue)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent-primary)')}
                      >
                        {savingPhase === editingKey ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setEditingKey(null); setSaveError(null) }}
                        className="flex items-center justify-center h-7 w-7 rounded"
                        style={{ border: '1px solid var(--border-default)', background: 'var(--bg-inset)' }}
                      >
                        <X className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                      </button>
                    </div>
                  </div>

                  {/* Error message */}
                  {saveError && (
                    <div
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-xs animate-fade-in"
                      style={{
                        background: 'var(--status-error-bg)',
                        border:     '1px solid var(--border-status-error)',
                        color:      'var(--status-error-text)',
                      }}
                    >
                      <span className="font-semibold">Save failed:</span> {saveError}
                      {saveError.includes('relation') || saveError.includes('does not exist') ? (
                        <span className="ml-1 opacity-80">— run the project_phases migration in your Supabase dashboard</span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
