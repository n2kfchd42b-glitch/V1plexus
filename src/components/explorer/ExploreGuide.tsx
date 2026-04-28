'use client'

import { useState, useMemo } from 'react'
import { Activity, BarChart2, Circle, TrendingUp, PieChart as PieIcon, ArrowRight, ChevronLeft } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ColumnSchema, ChartType, ChartConfig, ColumnType } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExploreGuideProps {
  columns: ColumnSchema[]
  onComplete: (chartType: ChartType, config: ChartConfig) => void
  onSkip: () => void
  /** Renders as a compact sidebar column instead of a full-page overlay */
  sidebar?: boolean
}

interface SlotDef {
  key: string
  label: string
  hint?: string
  types: ColumnType[] | 'all'
  optional?: boolean
}

interface IntentDef {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  slots: SlotDef[]
  requires?: ColumnType[]
  resolve: (columns: ColumnSchema[], vars: Record<string, string>) => { chartType: ChartType; config: ChartConfig }
}

// ─── Column type groups ───────────────────────────────────────────────────────

const NUMERIC: ColumnType[] = ['number', 'integer', 'decimal']
const CATEGORICAL: ColumnType[] = ['categorical', 'text']
const TEMPORAL: ColumnType[] = ['date', 'integer', 'number']

// ─── Intent definitions ───────────────────────────────────────────────────────

const INTENTS: IntentDef[] = [
  {
    id: 'distribution',
    icon: <Activity size={18} />,
    title: 'Explore a variable',
    description: 'See how values are spread — counts, ranges, and outliers',
    slots: [
      {
        key: 'variable',
        label: 'Which variable do you want to explore?',
        hint: 'e.g. age, viral load, outcome',
        types: 'all',
      },
    ],
    resolve: (columns, vars) => {
      const col = columns.find(c => c.name === vars.variable)
      if (col && NUMERIC.includes(col.type)) {
        return { chartType: 'histogram', config: { x_axis: vars.variable } }
      }
      return { chartType: 'bar', config: { x_axis: vars.variable, aggregation: 'count' } }
    },
  },
  {
    id: 'compare',
    icon: <BarChart2 size={18} />,
    title: 'Compare groups',
    description: 'Compare a measurement across categories, arms, or cohorts',
    requires: CATEGORICAL,
    slots: [
      {
        key: 'group',
        label: 'What are you grouping by?',
        hint: 'e.g. sex, treatment arm, study site',
        types: CATEGORICAL,
      },
      {
        key: 'measure',
        label: 'What do you want to measure?',
        hint: 'Leave blank to count occurrences',
        types: NUMERIC,
        optional: true,
      },
    ],
    resolve: (_columns, vars) => ({
      chartType: 'bar',
      config: {
        x_axis: vars.group,
        y_axis: vars.measure || undefined,
        aggregation: vars.measure ? 'mean' : 'count',
      },
    }),
  },
  {
    id: 'relationship',
    icon: <Circle size={18} />,
    title: 'Find a relationship',
    description: 'See if two numeric variables are correlated or associated',
    requires: NUMERIC,
    slots: [
      {
        key: 'x',
        label: 'First variable',
        hint: 'e.g. age, BMI',
        types: NUMERIC,
      },
      {
        key: 'y',
        label: 'Second variable',
        hint: 'e.g. CD4 count, blood pressure',
        types: NUMERIC,
      },
    ],
    resolve: (_columns, vars) => ({
      chartType: 'scatter',
      config: { x_axis: vars.x, y_axis: vars.y },
    }),
  },
  {
    id: 'trend',
    icon: <TrendingUp size={18} />,
    title: 'Track over time',
    description: 'See how a variable changes across dates or sequential time points',
    requires: ['date'],
    slots: [
      {
        key: 'time',
        label: 'Date or time variable',
        hint: 'e.g. visit_date, collection_date',
        types: TEMPORAL,
      },
      {
        key: 'value',
        label: 'What do you want to track?',
        hint: 'e.g. viral load, haemoglobin',
        types: NUMERIC,
      },
    ],
    resolve: (_columns, vars) => ({
      chartType: 'line',
      config: { x_axis: vars.time, y_axis: vars.value, aggregation: 'mean' },
    }),
  },
  {
    id: 'composition',
    icon: <PieIcon size={18} />,
    title: 'See proportions',
    description: 'Show how a whole breaks down between categories',
    requires: CATEGORICAL,
    slots: [
      {
        key: 'category',
        label: 'What categories do you want to compare?',
        hint: 'e.g. outcome, diagnosis, status',
        types: CATEGORICAL,
      },
    ],
    resolve: (_columns, vars) => ({
      chartType: 'pie',
      config: { x_axis: vars.category, aggregation: 'count' },
    }),
  },
]

// ─── Column icon ──────────────────────────────────────────────────────────────

function typeLabel(type: ColumnType): string {
  switch (type) {
    case 'number':
    case 'integer':
    case 'decimal':   return 'numeric'
    case 'categorical':
    case 'text':      return 'text'
    case 'date':      return 'date'
    case 'boolean':   return 'yes/no'
    default:          return type
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExploreGuide({ columns, onComplete, onSkip, sidebar }: ExploreGuideProps) {
  const [step, setStep] = useState<'intent' | 'variables'>('intent')
  const [selectedIntentId, setSelectedIntentId] = useState<string | null>(null)
  const [vars, setVars] = useState<Record<string, string>>({})

  // Only show intents that are feasible with this dataset's column types
  const availableIntents = useMemo(() =>
    INTENTS.filter(intent =>
      !intent.requires || columns.some(c => intent.requires!.includes(c.type))
    ),
    [columns]
  )

  const selectedIntent = INTENTS.find(i => i.id === selectedIntentId)

  const canBuild = selectedIntent
    ? selectedIntent.slots.filter(s => !s.optional).every(s => !!vars[s.key])
    : false

  function handleIntentSelect(intentId: string) {
    setSelectedIntentId(intentId)
    setVars({})
    setStep('variables')
  }

  function handleBuild() {
    if (!selectedIntent || !canBuild) return
    const { chartType, config } = selectedIntent.resolve(columns, vars)
    onComplete(chartType, config)
  }

  function getColumnsForSlot(types: ColumnType[] | 'all') {
    return types === 'all' ? columns : columns.filter(c => (types as ColumnType[]).includes(c.type))
  }

  // ── Sidebar mode ─────────────────────────────────────────────────────────

  if (sidebar) {
    if (step === 'intent') {
      return (
        <div className="flex flex-col h-full overflow-y-auto bg-[var(--bg-surface)]">
          <div className="px-3 pt-4 pb-2 flex-shrink-0">
            <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.12em] mb-3">What to explore?</p>
            <div className="space-y-1.5">
              {availableIntents.map(intent => (
                <button
                  key={intent.id}
                  onClick={() => handleIntentSelect(intent.id)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-md border transition-all duration-150 active:scale-[0.98]',
                    'bg-[var(--bg-surface)] border-[var(--border-default)]',
                    'hover:border-[var(--accent-blue)] hover:bg-[var(--accent-blue-subtle)]'
                  )}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[var(--accent-blue)] flex-shrink-0">{intent.icon}</span>
                    <span
                      className="text-xs font-semibold text-[var(--text-primary)] leading-tight"
                      style={{ fontFamily: 'var(--font-manrope)' }}
                    >
                      {intent.title}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--text-tertiary)] leading-snug pl-6">
                    {intent.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
          <div className="px-3 py-3 mt-auto flex-shrink-0">
            <button
              onClick={onSkip}
              className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] transition-colors"
            >
              Skip — build manually →
            </button>
          </div>
        </div>
      )
    }

    // Sidebar variable step
    return (
      <div className="flex flex-col h-full overflow-y-auto bg-[var(--bg-surface)]">
        <div className="px-3 pt-3 pb-2 flex-shrink-0">
          <button
            onClick={() => setStep('intent')}
            className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors mb-3"
          >
            <ChevronLeft size={11} />
            Change intent
          </button>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded flex items-center justify-center text-[var(--accent-blue)] bg-[var(--accent-blue-subtle)] flex-shrink-0">
              {selectedIntent?.icon}
            </div>
            <span
              className="text-xs font-bold text-[var(--text-primary)]"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              {selectedIntent?.title}
            </span>
          </div>

          <div className="space-y-4">
            {selectedIntent?.slots.map(slot => {
              const slotCols = getColumnsForSlot(slot.types)
              const hasColumns = slotCols.length > 0
              return (
                <div key={slot.key}>
                  <label
                    className="block text-[10px] font-semibold text-[var(--text-secondary)] mb-0.5"
                    style={{ fontFamily: 'var(--font-manrope)' }}
                  >
                    {slot.label}
                    {slot.optional && (
                      <span className="ml-1 font-normal text-[var(--text-tertiary)]">optional</span>
                    )}
                  </label>
                  {slot.hint && (
                    <p className="text-[10px] text-[var(--text-tertiary)] mb-1.5">{slot.hint}</p>
                  )}
                  {hasColumns ? (
                    <Select
                      value={vars[slot.key] ?? '__none__'}
                      onValueChange={v =>
                        setVars(prev => ({ ...prev, [slot.key]: v === '__none__' ? '' : v }))
                      }
                    >
                      <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue placeholder="Choose…" />
                      </SelectTrigger>
                      <SelectContent>
                        {slot.optional && (
                          <SelectItem value="__none__">
                            <span className="text-[var(--text-tertiary)] italic text-xs">None</span>
                          </SelectItem>
                        )}
                        {slotCols.map(col => (
                          <SelectItem key={col.name} value={col.name}>
                            <span className="flex items-center gap-1.5 text-xs">
                              <span>{col.name}</span>
                              <span className="text-[var(--text-tertiary)] text-[10px]">{typeLabel(col.type)}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-8 flex items-center px-2.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] text-[10px] text-[var(--text-tertiary)]">
                      No compatible variables
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="px-3 py-3 mt-auto flex-shrink-0 flex items-center justify-between border-t border-[var(--border-subtle)]">
          <button
            onClick={onSkip}
            className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] transition-colors"
          >
            Skip guide
          </button>
          <Button size="sm" onClick={handleBuild} disabled={!canBuild} className="gap-1 h-7 text-xs">
            Build
            <ArrowRight size={12} />
          </Button>
        </div>
      </div>
    )
  }

  // ── Step 1: intent picker ──────────────────────────────────────────────────

  if (step === 'intent') {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-0 overflow-auto py-14 px-6 bg-[var(--bg-app)]">
        <div className="w-full max-w-[640px]">
          <div className="mb-8 text-center">
            <h2
              className="text-xl font-bold text-[var(--text-primary)] tracking-tight"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              What do you want to explore?
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1.5">
              Choose a starting point — you can adjust everything afterwards.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {availableIntents.map(intent => (
              <button
                key={intent.id}
                onClick={() => handleIntentSelect(intent.id)}
                className={cn(
                  'group text-left p-4 rounded-lg border transition-all duration-150 active:scale-[0.98]',
                  'bg-[var(--bg-surface)] border-[var(--border-default)] shadow-[var(--shadow-xs)]',
                  'hover:border-[var(--accent-blue)] hover:shadow-[var(--shadow-sm)]'
                )}
              >
                <div className="w-8 h-8 rounded-md bg-[var(--accent-blue-subtle)] flex items-center justify-center text-[var(--accent-blue)] mb-3 transition-colors group-hover:bg-[var(--accent-blue)] group-hover:text-white">
                  {intent.icon}
                </div>
                <p
                  className="text-sm font-semibold text-[var(--text-primary)] leading-tight mb-1"
                  style={{ fontFamily: 'var(--font-manrope)' }}
                >
                  {intent.title}
                </p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {intent.description}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-7 text-center">
            <button
              onClick={onSkip}
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] transition-colors"
            >
              Skip — build manually →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 2: variable picker ────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-0 overflow-auto py-14 px-6 bg-[var(--bg-app)]">
      <div className="w-full max-w-sm">
        {/* Back */}
        <button
          onClick={() => setStep('intent')}
          className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors mb-7"
        >
          <ChevronLeft size={13} />
          Change intent
        </button>

        {/* Heading */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-md bg-[var(--accent-blue-subtle)] flex items-center justify-center text-[var(--accent-blue)] flex-shrink-0">
            {selectedIntent?.icon}
          </div>
          <h2
            className="text-base font-bold text-[var(--text-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-manrope)' }}
          >
            {selectedIntent?.title}
          </h2>
        </div>

        {/* Variable slots */}
        <div className="space-y-5">
          {selectedIntent?.slots.map(slot => {
            const slotCols = getColumnsForSlot(slot.types)
            const hasColumns = slotCols.length > 0

            return (
              <div key={slot.key}>
                <label
                  className="block text-sm font-medium text-[var(--text-primary)] mb-0.5"
                  style={{ fontFamily: 'var(--font-manrope)' }}
                >
                  {slot.label}
                  {slot.optional && (
                    <span className="ml-1.5 text-xs font-normal text-[var(--text-tertiary)]">optional</span>
                  )}
                </label>
                {slot.hint && (
                  <p className="text-xs text-[var(--text-tertiary)] mb-2">{slot.hint}</p>
                )}
                {hasColumns ? (
                  <Select
                    value={vars[slot.key] ?? '__none__'}
                    onValueChange={v =>
                      setVars(prev => ({ ...prev, [slot.key]: v === '__none__' ? '' : v }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a variable…" />
                    </SelectTrigger>
                    <SelectContent>
                      {slot.optional && (
                        <SelectItem value="__none__">
                          <span className="text-[var(--text-tertiary)] italic">None</span>
                        </SelectItem>
                      )}
                      {slotCols.map(col => (
                        <SelectItem key={col.name} value={col.name}>
                          <span className="flex items-center gap-2">
                            <span>{col.name}</span>
                            <span className="text-[var(--text-tertiary)] text-xs">
                              {typeLabel(col.type)}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="h-9 flex items-center px-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] text-xs text-[var(--text-tertiary)]">
                    No compatible variables in this dataset
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-xs text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] transition-colors"
          >
            Skip guide
          </button>
          <Button onClick={handleBuild} disabled={!canBuild} className="gap-1.5">
            Build chart
            <ArrowRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  )
}
