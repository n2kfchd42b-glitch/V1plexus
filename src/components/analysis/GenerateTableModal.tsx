'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X, Table2, ToggleLeft, ToggleRight, ChevronRight,
  FilePlus, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getProjectDocuments, createDocument } from '@/lib/data'
import { useAuth } from '@/hooks/useAuth'
import { logAudit } from '@/lib/audit'
import {
  parseDescriptiveResult,
  parseRegressionResult,
  parseSurvivalResult,
  getTableTemplate,
  generateFootnote,
  formatContValue,
  getNextTableNumber,
  insertTableIntoDocument,
  specToTipTapNodes,
  REGRESSION_TYPES,
  type ContVar,
  type CatVar,
  type FormatOption,
  type Table1Spec,
  type Table2Spec,
  type Table3Spec,
  type RegressionRow,
  type SurvivalSummaryRow,
} from '@/lib/tableGeneratorUtils'
import type { AnalysisResult } from '@/lib/analysis/types'
import type { AnalysisType } from '@/types/database'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  result: AnalysisResult
  projectId: string
  runTitle?: string
  onClose: () => void
}

// ─── Table 1 preview ──────────────────────────────────────────────────────────

function Table1Preview({
  totalN,
  format,
  footnote,
  contVars,
  catVars,
}: {
  totalN: number
  format: FormatOption
  footnote: string
  contVars: ContVar[]
  catVars: CatVar[]
}) {
  if (contVars.length === 0 && catVars.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-[#A1A1AA] text-sm">
        Select at least one variable to preview.
      </div>
    )
  }
  return (
    <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderTop: '2px solid #18181B' }}>
          <th className="text-left py-2 pr-4 font-bold text-[#18181B]"
            style={{ fontFamily: 'var(--font-manrope)', fontSize: '0.75rem', borderBottom: '1px solid #18181B' }}>
            Characteristic
          </th>
          <th className="text-right py-2 pl-4 font-bold text-[#18181B]"
            style={{ fontFamily: 'var(--font-manrope)', fontSize: '0.75rem', borderBottom: '1px solid #18181B', whiteSpace: 'nowrap' }}>
            Overall (N={totalN.toLocaleString()})
          </th>
        </tr>
      </thead>
      <tbody>
        {contVars.length > 0 && (
          <>
            <tr style={{ backgroundColor: 'rgba(241,245,249,0.5)' }}>
              <td colSpan={2} className="py-1.5 text-[#52525B]"
                style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-manrope)' }}>
                Continuous Variables
              </td>
            </tr>
            {contVars.map(v => (
              <tr key={v.name} style={{ borderBottom: '1px solid rgba(228,228,231,0.6)' }}>
                <td className="py-1.5 pl-3 text-[#18181B]" style={{ fontSize: '0.8125rem' }}>{v.name}</td>
                <td className="py-1.5 text-right text-[#18181B]"
                  style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '0.8125rem' }}>
                  {formatContValue(v, format)}
                </td>
              </tr>
            ))}
          </>
        )}
        {catVars.length > 0 && (
          <>
            <tr style={{ backgroundColor: 'rgba(241,245,249,0.5)' }}>
              <td colSpan={2} className="py-1.5 text-[#52525B]"
                style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-manrope)' }}>
                Categorical Variables
              </td>
            </tr>
            {catVars.map(v => (
              <>
                <tr key={v.name} style={{ backgroundColor: 'rgba(241,245,249,0.3)' }}>
                  <td colSpan={2} className="py-1 font-medium text-[#18181B]" style={{ fontSize: '0.8125rem' }}>{v.name}</td>
                </tr>
                {v.categories.map(cat => (
                  <tr key={cat.label} style={{ borderBottom: '1px solid rgba(228,228,231,0.6)' }}>
                    <td className="py-1 pl-6 text-[#52525B]" style={{ fontSize: '0.8125rem' }}>{cat.label}</td>
                    <td className="py-1 text-right text-[#18181B]"
                      style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '0.8125rem' }}>
                      {cat.count} ({cat.pct}%)
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </>
        )}
      </tbody>
      {footnote && (
        <tfoot>
          <tr style={{ borderTop: '1px solid #18181B' }}>
            <td colSpan={2} className="pt-2 text-[#52525B] italic" style={{ fontSize: '0.6875rem' }}>{footnote}</td>
          </tr>
        </tfoot>
      )}
    </table>
  )
}

// ─── Table 2 preview ──────────────────────────────────────────────────────────

function Table2Preview({
  rows, effectLabel, showCrude, showAdj, footnote,
}: {
  rows: RegressionRow[]
  effectLabel: string
  showCrude: boolean
  showAdj: boolean
  footnote: string
}) {
  if (rows.length === 0) {
    return <div className="py-8 text-center text-sm text-[#A1A1AA]">No regression rows found.</div>
  }
  const visRows = rows.filter(r => r.variable)
  const colCount = 1 + (showCrude ? 2 : 0) + (showAdj ? 2 : 0) + 1
  const thStyle: React.CSSProperties = {
    padding: '6px 8px 6px 0', fontWeight: 700, borderBottom: '1px solid #18181B',
    fontFamily: 'var(--font-manrope)', fontSize: '0.7rem', textTransform: 'uppercase',
    letterSpacing: '0.06em', whiteSpace: 'nowrap', color: '#18181B',
  }
  const tdStyle: React.CSSProperties = {
    padding: '5px 8px 5px 0', fontSize: '0.775rem',
    borderBottom: '1px solid rgba(228,228,231,0.6)', color: '#18181B',
  }
  const mono: React.CSSProperties = { fontFamily: 'var(--font-geist-mono)', textAlign: 'right' }
  return (
    <table className="w-full" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderTop: '2px solid #18181B' }}>
          <th style={{ ...thStyle, textAlign: 'left' }}>Variable</th>
          {showCrude && <>
            <th style={{ ...thStyle, textAlign: 'right' }}>Crude {effectLabel} (95% CI)</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>p</th>
          </>}
          {showAdj && <>
            <th style={{ ...thStyle, textAlign: 'right' }}>Adj. {effectLabel} (95% CI)</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>p</th>
          </>}
          <th style={{ ...thStyle, textAlign: 'right' }}>Sig.</th>
        </tr>
      </thead>
      <tbody>
        {visRows.map((row, i) => (
          <tr key={i}>
            <td style={{ ...tdStyle }}>{row.variable}</td>
            {showCrude && <>
              <td style={{ ...tdStyle, ...mono }}>{row.crude ?? '—'}</td>
              <td style={{ ...tdStyle, ...mono, color: '#52525B', fontSize: '0.7rem' }}>{row.crude_p ?? '—'}</td>
            </>}
            {showAdj && <>
              <td style={{ ...tdStyle, ...mono }}>{row.adj ?? '—'}</td>
              <td style={{ ...tdStyle, ...mono, color: '#52525B', fontSize: '0.7rem' }}>{row.adj_p ?? '—'}</td>
            </>}
            <td style={{ ...tdStyle, ...mono, fontWeight: 700, color: '#003d9b' }}>{row.sig}</td>
          </tr>
        ))}
      </tbody>
      {footnote && (
        <tfoot>
          <tr style={{ borderTop: '1px solid #18181B' }}>
            <td colSpan={colCount} className="pt-2 italic text-[#52525B]" style={{ fontSize: '0.6875rem' }}>{footnote}</td>
          </tr>
        </tfoot>
      )}
    </table>
  )
}

// ─── Table 3 preview ──────────────────────────────────────────────────────────

function Table3Preview({
  rows, timeUnit, eventLabel, footnote,
}: {
  rows: SurvivalSummaryRow[]
  timeUnit: string
  eventLabel: string
  footnote: string
}) {
  if (rows.length === 0) {
    return <div className="py-8 text-center text-sm text-[#A1A1AA]">No survival summary found.</div>
  }
  const hasGroup = rows.some(r => r.group)
  const colCount = hasGroup ? 6 : 5
  const thStyle: React.CSSProperties = {
    padding: '6px 8px 6px 0', fontWeight: 700, borderBottom: '1px solid #18181B',
    fontFamily: 'var(--font-manrope)', fontSize: '0.7rem', textTransform: 'uppercase',
    letterSpacing: '0.06em', whiteSpace: 'nowrap', color: '#18181B', textAlign: 'right',
  }
  const tdStyle: React.CSSProperties = {
    padding: '5px 8px 5px 0', fontSize: '0.775rem',
    borderBottom: '1px solid rgba(228,228,231,0.6)', color: '#18181B',
    fontFamily: 'var(--font-geist-mono)', textAlign: 'right',
  }
  return (
    <table className="w-full" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderTop: '2px solid #18181B' }}>
          {hasGroup && <th style={{ ...thStyle, textAlign: 'left' }}>Group</th>}
          <th style={thStyle}>N</th>
          <th style={thStyle}>{eventLabel}</th>
          <th style={thStyle}>Event %</th>
          <th style={thStyle}>Median ({timeUnit})</th>
          <th style={thStyle}>95% CI</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {hasGroup && <td style={{ ...tdStyle, textAlign: 'left', fontFamily: 'var(--font-manrope)' }}>{row.group ?? '—'}</td>}
            <td style={tdStyle}>{row.n.toLocaleString()}</td>
            <td style={tdStyle}>{row.events.toLocaleString()}</td>
            <td style={tdStyle}>{row.eventPct}</td>
            <td style={tdStyle}>{row.medianSurvival}</td>
            <td style={tdStyle}>{row.ci}</td>
          </tr>
        ))}
      </tbody>
      {footnote && (
        <tfoot>
          <tr style={{ borderTop: '1px solid #18181B' }}>
            <td colSpan={colCount} className="pt-2 italic text-[#52525B]" style={{ fontSize: '0.6875rem' }}>{footnote}</td>
          </tr>
        </tfoot>
      )}
    </table>
  )
}

// ─── Variable checkbox ────────────────────────────────────────────────────────

function VarCheckbox({
  name, badge, checked, onChange,
}: {
  name: string; badge: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2.5 py-2 px-3 rounded-lg cursor-pointer hover:bg-[#f7f9fb] transition-colors">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded border-[#c3c6d6] accent-[#0052cc] cursor-pointer" />
      <span className="text-sm text-[#18181B] flex-1 truncate font-medium">{name}</span>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(0,64,162,0.08)', color: '#0040a2' }}>
        {badge}
      </span>
    </label>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function GenerateTableModal({ result, projectId, runTitle, onClose }: Props) {
  const supabase = createClient()
  const { user } = useAuth()
  const analysisType = result.type as AnalysisType
  const template = getTableTemplate(analysisType)

  // ── Table 1 state ────────────────────────────────────────────────────────────
  const [continuous, setContinuous]   = useState<ContVar[]>([])
  const [categorical, setCategorical] = useState<CatVar[]>([])
  const [totalN, setTotalN]           = useState(0)
  const [selectedCont, setSelectedCont] = useState<Set<string>>(new Set())
  const [selectedCat, setSelectedCat]   = useState<Set<string>>(new Set())
  const [format, setFormat]           = useState<FormatOption>('mean_sd')

  // ── Table 2 state ────────────────────────────────────────────────────────────
  const [regressionRows, setRegressionRows]   = useState<RegressionRow[]>([])
  const [effectLabel, setEffectLabel]         = useState('OR')
  const [hasCrude, setHasCrude]               = useState(false)
  const [showCrude, setShowCrude]             = useState(true)
  const [showAdj, setShowAdj]                 = useState(true)

  // ── Table 3 state ────────────────────────────────────────────────────────────
  const [survivalRows, setSurvivalRows]       = useState<SurvivalSummaryRow[]>([])
  const [timeUnit, setTimeUnit]               = useState('months')
  const [eventLabel, setEventLabel]           = useState('Events')

  // ── Shared state ─────────────────────────────────────────────────────────────
  const [tableName, setTableName]         = useState('')
  const [includeFootnote, setIncludeFootnote] = useState(true)
  const [saveMode, setSaveMode]           = useState<'new' | 'insert'>('new')
  const [documents, setDocuments]         = useState<{ id: string; title: string }[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string>('')
  const [saving, setSaving]               = useState(false)

  // ── Initialise on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    // Auto-number the table name
    getNextTableNumber(projectId, supabase).then(n => {
      if (template === 'table1') setTableName(`Table ${n}. Baseline Characteristics`)
      else if (template === 'table2') setTableName(`Table ${n}. Regression Results`)
      else if (template === 'table3') setTableName(`Table ${n}. Survival Analysis Summary`)
      else setTableName(`Table ${n}. Analysis Results`)
    })

    if (template === 'table1') {
      const parsed = parseDescriptiveResult(result)
      setContinuous(parsed.continuous)
      setCategorical(parsed.categorical)
      setTotalN(parsed.totalN)
      setSelectedCont(new Set(parsed.continuous.map(v => v.name)))
      setSelectedCat(new Set(parsed.categorical.map(v => v.name)))
    } else if (template === 'table2') {
      const parsed = parseRegressionResult(result)
      setRegressionRows(parsed.rows)
      setEffectLabel(parsed.effectLabel)
      setHasCrude(parsed.hasCrude)
      setShowCrude(parsed.hasCrude)
      setShowAdj(parsed.hasAdjusted || !parsed.hasCrude)
    } else if (template === 'table3') {
      const parsed = parseSurvivalResult(result)
      setSurvivalRows(parsed.rows)
      setTimeUnit(parsed.timeUnit)
      setEventLabel(parsed.eventLabel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, template, projectId])

  // Fetch documents when insert mode selected
  useEffect(() => {
    if (saveMode !== 'insert' || documents.length > 0) return
    getProjectDocuments(supabase, projectId)
      .then(result => {
        if (result.data.length > 0) {
          const data = result.data
          setDocuments(data as { id: string; title: string }[])
          if (data.length > 0) setSelectedDocId(data[0].id)
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveMode])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleToggleCont = useCallback((name: string, checked: boolean) => {
    setSelectedCont(prev => { const n = new Set(prev); if (checked) { n.add(name) } else { n.delete(name) }; return n })
  }, [])

  const handleToggleCat = useCallback((name: string, checked: boolean) => {
    setSelectedCat(prev => { const n = new Set(prev); if (checked) { n.add(name) } else { n.delete(name) }; return n })
  }, [])

  // ── Build the spec to save ───────────────────────────────────────────────────
  function buildSpec(): Table1Spec | Table2Spec | Table3Spec {
    const selContVars = continuous.filter(v => selectedCont.has(v.name))
    const selCatVars  = categorical.filter(v => selectedCat.has(v.name))
    const footnote1 = includeFootnote
      ? generateFootnote(selContVars.length > 0, format, selCatVars.length > 0) : ''

    if (template === 'table2') {
      return {
        specType: 'table2',
        title: tableName,
        effectLabel,
        footnote: includeFootnote ? `Results shown as ${effectLabel} (95% CI). Significance: * p<0.05, ** p<0.01, *** p<0.001` : '',
        rows: regressionRows,
        showCrude,
        showAdjusted: showAdj,
      } satisfies Table2Spec
    }
    if (template === 'table3') {
      return {
        specType: 'table3',
        title: tableName,
        footnote: includeFootnote ? `Median survival time in ${timeUnit}. NR = Not Reached.` : '',
        rows: survivalRows,
        timeUnit,
        eventLabel,
      } satisfies Table3Spec
    }
    // Table 1
    const t1Spec: Table1Spec = {
      specType: 'table1',
      title: tableName,
      totalN,
      footnote: footnote1,
      variables: [...selContVars, ...selCatVars],
      format,
    }
    return t1Spec
  }

  function canSave(): boolean {
    if (template === 'table1') {
      const sel = [...continuous.filter(v => selectedCont.has(v.name)),
                   ...categorical.filter(v => selectedCat.has(v.name))]
      return sel.length > 0
    }
    if (template === 'table2') return regressionRows.length > 0
    if (template === 'table3') return survivalRows.length > 0
    return false
  }

  async function handleSave() {
    if (!canSave()) { toast.error('Nothing to save — check your selections.'); return }
    if (saveMode === 'insert' && !selectedDocId) {
      toast.error('Select a document to insert into.'); return
    }

    setSaving(true)
    try {
      const spec = buildSpec()

      if (saveMode === 'insert') {
        await insertTableIntoDocument(selectedDocId, spec, supabase)
        toast.success('Table inserted', { description: `"${tableName}" added to the selected document.` })
      } else {
        const docContent = {
          type: 'doc',
          content: specToTipTapNodes(spec),
        }
        const docResult = await createDocument(supabase, {
          project_id: projectId,
          title: tableName,
          content: docContent,
          status: 'draft',
          word_count: 0,
          current_version: 1,
        })
        if (docResult.status === 'error') throw new Error(docResult.error ?? 'Failed to create document')
        const newDoc = docResult.data
        if (newDoc && user) {
          logAudit('document.created', 'document', newDoc.id, { title: tableName, type: 'table' }, projectId)
        }
        toast.success('Table saved to Documents', { description: `"${tableName}" is ready in your Documents hub.` })
      }
      onClose()
    } catch (err) {
      toast.error('Failed to save table', {
        description: err instanceof Error ? err.message : 'An unexpected error occurred.',
      })
    } finally {
      setSaving(false)
    }
  }

  // ── Derived preview data ─────────────────────────────────────────────────────
  const selContVars = continuous.filter(v => selectedCont.has(v.name))
  const selCatVars  = categorical.filter(v => selectedCat.has(v.name))
  const t1Footnote  = includeFootnote
    ? generateFootnote(selContVars.length > 0, format, selCatVars.length > 0) : ''
  const t2Footnote  = includeFootnote
    ? `Results shown as ${effectLabel} (95% CI). Significance: * p<0.05, ** p<0.01, *** p<0.001` : ''
  const t3Footnote  = includeFootnote
    ? `Median survival time in ${timeUnit}. NR = Not Reached.` : ''

  // ── Render ───────────────────────────────────────────────────────────────────

  const typeLabel = template === 'table1' ? 'Table 1 — Baseline Characteristics'
    : template === 'table2' ? `Table 2 — ${REGRESSION_TYPES.has(analysisType) ? 'Regression Results' : 'Analysis Results'}`
    : template === 'table3' ? 'Table 3 — Survival Summary'
    : 'Generate Table'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,15,30,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-4xl rounded-2xl bg-white overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh', boxShadow: '0 32px 80px rgba(0,24,72,0.18), 0 8px 24px rgba(0,24,72,0.10)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-7 py-5 border-b border-[#f2f4f6]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Table2 className="h-4 w-4 text-[#0052cc]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope">
                {typeLabel}
              </span>
            </div>
            <h2 className="font-manrope font-extrabold text-xl text-[#18181B]">Generate Table</h2>
            {runTitle && <p className="text-sm text-[#A1A1AA] mt-0.5">{runTitle}</p>}
          </div>
          <button onClick={onClose}
            className="rounded-lg p-1.5 text-[#A1A1AA] hover:text-[#18181B] hover:bg-[#f2f4f6] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 divide-x divide-[#f2f4f6]">

            {/* ── Left: Config ──────────────────────────────────────────── */}
            <div className="flex flex-col divide-y divide-[#f2f4f6]">

              {/* Table configuration */}
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
                    className="w-full rounded-lg px-3 py-2 text-sm text-[#18181B] bg-[#f7f9fb] border border-[rgba(195,198,214,0.3)] outline-none focus:border-[rgba(0,82,204,0.4)] focus:shadow-[0_0_0_3px_rgba(0,82,204,0.08)] transition-all"
                  />
                </div>

                {/* Table 1: format + footnote */}
                {template === 'table1' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#52525B] mb-2 uppercase tracking-wide">
                        Continuous Format
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { value: 'mean_sd', label: 'Mean (SD)', hint: '45.2 (12.3)' },
                          { value: 'median_iqr', label: 'Median [IQR]', hint: '44.0 [35–55]' },
                        ] as const).map(opt => (
                          <button key={opt.value} onClick={() => setFormat(opt.value)}
                            className="text-left rounded-xl p-3 border transition-all"
                            style={{
                              borderColor: format === opt.value ? 'rgba(0,82,204,0.4)' : 'rgba(195,198,214,0.3)',
                              background: format === opt.value ? 'rgba(0,64,162,0.04)' : '#f7f9fb',
                              boxShadow: format === opt.value ? '0 0 0 3px rgba(0,82,204,0.08)' : 'none',
                            }}>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-3 h-3 rounded-full border-2 flex items-center justify-center"
                                style={{ borderColor: format === opt.value ? '#0052cc' : '#c3c6d6' }}>
                                {format === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary-hover)]" />}
                              </div>
                              <span className="text-xs font-bold text-[#18181B]">{opt.label}</span>
                            </div>
                            <span className="text-[10px] text-[#A1A1AA]" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                              {opt.hint}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Table 2: crude/adjusted toggles */}
                {template === 'table2' && (
                  <>
                    {hasCrude && (
                      <button onClick={() => setShowCrude(v => !v)}
                        className="flex items-center justify-between w-full rounded-xl p-3 border border-[rgba(195,198,214,0.3)] bg-[#f7f9fb] hover:bg-[#f2f4f6] transition-colors">
                        <div>
                          <p className="text-xs font-semibold text-[#18181B] text-left">Show Crude {effectLabel}</p>
                          <p className="text-[10px] text-[#A1A1AA] text-left mt-0.5">Unadjusted effect estimates</p>
                        </div>
                        {showCrude ? <ToggleRight className="h-5 w-5 text-[#0052cc] shrink-0" />
                          : <ToggleLeft className="h-5 w-5 text-[#A1A1AA] shrink-0" />}
                      </button>
                    )}
                    <button onClick={() => setShowAdj(v => !v)}
                      className="flex items-center justify-between w-full rounded-xl p-3 border border-[rgba(195,198,214,0.3)] bg-[#f7f9fb] hover:bg-[#f2f4f6] transition-colors">
                      <div>
                        <p className="text-xs font-semibold text-[#18181B] text-left">Show Adjusted {effectLabel}</p>
                        <p className="text-[10px] text-[#A1A1AA] text-left mt-0.5">Multivariable-adjusted estimates</p>
                      </div>
                      {showAdj ? <ToggleRight className="h-5 w-5 text-[#0052cc] shrink-0" />
                        : <ToggleLeft className="h-5 w-5 text-[#A1A1AA] shrink-0" />}
                    </button>
                  </>
                )}

                {/* Table 3: event/time labels */}
                {template === 'table3' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#52525B] mb-1.5 uppercase tracking-wide">
                        Event Label
                      </label>
                      <input value={eventLabel} onChange={e => setEventLabel(e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-sm text-[#18181B] bg-[#f7f9fb] border border-[rgba(195,198,214,0.3)] outline-none focus:border-[rgba(0,82,204,0.4)] transition-all" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#52525B] mb-1.5 uppercase tracking-wide">
                        Time Unit
                      </label>
                      <input value={timeUnit} onChange={e => setTimeUnit(e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-sm text-[#18181B] bg-[#f7f9fb] border border-[rgba(195,198,214,0.3)] outline-none focus:border-[rgba(0,82,204,0.4)] transition-all" />
                    </div>
                  </div>
                )}

                {/* Footnote toggle (all types) */}
                <button onClick={() => setIncludeFootnote(v => !v)}
                  className="flex items-center justify-between w-full rounded-xl p-3 border border-[rgba(195,198,214,0.3)] bg-[#f7f9fb] hover:bg-[#f2f4f6] transition-colors">
                  <div>
                    <p className="text-xs font-semibold text-[#18181B] text-left">Include footnote</p>
                    <p className="text-[10px] text-[#A1A1AA] text-left mt-0.5">Abbreviation key below the table</p>
                  </div>
                  {includeFootnote ? <ToggleRight className="h-5 w-5 text-[#0052cc] shrink-0" />
                    : <ToggleLeft className="h-5 w-5 text-[#A1A1AA] shrink-0" />}
                </button>
              </div>

              {/* Table 1: variable selection */}
              {template === 'table1' && (
                <div className="px-6 py-5 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope mb-4">
                    Variable Selection
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Continuous */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-semibold text-[#52525B] uppercase tracking-wide">Continuous</p>
                        {continuous.length > 0 && (
                          <button onClick={() => setSelectedCont(
                            continuous.every(v => selectedCont.has(v.name)) ? new Set() : new Set(continuous.map(v => v.name))
                          )} className="text-[10px] font-bold text-[#0052cc] hover:text-[#003d9b] transition-colors">
                            {continuous.every(v => selectedCont.has(v.name)) ? 'Deselect all' : 'Select all'}
                          </button>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {continuous.length === 0
                          ? <p className="text-xs text-[#A1A1AA] px-3 py-2">No continuous variables</p>
                          : continuous.map(v => (
                            <VarCheckbox key={v.name} name={v.name}
                              badge={format === 'mean_sd' ? 'Mean (SD)' : 'Med [IQR]'}
                              checked={selectedCont.has(v.name)}
                              onChange={c => handleToggleCont(v.name, c)} />
                          ))
                        }
                      </div>
                    </div>
                    {/* Categorical */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-semibold text-[#52525B] uppercase tracking-wide">Categorical</p>
                        {categorical.length > 0 && (
                          <button onClick={() => setSelectedCat(
                            categorical.every(v => selectedCat.has(v.name)) ? new Set() : new Set(categorical.map(v => v.name))
                          )} className="text-[10px] font-bold text-[#0052cc] hover:text-[#003d9b] transition-colors">
                            {categorical.every(v => selectedCat.has(v.name)) ? 'Deselect all' : 'Select all'}
                          </button>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {categorical.length === 0
                          ? <p className="text-xs text-[#A1A1AA] px-3 py-2">No categorical variables</p>
                          : categorical.map(v => (
                            <VarCheckbox key={v.name} name={v.name} badge="n (%)"
                              checked={selectedCat.has(v.name)}
                              onChange={c => handleToggleCat(v.name, c)} />
                          ))
                        }
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Table 2/3: row summary */}
              {(template === 'table2' || template === 'table3') && (
                <div className="px-6 py-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope mb-3">
                    Rows Detected
                  </p>
                  <div className="rounded-xl bg-[#f7f9fb] border border-[rgba(195,198,214,0.2)] px-4 py-3">
                    <p className="text-2xl font-extrabold text-[#18181B] font-manrope">
                      {template === 'table2' ? regressionRows.filter(r => r.variable).length
                        : survivalRows.length}
                    </p>
                    <p className="text-xs text-[#52525B] mt-0.5">
                      {template === 'table2' ? `${effectLabel} rows from ${runTitle ?? 'this analysis'}` : 'survival groups'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Right: Preview ────────────────────────────────────────── */}
            <div className="px-6 py-5 flex flex-col min-h-[420px]">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope mb-4">
                Live Table Preview
              </p>
              <div className="flex-1 bg-[#f7f9fb] rounded-xl p-5 overflow-auto border border-[rgba(195,198,214,0.2)]">
                {tableName && (
                  <p className="text-xs font-bold text-[#18181B] mb-3 font-manrope">{tableName}</p>
                )}
                {template === 'table1' && (
                  <Table1Preview totalN={totalN} format={format} footnote={t1Footnote}
                    contVars={selContVars} catVars={selCatVars} />
                )}
                {template === 'table2' && (
                  <Table2Preview rows={regressionRows} effectLabel={effectLabel}
                    showCrude={showCrude} showAdj={showAdj} footnote={t2Footnote} />
                )}
                {template === 'table3' && (
                  <Table3Preview rows={survivalRows} timeUnit={timeUnit}
                    eventLabel={eventLabel} footnote={t3Footnote} />
                )}
                {template === 'generic' && (
                  <div className="py-8 text-center text-sm text-[#A1A1AA]">
                    Table generation for this analysis type is not yet supported.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-[#f2f4f6]" style={{ background: '#fafbfc' }}>
          {/* Save destination */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-semibold text-[#52525B] uppercase tracking-wide">Save to:</span>
            <div className="flex gap-1.5">
              {([
                { mode: 'new' as const, icon: FilePlus, label: 'New Document' },
                { mode: 'insert' as const, icon: FileText, label: 'Existing Document' },
              ]).map(opt => (
                <button key={opt.mode} onClick={() => setSaveMode(opt.mode)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: saveMode === opt.mode ? 'rgba(0,64,162,0.08)' : 'transparent',
                    color: saveMode === opt.mode ? '#0040a2' : '#52525B',
                    border: `1px solid ${saveMode === opt.mode ? 'rgba(0,82,204,0.25)' : 'transparent'}`,
                  }}>
                  <opt.icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              ))}
            </div>

            {saveMode === 'insert' && (
              <select value={selectedDocId} onChange={e => setSelectedDocId(e.target.value)}
                className="ml-2 flex-1 rounded-lg px-3 py-1.5 text-xs text-[#18181B] bg-white border border-[rgba(195,198,214,0.4)] outline-none focus:border-[rgba(0,82,204,0.4)] transition-all"
                style={{ maxWidth: 240 }}>
                {documents.length === 0
                  ? <option value="">Loading documents…</option>
                  : documents.map(d => <option key={d.id} value={d.id}>{d.title}</option>)
                }
              </select>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button onClick={onClose}
              className="text-sm font-medium text-[#52525B] hover:text-[#18181B] transition-colors px-4 py-2">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !canSave()}
              className="flex items-center gap-2 px-5 py-2 text-white rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
              style={{ background: 'linear-gradient(135deg, #003d9b 0%, #0052cc 100%)' }}>
              {saving ? 'Saving…' : saveMode === 'insert' ? 'Insert into Document' : 'Save to Documents'}
              {!saving && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
