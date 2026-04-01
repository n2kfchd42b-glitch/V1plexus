'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  X, Copy, ChevronDown, ChevronRight, AlertTriangle,
  CheckCircle, Loader2, Download, Info,
} from 'lucide-react'
import {
  detectDuplicates, applyDuplicateResolutions,
  type DuplicateReport, type DuplicateAction, type DuplicateResolution,
} from '@/lib/data/operations'
import { saveCleanedVersion } from '@/lib/data/storage'
import type { DataRow, ColumnSchema, DatasetVersion } from '@/types/database'

// ─── Props ────────────────────────────────────────────────────────────────────

interface DuplicateReviewModalProps {
  rows: DataRow[]
  columns: ColumnSchema[]
  datasetId: string
  projectId: string
  version: DatasetVersion
  branchName: string
  createdBy: string
  onClose: () => void
  onVersionSaved: (newVersionId: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<DuplicateAction, string> = {
  keep_first:  'Keep First',
  keep_last:   'Keep Last',
  renumber:    'Renumber',
  keep_all:    'Keep All (Longitudinal)',
}

const SUFFIX_OPTIONS = [
  { label: '_1, _2, _3 …',         value: '_' },
  { label: '_visit1, _visit2 …',    value: '_visit' },
  { label: '_dup1, _dup2 …',        value: '_dup' },
  { label: '_a, _b, _c …',          value: '_' }, // handled specially
]

function downloadCSV(report: DuplicateReport, rows: DataRow[]) {
  const lines: string[] = []
  const allCols = rows.length > 0 ? Object.keys(rows[0]) : []

  lines.push(['duplicate_id_value', 'row_number_in_group', 'diff_columns', ...allCols].join(','))

  for (const group of report.duplicateGroups) {
    for (let i = 0; i < group.rows.length; i++) {
      const r = group.rows[i]
      const diffNote = group.diffColumns.join('; ')
      const cells = allCols.map(c => {
        const v = String(r.data[c] ?? '')
        return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
      })
      lines.push([group.idValue, String(i + 1), `"${diffNote}"`, ...cells].join(','))
    }
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'duplicate_report.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Group Row — side-by-side diff table ──────────────────────────────────────

function DuplicateGroupRow({
  group,
  resolution,
  onResolutionChange,
  maxCols = 8,
}: {
  group: DuplicateReport['duplicateGroups'][0]
  resolution: DuplicateResolution | undefined
  onResolutionChange: (idValue: string, res: DuplicateResolution) => void
  maxCols?: number
}) {
  const [expanded, setExpanded] = useState(true)
  const [reason, setReason] = useState(resolution?.reason ?? '')

  const action = resolution?.action ?? 'keep_first'
  const allCols = Object.keys(group.rows[0].data)
  const visibleCols = allCols.slice(0, maxCols)
  const diffSet = new Set(group.diffColumns)

  function setAction(a: DuplicateAction) {
    onResolutionChange(group.idValue, { action: a, reason })
  }

  function setReasonVal(r: string) {
    setReason(r)
    onResolutionChange(group.idValue, { action, reason: r })
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Group header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
        <span className="font-mono text-sm font-bold text-[#003d9b]">{group.idValue}</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
          {group.rows.length} records
        </span>
        {group.diffColumns.length > 0 && (
          <span className="text-[10px] text-slate-400">
            {group.diffColumns.length} field{group.diffColumns.length !== 1 ? 's' : ''} differ
          </span>
        )}
        <div className="ml-auto shrink-0">
          <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
            action === 'keep_first'  ? 'bg-blue-100 text-blue-700'   :
            action === 'keep_last'   ? 'bg-blue-100 text-blue-700'   :
            action === 'renumber'    ? 'bg-emerald-100 text-emerald-700' :
                                       'bg-purple-100 text-purple-700'
          }`}>
            {ACTION_LABELS[action]}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Side-by-side diff table */}
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 w-28 shrink-0">
                    Field
                  </th>
                  {group.rows.map((_, i) => (
                    <th key={i} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                      Record {i + 1}
                      {action === 'keep_first' && i === 0 && (
                        <span className="ml-1.5 text-emerald-600 normal-case font-normal">(kept)</span>
                      )}
                      {action === 'keep_last' && i === group.rows.length - 1 && (
                        <span className="ml-1.5 text-emerald-600 normal-case font-normal">(kept)</span>
                      )}
                      {(action === 'keep_first' && i > 0) || (action === 'keep_last' && i < group.rows.length - 1) ? (
                        <span className="ml-1.5 text-red-400 normal-case font-normal">(removed)</span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleCols.map(col => {
                  const isDiff = diffSet.has(col)
                  const vals = group.rows.map(r => String(r.data[col] ?? ''))
                  return (
                    <tr key={col} className={`border-b border-slate-50 ${isDiff ? 'bg-amber-50/60' : ''}`}>
                      <td className={`px-3 py-2 font-mono text-[11px] font-semibold truncate max-w-[7rem] ${isDiff ? 'text-amber-700' : 'text-slate-500'}`}>
                        {isDiff && <span className="mr-1 text-amber-500">●</span>}
                        {col}
                      </td>
                      {vals.map((v, i) => (
                        <td key={i} className={`px-3 py-2 font-mono text-[11px] max-w-[10rem] truncate ${isDiff ? 'text-amber-900 font-semibold' : 'text-slate-700'}`}>
                          {v || <span className="text-slate-300 italic">null</span>}
                        </td>
                      ))}
                    </tr>
                  )
                })}
                {allCols.length > maxCols && (
                  <tr>
                    <td colSpan={group.rows.length + 1} className="px-3 py-2 text-[10px] text-slate-400 italic">
                      + {allCols.length - maxCols} more fields
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Group-level controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Action:</span>
              {(['keep_first', 'keep_last', 'renumber', 'keep_all'] as DuplicateAction[]).map(a => (
                <button
                  key={a}
                  onClick={() => setAction(a)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    action === a
                      ? 'bg-[#003d9b] text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {ACTION_LABELS[a]}
                </button>
              ))}
            </div>
            <div className="flex-1 min-w-[160px]">
              <input
                value={reason}
                onChange={e => setReasonVal(e.target.value)}
                placeholder="Audit note (optional)…"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#003d9b]/20"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function DuplicateReviewModal({
  rows, columns, datasetId, projectId, version, branchName, createdBy, onClose, onVersionSaved,
}: DuplicateReviewModalProps) {
  const allColNames = columns.map(c => c.name)
  const [idColumnOverride, setIdColumnOverride]     = useState<string>('')
  const [activeTab, setActiveTab]                   = useState<'exact' | 'near'>('exact')
  const [resolutions, setResolutions]               = useState<Map<string, DuplicateResolution>>(new Map())
  const [defaultAction, setDefaultAction]           = useState<DuplicateAction>('keep_first')
  const [renumberSuffix, setRenumberSuffix]         = useState('_')
  const [commitMessage, setCommitMessage]           = useState('Resolve duplicate records')
  const [saving, setSaving]                         = useState(false)
  const [saveError, setSaveError]                   = useState<string | null>(null)

  const report = useMemo(
    () => detectDuplicates(rows, idColumnOverride || undefined),
    [rows, idColumnOverride]
  )

  const handleResolutionChange = useCallback((idValue: string, res: DuplicateResolution) => {
    setResolutions(prev => new Map(prev).set(idValue, res))
  }, [])

  const setAllAction = (action: DuplicateAction) => {
    setDefaultAction(action)
    const next = new Map<string, DuplicateResolution>()
    for (const group of report.duplicateGroups) {
      next.set(group.idValue, { action, reason: resolutions.get(group.idValue)?.reason })
    }
    setResolutions(next)
  }

  const previewCount = useMemo(() => {
    let removed = 0
    for (const group of report.duplicateGroups) {
      const action = resolutions.get(group.idValue)?.action ?? defaultAction
      if (action === 'keep_first' || action === 'keep_last') removed += group.rows.length - 1
    }
    return removed
  }, [report, resolutions, defaultAction])

  const handleApply = async () => {
    if (!commitMessage.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      const cleanedRows = applyDuplicateResolutions(rows, report, resolutions, defaultAction, renumberSuffix)
      await saveCleanedVersion({
        datasetId,
        projectId,
        parentVersionId: version.id,
        parentVersionNumber: version.version_number,
        branchName,
        commitMessage: commitMessage.trim(),
        rows: cleanedRows,
        columns,
        operations: [{ type: 'remove_duplicates', columns: [report.idColumn] }],
        createdBy,
      }).then(({ versionId }) => onVersionSaved(versionId))
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-50 rounded-xl mt-0.5">
              <Copy className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-manrope font-bold text-xl text-[#191c1e]">Duplicate Records</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {report.duplicateGroups.length} duplicate ID{report.duplicateGroups.length !== 1 ? 's' : ''} found across{' '}
                <span className="font-semibold text-amber-600">{report.totalAffectedRows} records</span>{' '}
                ({report.percentAffected.toFixed(1)}% of dataset)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Controls bar ── */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-center gap-4 shrink-0">
          {/* ID column selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ID Column:</span>
            <select
              value={idColumnOverride || report.idColumn}
              onChange={e => setIdColumnOverride(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-semibold text-[#003d9b] focus:outline-none focus:ring-2 focus:ring-[#003d9b]/20"
            >
              {allColNames.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Bulk actions */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Apply all:</span>
            {(['keep_first', 'keep_last', 'renumber', 'keep_all'] as DuplicateAction[]).map(a => (
              <button
                key={a}
                onClick={() => setAllAction(a)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                  defaultAction === a
                    ? 'bg-[#003d9b] text-white'
                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}
              >
                {ACTION_LABELS[a]}
              </button>
            ))}
          </div>

          {/* Renumber suffix */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Suffix:</span>
            <select
              value={renumberSuffix}
              onChange={e => setRenumberSuffix(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#003d9b]/20"
            >
              <option value="_">_1, _2, _3</option>
              <option value="_visit">_visit1, _visit2</option>
              <option value="_dup">_dup1, _dup2</option>
              <option value="_obs">_obs1, _obs2</option>
            </select>
          </div>

          <button
            onClick={() => downloadCSV(report, rows)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Download className="h-3 w-3" />
            Download Report
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-0 border-b border-slate-100 px-6 shrink-0">
          <button
            onClick={() => setActiveTab('exact')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'exact'
                ? 'border-[#003d9b] text-[#003d9b]'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            Exact Duplicates
            <span className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 font-mono">
              {report.duplicateGroups.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('near')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'near'
                ? 'border-[#003d9b] text-[#003d9b]'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            Near Duplicates
            <span className="text-[10px] bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5 font-mono">
              {report.nearDuplicateGroups.length}
            </span>
          </button>
        </div>

        {/* ── Scrollable group list ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3 min-h-0">

          {activeTab === 'exact' && (
            <>
              {report.duplicateGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <CheckCircle className="h-10 w-10 text-emerald-400 mb-3" />
                  <p className="font-semibold text-slate-600">No exact duplicates for this ID column</p>
                  <p className="text-xs text-slate-400 mt-1">Try selecting a different ID column above</p>
                </div>
              ) : (
                report.duplicateGroups.map(group => (
                  <DuplicateGroupRow
                    key={group.idValue}
                    group={group}
                    resolution={resolutions.get(group.idValue)}
                    onResolutionChange={handleResolutionChange}
                  />
                ))
              )}
            </>
          )}

          {activeTab === 'near' && (
            <>
              {report.nearDuplicateGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <CheckCircle className="h-10 w-10 text-emerald-400 mb-3" />
                  <p className="font-semibold text-slate-600">No near-duplicate IDs detected</p>
                  <p className="text-xs text-slate-400 mt-1">IDs with edit distance ≤ 2 would appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      These IDs differ by ≤ 2 characters and may be typos of the same record.
                      Review them and correct the source data if needed — near-duplicates cannot be auto-resolved here.
                    </span>
                  </div>
                  {report.nearDuplicateGroups.map((ng, i) => (
                    <div key={i} className="border border-blue-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 bg-blue-50 flex items-center gap-3">
                        <AlertTriangle className="h-4 w-4 text-blue-500 shrink-0" />
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-blue-800">{ng.ids[0]}</span>
                          <span className="text-slate-400 text-xs">↔</span>
                          <span className="font-mono text-sm font-bold text-blue-800">{ng.ids[1]}</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                          {Math.round(ng.similarity * 100)}% similar · edit distance {ng.editDistance}
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase bg-slate-50">Field</th>
                              {ng.rows.map((r, j) => (
                                <th key={j} className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase bg-slate-50">
                                  {r.idValue}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Object.keys(ng.rows[0].data).slice(0, 8).map(col => {
                              const vals = ng.rows.map(r => String(r.data[col] ?? ''))
                              const isDiff = new Set(vals).size > 1
                              return (
                                <tr key={col} className={`border-b border-slate-50 ${isDiff ? 'bg-amber-50/60' : ''}`}>
                                  <td className={`px-3 py-2 font-mono text-[11px] font-semibold ${isDiff ? 'text-amber-700' : 'text-slate-500'}`}>
                                    {isDiff && <span className="mr-1 text-amber-500">●</span>}{col}
                                  </td>
                                  {vals.map((v, j) => (
                                    <td key={j} className={`px-3 py-2 font-mono text-[11px] ${isDiff ? 'font-semibold text-amber-900' : 'text-slate-700'}`}>
                                      {v || <span className="text-slate-300 italic">null</span>}
                                    </td>
                                  ))}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
          {saveError && (
            <p className="text-xs text-red-600 mb-3 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />{saveError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {/* Preview stat */}
            {activeTab === 'exact' && previewCount > 0 && (
              <div className="text-xs text-slate-500">
                <span className="font-bold text-red-500">{previewCount} row{previewCount !== 1 ? 's' : ''}</span> will be removed
                · <span className="font-bold text-emerald-600">{rows.length - previewCount}</span> rows remain
              </div>
            )}

            <div className="flex-1 min-w-[200px]">
              <input
                value={commitMessage}
                onChange={e => setCommitMessage(e.target.value)}
                placeholder="Version commit message…"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#003d9b]/20"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={saving || !commitMessage.trim() || report.duplicateGroups.length === 0}
                className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-[#003d9b] hover:bg-[#0052cc] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Apply &amp; Save Version
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
