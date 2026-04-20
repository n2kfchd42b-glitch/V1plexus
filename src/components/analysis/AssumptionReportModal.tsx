"use client"

import React, { useState, useCallback } from 'react'
import {
  X,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Shield,
  FileText,
  MessageSquare,
  ClipboardList,
} from 'lucide-react'
import type {
  PostAnalysisReport,
  PostAnalysisAssumptionIssue,
  SensitivityScenario,
  DesignGuidanceItem,
} from '@/types/analysisIntegrity'

// ─── Tab definition ──────────────────────────────────────────────────────────

type Tab = 'issues' | 'sensitivity' | 'reporting' | 'review'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'issues',      label: 'Issues',      icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  { id: 'sensitivity', label: 'Sensitivity', icon: <Shield className="h-3.5 w-3.5" /> },
  { id: 'reporting',   label: 'Reporting',   icon: <FileText className="h-3.5 w-3.5" /> },
  { id: 'review',      label: 'Peer Review', icon: <MessageSquare className="h-3.5 w-3.5" /> },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function severityColor(s: string) {
  if (s === 'critical') return 'var(--status-error)'
  if (s === 'moderate') return 'var(--status-warning)'
  return 'var(--text-tertiary)'
}

function statusIcon(s: string, severity: string) {
  if (s === 'passed') return <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--status-success)' }} />
  if (severity === 'critical') return <AlertOctagon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--status-error)' }} />
  return <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--status-warning)' }} />
}

function overallBadge(status: string) {
  if (status === 'stable')      return { bg: 'var(--status-success-bg)', text: 'var(--status-success-text)', label: 'Stable' }
  if (status === 'needs_review') return { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)', label: 'Needs Review' }
  return { bg: 'var(--status-error-bg)', text: 'var(--status-error-text)', label: 'High Risk' }
}

function useCopy(text: string) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [text])
  return { copied, copy }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function IssueCard({ issue }: { issue: PostAnalysisAssumptionIssue }) {
  const [open, setOpen] = useState(false)
  const borderColor = severityColor(issue.severity)

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--border-default)', borderLeft: `3px solid ${borderColor}` }}
    >
      <button
        className="w-full flex items-start gap-2.5 px-3.5 py-3 text-left"
        style={{ background: 'var(--bg-surface)' }}
        onClick={() => setOpen(o => !o)}
      >
        {statusIcon(issue.status, issue.severity)}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{issue.title}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{issue.one_liner}</p>
        </div>
        <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
      </button>

      {open && (
        <div
          className="px-3.5 pb-3.5 space-y-2.5"
          style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}
        >
          <p className="text-[11px] pt-2.5" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Finding: </span>
            {issue.finding}
          </p>
          {issue.suggested_action && (
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Suggested action: </span>
              {issue.suggested_action}
            </p>
          )}
          {issue.alternative_tests.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Alternatives:</p>
              <div className="flex flex-wrap gap-1">
                {issue.alternative_tests.map(t => (
                  <span
                    key={t}
                    className="text-[10px] px-2 py-0.5 rounded"
                    style={{ background: 'var(--bg-inset)', color: 'var(--text-secondary)' }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function GuidanceList({ items }: { items: DesignGuidanceItem[] }) {
  return (
    <div className="space-y-1.5">
      {items.map((g, i) => {
        const color =
          g.status === 'done' ? 'var(--status-success)' :
          g.status === 'consider' ? 'var(--status-warning)' :
          'var(--text-tertiary)'
        const icon =
          g.status === 'done' ? <CheckCircle2 className="h-3 w-3 flex-shrink-0" /> :
          g.status === 'consider' ? <AlertTriangle className="h-3 w-3 flex-shrink-0" /> :
          <ClipboardList className="h-3 w-3 flex-shrink-0" />

        return (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-0.5" style={{ color }}>{icon}</span>
            <div>
              <p className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>{g.item}</p>
              {g.note && <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{g.note}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Sensitivity tab ──────────────────────────────────────────────────────────

function SensitivityTab({ report }: { report: PostAnalysisReport }) {
  const [sliderIdx, setSliderIdx] = useState(2) // default = δ=0
  const scenarios = report.sensitivity_scenarios

  if (!scenarios || scenarios.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Sensitivity analysis not available for this analysis type.
        </p>
      </div>
    )
  }

  const current: SensitivityScenario = scenarios[sliderIdx]
  const observed = scenarios.find(s => s.delta === 0) ?? scenarios[2]
  const ml = report.metric_label

  const fmtEst = (v: number) => ml === 'β' ? v.toFixed(3) : v.toFixed(2)

  return (
    <div className="space-y-5">
      {/* E-value */}
      {report.e_value != null && (
        <div
          className="rounded-lg p-3.5"
          style={{ background: 'var(--accent-blue-subtle)', border: '1px solid var(--border-status-info)' }}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold" style={{ color: 'var(--accent-blue)' }}>E-value for unmeasured confounding</p>
            <span
              className="font-mono text-sm font-bold tabular-nums"
              style={{ color: 'var(--accent-blue)' }}
            >
              {report.e_value.toFixed(2)}
            </span>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            An unmeasured confounder would need a {report.e_value.toFixed(2)}× association with both exposure and
            outcome to explain away the observed effect (VanderWeele &amp; Ding, 2017).
          </p>
        </div>
      )}

      {/* MNAR slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            MNAR bias sensitivity (δ)
          </p>
          <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--text-secondary)' }}>
            δ = {current.delta > 0 ? '+' : ''}{current.delta}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={scenarios.length - 1}
          value={sliderIdx}
          onChange={e => setSliderIdx(Number(e.target.value))}
          className="w-full accent-blue-500 cursor-pointer"
          style={{ accentColor: 'var(--accent-blue)' }}
        />

        <div className="flex justify-between mt-1">
          {scenarios.map(s => (
            <span key={s.delta} className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              {s.delta > 0 ? '+' : ''}{s.delta}
            </span>
          ))}
        </div>

        {/* Result card */}
        <div
          className="mt-3 rounded-lg p-3.5 space-y-2"
          style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-default)' }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{current.label}</p>
            <span
              className="font-mono text-sm font-bold tabular-nums"
              style={{ color: current.delta === 0 ? 'var(--accent-blue)' : 'var(--text-primary)' }}
            >
              {ml} {fmtEst(current.estimate)}
            </span>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            95% CI: {fmtEst(current.ci_lower)} – {fmtEst(current.ci_upper)}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{current.interpretation}</p>
        </div>
      </div>

      {/* Robustness bounds */}
      {report.robustness && (
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Robustness bounds</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: 'Estimate range',
                value: `${fmtEst(report.robustness.estimate_range[0])} – ${fmtEst(report.robustness.estimate_range[1])}`,
              },
              {
                label: 'Breaking point',
                value: report.robustness.breaking_point_delta != null
                  ? `δ = ${report.robustness.breaking_point_delta > 0 ? '+' : ''}${report.robustness.breaking_point_delta}`
                  : 'None in range',
              },
              {
                label: 'Stability',
                value: `${report.robustness.stability_pct.toFixed(0)}%`,
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-lg p-2.5 text-center"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
              >
                <p className="text-[10px] mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
                <p className="text-xs font-semibold font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
            Stability = percentage of MNAR scenarios where the result direction is maintained.
            Observed {ml}: {fmtEst(observed.estimate)}.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Reporting tab ────────────────────────────────────────────────────────────

function CopyBlock({ label, text }: { label: string; text: string }) {
  const { copied, copy } = useCopy(text)
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-colors"
          style={{
            color: copied ? 'var(--status-success-text)' : 'var(--text-tertiary)',
            background: copied ? 'var(--status-success-bg)' : 'var(--bg-inset)',
          }}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        className="text-[11px] p-3.5 rounded-lg whitespace-pre-wrap break-words leading-relaxed"
        style={{
          background: 'var(--bg-inset)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-sans)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {text}
      </pre>
    </div>
  )
}

function ReportingTab({ report }: { report: PostAnalysisReport }) {
  return (
    <div className="space-y-5">
      {report.methods_text
        ? <CopyBlock label="Methods section" text={report.methods_text} />
        : <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Methods text not available.</p>
      }
      {report.limitations && report.limitations.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Limitations</p>
          <ul className="space-y-1.5">
            {report.limitations.map((l, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-[11px] flex-shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }}>•</span>
                <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{l}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Peer Review tab ──────────────────────────────────────────────────────────

function ReviewTab({ report }: { report: PostAnalysisReport }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  if (!report.reviewer_questions || report.reviewer_questions.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        No reviewer questions available.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {report.reviewer_questions.map((q, i) => (
        <div
          key={i}
          className="rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--border-default)' }}
        >
          <button
            className="w-full flex items-start gap-2.5 px-3.5 py-3 text-left"
            style={{ background: 'var(--bg-surface)' }}
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
          >
            <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-blue)' }} />
            <p className="text-xs font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{q.question}</p>
            {openIdx === i
              ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }} />
              : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }} />
            }
          </button>
          {openIdx === i && (
            <div
              className="px-3.5 pb-3.5"
              style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}
            >
              <p className="text-[11px] pt-2.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {q.answer}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean
  report: PostAnalysisReport
  onClose: () => void
}

export function AssumptionReportModal({ isOpen, report, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('issues')

  if (!isOpen) return null

  const badge = overallBadge(report.overall_status)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(24,24,27,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-[560px] max-h-[85vh] flex flex-col rounded-xl overflow-hidden animate-scale-in"
        style={{
          background: 'var(--bg-surface)',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border-default)',
        }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 flex items-start justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--accent-blue-subtle)', border: '1px solid var(--border-status-info)' }}
            >
              <Shield className="h-3.5 w-3.5" style={{ color: 'var(--accent-blue)' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  Assumption Report
                </p>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded"
                  style={{ background: badge.bg, color: badge.text }}
                >
                  {badge.label}
                </span>
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                {(report.analysis_type ?? '').replace(/_/g, ' ')}
                {report.study_design ? ` · ${report.study_design.replace(/_/g, ' ')}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Context row */}
        {(report.outcome_variable || report.exposure_variable || report.research_question) && (
          <div
            className="mx-5 mb-3 px-3 py-2 rounded-lg flex flex-wrap gap-x-4 gap-y-1 flex-shrink-0"
            style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)' }}
          >
            {report.outcome_variable && (
              <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Outcome: </span>{report.outcome_variable}
              </span>
            )}
            {report.exposure_variable && (
              <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Exposure: </span>{report.exposure_variable}
              </span>
            )}
            {report.research_question && (
              <span className="text-[11px] w-full" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Q: </span>{report.research_question}
              </span>
            )}
          </div>
        )}

        {/* Tabs */}
        <div
          className="flex gap-0 px-5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors relative"
              style={{
                color: tab === t.id ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                borderBottom: tab === t.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {tab === 'issues' && (
            <div className="space-y-5">
              {/* Violation summary */}
              {(report.critical_violations > 0 || report.moderate_violations > 0 || report.minor_violations > 0) && (
                <div className="flex items-center gap-3">
                  {report.critical_violations > 0 && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded" style={{ background: 'var(--status-error-bg)', color: 'var(--status-error-text)' }}>
                      <AlertOctagon className="h-3 w-3" />
                      {report.critical_violations} critical
                    </span>
                  )}
                  {report.moderate_violations > 0 && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded" style={{ background: 'var(--status-warning-bg)', color: 'var(--status-warning-text)' }}>
                      <AlertTriangle className="h-3 w-3" />
                      {report.moderate_violations} moderate
                    </span>
                  )}
                  {report.minor_violations > 0 && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded" style={{ background: 'var(--bg-inset)', color: 'var(--text-secondary)' }}>
                      {report.minor_violations} minor
                    </span>
                  )}
                </div>
              )}
              {report.all_passed && (
                <div
                  className="flex items-center gap-2 px-3.5 py-3 rounded-lg"
                  style={{ background: 'var(--status-success-bg)', border: '1px solid var(--border-status-success)' }}
                >
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--status-success)' }} />
                  <p className="text-xs font-medium" style={{ color: 'var(--status-success-text)' }}>
                    All assumption checks passed. Proceed with confidence.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                {(report.top_issues ?? []).map((issue, i) => (
                  <IssueCard key={i} issue={issue} />
                ))}
              </div>
              {report.design_guidance && report.design_guidance.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2.5" style={{ color: 'var(--text-primary)' }}>
                    Design checklist
                  </p>
                  <GuidanceList items={report.design_guidance} />
                </div>
              )}
            </div>
          )}
          {tab === 'sensitivity' && <SensitivityTab report={report} />}
          {tab === 'reporting'   && <ReportingTab report={report} />}
          {tab === 'review'      && <ReviewTab report={report} />}
        </div>
      </div>
    </div>
  )
}
