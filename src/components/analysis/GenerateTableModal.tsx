'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Table2, ToggleLeft, ToggleRight, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  parseDescriptiveResult,
  generateFootnote,
  formatContValue,
  type ContVar,
  type CatVar,
  type FormatOption,
  type GeneratedTableSpec,
} from '@/lib/tableGeneratorUtils'
import type { AnalysisResult } from '@/lib/analysis/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  result: AnalysisResult
  projectId: string
  runTitle?: string
  onClose: () => void
}

// ─── Journal table preview ────────────────────────────────────────────────────

function JournalTablePreview({
  spec,
  selectedCont,
  selectedCat,
}: {
  spec: { title: string; totalN: number; footnote: string; format: FormatOption }
  selectedCont: ContVar[]
  selectedCat: CatVar[]
}) {
  const hasCont = selectedCont.length > 0
  const hasCat = selectedCat.length > 0
  if (!hasCont && !hasCat) {
    return (
      <div className="flex items-center justify-center h-full py-12 text-[#A1A1AA] text-sm">
        Select at least one variable to preview the table.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
        {/* Top rule */}
        <thead>
          <tr style={{ borderTop: '2px solid #18181B' }}>
            <th
              className="text-left py-2 pr-4 font-bold text-[#18181B]"
              style={{ fontFamily: 'var(--font-manrope)', fontSize: '0.75rem', borderBottom: '1px solid #18181B' }}
            >
              Characteristic
            </th>
            <th
              className="text-right py-2 pl-4 font-bold text-[#18181B]"
              style={{ fontFamily: 'var(--font-manrope)', fontSize: '0.75rem', borderBottom: '1px solid #18181B', whiteSpace: 'nowrap' }}
            >
              Overall (N={spec.totalN.toLocaleString()})
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Continuous group */}
          {hasCont && (
            <>
              <tr style={{ backgroundColor: 'rgba(241,245,249,0.5)' }}>
                <td
                  colSpan={2}
                  className="py-1.5 px-0 text-[#52525B] uppercase tracking-wide"
                  style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'var(--font-manrope)' }}
                >
                  Continuous Variables
                </td>
              </tr>
              {selectedCont.map(v => (
                <tr key={v.name} style={{ borderBottom: '1px solid rgba(228,228,231,0.6)' }}>
                  <td className="py-1.5 pl-4 text-[#18181B]" style={{ fontSize: '0.8125rem' }}>
                    {v.name}
                    <span className="ml-2 text-[#A1A1AA]" style={{ fontSize: '0.65rem' }}>
                      {spec.format === 'mean_sd' ? 'mean (SD)' : 'median [IQR]'}
                    </span>
                  </td>
                  <td
                    className="py-1.5 pl-4 text-right text-[#18181B]"
                    style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '0.8125rem' }}
                  >
                    {formatContValue(v, spec.format)}
                  </td>
                </tr>
              ))}
            </>
          )}

          {/* Categorical group */}
          {hasCat && (
            <>
              <tr style={{ backgroundColor: 'rgba(241,245,249,0.5)' }}>
                <td
                  colSpan={2}
                  className="py-1.5 px-0 text-[#52525B] uppercase tracking-wide"
                  style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'var(--font-manrope)' }}
                >
                  Categorical Variables
                </td>
              </tr>
              {selectedCat.map(v => (
                <>
                  <tr key={v.name} style={{ backgroundColor: 'rgba(241,245,249,0.3)' }}>
                    <td
                      colSpan={2}
                      className="py-1 pl-0 text-[#18181B] font-medium"
                      style={{ fontSize: '0.8125rem' }}
                    >
                      {v.name}
                      <span className="ml-2 text-[#A1A1AA]" style={{ fontSize: '0.65rem' }}>
                        n (%)
                      </span>
                    </td>
                  </tr>
                  {v.categories.length > 0 ? (
                    v.categories.map(cat => (
                      <tr key={cat.label} style={{ borderBottom: '1px solid rgba(228,228,231,0.6)' }}>
                        <td className="py-1.5 pl-8 text-[#52525B]" style={{ fontSize: '0.8125rem' }}>
                          {cat.label}
                        </td>
                        <td
                          className="py-1.5 pl-4 text-right text-[#18181B]"
                          style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '0.8125rem' }}
                        >
                          {cat.count} ({cat.pct}%)
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr style={{ borderBottom: '1px solid rgba(228,228,231,0.6)' }}>
                      <td colSpan={2} className="py-1.5 pl-8 text-[#A1A1AA]" style={{ fontSize: '0.8125rem' }}>
                        Category data unavailable
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </>
          )}
        </tbody>
        {/* Footnote */}
        {spec.footnote && (
          <tfoot>
            <tr style={{ borderTop: '1px solid #18181B' }}>
              <td
                colSpan={2}
                className="pt-2 text-[#52525B] italic"
                style={{ fontSize: '0.6875rem' }}
              >
                {spec.footnote}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

// ─── Variable checkbox row ────────────────────────────────────────────────────

function VarCheckbox({
  name,
  badge,
  checked,
  onChange,
}: {
  name: string
  badge: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2.5 py-2 px-3 rounded-lg cursor-pointer hover:bg-[#f7f9fb] transition-colors group">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded border-[#c3c6d6] accent-[#0052cc] cursor-pointer"
      />
      <span className="text-sm text-[#18181B] flex-1 truncate font-medium">{name}</span>
      <span
        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(0,64,162,0.08)', color: '#0040a2', letterSpacing: '0.04em' }}
      >
        {badge}
      </span>
    </label>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function GenerateTableModal({ result, projectId, runTitle, onClose }: Props) {
  const supabase = createClient()

  // Parsed variable data
  const [continuous, setContinuous] = useState<ContVar[]>([])
  const [categorical, setCategorical] = useState<CatVar[]>([])
  const [totalN, setTotalN] = useState(0)

  // Configuration state
  const [tableName, setTableName] = useState('Table 1. Baseline Characteristics')
  const [format, setFormat] = useState<FormatOption>('mean_sd')
  const [includeFootnote, setIncludeFootnote] = useState(true)
  const [selectedCont, setSelectedCont] = useState<Set<string>>(new Set())
  const [selectedCat, setSelectedCat] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // Parse result on mount
  useEffect(() => {
    const parsed = parseDescriptiveResult(result)
    setContinuous(parsed.continuous)
    setCategorical(parsed.categorical)
    setTotalN(parsed.totalN)
    // Select all by default
    setSelectedCont(new Set(parsed.continuous.map(v => v.name)))
    setSelectedCat(new Set(parsed.categorical.map(v => v.name)))
  }, [result])

  // Build preview spec
  const selContVars = continuous.filter(v => selectedCont.has(v.name))
  const selCatVars = categorical.filter(v => selectedCat.has(v.name))
  const footnote = includeFootnote
    ? generateFootnote(selContVars.length > 0, format, selCatVars.length > 0)
    : ''

  const previewSpec = { title: tableName, totalN, footnote, format }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleToggleCont = useCallback((name: string, checked: boolean) => {
    setSelectedCont(prev => {
      const next = new Set(prev)
      if (checked) { next.add(name) } else { next.delete(name) }
      return next
    })
  }, [])

  const handleToggleCat = useCallback((name: string, checked: boolean) => {
    setSelectedCat(prev => {
      const next = new Set(prev)
      if (checked) { next.add(name) } else { next.delete(name) }
      return next
    })
  }, [])

  async function handleSave() {
    if (selContVars.length === 0 && selCatVars.length === 0) {
      toast.error('Select at least one variable before saving.')
      return
    }

    setSaving(true)
    try {
      const tableSpec: GeneratedTableSpec = {
        title: tableName,
        totalN,
        footnote,
        variables: [...selContVars, ...selCatVars],
        format,
      }

      // TipTap document JSON wrapping the TableBlockNode
      const docContent = {
        type: 'doc',
        content: [
          {
            type: 'tableBlock',
            attrs: { tableSpec: JSON.stringify(tableSpec) },
          },
        ],
      }

      const { error } = await supabase.from('documents').insert({
        project_id: projectId,
        title: tableName,
        content: docContent,
        status: 'draft',
        word_count: 0,
        current_version: 1,
      })

      if (error) throw error

      toast.success('Table saved to Documents', {
        description: `"${tableName}" is ready in your Documents hub.`,
      })
      onClose()
    } catch (err) {
      toast.error('Failed to save table', {
        description: err instanceof Error ? err.message : 'An unexpected error occurred.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,15,30,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Modal */}
      <div
        className="relative w-full max-w-4xl rounded-2xl bg-white overflow-hidden flex flex-col"
        style={{
          maxHeight: '90vh',
          boxShadow: '0 32px 80px rgba(0,24,72,0.18), 0 8px 24px rgba(0,24,72,0.10)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-7 py-5 border-b border-[#f2f4f6]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Table2 className="h-4 w-4 text-[#0052cc]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope">
                Table Generator
              </span>
            </div>
            <h2 className="font-manrope font-extrabold text-xl text-[#18181B]">Generate Table</h2>
            {runTitle && (
              <p className="text-sm text-[#A1A1AA] mt-0.5">{runTitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#A1A1AA] hover:text-[#18181B] hover:bg-[#f2f4f6] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 divide-x divide-[#f2f4f6]">

            {/* ── Left panel: Config + Variables ───────────────────────── */}
            <div className="flex flex-col divide-y divide-[#f2f4f6]">

              {/* Section A — Table Configuration */}
              <div className="px-6 py-5 space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope">
                  Table Configuration
                </p>

                {/* Table name */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#52525B] mb-1.5 uppercase tracking-wide">
                    Table Name
                  </label>
                  <input
                    value={tableName}
                    onChange={e => setTableName(e.target.value)}
                    placeholder="e.g. Table 1. Baseline Characteristics"
                    className="w-full rounded-lg px-3 py-2 text-sm text-[#18181B] bg-[#f7f9fb] border border-[rgba(195,198,214,0.3)] outline-none focus:border-[rgba(0,82,204,0.4)] focus:shadow-[0_0_0_3px_rgba(0,82,204,0.08)] transition-all"
                  />
                </div>

                {/* Format radio cards */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#52525B] mb-2 uppercase tracking-wide">
                    Continuous Format
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'mean_sd', label: 'Mean (SD)', hint: '45.2 (12.3)' },
                      { value: 'median_iqr', label: 'Median [IQR]', hint: '44.0 [35–55]' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setFormat(opt.value)}
                        className="text-left rounded-xl p-3 border transition-all"
                        style={{
                          borderColor: format === opt.value ? 'rgba(0,82,204,0.4)' : 'rgba(195,198,214,0.3)',
                          background: format === opt.value ? 'rgba(0,64,162,0.04)' : '#f7f9fb',
                          boxShadow: format === opt.value ? '0 0 0 3px rgba(0,82,204,0.08)' : 'none',
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="w-3 h-3 rounded-full border-2 flex items-center justify-center"
                            style={{
                              borderColor: format === opt.value ? '#0052cc' : '#c3c6d6',
                            }}
                          >
                            {format === opt.value && (
                              <div className="w-1.5 h-1.5 rounded-full bg-[#0052cc]" />
                            )}
                          </div>
                          <span className="text-xs font-bold text-[#18181B]">{opt.label}</span>
                        </div>
                        <span
                          className="text-[10px] text-[#A1A1AA]"
                          style={{ fontFamily: 'var(--font-geist-mono)' }}
                        >
                          {opt.hint}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footnote toggle */}
                <button
                  onClick={() => setIncludeFootnote(v => !v)}
                  className="flex items-center justify-between w-full rounded-xl p-3 border border-[rgba(195,198,214,0.3)] bg-[#f7f9fb] hover:bg-[#f2f4f6] transition-colors"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#18181B] text-left">Include footnote</p>
                    <p className="text-[10px] text-[#A1A1AA] text-left mt-0.5">
                      Adds abbreviation key below the table
                    </p>
                  </div>
                  {includeFootnote
                    ? <ToggleRight className="h-5 w-5 text-[#0052cc] shrink-0" />
                    : <ToggleLeft className="h-5 w-5 text-[#A1A1AA] shrink-0" />}
                </button>
              </div>

              {/* Section B — Variable Selection */}
              <div className="px-6 py-5 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope mb-4">
                  Variable Selection
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {/* Continuous column */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-[#52525B] uppercase tracking-wide">
                        Continuous
                      </p>
                      {continuous.length > 0 && (
                        <button
                          onClick={() => {
                            const allSel = continuous.every(v => selectedCont.has(v.name))
                            setSelectedCont(allSel ? new Set() : new Set(continuous.map(v => v.name)))
                          }}
                          className="text-[10px] font-bold text-[#0052cc] hover:text-[#003d9b] transition-colors"
                        >
                          {continuous.every(v => selectedCont.has(v.name)) ? 'Deselect all' : 'Select all'}
                        </button>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {continuous.length === 0 ? (
                        <p className="text-xs text-[#A1A1AA] px-3 py-2">No continuous variables</p>
                      ) : (
                        continuous.map(v => (
                          <VarCheckbox
                            key={v.name}
                            name={v.name}
                            badge={format === 'mean_sd' ? 'Mean (SD)' : 'Med [IQR]'}
                            checked={selectedCont.has(v.name)}
                            onChange={checked => handleToggleCont(v.name, checked)}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* Categorical column */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-[#52525B] uppercase tracking-wide">
                        Categorical
                      </p>
                      {categorical.length > 0 && (
                        <button
                          onClick={() => {
                            const allSel = categorical.every(v => selectedCat.has(v.name))
                            setSelectedCat(allSel ? new Set() : new Set(categorical.map(v => v.name)))
                          }}
                          className="text-[10px] font-bold text-[#0052cc] hover:text-[#003d9b] transition-colors"
                        >
                          {categorical.every(v => selectedCat.has(v.name)) ? 'Deselect all' : 'Select all'}
                        </button>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {categorical.length === 0 ? (
                        <p className="text-xs text-[#A1A1AA] px-3 py-2">No categorical variables</p>
                      ) : (
                        categorical.map(v => (
                          <VarCheckbox
                            key={v.name}
                            name={v.name}
                            badge="n (%)"
                            checked={selectedCat.has(v.name)}
                            onChange={checked => handleToggleCat(v.name, checked)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right panel: Live Preview ─────────────────────────────── */}
            <div className="px-6 py-5 flex flex-col min-h-[420px]">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope mb-4">
                Live Table Preview
              </p>
              <div className="flex-1 bg-[#f7f9fb] rounded-xl p-5 overflow-auto border border-[rgba(195,198,214,0.2)]">
                {tableName && (
                  <p className="text-xs font-bold text-[#18181B] mb-3 font-manrope">{tableName}</p>
                )}
                <JournalTablePreview
                  spec={previewSpec}
                  selectedCont={selContVars}
                  selectedCat={selCatVars}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-7 py-4 border-t border-[#f2f4f6]"
          style={{ background: '#fafbfc' }}
        >
          <button
            onClick={onClose}
            className="text-sm font-medium text-[#52525B] hover:text-[#18181B] transition-colors px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (selContVars.length === 0 && selCatVars.length === 0)}
            className="flex items-center gap-2 px-5 py-2 text-white rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
            style={{ background: 'linear-gradient(135deg, #003d9b 0%, #0052cc 100%)' }}
          >
            {saving ? 'Saving…' : 'Save to Documents'}
            {!saving && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
