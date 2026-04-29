"use client"

import { useState } from 'react'
import { FileText, ChevronDown } from 'lucide-react'
import { SummaryBox } from './SummaryBox'
import { CoefficientTable } from './CoefficientTable'
import { InterpretationBox } from './InterpretationBox'
import { ResultsActions } from './ResultsActions'
import { AnalysisCharts } from './AnalysisCharts'
import type { AnalysisResult } from '@/lib/analysis/types'
import type { AnalysisType } from '@/types/database'

// Chart types that belong in the Diagnostics section
const DIAGNOSTIC_CHART_TYPES = new Set(['residual_plot', 'acf_plot', 'funnel_plot'])

interface Props {
  result: AnalysisResult
  analysisType: AnalysisType
  title?: string
  datasetName?: string
  onSave: () => Promise<void>
  isSaved?: boolean
  runId?: string
  projectId?: string
  datasetId?: string | null
  versionId?: string | null
  savedChartConfig?: Record<string, unknown> | null
}

function exportToWord(result: AnalysisResult, title: string) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const tableHtml = result.tables.map(t => `
    <h3 style="font-family:Calibri;font-size:12pt;margin-top:14pt">${esc(t.title)}</h3>
    <table style="border-collapse:collapse;width:100%;font-family:Calibri;font-size:10pt">
      <thead>
        <tr>${t.headers.map(h => `<th style="border:1px solid #999;padding:4px 8px;background:#f0f0f0;text-align:left;font-weight:bold">${esc(h)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${t.rows.map(row => `<tr>${row.map(cell =>
    `<td style="border:1px solid #ccc;padding:4px 8px">${esc(cell === null ? '—' : String(cell))}</td>`
  ).join('')}</tr>`).join('')}
      </tbody>
    </table>
    ${t.footnotes?.map(fn => `<p style="font-family:Calibri;font-size:9pt;color:#555;font-style:italic;margin:2pt 0">${esc(fn)}</p>`).join('') ?? ''}
  `).join('\n')

  const interpretHtml = result.plainLanguage
    ? `<h3 style="font-family:Calibri;font-size:12pt;margin-top:14pt">Plain Language Summary</h3>
       <p style="font-family:Calibri;font-size:10pt;line-height:1.5">${esc(result.plainLanguage)}</p>`
    : ''

  const techHtml = result.interpretation
    ? `<h3 style="font-family:Calibri;font-size:12pt;margin-top:14pt">Statistical Summary</h3>
       <p style="font-family:Calibri;font-size:10pt;line-height:1.5">${esc(result.interpretation)}</p>`
    : ''

  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
<head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:Calibri,sans-serif;font-size:11pt;line-height:1.4;margin:2cm}h1{font-size:16pt}h2{font-size:13pt;margin-top:16pt}h3{font-size:12pt;margin-top:12pt}p{margin:4pt 0}table{border-collapse:collapse;width:100%;margin-top:6pt}th,td{border:1px solid #999;padding:4px 8px}th{background:#f0f0f0;font-weight:bold}</style>
</head><body><h1>${esc(title)}</h1>${interpretHtml}<h2>Results Tables</h2>${tableHtml}${techHtml}</body></html>`

  const blob = new Blob([html], { type: 'application/vnd.ms-word;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_results.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ResultsPanel({ result, analysisType, title, datasetName, onSave, isSaved, runId, projectId, datasetId, versionId, savedChartConfig }: Props) {
  const [tableSearch, setTableSearch] = useState('')
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)

  if (result.summary?.error) {
    return (
      <div className="bg-[#FEF2F2] rounded-2xl p-5" style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }}>
        <p className="text-sm font-semibold text-[#991B1B]">Analysis Error</p>
        <p className="text-sm text-[#52525B] mt-1">{String(result.summary.error)}</p>
      </div>
    )
  }

  type ChartSpec = { type: string; title: string; data: unknown[]; config: Record<string, unknown> }
  const mainCharts = result.charts.filter(c => !DIAGNOSTIC_CHART_TYPES.has((c as ChartSpec).type))
  const diagnosticCharts = result.charts.filter(c => DIAGNOSTIC_CHART_TYPES.has((c as ChartSpec).type))

  const primaryTables = result.tables.filter(t => !t.advanced)
  const advancedTables = result.tables.filter(t => t.advanced)

  const filteredPrimaryTables = tableSearch
    ? primaryTables.filter(t => t.title.toLowerCase().includes(tableSearch.toLowerCase()))
    : primaryTables

  const hasDiagnostics = diagnosticCharts.length > 0 || advancedTables.length > 0
  const exportTitle = title ?? `${analysisType} results`
  const hasChart = mainCharts.length > 0
  const hasTable = filteredPrimaryTables.length > 0

  return (
    <div className="space-y-5">

      {/* ── 1. Key Stats ─────────────────────────────────────────────── */}
      <SummaryBox
        analysisType={analysisType}
        summary={result.summary}
        title={title}
        datasetName={datasetName}
      />

      {/* ── 2. Summary ───────────────────────────────────────────────── */}
      {(result.plainLanguage || result.interpretation) && (
        <InterpretationBox
          plainLanguage={result.plainLanguage}
          text={result.interpretation}
        />
      )}

      {/* ── 3. Primary Results: chart + table side-by-side ───────────── */}
      {(hasChart || hasTable) && (
        <div className={`grid gap-5 ${hasChart && hasTable ? 'grid-cols-1 lg:grid-cols-[3fr_2fr]' : 'grid-cols-1'}`}>

          {/* Chart column */}
          {hasChart && (
            <AnalysisCharts
              charts={mainCharts as Parameters<typeof AnalysisCharts>[0]['charts']}
              runId={runId}
              datasetId={datasetId}
              versionId={versionId}
              analysisType={analysisType}
              savedConfig={savedChartConfig}
            />
          )}

          {/* Tables column */}
          {hasTable && (
            <div className="border border-[var(--border-row)] rounded overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-[var(--border-row)] flex items-center justify-between gap-3 flex-shrink-0">
                <p className="subsection-label">Results Tables</p>
                {primaryTables.length > 1 && (
                  <input
                    value={tableSearch}
                    onChange={e => setTableSearch(e.target.value)}
                    placeholder="Filter…"
                    className="bg-[var(--bg-row-hover)] border-0 rounded px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent-blue)]/30 w-24"
                  />
                )}
              </div>
              <div className="overflow-y-auto flex-1" style={{ maxHeight: hasChart ? '520px' : undefined }}>
                {filteredPrimaryTables.length > 0 ? (
                  filteredPrimaryTables.map((table, idx) => (
                    <div key={table.id} className="px-4 py-4 border-b border-[var(--border-row)] last:border-0">
                      <CoefficientTable table={table} tableNumber={idx + 1} />
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[var(--text-tertiary)] text-center py-8">No tables match.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 4. Diagnostics — collapsible ─────────────────────────────── */}
      {hasDiagnostics && (
        <div className="border-t border-[var(--border-row)]">
          <button
            onClick={() => setDiagnosticsOpen(v => !v)}
            className="w-full flex items-center justify-between py-3 text-left hover:text-[var(--text-primary)] transition-colors"
          >
            <p className="text-xs font-medium text-[var(--text-secondary)]">Diagnostics</p>
            <ChevronDown
              className={`h-3.5 w-3.5 text-[var(--text-tertiary)] transition-transform duration-200 ${diagnosticsOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {diagnosticsOpen && (
            <div className="border-t border-[var(--border-row)] pt-4 space-y-4">
              {diagnosticCharts.length > 0 && (
                <AnalysisCharts
                  charts={diagnosticCharts as Parameters<typeof AnalysisCharts>[0]['charts']}
                  runId={runId}
                  datasetId={datasetId}
                  versionId={versionId}
                  analysisType={analysisType}
                />
              )}

              {advancedTables.length > 0 && (
                <div>
                  {advancedTables.map(table => (
                    <div key={table.id} className="py-4 border-b border-[var(--border-row)] last:border-0">
                      <CoefficientTable table={table} />
                    </div>
                  ))}
                </div>
              )}

              {result.interpretation && (
                <div className="py-3 border-t border-[var(--border-row)]">
                  <p className="subsection-label mb-2">Statistical Summary</p>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{result.interpretation}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Persistent action footer ──────────────────────────────────── */}
      <div className="flex items-center gap-2 pt-4 border-t border-[var(--border-row)] flex-wrap">
        <ResultsActions onSave={onSave} saved={isSaved} />
        <button
          onClick={() => exportToWord(result, exportTitle)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-strong)] rounded px-3 py-1.5 hover:bg-[var(--bg-row-hover)] transition-colors"
        >
          <FileText className="h-3.5 w-3.5" />
          Export to Word
        </button>
      </div>
    </div>
  )
}
