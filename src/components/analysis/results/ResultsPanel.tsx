"use client"

import { useState } from 'react'
import { ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { SummaryBox } from './SummaryBox'
import { CoefficientTable } from './CoefficientTable'
import { InterpretationBox } from './InterpretationBox'
import { ResultsActions } from './ResultsActions'
import { AnalysisCharts } from './AnalysisCharts'
import type { AnalysisResult } from '@/lib/analysis/types'
import type { AnalysisType } from '@/types/database'

interface Props {
  result: AnalysisResult
  analysisType: AnalysisType
  title?: string
  datasetName?: string
  onSave: () => Promise<void>
  isSaved?: boolean
}

// ── DOCX export helper ────────────────────────────────────────────────────────
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
<head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
  <style>
    body { font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.4; margin: 2cm; }
    h1 { font-size: 16pt; margin-bottom: 4pt; }
    h2 { font-size: 13pt; margin-top: 16pt; }
    h3 { font-size: 12pt; margin-top: 12pt; }
    p { margin: 4pt 0; }
    table { border-collapse: collapse; width: 100%; margin-top: 6pt; }
    th, td { border: 1px solid #999; padding: 4px 8px; }
    th { background: #f0f0f0; font-weight: bold; }
  </style>
</head>
<body>
  <h1>${esc(title)}</h1>
  ${interpretHtml}
  <h2>Results Tables</h2>
  ${tableHtml}
  ${techHtml}
</body>
</html>`

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

// ─────────────────────────────────────────────────────────────────────────────

export function ResultsPanel({ result, analysisType, title, datasetName, onSave, isSaved }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  if (result.summary?.error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
        <p className="text-sm font-medium text-destructive">Analysis Error</p>
        <p className="text-sm text-muted-foreground mt-1">{String(result.summary.error)}</p>
      </div>
    )
  }

  const primaryTables = result.tables.filter(t => !t.advanced)
  const advancedTables = result.tables.filter(t => t.advanced)
  const exportTitle = title ?? `${analysisType} results`

  return (
    <div className="space-y-4">
      <SummaryBox analysisType={analysisType} summary={result.summary} title={title} datasetName={datasetName} />

      {/* Primary tables */}
      {primaryTables.length > 0 && (
        <div className="space-y-4">
          {primaryTables.map(table => (
            <div key={table.id} className="rounded-lg border p-3">
              <CoefficientTable table={table} />
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      {result.charts.length > 0 && (
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-semibold mb-4">Visualizations</h3>
          <AnalysisCharts charts={result.charts as Parameters<typeof AnalysisCharts>[0]['charts']} />
        </div>
      )}

      {/* Interpretation */}
      {(result.plainLanguage || result.interpretation) && (
        <InterpretationBox plainLanguage={result.plainLanguage} text={result.interpretation} />
      )}

      {/* Advanced statistics toggle */}
      {advancedTables.length > 0 && (
        <div className="rounded-lg border border-dashed">
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/30 transition-colors rounded-lg"
          >
            <span className="text-xs font-medium text-muted-foreground">
              Advanced Statistics ({advancedTables.length} table{advancedTables.length > 1 ? 's' : ''})
            </span>
            {showAdvanced
              ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          {showAdvanced && (
            <div className="px-3 pb-3 space-y-4 border-t pt-3">
              {advancedTables.map(table => (
                <CoefficientTable key={table.id} table={table} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t">
        <ResultsActions onSave={onSave} saved={isSaved} />
        <button
          onClick={() => exportToWord(result, exportTitle)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded px-2.5 py-1.5 hover:bg-muted/30 transition-colors"
          title="Export all tables to a Word document"
        >
          <FileText className="h-3.5 w-3.5" />
          Export to Word
        </button>
      </div>
    </div>
  )
}
