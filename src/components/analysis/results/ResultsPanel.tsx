"use client"

import { useState } from 'react'
import { FileText, Sparkles, Copy, Check } from 'lucide-react'
import { SummaryBox } from './SummaryBox'
import { CoefficientTable } from './CoefficientTable'
import { InterpretationBox } from './InterpretationBox'
import { ResultsActions } from './ResultsActions'
import { AnalysisCharts } from './AnalysisCharts'
import type { AnalysisResult } from '@/lib/analysis/types'
import type { AnalysisType } from '@/types/database'
import type { ResultsTab } from '@/app/(dashboard)/projects/[id]/analysis/[runId]/page'

// Chart types that belong in the Diagnostics tab
const DIAGNOSTIC_CHART_TYPES = new Set(['residual_plot', 'acf_plot', 'funnel_plot'])

interface Props {
  result: AnalysisResult
  analysisType: AnalysisType
  title?: string
  datasetName?: string
  onSave: () => Promise<void>
  isSaved?: boolean
  activeTab?: ResultsTab
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

export function ResultsPanel({ result, analysisType, title, datasetName, onSave, isSaved, activeTab = 'charts', runId, projectId, datasetId, versionId, savedChartConfig }: Props) {
  const [tableSearch, setTableSearch] = useState('')
  const [narrative, setNarrative] = useState<string | null>(null)
  const [narrativeLoading, setNarrativeLoading] = useState(false)
  const [narrativeCopied, setNarrativeCopied] = useState(false)

  const generateNarrative = async () => {
    setNarrativeLoading(true)
    try {
      const res = await fetch('/api/analytics/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId ?? '',
          analysis_type: analysisType,
          result: result.summary ?? {},
          dataset_id: datasetId ?? '',
          variables: {},
          analysis_run_id: runId,
        }),
      })
      if (res.ok) {
        const json = await res.json()
        setNarrative(json.deterministic_text ?? null)
      }
    } catch { /* non-blocking */ }
    finally { setNarrativeLoading(false) }
  }

  const copyNarrative = () => {
    if (!narrative) return
    navigator.clipboard.writeText(narrative).then(() => {
      setNarrativeCopied(true)
      setTimeout(() => setNarrativeCopied(false), 2000)
    })
  }

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
  const allTables = [...primaryTables, ...advancedTables]

  const filteredTables = tableSearch
    ? allTables.filter(t => t.title.toLowerCase().includes(tableSearch.toLowerCase()))
    : allTables

  const exportTitle = title ?? `${analysisType} results`

  return (
    <div>
      {/* ── Charts Tab ───────────────────────────────────────────────── */}
      {activeTab === 'charts' && (
        <div className="space-y-5">
          <SummaryBox
            analysisType={analysisType}
            summary={result.summary}
            title={title}
            datasetName={datasetName}
          />

          {mainCharts.length > 0 && (
            <AnalysisCharts
              charts={mainCharts as Parameters<typeof AnalysisCharts>[0]['charts']}
              runId={runId}
              datasetId={datasetId}
              versionId={versionId}
              analysisType={analysisType}
              savedConfig={savedChartConfig}
            />
          )}

          {(result.plainLanguage || result.interpretation) && (
            <InterpretationBox
              plainLanguage={result.plainLanguage}
              text={result.interpretation}
            />
          )}

          {/* Statistical Narrative */}
          {narrative ? (
            <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope">
                  Statistical Narrative
                </p>
                <button
                  onClick={copyNarrative}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {narrativeCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {narrativeCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-sm text-[#52525B] leading-relaxed">{narrative}</p>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Tables Tab ───────────────────────────────────────────────── */}
      {activeTab === 'tables' && (
        <div>
          <div
            className="bg-white rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04), 0 4px 12px rgba(0,24,72,0.03)' }}
          >
            {/* Table header */}
            <div className="px-7 py-6 border-b border-[#f2f4f6] flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope mb-1">
                  Results Output
                </p>
                <h2 className="font-manrope font-bold text-lg text-[#18181B]">
                  {title ?? 'Results Tables'}
                </h2>
              </div>
              <input
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                placeholder="Search tables..."
                className="bg-[#f2f4f6] border border-[rgba(195,198,214,0.3)] rounded-lg px-3 py-2 text-sm text-[#18181B] outline-none focus:border-[rgba(0,82,204,0.4)] focus:shadow-[0_0_0_3px_rgba(0,82,204,0.08)] transition-all w-52"
              />
            </div>

            {/* Tables */}
            {filteredTables.length > 0 ? (
              filteredTables.map(table => (
                <div key={table.id} className="px-7 py-6 border-b border-[#f2f4f6] last:border-0">
                  <CoefficientTable table={table} />
                </div>
              ))
            ) : (
              <p className="text-sm text-[#A1A1AA] text-center py-14">
                No tables match your search.
              </p>
            )}
          </div>

        </div>
      )}

      {/* ── Diagnostics Tab ──────────────────────────────────────────── */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-5">
          {diagnosticCharts.length > 0 ? (
            <AnalysisCharts
              charts={diagnosticCharts as Parameters<typeof AnalysisCharts>[0]['charts']}
              runId={runId}
              datasetId={datasetId}
              versionId={versionId}
              analysisType={analysisType}
            />
          ) : (
            <div
              className="bg-white rounded-2xl p-14 text-center"
              style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }}
            >
              <p className="text-sm text-[#A1A1AA]">
                No diagnostic plots available for this analysis type.
              </p>
            </div>
          )}

          {advancedTables.length > 0 && (
            <div
              className="bg-white rounded-2xl overflow-hidden"
              style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }}
            >
              <div className="px-7 py-5 border-b border-[#f2f4f6]">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope mb-1">
                  Advanced
                </p>
                <h2 className="font-manrope font-bold text-lg text-[#18181B]">
                  Diagnostic Statistics
                </h2>
              </div>
              {advancedTables.map(table => (
                <div key={table.id} className="px-7 py-6 border-b border-[#f2f4f6] last:border-0">
                  <CoefficientTable table={table} />
                </div>
              ))}
            </div>
          )}

          {result.interpretation && (
            <div
              className="bg-white rounded-2xl p-7"
              style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04)' }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope mb-4">
                Statistical Summary
              </p>
              <p className="text-sm text-[#52525B] leading-relaxed">{result.interpretation}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Persistent action footer (always visible) ────────────────── */}
      <div className="flex items-center gap-3 mt-5 pt-5 border-t border-[#f2f4f6] flex-wrap">
        <ResultsActions onSave={onSave} saved={isSaved} />
        <button
          onClick={() => exportToWord(result, exportTitle)}
          className="inline-flex items-center gap-2 text-xs font-medium text-[#52525B] hover:text-[#18181B] border border-[rgba(195,198,214,0.4)] rounded-lg px-4 py-2 hover:bg-[#f2f4f6] transition-all bg-white"
          style={{ boxShadow: '0 8px 24px rgba(0,24,72,0.05)' }}
        >
          <FileText className="h-3.5 w-3.5" />
          Export to Word
        </button>
        {!narrative && (
          <button
            onClick={generateNarrative}
            disabled={narrativeLoading}
            className="inline-flex items-center gap-2 text-xs font-medium text-[#0040a2] hover:text-[#003080] border border-[rgba(0,64,162,0.25)] rounded-lg px-4 py-2 hover:bg-blue-50 transition-all bg-white disabled:opacity-50"
            style={{ boxShadow: '0 8px 24px rgba(0,24,72,0.05)' }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {narrativeLoading ? 'Generating…' : 'Generate Narrative'}
          </button>
        )}
      </div>
    </div>
  )
}
