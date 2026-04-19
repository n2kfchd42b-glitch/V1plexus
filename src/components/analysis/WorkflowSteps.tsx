"use client"

import type { WorkflowStep } from '@/lib/decision-engine/types'

interface Props {
  steps: WorkflowStep[]
}

const BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  'auto-generates Table 1': { bg: 'rgba(139,92,246,0.1)', text: '#7c3aed' },
  'primary analysis': { bg: 'rgba(59,130,246,0.1)', text: '#2563eb' },
  'auto-run': { bg: 'rgba(22,163,74,0.08)', text: '#16a34a' },
  'in results': { bg: 'var(--bg-inset)', text: 'var(--text-tertiary)' },
  'manual next step': { bg: 'rgba(245,158,11,0.1)', text: '#d97706' },
}

export function WorkflowSteps({ steps }: Props) {
  return (
    <div className="relative space-y-0">
      {steps.map((step, idx) => {
        const isDisplayOnly = step.display_only === true
        const badgeStyle = step.badge ? (BADGE_STYLES[step.badge] ?? { bg: 'var(--bg-inset)', text: 'var(--text-tertiary)' }) : null
        const isLast = idx === steps.length - 1
        return (
          <div key={step.number} className={`flex gap-3 ${isDisplayOnly ? 'opacity-50' : ''}`}>
            {/* Step number + connector line */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                style={isDisplayOnly
                  ? { background: 'var(--bg-inset)', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)' }
                  : { background: 'var(--accent-blue-subtle)', color: 'var(--accent-blue)', border: '1px solid var(--border-status-info)' }
                }
              >
                {step.number}
              </div>
              {!isLast && (
                <div
                  className="w-px flex-1 my-1"
                  style={{ background: 'var(--border-subtle)', minHeight: '12px' }}
                />
              )}
            </div>
            {/* Content */}
            <div className={`flex-1 min-w-0 ${isLast ? '' : 'pb-3'}`}>
              <div className="flex items-start gap-2 flex-wrap">
                <p
                  className="text-xs font-semibold leading-snug"
                  style={{ color: isDisplayOnly ? 'var(--text-tertiary)' : 'var(--text-primary)' }}
                >
                  {step.name}
                </p>
                {step.badge && badgeStyle && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                    style={{ background: badgeStyle.bg, color: badgeStyle.text }}
                  >
                    {step.badge}
                  </span>
                )}
              </div>
              <p
                className="text-[11px] mt-0.5 leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {step.description}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
