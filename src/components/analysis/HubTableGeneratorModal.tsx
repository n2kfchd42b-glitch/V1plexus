'use client'

import { useState, useEffect, useMemo, Fragment } from 'react'
import {
  X, Table2, ChevronRight, ChevronLeft,
  CheckCircle2, Circle, FilePlus, FileText,
  ToggleLeft, ToggleRight, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getCompletedProjectAnalysisRuns, getProjectDocuments, createDocument } from '@/lib/data'
import { useAuth } from '@/hooks/useAuth'
import { logAudit } from '@/lib/audit'
import {
  parseDescriptiveResult,
  parseRegressionResult,
  parseSurvivalResult,
  generateFootnote,
  formatContValue,
  getNextTableNumber,
  insertTableIntoDocument,
  specToTipTapNodes,
  REGRESSION_TYPES,
  SURVIVAL_TYPES,
  getTableTemplate,
  type ContVar,
  type CatVar,
  type FormatOption,
  type Table1Spec,
  type Table2Spec,
  type Table3Spec,
  type RegressionRow,
  type SurvivalSummaryRow,
  type StratifiedColumn,
} from '@/lib/tableGeneratorUtils'
import type { AnalysisRun, AnalysisType } from '@/types/database'
import type { AnalysisResult } from '@/lib/analysis/types'
import { useLocale } from '@/i18n/LocaleProvider'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  projectId: string
  onClose: () => void
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateType = 'table1' | 'table2' | 'table3'

interface RunWithResult extends AnalysisRun {
  parsedResult?: AnalysisResult
}

// ─── Shared preview table cells ───────────────────────────────────────────────

const TH: React.CSSProperties = {
  padding: '5px 8px 5px 0', fontWeight: 700, borderBottom: '1px solid #18181B',
  fontFamily: 'var(--font-manrope)', fontSize: '0.68rem', textTransform: 'uppercase',
  letterSpacing: '0.06em', whiteSpace: 'nowrap', color: '#18181B',
}
const TD: React.CSSProperties = {
  padding: '4px 8px 4px 0', fontSize: '0.775rem',
  borderBottom: '1px solid rgba(228,228,231,0.6)', color: '#18181B',
}
const MONO: React.CSSProperties = { fontFamily: 'var(--font-geist-mono)', textAlign: 'right' }

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const { t } = useLocale()
  const steps = [
    { n: 1, label: t('hubTable.step.template') },
    { n: 2, label: t('hubTable.step.selectRun') },
    { n: 3, label: t('hubTable.step.configure') },
  ] as const
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <Fragment key={s.n}>
          {i > 0 && (
            <div className="flex-1 h-px mx-1"
              style={{ background: step > s.n - 1 ? '#0052cc' : '#e4e4e7' }} />
          )}
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
              style={{
                background: step >= s.n ? 'linear-gradient(135deg, #003d9b, #0052cc)' : '#f2f4f6',
                color: step >= s.n ? 'white' : '#A1A1AA',
              }}
            >
              {step > s.n ? '✓' : s.n}
            </div>
            <span
              className="text-[11px] font-semibold hidden sm:block"
              style={{ color: step >= s.n ? '#003d9b' : '#A1A1AA' }}
            >
              {s.label}
            </span>
          </div>
        </Fragment>
      ))}
    </div>
  )
}

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({
  type, title, description, badge, selected, onClick,
}: {
  type: TemplateType
  title: string
  description: string
  badge: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-5 rounded-2xl border-2 transition-all hover:scale-[1.01]"
      style={{
        borderColor: selected ? 'rgba(0,82,204,0.5)' : 'rgba(195,198,214,0.3)',
        background: selected ? 'rgba(0,64,162,0.04)' : 'white',
        boxShadow: selected ? '0 0 0 4px rgba(0,82,204,0.08)' : '0 2px 8px rgba(0,24,72,0.04)',
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <span
            className="text-[10px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full mb-2 inline-block"
            style={{ background: selected ? 'rgba(0,64,162,0.12)' : 'rgba(241,245,249,1)', color: selected ? '#003d9b' : '#52525B' }}
          >
            {badge}
          </span>
          <h3 className="font-manrope font-bold text-base text-[#18181B]">{title}</h3>
        </div>
        <div className="mt-1 shrink-0">
          {selected
            ? <CheckCircle2 className="h-5 w-5 text-[#0052cc]" />
            : <Circle className="h-5 w-5 text-[#c3c6d6]" />}
        </div>
      </div>
      <p className="text-xs text-[#52525B] leading-relaxed">{description}</p>
    </button>
  )
}

// ─── Run selector row ─────────────────────────────────────────────────────────

function RunRow({
  run, selected, multi, onToggle,
}: {
  run: AnalysisRun
  selected: boolean
  multi: boolean
  onToggle: () => void
}) {
  const { t } = useLocale()
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left"
      style={{
        background: selected ? 'rgba(0,64,162,0.05)' : 'transparent',
        border: `1px solid ${selected ? 'rgba(0,82,204,0.25)' : 'rgba(228,228,231,0.5)'}`,
      }}
    >
      <div
        className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
        style={{
          background: selected ? 'linear-gradient(135deg, #003d9b, #0052cc)' : 'transparent',
          border: selected ? 'none' : '2px solid #c3c6d6',
        }}
      >
        {selected && <span className="text-white text-[9px] font-bold">✓</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#18181B] truncate">
          {run.title ?? run.analysis_type}
        </p>
        <p className="text-[11px] text-[#A1A1AA] mt-0.5">
          {run.analysis_type.replace(/_/g, ' ')}
        </p>
      </div>
      {multi && selected && (
        <span className="text-[10px] font-bold text-[#0040a2] bg-[rgba(0,64,162,0.08)] px-2 py-0.5 rounded-full shrink-0">
          {t('hubTable.groupBadge')}
        </span>
      )}
    </button>
  )
}

// ─── Table 1 preview ──────────────────────────────────────────────────────────

function Table1Preview({ spec }: { spec: Partial<Table1Spec> & { format: FormatOption } }) {
  const { t } = useLocale()
  const variables = spec.variables ?? []
  const contVars = variables.filter((v): v is ContVar => v.type === 'continuous')
  const catVars  = variables.filter((v): v is CatVar  => v.type === 'categorical')

  // Stratified
  if (spec.stratified && spec.columns?.length) {
    const cols = spec.columns
    return (
      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderTop: '2px solid #18181B' }}>
            <th style={{ ...TH, textAlign: 'left' }}>{t('hubTable.preview.characteristic')}</th>
            {cols.map(c => (
              <th key={c.label} style={{ ...TH, textAlign: 'right', paddingLeft: 8 }}>
                {c.label}<br />
                <span style={{ fontWeight: 400, fontSize: '0.62rem', color: '#52525B' }}>N={c.n.toLocaleString()}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cols[0]?.variables.filter((v): v is ContVar => v.type === 'continuous').map(v => (
            <tr key={v.name}>
              <td style={{ ...TD, paddingLeft: 8 }}>{v.name}</td>
              {cols.map(c => {
                const found = c.variables.find(cv => cv.name === v.name && cv.type === 'continuous') as ContVar | undefined
                return <td key={c.label} style={{ ...TD, ...MONO }}>{found ? formatContValue(found, spec.format) : '—'}</td>
              })}
            </tr>
          ))}
          {cols[0]?.variables.filter((v): v is CatVar => v.type === 'categorical').flatMap(v => {
            const rows = []
            rows.push(
              <tr key={`${v.name}_h`} style={{ background: 'rgba(241,245,249,0.3)' }}>
                <td colSpan={cols.length + 1} style={{ ...TD, fontWeight: 600 }}>{v.name}</td>
              </tr>
            )
            v.categories.forEach(cat => {
              rows.push(
                <tr key={`${v.name}_${cat.label}`}>
                  <td style={{ ...TD, paddingLeft: 16, color: '#52525B' }}>{cat.label}</td>
                  {cols.map(c => {
                    const found = c.variables.find(cv => cv.name === v.name && cv.type === 'categorical') as CatVar | undefined
                    const fc = found?.categories.find(cc => cc.label === cat.label)
                    return <td key={c.label} style={{ ...TD, ...MONO }}>{fc ? `${fc.count} (${fc.pct}%)` : '—'}</td>
                  })}
                </tr>
              )
            })
            return rows
          })}
        </tbody>
        {spec.footnote && (
          <tfoot>
            <tr style={{ borderTop: '1px solid #18181B' }}>
              <td colSpan={cols.length + 1} className="pt-2 italic text-[#52525B]" style={{ fontSize: '0.6875rem' }}>{spec.footnote}</td>
            </tr>
          </tfoot>
        )}
      </table>
    )
  }

  // Simple
  const totalN = spec.totalN ?? 0
  if (contVars.length === 0 && catVars.length === 0) {
    return <div className="py-8 text-center text-sm text-[#A1A1AA]">{t('hubTable.preview.selectVar')}</div>
  }
  return (
    <table className="w-full" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderTop: '2px solid #18181B' }}>
          <th style={{ ...TH, textAlign: 'left' }}>{t('hubTable.preview.characteristic')}</th>
          <th style={{ ...TH, textAlign: 'right', paddingLeft: 8 }}>{t('hubTable.preview.overall')} (N={totalN.toLocaleString()})</th>
        </tr>
      </thead>
      <tbody>
        {contVars.map(v => (
          <tr key={v.name}><td style={{ ...TD, paddingLeft: 8 }}>{v.name}</td><td style={{ ...TD, ...MONO }}>{formatContValue(v, spec.format)}</td></tr>
        ))}
        {catVars.flatMap(v => [
          <tr key={`${v.name}_h`} style={{ background: 'rgba(241,245,249,0.3)' }}>
            <td colSpan={2} style={{ ...TD, fontWeight: 600 }}>{v.name}</td>
          </tr>,
          ...v.categories.map(cat => (
            <tr key={`${v.name}_${cat.label}`}>
              <td style={{ ...TD, paddingLeft: 16, color: '#52525B' }}>{cat.label}</td>
              <td style={{ ...TD, ...MONO }}>{cat.count} ({cat.pct}%)</td>
            </tr>
          )),
        ])}
      </tbody>
      {spec.footnote && (
        <tfoot>
          <tr style={{ borderTop: '1px solid #18181B' }}>
            <td colSpan={2} className="pt-2 italic text-[#52525B]" style={{ fontSize: '0.6875rem' }}>{spec.footnote}</td>
          </tr>
        </tfoot>
      )}
    </table>
  )
}

// ─── Table 2 preview ──────────────────────────────────────────────────────────

function Table2Preview({ spec }: { spec: Partial<Table2Spec> }) {
  const { t } = useLocale()
  const rows = spec.rows ?? []
  const showCrude = spec.showCrude ?? false
  const showAdj   = spec.showAdjusted ?? true
  const eff = spec.effectLabel ?? 'OR'
  const colCount = 1 + (showCrude ? 2 : 0) + (showAdj ? 2 : 0) + 1
  if (rows.length === 0) return <div className="py-8 text-center text-sm text-[#A1A1AA]">{t('hubTable.preview.noRegression')}</div>
  return (
    <table className="w-full" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderTop: '2px solid #18181B' }}>
          <th style={{ ...TH, textAlign: 'left' }}>{t('hubTable.preview.variable')}</th>
          {showCrude && <><th style={{ ...TH, textAlign: 'right', paddingLeft: 8 }}>{t('hubTable.preview.crude')} {eff} {t('hubTable.preview.ci')}</th><th style={{ ...TH, textAlign: 'right', paddingLeft: 8 }}>{t('hubTable.preview.p')}</th></>}
          {showAdj  && <><th style={{ ...TH, textAlign: 'right', paddingLeft: 8 }}>{t('hubTable.preview.adjusted')} {eff} {t('hubTable.preview.ci')}</th><th style={{ ...TH, textAlign: 'right', paddingLeft: 8 }}>{t('hubTable.preview.p')}</th></>}
          <th style={{ ...TH, textAlign: 'right', paddingLeft: 8 }}>{t('hubTable.preview.sig')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.filter(r => r.variable).map((row, i) => (
          <tr key={i}>
            <td style={TD}>{row.variable}</td>
            {showCrude && <><td style={{ ...TD, ...MONO }}>{row.crude ?? '—'}</td><td style={{ ...TD, ...MONO, color: '#52525B', fontSize: '0.7rem' }}>{row.crude_p ?? '—'}</td></>}
            {showAdj  && <><td style={{ ...TD, ...MONO }}>{row.adj ?? '—'}</td><td style={{ ...TD, ...MONO, color: '#52525B', fontSize: '0.7rem' }}>{row.adj_p ?? '—'}</td></>}
            <td style={{ ...TD, ...MONO, fontWeight: 700, color: '#003d9b' }}>{row.sig}</td>
          </tr>
        ))}
      </tbody>
      {spec.footnote && (
        <tfoot>
          <tr style={{ borderTop: '1px solid #18181B' }}>
            <td colSpan={colCount} className="pt-2 italic text-[#52525B]" style={{ fontSize: '0.6875rem' }}>{spec.footnote}</td>
          </tr>
        </tfoot>
      )}
    </table>
  )
}

// ─── Table 3 preview ──────────────────────────────────────────────────────────

function Table3Preview({ spec }: { spec: Partial<Table3Spec> }) {
  const { t } = useLocale()
  const rows = spec.rows ?? []
  const hasGroup = rows.some(r => r.group)
  const colCount = hasGroup ? 6 : 5
  if (rows.length === 0) return <div className="py-8 text-center text-sm text-[#A1A1AA]">{t('hubTable.preview.noSurvival')}</div>
  return (
    <table className="w-full" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderTop: '2px solid #18181B' }}>
          {hasGroup && <th style={{ ...TH, textAlign: 'left' }}>{t('hubTable.preview.group')}</th>}
          <th style={{ ...TH, textAlign: 'right', paddingLeft: 8 }}>{t('hubTable.preview.n')}</th>
          <th style={{ ...TH, textAlign: 'right', paddingLeft: 8 }}>{spec.eventLabel ?? t('hubTable.preview.events')}</th>
          <th style={{ ...TH, textAlign: 'right', paddingLeft: 8 }}>{t('hubTable.preview.eventPct')}</th>
          <th style={{ ...TH, textAlign: 'right', paddingLeft: 8 }}>{t('hubTable.preview.median')} ({spec.timeUnit ?? 'months'})</th>
          <th style={{ ...TH, textAlign: 'right', paddingLeft: 8 }}>{t('hubTable.preview.ci95')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {hasGroup && <td style={{ ...TD, fontFamily: 'var(--font-manrope)' }}>{row.group ?? '—'}</td>}
            <td style={{ ...TD, ...MONO }}>{row.n.toLocaleString()}</td>
            <td style={{ ...TD, ...MONO }}>{row.events.toLocaleString()}</td>
            <td style={{ ...TD, ...MONO }}>{row.eventPct}</td>
            <td style={{ ...TD, ...MONO }}>{row.medianSurvival}</td>
            <td style={{ ...TD, ...MONO }}>{row.ci}</td>
          </tr>
        ))}
      </tbody>
      {spec.footnote && (
        <tfoot>
          <tr style={{ borderTop: '1px solid #18181B' }}>
            <td colSpan={colCount} className="pt-2 italic text-[#52525B]" style={{ fontSize: '0.6875rem' }}>{spec.footnote}</td>
          </tr>
        </tfoot>
      )}
    </table>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function HubTableGeneratorModal({ projectId, onClose }: Props) {
  const supabase = createClient()
  const { user } = useAuth()
  const { t } = useLocale()

  // ── Navigation ────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // ── Step 1: Template ──────────────────────────────────────────────────────────
  const [template, setTemplate] = useState<TemplateType | null>(null)

  // ── Step 2: Run selection ─────────────────────────────────────────────────────
  const [allRuns, setAllRuns]               = useState<RunWithResult[]>([])
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([])
  const [groupLabels, setGroupLabels]       = useState<Record<string, string>>({})
  const [runsLoading, setRunsLoading]       = useState(false)

  // ── Step 3: Configure ─────────────────────────────────────────────────────────
  const [tableName, setTableName]           = useState('')
  const [format, setFormat]                 = useState<FormatOption>('mean_sd')
  const [includeFootnote, setIncludeFootnote] = useState(true)

  // Table 1 variable selection
  const [selectedCont, setSelectedCont]     = useState<Set<string>>(new Set())
  const [selectedCat, setSelectedCat]       = useState<Set<string>>(new Set())

  // Table 2
  const [showCrude, setShowCrude]           = useState(true)
  const [showAdj, setShowAdj]               = useState(true)
  const [t2Rows, setT2Rows]                 = useState<RegressionRow[]>([])
  const [effectLabel, setEffectLabel]       = useState('OR')
  const [hasCrude, setHasCrude]             = useState(false)

  // Table 3
  const [t3Rows, setT3Rows]                 = useState<SurvivalSummaryRow[]>([])
  const [timeUnit, setTimeUnit]             = useState('months')
  const [eventLabel, setEventLabel]         = useState('Events')

  // ── Save destination ──────────────────────────────────────────────────────────
  const [saveMode, setSaveMode]             = useState<'new' | 'insert'>('new')
  const [documents, setDocuments]           = useState<{ id: string; title: string }[]>([])
  const [selectedDocId, setSelectedDocId]   = useState<string>('')
  const [saving, setSaving]                 = useState(false)

  // ── Escape key ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // ── Load runs on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    setRunsLoading(true)
    getCompletedProjectAnalysisRuns(supabase, projectId)
      .then(result => {
        setAllRuns(result.data as RunWithResult[])
        setRunsLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // ── Load documents for insert mode ───────────────────────────────────────────
  useEffect(() => {
    if (saveMode !== 'insert' || documents.length > 0) return
    getProjectDocuments(supabase, projectId)
      .then(result => {
        setDocuments(result.data)
        if (result.data.length > 0) setSelectedDocId(result.data[0].id)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveMode])

  // ── Filtered runs by template ─────────────────────────────────────────────────
  const filteredRuns = useMemo(() => {
    if (!template) return []
    return allRuns.filter(r => {
      const t = getTableTemplate(r.analysis_type as AnalysisType)
      return t === template
    })
  }, [allRuns, template])

  // ── Move to step 2 ────────────────────────────────────────────────────────────
  async function goToStep2() {
    if (!template) return
    const n = await getNextTableNumber(projectId, supabase)
    setTableName(
      template === 'table1' ? `Table ${n}. Baseline Characteristics`
        : template === 'table2' ? `Table ${n}. Regression Results`
        : `Table ${n}. Survival Analysis Summary`
    )
    setSelectedRunIds([])
    setGroupLabels({})
    setStep(2)
  }

  // ── Handle run selection ──────────────────────────────────────────────────────
  function toggleRun(id: string) {
    if (template === 'table1') {
      // Multi-select for stratified
      setSelectedRunIds(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      )
    } else {
      // Single select for table2/3
      setSelectedRunIds([id])
    }
  }

  // ── Move to step 3: parse selected runs ───────────────────────────────────────
  function goToStep3() {
    if (selectedRunIds.length === 0) return
    const selectedRuns = allRuns.filter(r => selectedRunIds.includes(r.id))

    if (template === 'table1') {
      if (selectedRuns.length === 1) {
        const r = selectedRuns[0]
        const result = r.results as unknown as AnalysisResult
        if (!result) return
        const parsed = parseDescriptiveResult(result)
        setSelectedCont(new Set(parsed.continuous.map(v => v.name)))
        setSelectedCat(new Set(parsed.categorical.map(v => v.name)))
      } else {
        // Stratified: all variables are available from first run, preselect all
        const result = selectedRuns[0]?.results as unknown as AnalysisResult
        if (!result) return
        const parsed = parseDescriptiveResult(result)
        setSelectedCont(new Set(parsed.continuous.map(v => v.name)))
        setSelectedCat(new Set(parsed.categorical.map(v => v.name)))
      }
    } else if (template === 'table2') {
      const result = selectedRuns[0]?.results as unknown as AnalysisResult
      if (!result) return
      const parsed = parseRegressionResult(result)
      setT2Rows(parsed.rows)
      setEffectLabel(parsed.effectLabel)
      setHasCrude(parsed.hasCrude)
      setShowCrude(parsed.hasCrude)
      setShowAdj(parsed.hasAdjusted || !parsed.hasCrude)
    } else if (template === 'table3') {
      const result = selectedRuns[0]?.results as unknown as AnalysisResult
      if (!result) return
      const parsed = parseSurvivalResult(result)
      setT3Rows(parsed.rows)
      setTimeUnit(parsed.timeUnit)
      setEventLabel(parsed.eventLabel)
    }

    setStep(3)
  }

  // ── Build final spec ──────────────────────────────────────────────────────────
  function buildSpec(): Table1Spec | Table2Spec | Table3Spec | null {
    if (!template) return null

    if (template === 'table1') {
      const selectedRuns = allRuns.filter(r => selectedRunIds.includes(r.id))

      if (selectedRuns.length > 1) {
        // Stratified: build columns from each run
        const columns: StratifiedColumn[] = selectedRuns.map(r => {
          const result = r.results as unknown as AnalysisResult
          const parsed = parseDescriptiveResult(result)
          return {
            label: groupLabels[r.id] ?? r.title ?? r.analysis_type,
            n: parsed.totalN,
            variables: [
              ...parsed.continuous.filter(v => selectedCont.has(v.name)),
              ...parsed.categorical.filter(v => selectedCat.has(v.name)),
            ],
          }
        })
        const footnote = includeFootnote
          ? generateFootnote(selectedCont.size > 0, format, selectedCat.size > 0) : ''
        const spec: Table1Spec = {
          specType: 'table1',
          title: tableName,
          footnote,
          format,
          stratified: true,
          columns,
        }
        return spec
      }

      // Single run
      const result = selectedRuns[0]?.results as unknown as AnalysisResult
      if (!result) return null
      const parsed = parseDescriptiveResult(result)
      const selCont = parsed.continuous.filter(v => selectedCont.has(v.name))
      const selCat  = parsed.categorical.filter(v => selectedCat.has(v.name))
      const spec: Table1Spec = {
        specType: 'table1',
        title: tableName,
        totalN: parsed.totalN,
        footnote: includeFootnote ? generateFootnote(selCont.length > 0, format, selCat.length > 0) : '',
        variables: [...selCont, ...selCat],
        format,
      }
      return spec
    }

    if (template === 'table2') {
      const spec: Table2Spec = {
        specType: 'table2',
        title: tableName,
        effectLabel,
        footnote: includeFootnote
          ? `Results shown as ${effectLabel} (95% CI). Significance: * p<0.05, ** p<0.01, *** p<0.001` : '',
        rows: t2Rows,
        showCrude,
        showAdjusted: showAdj,
      }
      return spec
    }

    // table3
    const spec: Table3Spec = {
      specType: 'table3',
      title: tableName,
      footnote: includeFootnote ? `Median survival time in ${timeUnit}. NR = Not Reached.` : '',
      rows: t3Rows,
      timeUnit,
      eventLabel,
    }
    return spec
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  async function handleSave() {
    const spec = buildSpec()
    if (!spec) { toast.error(t('hubTable.toast.nothingToSave')); return }
    if (saveMode === 'insert' && !selectedDocId) { toast.error(t('hubTable.toast.selectDocument')); return }

    setSaving(true)
    try {
      if (saveMode === 'insert') {
        await insertTableIntoDocument(selectedDocId, spec, supabase)
        toast.success(t('hubTable.toast.inserted'), { description: `"${tableName}" ${t('hubTable.toast.insertedDesc')}` })
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
        toast.success(t('hubTable.toast.saved'), { description: `"${tableName}" ${t('hubTable.toast.savedDesc')}` })
      }
      onClose()
    } catch (err) {
      toast.error(t('hubTable.toast.saveFailed'), { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setSaving(false)
    }
  }

  // ── Derived preview state ─────────────────────────────────────────────────────
  const previewSpec = useMemo((): Partial<Table1Spec> & { format: FormatOption } | null => {
    if (template !== 'table1' || step < 3) return null
    const selectedRuns = allRuns.filter(r => selectedRunIds.includes(r.id))
    if (selectedRuns.length > 1) {
      const columns: StratifiedColumn[] = selectedRuns.map(r => {
        const result = r.results as unknown as AnalysisResult
        const parsed = parseDescriptiveResult(result)
        return {
          label: groupLabels[r.id] ?? r.title ?? r.analysis_type,
          n: parsed.totalN,
          variables: [
            ...parsed.continuous.filter(v => selectedCont.has(v.name)),
            ...parsed.categorical.filter(v => selectedCat.has(v.name)),
          ],
        }
      })
      return { format, stratified: true, columns, footnote: includeFootnote ? generateFootnote(true, format, true) : '' }
    }
    const result = selectedRuns[0]?.results as unknown as AnalysisResult
    if (!result) return null
    const parsed = parseDescriptiveResult(result)
    return {
      format,
      totalN: parsed.totalN,
      variables: [
        ...parsed.continuous.filter(v => selectedCont.has(v.name)),
        ...parsed.categorical.filter(v => selectedCat.has(v.name)),
      ],
      footnote: includeFootnote ? generateFootnote(
        parsed.continuous.some(v => selectedCont.has(v.name)),
        format,
        parsed.categorical.some(v => selectedCat.has(v.name))
      ) : '',
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, step, allRuns, selectedRunIds, selectedCont, selectedCat, format, includeFootnote, groupLabels])

  // ── Parsed variable lists (step 3 T1) ─────────────────────────────────────────
  const { parsedCont, parsedCat } = useMemo(() => {
    if (template !== 'table1' || selectedRunIds.length === 0) return { parsedCont: [], parsedCat: [] }
    const result = allRuns.find(r => r.id === selectedRunIds[0])?.results as unknown as AnalysisResult
    if (!result) return { parsedCont: [], parsedCat: [] }
    const p = parseDescriptiveResult(result)
    return { parsedCont: p.continuous, parsedCat: p.categorical }
  }, [template, selectedRunIds, allRuns])

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,15,30,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-5xl rounded-2xl bg-white overflow-hidden flex flex-col"
        style={{ maxHeight: '92vh', boxShadow: '0 32px 80px rgba(0,24,72,0.18), 0 8px 24px rgba(0,24,72,0.10)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-[#f2f4f6]">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Table2 className="h-4 w-4 text-[#0052cc]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope">
                  {t('hubTable.title')}
                </span>
              </div>
              <h2 className="font-manrope font-extrabold text-xl text-[#18181B]">{t('hubTable.generateTable')}</h2>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <StepIndicator step={step} />
            <button onClick={onClose}
              className="rounded-lg p-1.5 text-[#A1A1AA] hover:text-[#18181B] hover:bg-[#f2f4f6] transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ─ Step 1: Template selection ─────────────────────────────────── */}
          {step === 1 && (
            <div className="p-7 max-w-3xl mx-auto">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0040a2] font-manrope mb-6">
                {t('hubTable.chooseTemplate')}
              </p>
              <div className="grid gap-4">
                <TemplateCard
                  type="table1"
                  badge={t('hubTable.template.table1Badge')}
                  title={t('hubTable.template.table1Title')}
                  description={t('hubTable.template.table1Desc')}
                  selected={template === 'table1'}
                  onClick={() => setTemplate('table1')}
                />
                <TemplateCard
                  type="table2"
                  badge={t('hubTable.template.table2Badge')}
                  title={t('hubTable.template.table2Title')}
                  description={t('hubTable.template.table2Desc')}
                  selected={template === 'table2'}
                  onClick={() => setTemplate('table2')}
                />
                <TemplateCard
                  type="table3"
                  badge={t('hubTable.template.table3Badge')}
                  title={t('hubTable.template.table3Title')}
                  description={t('hubTable.template.table3Desc')}
                  selected={template === 'table3'}
                  onClick={() => setTemplate('table3')}
                />
              </div>
            </div>
          )}

          {/* ─ Step 2: Run selection ──────────────────────────────────────── */}
          {step === 2 && (
            <div className="p-7">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0040a2] font-manrope">
                  {template === 'table1' ? t('hubTable.selectRuns') : t('hubTable.selectRun')}
                </p>
                {template === 'table1' && selectedRunIds.length > 1 && (
                  <div className="flex items-center gap-1.5 text-xs text-[#0040a2]">
                    <Users className="h-3.5 w-3.5" />
                    <span className="font-semibold">{selectedRunIds.length} {t('hubTable.runsSelected')}</span>
                  </div>
                )}
              </div>

              {runsLoading ? (
                <div className="py-12 text-center text-sm text-[#A1A1AA]">{t('hubTable.loadingAnalyses')}</div>
              ) : filteredRuns.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-semibold text-[#18181B] mb-1">{t('hubTable.noAnalyses')}</p>
                  <p className="text-xs text-[#A1A1AA]">
                    {template === 'table1' ? t('hubTable.runFirst.descriptive') : template === 'table2' ? t('hubTable.runFirst.regression') : t('hubTable.runFirst.survival')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {filteredRuns.map(run => (
                    <RunRow
                      key={run.id}
                      run={run}
                      selected={selectedRunIds.includes(run.id)}
                      multi={template === 'table1'}
                      onToggle={() => toggleRun(run.id)}
                    />
                  ))}
                </div>
              )}

              {/* Group label inputs for stratified Table 1 */}
              {template === 'table1' && selectedRunIds.length > 1 && (
                <div className="mt-5 pt-5 border-t border-[#f2f4f6]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#52525B] font-manrope mb-3">
                    {t('hubTable.columnLabels')}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedRunIds.map(id => {
                      const run = allRuns.find(r => r.id === id)
                      return (
                        <div key={id}>
                          <label className="block text-[11px] font-medium text-[#52525B] mb-1 truncate">
                            {run?.title ?? run?.analysis_type}
                          </label>
                          <input
                            value={groupLabels[id] ?? ''}
                            onChange={e => setGroupLabels(prev => ({ ...prev, [id]: e.target.value }))}
                            placeholder={run?.title ?? 'Group label…'}
                            className="w-full rounded-lg px-3 py-2 text-sm text-[#18181B] bg-[#f7f9fb] border border-[rgba(195,198,214,0.3)] outline-none focus:border-[rgba(0,82,204,0.4)] transition-all"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─ Step 3: Configure + Preview ───────────────────────────────── */}
          {step === 3 && (
            <div className="grid grid-cols-2 divide-x divide-[#f2f4f6]">

              {/* Left: Config */}
              <div className="flex flex-col divide-y divide-[#f2f4f6]">
                <div className="px-6 py-5 space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope">
                    {t('hubTable.configuration')}
                  </p>

                  {/* Table name */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#52525B] mb-1.5 uppercase tracking-wide">{t('hubTable.tableName')}</label>
                    <input value={tableName} onChange={e => setTableName(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm text-[#18181B] bg-[#f7f9fb] border border-[rgba(195,198,214,0.3)] outline-none focus:border-[rgba(0,82,204,0.4)] focus:shadow-[0_0_0_3px_rgba(0,82,204,0.08)] transition-all" />
                  </div>

                  {/* Table 1 options */}
                  {template === 'table1' && (
                    <div>
                      <label className="block text-[11px] font-semibold text-[#52525B] mb-2 uppercase tracking-wide">{t('hubTable.continuousFormat')}</label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { value: 'mean_sd', label: t('hubTable.formatMeanSD'), hint: '45.2 (12.3)' },
                          { value: 'median_iqr', label: t('hubTable.formatMedianIQR'), hint: '44.0 [35–55]' },
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
                            <span className="text-[10px] text-[#A1A1AA]" style={{ fontFamily: 'var(--font-geist-mono)' }}>{opt.hint}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Table 2 options */}
                  {template === 'table2' && (
                    <>
                      {hasCrude && (
                        <button onClick={() => setShowCrude(v => !v)}
                          className="flex items-center justify-between w-full rounded-xl p-3 border border-[rgba(195,198,214,0.3)] bg-[#f7f9fb] hover:bg-[#f2f4f6] transition-colors">
                          <div>
                            <p className="text-xs font-semibold text-[#18181B] text-left">{t('hubTable.showCrude')} {effectLabel}</p>
                            <p className="text-[10px] text-[#A1A1AA] text-left mt-0.5">{t('hubTable.unadjustedEstimates')}</p>
                          </div>
                          {showCrude ? <ToggleRight className="h-5 w-5 text-[#0052cc]" /> : <ToggleLeft className="h-5 w-5 text-[#A1A1AA]" />}
                        </button>
                      )}
                      <button onClick={() => setShowAdj(v => !v)}
                        className="flex items-center justify-between w-full rounded-xl p-3 border border-[rgba(195,198,214,0.3)] bg-[#f7f9fb] hover:bg-[#f2f4f6] transition-colors">
                        <div>
                          <p className="text-xs font-semibold text-[#18181B] text-left">{t('hubTable.showAdjusted')} {effectLabel}</p>
                          <p className="text-[10px] text-[#A1A1AA] text-left mt-0.5">{t('hubTable.adjustedEstimates')}</p>
                        </div>
                        {showAdj ? <ToggleRight className="h-5 w-5 text-[#0052cc]" /> : <ToggleLeft className="h-5 w-5 text-[#A1A1AA]" />}
                      </button>
                    </>
                  )}

                  {/* Table 3 options */}
                  {template === 'table3' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#52525B] mb-1.5 uppercase tracking-wide">{t('hubTable.eventLabel')}</label>
                        <input value={eventLabel} onChange={e => setEventLabel(e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-sm text-[#18181B] bg-[#f7f9fb] border border-[rgba(195,198,214,0.3)] outline-none focus:border-[rgba(0,82,204,0.4)] transition-all" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#52525B] mb-1.5 uppercase tracking-wide">{t('hubTable.timeUnit')}</label>
                        <input value={timeUnit} onChange={e => setTimeUnit(e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-sm text-[#18181B] bg-[#f7f9fb] border border-[rgba(195,198,214,0.3)] outline-none focus:border-[rgba(0,82,204,0.4)] transition-all" />
                      </div>
                    </div>
                  )}

                  {/* Footnote toggle */}
                  <button onClick={() => setIncludeFootnote(v => !v)}
                    className="flex items-center justify-between w-full rounded-xl p-3 border border-[rgba(195,198,214,0.3)] bg-[#f7f9fb] hover:bg-[#f2f4f6] transition-colors">
                    <div>
                      <p className="text-xs font-semibold text-[#18181B] text-left">{t('hubTable.includeFootnote')}</p>
                      <p className="text-[10px] text-[#A1A1AA] text-left mt-0.5">{t('hubTable.abbreviationKey')}</p>
                    </div>
                    {includeFootnote ? <ToggleRight className="h-5 w-5 text-[#0052cc]" /> : <ToggleLeft className="h-5 w-5 text-[#A1A1AA]" />}
                  </button>
                </div>

                {/* Table 1 variable selection */}
                {template === 'table1' && (
                  <div className="px-6 py-5 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope mb-3">
                      {t('hubTable.variableSelection')}
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-semibold text-[#52525B] uppercase tracking-wide">{t('hubTable.continuous')}</p>
                          {parsedCont.length > 0 && (
                            <button onClick={() => setSelectedCont(
                              parsedCont.every(v => selectedCont.has(v.name)) ? new Set() : new Set(parsedCont.map(v => v.name))
                            )} className="text-[10px] font-bold text-[#0052cc] hover:text-[#003d9b] transition-colors">
                              {parsedCont.every(v => selectedCont.has(v.name)) ? t('hubTable.deselectAll') : t('hubTable.selectAll')}
                            </button>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          {parsedCont.length === 0
                            ? <p className="text-xs text-[#A1A1AA] px-3 py-2">{t('hubTable.none')}</p>
                            : parsedCont.map(v => (
                              <label key={v.name} className="flex items-center gap-2 py-1.5 px-3 rounded-lg cursor-pointer hover:bg-[#f7f9fb] transition-colors">
                                <input type="checkbox" checked={selectedCont.has(v.name)}
                                  onChange={e => setSelectedCont(prev => { const n = new Set(prev); if (e.target.checked) { n.add(v.name) } else { n.delete(v.name) }; return n })}
                                  className="w-3.5 h-3.5 rounded accent-[#0052cc] cursor-pointer" />
                                <span className="text-sm text-[#18181B] truncate">{v.name}</span>
                              </label>
                            ))
                          }
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-semibold text-[#52525B] uppercase tracking-wide">{t('hubTable.categorical')}</p>
                          {parsedCat.length > 0 && (
                            <button onClick={() => setSelectedCat(
                              parsedCat.every(v => selectedCat.has(v.name)) ? new Set() : new Set(parsedCat.map(v => v.name))
                            )} className="text-[10px] font-bold text-[#0052cc] hover:text-[#003d9b] transition-colors">
                              {parsedCat.every(v => selectedCat.has(v.name)) ? t('hubTable.deselectAll') : t('hubTable.selectAll')}
                            </button>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          {parsedCat.length === 0
                            ? <p className="text-xs text-[#A1A1AA] px-3 py-2">{t('hubTable.none')}</p>
                            : parsedCat.map(v => (
                              <label key={v.name} className="flex items-center gap-2 py-1.5 px-3 rounded-lg cursor-pointer hover:bg-[#f7f9fb] transition-colors">
                                <input type="checkbox" checked={selectedCat.has(v.name)}
                                  onChange={e => setSelectedCat(prev => { const n = new Set(prev); if (e.target.checked) { n.add(v.name) } else { n.delete(v.name) }; return n })}
                                  className="w-3.5 h-3.5 rounded accent-[#0052cc] cursor-pointer" />
                                <span className="text-sm text-[#18181B] truncate">{v.name}</span>
                              </label>
                            ))
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Preview */}
              <div className="px-6 py-5 flex flex-col min-h-[460px]">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope mb-4">
                  {t('hubTable.livePreview')}
                </p>
                <div className="flex-1 bg-[#f7f9fb] rounded-xl p-5 overflow-auto border border-[rgba(195,198,214,0.2)]">
                  {tableName && (
                    <p className="text-xs font-bold text-[#18181B] mb-3 font-manrope">{tableName}</p>
                  )}
                  {template === 'table1' && previewSpec && (
                    <Table1Preview spec={previewSpec} />
                  )}
                  {template === 'table2' && (
                    <Table2Preview spec={{
                      rows: t2Rows, effectLabel, showCrude, showAdjusted: showAdj,
                      footnote: includeFootnote ? `Results shown as ${effectLabel} (95% CI). * p<0.05, ** p<0.01, *** p<0.001` : '',
                    }} />
                  )}
                  {template === 'table3' && (
                    <Table3Preview spec={{
                      rows: t3Rows, timeUnit, eventLabel,
                      footnote: includeFootnote ? `Median survival time in ${timeUnit}. NR = Not Reached.` : '',
                    }} />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="px-7 py-4 border-t border-[#f2f4f6]" style={{ background: '#fafbfc' }}>
          {/* Save destination (step 3 only) */}
          {step === 3 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-semibold text-[#52525B] uppercase tracking-wide">{t('hubTable.saveTo')}</span>
              <div className="flex gap-1.5">
                {([
                  { mode: 'new' as const, icon: FilePlus, label: t('hubTable.newDocument') },
                  { mode: 'insert' as const, icon: FileText, label: t('hubTable.existingDocument') },
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
                  style={{ maxWidth: 220 }}>
                  {documents.length === 0
                    ? <option value="">{t('hubTable.loadingDocs')}</option>
                    : documents.map(d => <option key={d.id} value={d.id}>{d.title}</option>)
                  }
                </select>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={onClose}
                className="text-sm font-medium text-[#52525B] hover:text-[#18181B] transition-colors px-4 py-2">
                {t('hubTable.cancel')}
              </button>
              {step > 1 && (
                <button onClick={() => setStep(prev => (prev - 1) as 1 | 2 | 3)}
                  className="flex items-center gap-1.5 text-sm font-medium text-[#52525B] hover:text-[#18181B] transition-colors px-4 py-2">
                  <ChevronLeft className="h-4 w-4" />
                  {t('hubTable.back')}
                </button>
              )}
            </div>
            <button
              disabled={
                step === 1 ? !template
                  : step === 2 ? selectedRunIds.length === 0
                  : saving
              }
              onClick={
                step === 1 ? goToStep2
                  : step === 2 ? goToStep3
                  : handleSave
              }
              className="flex items-center gap-2 px-5 py-2 text-white rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
              style={{ background: 'linear-gradient(135deg, #003d9b 0%, #0052cc 100%)' }}
            >
              {step === 3
                ? (saving ? t('hubTable.saving') : saveMode === 'insert' ? t('hubTable.insertIntoDocument') : t('hubTable.saveToDocuments'))
                : t('hubTable.continue')}
              {!(step === 3 && saving) && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
