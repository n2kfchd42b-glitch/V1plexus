"use client"

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'
import type { EngineColumnSchema, VariableType } from '@/lib/decision-engine/types'
import { completenessPercent } from '@/lib/decision-engine/variableProfiler'

// Type pill colors — all values use design-system tokens
const TYPE_COLORS: Record<VariableType, { bg: string; text: string; label: string }> = {
  continuous: { bg: 'var(--accent-blue-subtle)', text: 'var(--accent-blue-hover)', label: 'Continuous' },
  binary: { bg: 'var(--status-success-bg)', text: 'var(--status-success-text)', label: 'Binary' },
  categorical: { bg: 'var(--bg-inset)', text: 'var(--phase-data)', label: 'Categorical' },
  date: { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)', label: 'Date' },
  time_to_event: { bg: 'var(--status-error-bg)', text: 'var(--status-error-hover)', label: 'Time-to-event' },
  id: { bg: 'var(--bg-inset)', text: 'var(--text-tertiary)', label: 'ID' },
  text: { bg: 'var(--bg-inset)', text: 'var(--text-tertiary)', label: 'Text' },
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

  // Close on outside click
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

  const typeInfo = value ? (TYPE_COLORS[value.type] ?? TYPE_COLORS.text) : null
  const completeness = value ? completenessPercent(value, row_count) : null

  return (
    <div ref={ref} className="relative">
      {/* Label */}
      <div className="flex items-center gap-1.5 mb-1">
        {value && (
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: typeInfo?.text ?? 'var(--accent-blue)' }}
          />
        )}
        {!value && (
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: required ? 'var(--status-error)' : 'var(--text-tertiary)' }}
          />
        )}
        <label
          className="text-xs font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          {label}
          {required && (
            <span style={{ color: 'var(--status-error)' }} className="ml-0.5">*</span>
          )}
        </label>
      </div>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors"
        style={{
          background: 'var(--bg-surface)',
          border: `1px solid ${open ? 'var(--border-focus)' : 'var(--border-default)'}`,
          boxShadow: open ? 'var(--shadow-focus)' : 'none',
          minHeight: '36px',
        }}
      >
        {value ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className="text-xs font-medium truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {value.name}
            </span>
            {typeInfo && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                style={{ background: typeInfo.bg, color: typeInfo.text }}
              >
                {typeInfo.label}
              </span>
            )}
            {completeness !== null && (
              <span
                className="text-[10px] font-mono tabular-nums flex-shrink-0"
                style={{
                  color:
                    completeness >= 90
                      ? 'var(--status-success-text)'
                      : completeness >= 75
                        ? 'var(--status-warning-text)'
                        : 'var(--status-error-text)',
                }}
              >
                {completeness}%
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {placeholder}
          </span>
        )}
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {value && (
            <span
              role="button"
              onClick={e => {
                e.stopPropagation()
                onChange(null)
                setOpen(false)
              }}
              className="h-4 w-4 flex items-center justify-center rounded hover:bg-[var(--bg-row-hover)] cursor-pointer"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-tertiary)' }}
          />
        </div>
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
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                No compatible variables
              </p>
            </div>
          ) : (
            options.map(col => {
              const t = TYPE_COLORS[col.type] ?? TYPE_COLORS.text
              const pct = completenessPercent(col, row_count)
              const isSelected = value?.name === col.name
              return (
                <button
                  key={col.name}
                  type="button"
                  onClick={() => {
                    onChange(col)
                    setOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                  style={{
                    background: isSelected ? 'var(--bg-row-active)' : undefined,
                    borderBottom: '1px solid var(--border-row)',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected)
                      e.currentTarget.style.background = 'var(--bg-row-hover)'
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.background = ''
                  }}
                >
                  {/* Variable name + type */}
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span
                      className="text-xs font-medium truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {col.name}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 uppercase tracking-wide"
                      style={{ background: t.bg, color: t.text }}
                    >
                      {t.label}
                    </span>
                  </div>
                  {/* Completion % — right-aligned, no bar */}
                  <span
                    className="text-[10px] font-mono tabular-nums flex-shrink-0"
                    style={{
                      color: pct >= 90
                        ? 'var(--status-success-text)'
                        : pct >= 75
                          ? 'var(--status-warning-text)'
                          : 'var(--status-error-text)',
                    }}
                  >
                    {pct}% complete
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
