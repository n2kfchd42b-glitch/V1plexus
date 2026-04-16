"use client"

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'
import type { EngineColumnSchema, VariableType } from '@/lib/decision-engine/types'
import { completenessPercent } from '@/lib/decision-engine/variableProfiler'

const TYPE_META: Record<VariableType, { abbr: string; bg: string; text: string; dot: string }> = {
  continuous:    { abbr: 'NUM',  bg: 'var(--accent-blue-subtle)',  text: 'var(--accent-blue-hover)',    dot: 'var(--accent-blue-hover)'    },
  binary:        { abbr: 'BIN',  bg: 'var(--status-success-bg)',   text: 'var(--status-success-text)',  dot: 'var(--status-success-text)'  },
  categorical:   { abbr: 'CAT',  bg: 'var(--bg-inset)',            text: 'var(--phase-data)',            dot: 'var(--phase-data)'           },
  date:          { abbr: 'DATE', bg: 'var(--status-warning-bg)',   text: 'var(--status-warning-text)',  dot: 'var(--status-warning-text)'  },
  time_to_event: { abbr: 'T-E',  bg: 'var(--status-error-bg)',     text: 'var(--status-error-hover)',   dot: 'var(--status-error-hover)'   },
  id:            { abbr: 'ID',   bg: 'var(--bg-inset)',            text: 'var(--text-tertiary)',         dot: 'var(--text-tertiary)'        },
  text:          { abbr: 'TXT',  bg: 'var(--bg-inset)',            text: 'var(--text-tertiary)',         dot: 'var(--text-tertiary)'        },
}

interface Props {
  label: string
  required?: boolean
  schema: EngineColumnSchema[]
  allowedTypes?: VariableType[]
  value: EngineColumnSchema | null
  onChange: (col: EngineColumnSchema | null) => void
  placeholder?: string
  row_count: number
  excludeNames?: string[]
}

export function DecisionVariableSelector({
  label,
  required,
  schema,
  allowedTypes,
  value,
  onChange,
  placeholder = 'Select variable…',
  row_count,
  excludeNames = [],
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const options = schema.filter(col => {
    if (excludeNames.includes(col.name)) return false
    if (allowedTypes && allowedTypes.length > 0) return allowedTypes.includes(col.type)
    return col.type !== 'id' && col.type !== 'text'
  })

  const typeMeta = value ? (TYPE_META[value.type] ?? TYPE_META.text) : null
  const completeness = value ? completenessPercent(value, row_count) : null

  return (
    <div ref={ref} className="relative">
      {/* Label row */}
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: value ? (typeMeta?.dot ?? 'var(--accent-blue)') : required ? 'var(--status-error)' : 'var(--text-tertiary)' }}
        />
        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
          {required && <span style={{ color: 'var(--status-error)' }} className="ml-0.5">*</span>}
        </label>
      </div>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center px-2.5 py-2 rounded-lg text-left transition-colors"
        style={{
          background: 'var(--bg-surface)',
          border: `1px solid ${open ? 'var(--border-focus)' : 'var(--border-default)'}`,
          boxShadow: open ? 'var(--shadow-focus)' : 'none',
          minHeight: '34px',
          gap: '6px',
        }}
      >
        {value ? (
          <>
            {/* Colored dot */}
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: typeMeta?.dot }} />
            {/* Variable name — gets all remaining space */}
            <span
              className="text-xs font-semibold flex-1 min-w-0 truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {value.name}
            </span>
            {/* Short type badge */}
            {typeMeta && (
              <span
                className="text-[9px] px-1 py-0.5 rounded font-bold flex-shrink-0 uppercase tracking-wide"
                style={{ background: typeMeta.bg, color: typeMeta.text }}
              >
                {typeMeta.abbr}
              </span>
            )}
            {/* Completeness — just the number */}
            {completeness !== null && (
              <span
                className="text-[10px] font-mono tabular-nums flex-shrink-0"
                style={{
                  color: completeness >= 90
                    ? 'var(--status-success-text)'
                    : completeness >= 75
                      ? 'var(--status-warning-text)'
                      : 'var(--status-error-text)',
                }}
              >
                {completeness}%
              </span>
            )}
            {/* Clear */}
            <span
              role="button"
              onClick={e => { e.stopPropagation(); onChange(null); setOpen(false) }}
              className="h-4 w-4 flex items-center justify-center rounded flex-shrink-0 cursor-pointer"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-row-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
            >
              <X className="h-3 w-3" />
            </span>
          </>
        ) : (
          <>
            <span className="text-xs flex-1" style={{ color: 'var(--text-tertiary)' }}>{placeholder}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
              style={{ color: 'var(--text-tertiary)' }}
            />
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-50 left-0 right-0 top-full mt-1 rounded-lg overflow-hidden"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-lg)',
            maxHeight: '220px',
            overflowY: 'auto',
          }}
        >
          {options.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No compatible variables</p>
            </div>
          ) : (
            options.map(col => {
              const t = TYPE_META[col.type] ?? TYPE_META.text
              const pct = completenessPercent(col, row_count)
              const isSelected = value?.name === col.name
              return (
                <button
                  key={col.name}
                  type="button"
                  onClick={() => { onChange(col); setOpen(false) }}
                  className="w-full flex items-center px-3 py-2 text-left transition-colors"
                  style={{
                    gap: '8px',
                    background: isSelected ? 'var(--bg-row-active)' : undefined,
                    borderBottom: '1px solid var(--border-row)',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-row-hover)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '' }}
                >
                  {/* Dot */}
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.dot }} />
                  {/* Variable name — dominant, takes all space */}
                  <span
                    className="text-xs font-semibold flex-1 min-w-0 truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {col.name}
                  </span>
                  {/* Short type badge */}
                  <span
                    className="text-[9px] px-1 py-0.5 rounded font-bold flex-shrink-0 uppercase tracking-wide"
                    style={{ background: t.bg, color: t.text }}
                  >
                    {t.abbr}
                  </span>
                  {/* Completeness */}
                  <span
                    className="text-[10px] font-mono tabular-nums flex-shrink-0 w-8 text-right"
                    style={{
                      color: pct >= 90
                        ? 'var(--status-success-text)'
                        : pct >= 75
                          ? 'var(--status-warning-text)'
                          : 'var(--status-error-text)',
                    }}
                  >
                    {pct}%
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
