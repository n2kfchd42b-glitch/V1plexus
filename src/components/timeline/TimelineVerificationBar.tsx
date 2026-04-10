"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ChainVerificationResult } from '@/types/audit'

interface Props {
  projectId: string
}

export function TimelineVerificationBar({ projectId }: Props) {
  const router = useRouter()
  const [result, setResult] = useState<ChainVerificationResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/audit/verify?project_id=${projectId}`)
      .then(r => r.json())
      .then(setResult)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-6 py-2 border-b border-[var(--border-row)] bg-[var(--bg-app)]">
        <div className="skeleton h-2 w-2 rounded-full flex-shrink-0" />
        <div className="skeleton h-3 w-48 rounded" />
      </div>
    )
  }

  if (!result || result.total_entries === 0) {
    return (
      <div className="flex items-center gap-2 px-6 py-2 border-b border-[var(--border-row)] bg-[var(--bg-app)]">
        <span className="status-dot status-dot--neutral" />
        <p className="text-xs text-[var(--text-tertiary)]">No entries yet — run an analysis to start your timeline.</p>
      </div>
    )
  }

  const warnings = result.violations.length
  const verified = result.valid_entries
  const intact   = result.chain_intact

  return (
    <div className="flex items-center justify-between px-6 py-2 border-b border-[var(--border-row)] bg-[var(--bg-app)]">
      <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
        {/* Verified count */}
        <span className="flex items-center gap-1.5">
          <span className="status-dot status-dot--verified" />
          <span className="data-mono">{verified}</span>
          <span className="text-[var(--text-tertiary)]">{verified === 1 ? 'entry' : 'entries'} verified</span>
        </span>

        {/* Warnings */}
        {warnings > 0 && (
          <>
            <span className="text-[var(--border-strong)]">·</span>
            <span className="flex items-center gap-1.5">
              <span className="status-dot status-dot--warning" />
              <span className="data-mono">{warnings}</span>
              <span className="text-[var(--text-tertiary)]">{warnings === 1 ? 'warning' : 'warnings'}</span>
            </span>
          </>
        )}
      </div>

      {/* Chain status */}
      <span className={`text-xs font-medium ${intact ? 'text-[var(--timeline-verified)]' : 'text-[var(--timeline-flagged)]'}`}>
        {intact ? 'Chain intact' : 'Chain violation detected'}
      </span>
    </div>
  )
}
