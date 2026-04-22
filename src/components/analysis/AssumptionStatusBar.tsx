"use client"

import React from 'react'
import { CheckCircle2, AlertTriangle, AlertOctagon, ChevronRight, Loader2 } from 'lucide-react'
import type { PostAnalysisReport, AssumptionOverallStatus } from '@/types/analysisIntegrity'

interface Props {
  report: PostAnalysisReport | null
  checking: boolean
  onOpen: () => void
}

const STATUS_CONFIG: Record<
  AssumptionOverallStatus,
  { icon: React.ElementType; color: string; bg: string; textColor: string; label: string }
> = {
  stable: {
    icon: CheckCircle2,
    color: 'var(--status-success)',
    bg: 'var(--status-success-bg)',
    textColor: 'var(--status-success-text)',
    label: 'Assumptions robust',
  },
  needs_review: {
    icon: AlertTriangle,
    color: 'var(--status-warning)',
    bg: 'var(--status-warning-bg)',
    textColor: 'var(--status-warning-text)',
    label: 'Review recommended',
  },
  high_risk: {
    icon: AlertOctagon,
    color: 'var(--status-error)',
    bg: 'var(--status-error-bg)',
    textColor: 'var(--status-error-text)',
    label: 'Assumptions at risk',
  },
}

export function AssumptionStatusBar({ report, checking, onOpen }: Props) {
  if (!checking && !report) return null

  if (checking) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ borderTop: '1px solid var(--border-row)', background: 'var(--bg-app)' }}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Checking assumptions…</span>
      </div>
    )
  }

  if (!report) return null

  const cfg = STATUS_CONFIG[report.overall_status] ?? STATUS_CONFIG.needs_review
  const Icon = cfg.icon
  const violationCount = report.critical_violations + report.moderate_violations + report.minor_violations
  const subtitle = report.all_passed
    ? 'All checks passed — click for full report'
    : `${violationCount} issue${violationCount !== 1 ? 's' : ''} detected — click to review`

  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors"
      style={{
        borderTop: '1px solid var(--border-row)',
        background: 'var(--bg-app)',
        cursor: 'pointer',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = cfg.bg }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-app)' }}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: cfg.color }} />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold" style={{ color: cfg.textColor }}>
          Assumption Check — {cfg.label}
        </span>
        <span className="text-xs ml-2" style={{ color: 'var(--text-tertiary)' }}>
          {subtitle}
        </span>
      </div>
      <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
    </button>
  )
}
