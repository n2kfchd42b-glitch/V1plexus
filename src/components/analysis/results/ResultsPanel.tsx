"use client"

import { useState } from 'react'
import { ChevronDown, ChevronUp, FileText, BarChart2, Table2, FlaskConical } from 'lucide-react'
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

export function ResultsPanel({ result, analysisType, title, datasetName, onSave, isSaved }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  if (result.summary?.error) {
    return (
      <div className="bg-[#FEF2F2] border border-[#E4E4E7] rounded-lg p-5">
        <p className="text-sm font-semibold text-[#991B1B]">Analysis Error</p>
        <p className="text-sm text-[#52525B] mt-1">{String(result.summary.error)}</p>
      </div>
    )
  }

  const primaryTables = result.tables.filter(t => !t.advanced)
  const advancedTables = result.tables.filter(t => t.advanced)
  const exportTitle = title ?? `${analysisType} results`

  return (
    <div className="space-y-6">
      {/* Summary */}
      <SummaryBox analysisType={analysisType} summary={result.summary} title={title} datasetName={datasetName} />

      {/* Interpretation */}
      {(result.plainLanguage || result.interpretation) && (
        <InterpretationBox plainLanguage={result.plainLanguage} text={result.interpretation} />
      )}

      {/* Charts */}
      {result.charts.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="h-4 w-4 text-[#0052CC]" />
            <h3 className="font-manrope font-bold text-sm text-[#18181B]">Visualizations</h3>
            <span className="text-xs text-[#A1A1AA]">{result.charts.length} chart{result.charts.length > 1 ? 's' : ''}</span>
          </div>
          <AnalysisCharts charts={result.charts as Parameters<typeof AnalysisCharts>[0]['charts']} />
        </section>
      )}

      {/* Primary Tables */}
      {primaryTables.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Table2 className="h-4 w-4 text-[#0052CC]" />
            <h3 className="font-manrope font-bold text-sm text-[#18181B]">Results Tables</h3>
            <span className="text-xs text-[#A1A1AA]">{primaryTables.length} table{primaryTables.length > 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-4">
            {primaryTables.map(table => (
              <div key={table.id} className="bg-white border border-[#E4E4E7] rounded-lg p-5">
                <CoefficientTable table={table} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Advanced Statistics */}
      {advancedTables.length > 0 && (
        <div className="bg-white border border-[#E4E4E7] rounded-lg overflow-hidden">
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#F5F5F5] transition-colors duration-150"
          >
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-[#A1A1AA]" />
              <span className="text-sm font-medium text-[#52525B]">
                Advanced Statistics ({advancedTables.length} table{advancedTables.length > 1 ? 's' : ''})
              </span>
            </div>
            {showAdvanced
              ? <ChevronUp className="h-4 w-4 text-[#A1A1AA]" />
              : <ChevronDown className="h-4 w-4 text-[#A1A1AA]" />}
          </button>
          {showAdvanced && (
            <div className="px-5 pb-5 space-y-4 border-t border-[#F0F0F0] pt-4">
              {advancedTables.map(table => (
                <CoefficientTable key={table.id} table={table} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-[#E4E4E7]">
        <ResultsActions onSave={onSave} saved={isSaved} />
        <button
          onClick={() => exportToWord(result, exportTitle)}
          className="inline-flex items-center gap-2 text-xs font-medium text-[#52525B] hover:text-[#18181B] border border-[#E4E4E7] rounded-lg px-4 py-2 hover:bg-[#F5F5F5] transition-all duration-150"
        >
          <FileText className="h-3.5 w-3.5" />
          Export to Word
        </button>
      </div>
    </div>
  )
}
