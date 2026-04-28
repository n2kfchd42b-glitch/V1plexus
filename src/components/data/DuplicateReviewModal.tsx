'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  AlertTriangle, CheckCircle, Loader2, Download, ChevronLeft,
  ChevronRight, Copy, X,
} from 'lucide-react'
import {
  detectDuplicates, applyDuplicateResolutions,
  type DuplicateReport, type DuplicateAction, type DuplicateResolution,
} from '@/lib/data/operations'
import { saveCleanedVersion } from '@/lib/data/storage'
import { auditDuplicateResolution } from '@/lib/audit/auditHelpers'
import { JustificationModal } from '@/components/dataset-hub/JustificationModal'
import type { JustificationCategory } from '@/types/audit'
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
  inline?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIONS: { value: DuplicateAction; label: string; description: string }[] = [
  { value: 'keep_first', label: 'Keep First',  description: 'Remove all but the first occurrence' },
  { value: 'keep_last',  label: 'Keep Last',   description: 'Remove all but the last occurrence'  },
  { value: 'keep_all',   label: 'Keep All',    description: 'Retain all — treat as longitudinal'  },
  { value: 'renumber',   label: 'Renumber',    description: 'Keep all with a unique suffix added'  },
]

function downloadCSV(report: DuplicateReport, rows: DataRow[]) {
  const allCols = rows.length > 0 ? Object.keys(rows[0]) : []
  const lines = [['duplicate_id_value', 'row_in_group', 'diff_columns', ...allCols].join(',')]
  for (const group of report.duplicateGroups) {
    for (let i = 0; i < group.rows.length; i++) {
      const r = group.rows[i]
      const cells = allCols.map(c => {
        const v = String(r.data[c] ?? '')
        return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
      })
      lines.push([group.idValue, String(i + 1), `"${group.diffColumns.join('; ')}"`, ...cells].join(','))
    }
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  Object.assign(document.createElement('a'), { href: url, download: 'duplicate_report.csv' }).click()
  URL.revokeObjectURL(url)
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DuplicateReviewModal({
  rows, columns, datasetId, projectId, version, branchName,
  createdBy, onClose, onVersionSaved, inline,
}: DuplicateReviewModalProps) {
  const allColNames = columns.map(c => c.name)
  const [idColumnOverride, setIdColumnOverride] = useState('')
  const [index, setIndex]                       = useState(0)
  const [resolutions, setResolutions]           = useState<Map<string, DuplicateResolution>>(new Map())
  const [defaultAction, setDefaultAction]       = useState<DuplicateAction>('keep_first')
  const [renumberSuffix, setRenumberSuffix]     = useState('_')
  const [showAll, setShowAll]                   = useState(false)
  const [commitMessage, setCommitMessage]       = useState('Resolve duplicate records')
  const [saving, setSaving]                     = useState(false)
  const [saveError, setSaveError]               = useState<string | null>(null)
  const [showJustification, setShowJustification] = useState(false)

  const report = useMemo(
    () => detectDuplicates(rows, idColumnOverride || undefined),
    [rows, idColumnOverride]
  )

  const groups   = report.duplicateGroups
  const total    = groups.length
  const safeIdx  = Math.min(index, Math.max(0, total - 1))
  const group    = groups[safeIdx] ?? null
  const resolved = useMemo(() => [...resolutions.keys()].filter(k => groups.some(g => g.idValue === k)).length, [resolutions, groups])

  const action   = group ? (resolutions.get(group.idValue)?.action ?? defaultAction) : defaultAction
  const reason   = group ? (resolutions.get(group.idValue)?.reason ?? '') : ''

  const setResolution = useCallback((act: DuplicateAction, rsn: string) => {
    if (!group) return
    setResolutions(prev => new Map(prev).set(group.idValue, { action: act, reason: rsn }))
  }, [group])

  const applyAll = (act: DuplicateAction) => {
    setDefaultAction(act)
    const next = new Map<string, DuplicateResolution>()
    for (const g of groups) next.set(g.idValue, { action: act, reason: resolutions.get(g.idValue)?.reason })
    setResolutions(next)
  }

  const previewCount = useMemo(() => {
    let removed = 0
    for (const g of groups) {
      const a = resolutions.get(g.idValue)?.action ?? defaultAction
      if (a === 'keep_first' || a === 'keep_last') removed += g.rows.length - 1
    }
    return removed
  }, [groups, resolutions, defaultAction])

  const handleJustificationConfirm = async ({ text, category }: { text: string; category: JustificationCategory }) => {
    setShowJustification(false)
    setSaving(true)
    setSaveError(null)
    try {
      const cleanedRows = applyDuplicateResolutions(rows, report, resolutions, defaultAction, renumberSuffix)
      const { versionId } = await saveCleanedVersion({
        datasetId, projectId,
        parentVersionId: version.id,
        parentVersionNumber: version.version_number,
        branchName, commitMessage: commitMessage.trim(),
        rows: cleanedRows, columns,
        operations: [{ type: 'remove_duplicates', columns: [report.idColumn] }],
        createdBy,
      })
      auditDuplicateResolution(
        { userId: createdBy, projectId },
        {
          versionId, versionNumber: version.version_number + 1,
          parentVersionNumber: version.version_number,
          idColumn: report.idColumn, rowsBefore: rows.length,
          rowsAfter: cleanedRows.length, rowsRemoved: rows.length - cleanedRows.length,
          justification: text,
        }
      ).catch(err => console.error('[audit]', err))
      fetch('/api/analytics/portrait/trigger', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetId, projectId, versionId }),
      }).catch(() => {})
      onVersionSaved(versionId)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Diff fields vs identical fields ────────────────────────────────────────
  const diffCols = group?.diffColumns ?? []
  const allCols  = group ? Object.keys(group.rows[0].data) : []
  const sameCols = allCols.filter(c => !diffCols.includes(c))
  const visibleSameCols = showAll ? sameCols : sameCols.slice(0, 3)

  const wrapper = inline
    ? 'flex flex-col h-full overflow-hidden bg-[var(--bg-app)]'
    : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm'

  const inner = inline
    ? 'flex flex-col h-full w-full overflow-hidden'
    : 'bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden'

  return (
    <>
      <JustificationModal
        isOpen={showJustification}
        onClose={() => setShowJustification(false)}
        operation={{
          type: 'Resolve duplicate records',
          impact: `${previewCount} rows will be removed · ${rows.length - previewCount} rows retained`,
        }}
        onConfirm={handleJustificationConfirm}
      />

      <div className={wrapper}>
        <div className={inner}>

          {/* ── Header strip ───────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border-default)] bg-[var(--bg-surface)] flex-shrink-0">
            <Copy className="h-4 w-4 text-[var(--status-warning)] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {total} duplicate group{total !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-[var(--text-tertiary)] ml-2">
                {report.totalAffectedRows} affected rows · {report.percentAffected.toFixed(1)}%
              </span>
            </div>

            {/* ID column selector — tucked right */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide font-semibold hidden sm:block">ID:</span>
              <select
                value={idColumnOverride || report.idColumn}
                onChange={e => { setIdColumnOverride(e.target.value); setIndex(0) }}
                className="h-7 px-2 bg-[var(--bg-inset)] border-none rounded-md text-xs font-mono text-[var(--accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
              >
                {allColNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <button
              onClick={() => downloadCSV(report, rows)}
              className="h-7 flex items-center gap-1.5 px-2.5 rounded-md bg-[var(--bg-inset)] text-[10px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-active)] transition-colors flex-shrink-0"
            >
              <Download className="h-3 w-3" />
              Export
            </button>

            {!inline && (
              <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-surface-hover)] transition-colors flex-shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* ── Progress bar ───────────────────────────────────────────────── */}
          {total > 0 && (
            <div className="flex items-center gap-3 px-5 py-2.5 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex-shrink-0">
              <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-inset)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--accent-blue)] transition-all duration-300"
                  style={{ width: `${total > 0 ? (resolved / total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums flex-shrink-0">
                {resolved} of {total} reviewed
              </span>
            </div>
          )}

          {/* ── Body ───────────────────────────────────────────────────────── */}
          <div className="flex-1 min-h-0 overflow-y-auto">

            {total === 0 ? (
              /* All clear */
              <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
                <CheckCircle className="h-10 w-10 text-[var(--status-success)]" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">No duplicates found</p>
                <p className="text-xs text-[var(--text-tertiary)]">Try selecting a different ID column above</p>
              </div>
            ) : group && (
              <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

                {/* Group identity + navigation */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">Duplicate ID</p>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xl font-bold text-[var(--text-primary)]">{group.idValue}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border border-[var(--border-status-warning)]">
                        {group.rows.length} records
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => { setIndex(i => Math.max(0, i - 1)); setShowAll(false) }}
                      disabled={safeIdx === 0}
                      className="h-8 w-8 flex items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs text-[var(--text-tertiary)] tabular-nums w-12 text-center">{safeIdx + 1} / {total}</span>
                    <button
                      onClick={() => { setIndex(i => Math.min(total - 1, i + 1)); setShowAll(false) }}
                      disabled={safeIdx === total - 1}
                      className="h-8 w-8 flex items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Comparison table */}
                <div className="rounded-xl border border-[var(--border-default)] overflow-hidden bg-[var(--bg-surface)]">

                  {/* Column headers */}
                  <div className="grid border-b border-[var(--border-default)] bg-[var(--bg-app)]" style={{ gridTemplateColumns: `10rem repeat(${group.rows.length}, 1fr)` }}>
                    <div className="px-4 py-2.5 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Field</div>
                    {group.rows.map((_, i) => (
                      <div key={i} className="px-4 py-2.5 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
                        Record {i + 1}
                        {(action === 'keep_first' && i === 0) || (action === 'keep_last' && i === group.rows.length - 1) || action === 'keep_all' || action === 'renumber'
                          ? <span className="ml-1.5 normal-case font-medium text-[var(--status-success-text)]">✓</span>
                          : <span className="ml-1.5 normal-case font-medium text-[var(--status-error-text)]">✕</span>
                        }
                      </div>
                    ))}
                  </div>

                  {/* Differing fields — always shown, highlighted */}
                  {diffCols.length > 0 ? (
                    <>
                      <div className="px-4 py-1.5 bg-[var(--status-warning-bg)] border-b border-[var(--border-status-warning)]">
                        <span className="text-[10px] font-semibold text-[var(--status-warning-text)] uppercase tracking-wide">
                          {diffCols.length} field{diffCols.length !== 1 ? 's' : ''} differ
                        </span>
                      </div>
                      {diffCols.map(col => {
                        const vals = group.rows.map(r => r.data[col])
                        return (
                          <div
                            key={col}
                            className="grid items-center border-b border-[var(--border-row)] bg-[var(--status-warning-bg)]/40"
                            style={{ gridTemplateColumns: `10rem repeat(${group.rows.length}, 1fr)` }}
                          >
                            <div className="px-4 py-3 flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-warning)] flex-shrink-0" />
                              <span className="font-mono text-[11px] font-semibold text-[var(--status-warning-text)] truncate">{col}</span>
                            </div>
                            {vals.map((v, i) => (
                              <div key={i} className="px-4 py-3">
                                {v === null || v === undefined || v === ''
                                  ? <span className="text-xs text-[var(--text-tertiary)] italic">null</span>
                                  : <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">{String(v)}</span>
                                }
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </>
                  ) : (
                    <div className="px-4 py-3 bg-[var(--bg-app)] border-b border-[var(--border-subtle)]">
                      <span className="text-[10px] text-[var(--text-tertiary)]">All fields are identical across these records</span>
                    </div>
                  )}

                  {/* Identical fields — collapsed by default */}
                  {sameCols.length > 0 && (
                    <>
                      {visibleSameCols.map(col => {
                        const vals = group.rows.map(r => r.data[col])
                        return (
                          <div
                            key={col}
                            className="grid items-center border-b border-[var(--border-row)] last:border-b-0"
                            style={{ gridTemplateColumns: `10rem repeat(${group.rows.length}, 1fr)` }}
                          >
                            <div className="px-4 py-2.5">
                              <span className="font-mono text-[11px] text-[var(--text-tertiary)] truncate block">{col}</span>
                            </div>
                            {vals.map((v, i) => (
                              <div key={i} className="px-4 py-2.5">
                                {v === null || v === undefined || v === ''
                                  ? <span className="text-xs text-[var(--text-tertiary)] italic">null</span>
                                  : <span className="font-mono text-xs text-[var(--text-secondary)]">{String(v)}</span>
                                }
                              </div>
                            ))}
                          </div>
                        )
                      })}
                      {sameCols.length > 3 && (
                        <button
                          onClick={() => setShowAll(v => !v)}
                          className="w-full px-4 py-2 text-[11px] font-medium text-[var(--accent-blue)] hover:bg-[var(--bg-surface-hover)] transition-colors text-left"
                        >
                          {showAll ? '↑ Collapse identical fields' : `↓ Show ${sameCols.length - 3} more identical fields`}
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Action picker */}
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">What should we do with these records?</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ACTIONS.map(a => (
                      <button
                        key={a.value}
                        onClick={() => setResolution(a.value, reason)}
                        className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl border transition-all text-left ${
                          action === a.value
                            ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-subtle)] text-[var(--accent-blue)]'
                            : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]'
                        }`}
                      >
                        <span className="text-xs font-semibold leading-none">{a.label}</span>
                        <span className={`text-[10px] leading-snug mt-0.5 ${action === a.value ? 'text-[var(--accent-blue)]/70' : 'text-[var(--text-tertiary)]'}`}>
                          {a.description}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Suffix input — only when renumber */}
                  {action === 'renumber' && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] text-[var(--text-tertiary)] font-semibold uppercase tracking-wide">Suffix pattern:</span>
                      <select
                        value={renumberSuffix}
                        onChange={e => setRenumberSuffix(e.target.value)}
                        className="h-7 px-2 bg-[var(--bg-inset)] border-none rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                      >
                        <option value="_">_1, _2, _3</option>
                        <option value="_visit">_visit1, _visit2</option>
                        <option value="_dup">_dup1, _dup2</option>
                        <option value="_obs">_obs1, _obs2</option>
                      </select>
                    </div>
                  )}

                  {/* Audit note */}
                  <input
                    value={reason}
                    onChange={e => setResolution(action, e.target.value)}
                    placeholder="Audit note (optional)…"
                    className="w-full h-8 px-3 bg-[var(--bg-inset)] border-none rounded-md text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                  />
                </div>

                {/* Apply-all shortcut */}
                <div className="flex items-center gap-2 pt-1 pb-2">
                  <span className="text-[10px] text-[var(--text-tertiary)]">Apply this action to all groups:</span>
                  <button
                    onClick={() => applyAll(action)}
                    className="text-[10px] font-semibold text-[var(--accent-blue)] hover:underline"
                  >
                    Set all to "{ACTIONS.find(a => a.value === action)?.label}"
                  </button>
                </div>

              </div>
            )}
          </div>

          {/* ── Footer ─────────────────────────────────────────────────────── */}
          {total > 0 && (
            <div className="flex-shrink-0 border-t border-[var(--border-default)] bg-[var(--bg-surface)] px-5 py-3">
              {saveError && (
                <p className="text-xs text-[var(--status-error)] mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />{saveError}
                </p>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                {previewCount > 0 && (
                  <span className="text-xs text-[var(--text-secondary)]">
                    <span className="font-semibold text-[var(--status-error-text)]">{previewCount}</span> row{previewCount !== 1 ? 's' : ''} removed
                    · <span className="font-semibold text-[var(--status-success-text)]">{rows.length - previewCount}</span> remain
                  </span>
                )}
                <input
                  value={commitMessage}
                  onChange={e => setCommitMessage(e.target.value)}
                  placeholder="Commit message…"
                  className="flex-1 min-w-[160px] h-8 px-3 bg-[var(--bg-inset)] border-none rounded-md text-xs placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                />
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={onClose}
                    className="h-8 px-3 rounded-md text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowJustification(true)}
                    disabled={saving || !commitMessage.trim()}
                    className="h-8 px-4 rounded-md text-xs font-semibold text-white bg-[var(--accent-blue)] hover:bg-[var(--accent-blue-hover)] disabled:opacity-40 transition-colors flex items-center gap-1.5"
                  >
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Apply &amp; Save
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
