"use client"

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { ChevronDown, X } from 'lucide-react'
import type { AnalysisResult } from '@/lib/analysis/types'
import type { AnalysisType } from '@/types/database'
import { useLocale } from '@/i18n/LocaleProvider'
import { getKeyFindings } from './keyFindings'

const AnalysisCharts = dynamic(() => import('./AnalysisCharts').then(m => ({ default: m.AnalysisCharts })))

export interface CanvasBlock {
  id: string
  analysisType: AnalysisType
  title: string
  result: AnalysisResult
  createdAt: number
}

interface Props {
  block: CanvasBlock
  onRemove: (id: string) => void
  defaultExpanded?: boolean
}

// One result on the append-only canvas: collapsible, removable, self-contained.
// Renders the same charts / key-finding chips / interpretation / tables the hub
// used to show for the single active result, but scoped to its own block so any
// number of results can stack.
export function ResultBlock({ block, onRemove, defaultExpanded = true }: Props) {
  const { t } = useLocale()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [tab, setTab] = useState<'results' | 'tables'>('results')

  const { result, analysisType, title, createdAt } = block
  const isError = !!result.summary?.error
  const findings = isError ? [] : getKeyFindings(result, analysisType)
  const time = new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-xs)' }}
    >
      {/* Block header */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: expanded ? '1px solid var(--border-row)' : 'none' }}>
        <button
          onClick={() => setExpanded(e => !e)}
          className="h-5 w-5 flex items-center justify-center rounded flex-shrink-0 transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? '' : '-rotate-90'}`} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{title}</p>
        </div>
        {isError && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ background: 'var(--status-error-bg)', color: 'var(--status-error-text)' }}>
            failed
          </span>
        )}
        <span className="data-mono-xs flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{time}</span>
        <button
          onClick={() => onRemove(block.id)}
          className="h-5 w-5 flex items-center justify-center rounded flex-shrink-0 transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-row-hover)'; e.currentTarget.style.color = 'var(--status-error-text)' }}
          onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-tertiary)' }}
          aria-label="Remove result"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        isError ? (
          <div className="px-4 py-3">
            <p className="text-xs leading-relaxed" style={{ color: 'var(--status-error-text)' }}>
              {String(result.summary.error)}
            </p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex items-center gap-0 px-4" style={{ borderBottom: '1px solid var(--border-row)' }}>
              {(['results', 'tables'] as const).map(tb => (
                <button
                  key={tb}
                  onClick={() => setTab(tb)}
                  className="relative px-3 py-2 text-xs font-medium transition-colors"
                  style={{ color: tab === tb ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}
                >
                  {tb === 'results' ? t('analysis.resultsTab') : t('analysis.tablesTab')}
                  {tab === tb && <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-t-sm" style={{ background: 'var(--accent-blue)' }} />}
                </button>
              ))}
            </div>

            {tab === 'results' ? (
              <div className="px-5 py-4 space-y-5">
                {(result.charts ?? []).length > 0 && (
                  <AnalysisCharts charts={result.charts as never} analysisType={analysisType} />
                )}

                {findings.length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-3 border-b border-[var(--border-row)]">
                    {findings.map((f, i) => {
                      const isComplete = i === findings.length - 1 && f.label.toLowerCase().includes('complet')
                      const isMissing = f.label.toLowerCase().includes('miss')
                      const chipStyle = isComplete
                        ? { background: 'var(--accent-blue-subtle)', border: '1px solid var(--border-status-info)', color: 'var(--status-info-text)' }
                        : isMissing
                        ? { background: 'var(--status-warning-bg)', border: '1px solid var(--border-status-warning)', color: 'var(--status-warning-text)' }
                        : { background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }
                      return (
                        <div key={f.label} className="flex flex-col px-3 py-2 rounded-lg" style={chipStyle}>
                          <span className="text-[9px] uppercase tracking-[0.08em] mb-0.5" style={{ opacity: 0.7 }}>{f.label}</span>
                          <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{f.value}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {result.interpretation && (
                  <div className="px-4 py-3 rounded-lg bg-[var(--bg-row-hover)] border border-[var(--border-row)]">
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5 font-semibold">{t('analysis.interpretation')}</p>
                    <p className="text-sm text-[var(--text-primary)] leading-relaxed">{result.interpretation}</p>
                  </div>
                )}

                {(result as { plainLanguage?: string }).plainLanguage && (
                  <div className="px-4 py-3 rounded-lg border border-[var(--accent-blue)]/15 bg-blue-50/40">
                    <p className="text-[10px] text-[var(--accent-blue)] uppercase tracking-wider mb-1.5 font-semibold">{t('analysis.plainLanguage')}</p>
                    <p className="text-sm text-[var(--text-primary)] leading-relaxed">{(result as { plainLanguage?: string }).plainLanguage}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="px-5 py-4 space-y-6">
                {(result.tables ?? []).length === 0 ? (
                  <p className="text-xs text-[var(--text-tertiary)] text-center py-8">{t('analysis.noTables')}</p>
                ) : (result.tables ?? []).map((table, i) => (
                  <div key={i}>
                    <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">{table.title}</p>
                    <div className="overflow-x-auto rounded-lg border border-[var(--border-row)]">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[var(--bg-row-hover)]">
                            {table.headers.map((h, j) => (
                              <th key={j} className="px-3 py-2 text-left font-semibold text-[var(--text-secondary)] whitespace-nowrap border-b border-[var(--border-row)]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows.map((row, j) => {
                            const isContinuation = (table.id === 'categorical_summary' || table.id === 'table1_categorical') && row[0] === ''
                            return (
                              <tr key={j} className={`border-b border-[var(--border-row)] last:border-0 transition-colors ${isContinuation ? '' : 'hover:bg-[var(--bg-row-hover)]'}`}
                                style={isContinuation ? { background: 'var(--bg-app)' } : undefined}
                              >
                                {row.map((cell, k) => (
                                  <td key={k} className={`px-3 py-2 whitespace-nowrap font-mono ${isContinuation && k === 0 ? '' : 'text-[var(--text-primary)]'} ${isContinuation && k === 1 ? 'text-[var(--text-secondary)]' : ''}`}>
                                    {cell === null ? <span className="text-[var(--text-tertiary)]">—</span> : cell === '' ? '' : String(cell)}
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
        )
      )}
    </div>
  )
}
