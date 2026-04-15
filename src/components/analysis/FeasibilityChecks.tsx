"use client"

import type { FeasibilityCheck } from '@/lib/decision-engine/types'

const STATUS_STYLES = {
  pass: {
    bg: 'var(--status-success-bg)',
    border: 'var(--border-status-success)',
    icon: '✓',
    iconColor: 'var(--status-success-text)',
    textColor: 'var(--status-success-text)',
  },
  warn: {
    bg: 'var(--status-warning-bg)',
    border: 'var(--border-status-warning)',
    icon: '⚠',
    iconColor: 'var(--status-warning-text)',
    textColor: 'var(--status-warning-text)',
  },
  fail: {
    bg: 'var(--status-error-bg)',
    border: 'var(--border-status-error)',
    icon: '✗',
    iconColor: 'var(--status-error-text)',
    textColor: 'var(--status-error-text)',
  },
  na: {
    bg: 'var(--bg-inset)',
    border: 'var(--border-subtle)',
    icon: '—',
    iconColor: 'var(--text-tertiary)',
    textColor: 'var(--text-tertiary)',
  },
}

interface Props {
  checks: FeasibilityCheck[]
}

export function FeasibilityChecks({ checks }: Props) {
  return (
    <div className="space-y-1.5">
      {checks.map(check => {
        const s = STATUS_STYLES[check.status]
        return (
          <div
            key={check.id}
            className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
            style={{ background: s.bg, border: `1px solid ${s.border}` }}
          >
            <span
              className="text-sm font-bold flex-shrink-0 w-4 text-center leading-tight mt-px"
              style={{ color: s.iconColor }}
            >
              {s.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {check.label}
                </span>
                <span
                  className="text-xs font-mono tabular-nums flex-shrink-0"
                  style={{ color: s.textColor }}
                >
                  {check.value}
                </span>
              </div>
              {check.detail && (
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {check.detail}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
