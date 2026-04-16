"use client"

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'
import type { EngineColumnSchema, VariableType } from '@/lib/decision-engine/types'
import { completenessPercent } from '@/lib/decision-engine/variableProfiler'

const TYPE_META: Record<VariableType, { abbr: string; dot: string; bg: string; text: string }> = {
  continuous:    { abbr: 'NUM',  dot: 'var(--accent-blue-hover)',    bg: 'var(--accent-blue-subtle)',  text: 'var(--accent-blue-hover)'    },
  binary:        { abbr: 'BIN',  dot: 'var(--status-success-text)',  bg: 'var(--status-success-bg)',   text: 'var(--status-success-text)'  },
  categorical:   { abbr: 'CAT',  dot: 'var(--phase-data)',           bg: 'var(--bg-inset)',            text: 'var(--phase-data)'           },
  date:          { abbr: 'DATE', dot: 'var(--status-warning-text)',  bg: 'var(--status-warning-bg)',   text: 'var(--status-warning-text)'  },
  time_to_event: { abbr: 'T-E',  dot: 'var(--status-error-hover)',   bg: 'var(--status-error-bg)',     text: 'var(--status-error-hover)'   },
  id:            { abbr: 'ID',   dot: 'var(--text-tertiary)',        bg: 'var(--bg-inset)',            text: 'var(--text-tertiary)'        },
  text:          { abbr: 'TXT',  dot: 'var(--text-tertiary)',        bg: 'var(--bg-inset)',            text: 'var(--text-tertiary)'        },
}

interface Props {
  label: string
  schema: EngineColumnSchema[]
  allowedTypes?: VariableType[]
  value: EngineColumnSchema[]
  onChange: (cols: EngineColumnSchema[]) => void
  placeholder?: string
  row_count: number
  excludeNames?: string[]
}

export function MultiDecisionVariableSelector({
  label,
  schema,
  allowedTypes,
  value,
  onChange,
  placeholder = 'Select variables…',
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

  const selectedNames = new Set(value.map(v => v.name))

  const options = schema.filter(col => {
    if (excludeNames.includes(col.name)) return false
    if (allowedTypes && allowedTypes.length > 0) return allowedTypes.includes(col.type)
    return col.type !== 'id' && col.type !== 'text'
  })

  const toggle = (col: EngineColumnSchema) => {
    if (selectedNames.has(col.name)) {
      onChange(value.filter(v => v.name !== col.name))
    } else {
      onChange([...value, col])
    }
  }

  const remove = (name: string) => onChange(value.filter(v => v.name !== name))

  return (
    <div ref={ref} className="relative">
      {/* Label */}
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: value.length > 0 ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}
        />
        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </label>
        {value.length > 0 && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--accent-blue-subtle)', color: 'var(--accent-blue)' }}
          >
            {value.length}
          </span>
        )}
      </div>

      {/* Chip box + trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left rounded-lg transition-colors"
        style={{
          background: 'var(--bg-surface)',
          border: `1px solid ${open ? 'var(--border-focus)' : 'var(--border-default)'}`,
          boxShadow: open ? 'var(--shadow-focus)' : 'none',
          minHeight: '34px',
          padding: value.length > 0 ? '5px 8px' : '0 10px',
        }}
      >
        {value.length === 0 ? (
          <div className="flex items-center justify-between" style={{ minHeight: '24px' }}>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{placeholder}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
              style={{ color: 'var(--text-tertiary)' }}
            />
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {value.map(col => {
              const t = TYPE_META[col.type] ?? TYPE_META.text
              return (
                <span
                  key={col.name}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold"
                  style={{ background: t.bg, color: t.text }}
                  onClick={e => e.stopPropagation()}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: t.dot }} />
                  <span className="truncate max-w-[100px]" style={{ color: 'var(--text-primary)' }}>{col.name}</span>
                  <span
                    role="button"
                    onClick={e => { e.stopPropagation(); remove(col.name) }}
                    className="flex-shrink-0 cursor-pointer ml-0.5 opacity-60 hover:opacity-100"
                  >
                    <X className="h-2.5 w-2.5" />
                  </span>
                </span>
              )
            })}
            <span className="ml-auto self-center flex-shrink-0 pl-1">
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
                style={{ color: 'var(--text-tertiary)' }}
              />
            </span>
          </div>
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
              const isSelected = selectedNames.has(col.name)
              return (
                <button
                  key={col.name}
                  type="button"
                  onClick={() => toggle(col)}
                  className="w-full flex items-center px-3 py-2 text-left transition-colors"
                  style={{
                    gap: '8px',
                    background: isSelected ? 'var(--bg-row-active)' : undefined,
                    borderBottom: '1px solid var(--border-row)',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-row-hover)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '' }}
                >
                  {/* Checkbox */}
                  <span
                    className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border"
                    style={{
                      background: isSelected ? 'var(--accent-blue)' : 'var(--bg-surface)',
                      borderColor: isSelected ? 'var(--accent-blue)' : 'var(--border-default)',
                    }}
                  >
                    {isSelected && (
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  {/* Dot */}
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.dot }} />
                  {/* Variable name — dominant */}
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
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => { onChange([]); setOpen(false) }}
              className="w-full px-3 py-2 text-left text-xs transition-colors"
              style={{ color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-row)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--status-error)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              Clear all ({value.length})
            </button>
          )}
        </div>
      )}
    </div>
  )
}
