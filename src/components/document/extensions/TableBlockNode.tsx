'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { Table2 } from 'lucide-react'
import {
  formatContValue,
  type AnyTableSpec,
  type Table1Spec,
  type Table2Spec,
  type Table3Spec,
  type LegacyTableSpec,
  type ContVar,
  type CatVar,
} from '@/lib/tableGeneratorUtils'

// ─── Shared table styles ──────────────────────────────────────────────────────

const TH: React.CSSProperties = {
  padding: '6px 12px 6px 0',
  fontWeight: 700,
  borderBottom: '1px solid #18181B',
  fontFamily: 'var(--font-manrope)',
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#18181B',
  whiteSpace: 'nowrap',
}

const TD: React.CSSProperties = {
  padding: '5px 12px 5px 0',
  fontSize: '0.8125rem',
  color: '#18181B',
  borderBottom: '1px solid rgba(228,228,231,0.6)',
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-geist-mono)', textAlign: 'right' }

const SECTION_LABEL: React.CSSProperties = {
  padding: '5px 0',
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#52525B',
  fontFamily: 'var(--font-manrope)',
  background: 'rgba(241,245,249,0.5)',
}

function FootnoteRow({ text, cols }: { text: string; cols: number }) {
  return (
    <tfoot>
      <tr style={{ borderTop: '1px solid #18181B' }}>
        <td colSpan={cols} style={{ paddingTop: 6, fontSize: '0.6875rem', color: '#52525B', fontStyle: 'italic' }}>
          {text}
        </td>
      </tr>
    </tfoot>
  )
}

// ─── Table 1 — Baseline Characteristics ──────────────────────────────────────

function Table1Render({ spec }: { spec: Table1Spec | LegacyTableSpec }) {
  const variables = spec.variables ?? []
  const contVars = variables.filter((v): v is ContVar => v.type === 'continuous')
  const catVars  = variables.filter((v): v is CatVar  => v.type === 'categorical')

  // Stratified multi-column layout
  if ((spec as Table1Spec).stratified && (spec as Table1Spec).columns?.length) {
    const cols = (spec as Table1Spec).columns!
    const colCount = cols.length + 1
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <thead>
          <tr style={{ borderTop: '2px solid #18181B' }}>
            <th style={{ ...TH, textAlign: 'left' }}>Characteristic</th>
            {cols.map(c => (
              <th key={c.label} style={{ ...TH, textAlign: 'right', paddingLeft: 12 }}>
                {c.label}<br /><span style={{ fontWeight: 400, fontSize: '0.65rem', color: '#52525B' }}>N={c.n.toLocaleString()}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cols[0]?.variables.filter(v => v.type === 'continuous').length > 0 && (
            <tr><td colSpan={colCount} style={SECTION_LABEL}>Continuous Variables</td></tr>
          )}
          {cols[0]?.variables.filter((v): v is ContVar => v.type === 'continuous').map(v => (
            <tr key={v.name}>
              <td style={{ ...TD, paddingLeft: 12 }}>{v.name}</td>
              {cols.map(c => {
                const found = c.variables.find(cv => cv.name === v.name && cv.type === 'continuous') as ContVar | undefined
                return (
                  <td key={c.label} style={{ ...TD, ...MONO }}>
                    {found ? formatContValue(found, spec.format) : '—'}
                  </td>
                )
              })}
            </tr>
          ))}
          {cols[0]?.variables.filter(v => v.type === 'categorical').length > 0 && (
            <tr><td colSpan={colCount} style={SECTION_LABEL}>Categorical Variables</td></tr>
          )}
          {cols[0]?.variables.filter((v): v is CatVar => v.type === 'categorical').flatMap(v => {
            const rows = []
            rows.push(
              <tr key={`${v.name}_hdr`} style={{ background: 'rgba(241,245,249,0.3)' }}>
                <td colSpan={colCount} style={{ ...TD, fontWeight: 600, paddingLeft: 0 }}>{v.name}</td>
              </tr>
            )
            v.categories.forEach(cat => {
              rows.push(
                <tr key={`${v.name}_${cat.label}`}>
                  <td style={{ ...TD, paddingLeft: 20, color: '#52525B' }}>{cat.label}</td>
                  {cols.map(c => {
                    const found = c.variables.find(cv => cv.name === v.name && cv.type === 'categorical') as CatVar | undefined
                    const foundCat = found?.categories.find(cc => cc.label === cat.label)
                    return (
                      <td key={c.label} style={{ ...TD, ...MONO }}>
                        {foundCat ? `${foundCat.count} (${foundCat.pct}%)` : '—'}
                      </td>
                    )
                  })}
                </tr>
              )
            })
            return rows
          })}
        </tbody>
        {spec.footnote && <FootnoteRow text={spec.footnote} cols={colCount} />}
      </table>
    )
  }

  // Simple single-column layout
  const totalN = (spec as Table1Spec).totalN ?? (spec as LegacyTableSpec).totalN ?? 0
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
      <thead>
        <tr style={{ borderTop: '2px solid #18181B' }}>
          <th style={{ ...TH, textAlign: 'left' }}>Characteristic</th>
          <th style={{ ...TH, textAlign: 'right', paddingLeft: 12 }}>Overall (N={totalN.toLocaleString()})</th>
        </tr>
      </thead>
      <tbody>
        {contVars.length > 0 && (
          <>
            <tr><td colSpan={2} style={SECTION_LABEL}>Continuous Variables</td></tr>
            {contVars.map(v => (
              <tr key={v.name}>
                <td style={{ ...TD, paddingLeft: 12 }}>{v.name}</td>
                <td style={{ ...TD, ...MONO }}>{formatContValue(v, spec.format)}</td>
              </tr>
            ))}
          </>
        )}
        {catVars.length > 0 && (
          <>
            <tr><td colSpan={2} style={SECTION_LABEL}>Categorical Variables</td></tr>
            {catVars.map(v => (
              <>
                <tr key={v.name} style={{ background: 'rgba(241,245,249,0.3)' }}>
                  <td colSpan={2} style={{ ...TD, fontWeight: 600, paddingLeft: 0 }}>{v.name}</td>
                </tr>
                {v.categories.length > 0 ? v.categories.map(cat => (
                  <tr key={cat.label}>
                    <td style={{ ...TD, paddingLeft: 20, color: '#52525B' }}>{cat.label}</td>
                    <td style={{ ...TD, ...MONO }}>{cat.count} ({cat.pct}%)</td>
                  </tr>
                )) : (
                  <tr key={`${v.name}_empty`}>
                    <td colSpan={2} style={{ ...TD, paddingLeft: 20, color: '#A1A1AA' }}>Category data unavailable</td>
                  </tr>
                )}
              </>
            ))}
          </>
        )}
      </tbody>
      {spec.footnote && <FootnoteRow text={spec.footnote} cols={2} />}
    </table>
  )
}

// ─── Table 2 — Regression Results ────────────────────────────────────────────

function Table2Render({ spec }: { spec: Table2Spec }) {
  const showCrude = spec.showCrude
  const showAdj   = spec.showAdjusted
  const colCount  = 1 + (showCrude ? 2 : 0) + (showAdj ? 2 : 0) + 1

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
      <thead>
        <tr style={{ borderTop: '2px solid #18181B' }}>
          <th style={{ ...TH, textAlign: 'left' }}>Variable</th>
          {showCrude && <>
            <th style={{ ...TH, textAlign: 'right', paddingLeft: 12 }}>Crude {spec.effectLabel} (95% CI)</th>
            <th style={{ ...TH, textAlign: 'right', paddingLeft: 12 }}>p</th>
          </>}
          {showAdj && <>
            <th style={{ ...TH, textAlign: 'right', paddingLeft: 12 }}>Adj. {spec.effectLabel} (95% CI)</th>
            <th style={{ ...TH, textAlign: 'right', paddingLeft: 12 }}>p</th>
          </>}
          <th style={{ ...TH, textAlign: 'right', paddingLeft: 12 }}>Sig.</th>
        </tr>
      </thead>
      <tbody>
        {spec.rows.map((row, i) => (
          <tr key={i}>
            <td style={{ ...TD, paddingLeft: 0 }}>{row.variable}</td>
            {showCrude && <>
              <td style={{ ...TD, ...MONO }}>{row.crude ?? '—'}</td>
              <td style={{ ...TD, ...MONO, fontSize: '0.75rem', color: '#52525B' }}>{row.crude_p ?? '—'}</td>
            </>}
            {showAdj && <>
              <td style={{ ...TD, ...MONO }}>{row.adj ?? '—'}</td>
              <td style={{ ...TD, ...MONO, fontSize: '0.75rem', color: '#52525B' }}>{row.adj_p ?? '—'}</td>
            </>}
            <td style={{ ...TD, textAlign: 'right', fontFamily: 'var(--font-geist-mono)', fontWeight: 700, color: '#003d9b' }}>
              {row.sig}
            </td>
          </tr>
        ))}
      </tbody>
      {spec.footnote && <FootnoteRow text={spec.footnote} cols={colCount} />}
    </table>
  )
}

// ─── Table 3 — Survival Summary ───────────────────────────────────────────────

function Table3Render({ spec }: { spec: Table3Spec }) {
  const hasGroup = spec.rows.some(r => r.group)
  const colCount = hasGroup ? 6 : 5

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
      <thead>
        <tr style={{ borderTop: '2px solid #18181B' }}>
          {hasGroup && <th style={{ ...TH, textAlign: 'left' }}>Group</th>}
          <th style={{ ...TH, textAlign: 'right', paddingLeft: 12 }}>N</th>
          <th style={{ ...TH, textAlign: 'right', paddingLeft: 12 }}>{spec.eventLabel}</th>
          <th style={{ ...TH, textAlign: 'right', paddingLeft: 12 }}>Event %</th>
          <th style={{ ...TH, textAlign: 'right', paddingLeft: 12 }}>Median ({spec.timeUnit})</th>
          <th style={{ ...TH, textAlign: 'right', paddingLeft: 12 }}>95% CI</th>
        </tr>
      </thead>
      <tbody>
        {spec.rows.map((row, i) => (
          <tr key={i}>
            {hasGroup && <td style={{ ...TD, paddingLeft: 0 }}>{row.group ?? '—'}</td>}
            <td style={{ ...TD, ...MONO }}>{row.n.toLocaleString()}</td>
            <td style={{ ...TD, ...MONO }}>{row.events.toLocaleString()}</td>
            <td style={{ ...TD, ...MONO }}>{row.eventPct}</td>
            <td style={{ ...TD, ...MONO }}>{row.medianSurvival}</td>
            <td style={{ ...TD, ...MONO }}>{row.ci}</td>
          </tr>
        ))}
      </tbody>
      {spec.footnote && <FootnoteRow text={spec.footnote} cols={colCount} />}
    </table>
  )
}

// ─── NodeView component ───────────────────────────────────────────────────────

function TableBlockView({ node }: { node: { attrs: Record<string, unknown> } }) {
  const { tableSpec } = node.attrs as { tableSpec: string }

  let spec: AnyTableSpec | null = null
  try {
    spec = JSON.parse(tableSpec) as AnyTableSpec
  } catch {
    // ignore
  }

  if (!spec) {
    return (
      <NodeViewWrapper className="my-4">
        <div className="border border-red-200 rounded-lg p-4 bg-red-50 text-sm text-red-600">
          Failed to load table data.
        </div>
      </NodeViewWrapper>
    )
  }

  // Determine header meta
  let meta = ''
  if (spec.specType === 'table2') {
    meta = spec.effectLabel
  } else if (spec.specType === 'table3') {
    meta = spec.timeUnit
  } else {
    const n = (spec as { totalN?: number }).totalN
    if (n != null) meta = `N=${n.toLocaleString()}`
  }

  return (
    <NodeViewWrapper className="my-5">
      <div
        className="border rounded-xl overflow-hidden bg-white"
        contentEditable={false}
        style={{ boxShadow: '0 4px 16px rgba(0,24,72,0.06)' }}
      >
        {/* Header bar */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 border-b"
          style={{ background: 'rgba(0,64,162,0.04)', borderColor: 'rgba(0,82,204,0.12)' }}
        >
          <Table2 className="h-3.5 w-3.5 text-[#0052cc] shrink-0" />
          <span
            className="text-sm font-semibold text-[#003d9b] truncate flex-1"
            style={{ fontFamily: 'var(--font-manrope)' }}
          >
            {spec.title}
          </span>
          {meta && (
            <span
              className="text-[10px] text-[#0040a2] font-bold uppercase tracking-wide shrink-0"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              {meta}
            </span>
          )}
        </div>

        {/* Table content */}
        <div className="px-5 py-4 overflow-x-auto">
          {spec.specType === 'table2' ? (
            <Table2Render spec={spec as Table2Spec} />
          ) : spec.specType === 'table3' ? (
            <Table3Render spec={spec as Table3Spec} />
          ) : (
            <Table1Render spec={spec as Table1Spec | LegacyTableSpec} />
          )}
        </div>
      </div>
    </NodeViewWrapper>
  )
}

// ─── TipTap Node Extension ────────────────────────────────────────────────────

export const TableBlockNodeExtension = Node.create({
  name: 'tableBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      tableSpec: { default: '{}' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="table-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'table-block' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(TableBlockView)
  },
})
