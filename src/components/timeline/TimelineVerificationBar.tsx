"use client"

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { buildResearchLogHtml } from '@/lib/audit/exportLedger'
import type { ChainVerificationResult } from '@/types/audit'

interface Props {
  projectId: string
}

export function TimelineVerificationBar({ projectId }: Props) {
  const [result, setResult]     = useState<ChainVerificationResult | null>(null)
  const [loading, setLoading]   = useState(true)
  const [exporting, setExporting] = useState(false)

  const runVerify = useCallback(() => {
    setLoading(true)
    fetch(`/api/audit/verify?project_id=${projectId}`)
      .then(r => r.json())
      .then(setResult)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => { runVerify() }, [runVerify])

  const handleExport = async () => {
    setExporting(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('timestamp', { ascending: false })
        .limit(500)
      if (error) throw error
      const exportedAt = new Date().toISOString()
      const html = buildResearchLogHtml(data ?? [], {
        projectId,
        subjectLabel: `Project ${projectId.slice(0, 8)}`,
        exportedAt,
      })

      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } finally {
      setExporting(false)
    }
  }

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

      <div className="flex items-center gap-3">
        {/* Chain status */}
        <span className={`text-xs font-medium ${intact ? 'text-[var(--timeline-verified)]' : 'text-[var(--timeline-flagged)]'}`}>
          {intact ? 'Chain intact' : 'Chain violation detected'}
        </span>

        <span className="text-[var(--border-strong)]">·</span>

        {/* Re-verify */}
        <button
          onClick={runVerify}
          className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          title="Re-verify chain"
        >
          <RefreshCw className="h-3 w-3" />
          Re-verify
        </button>

        <span className="text-[var(--border-strong)]">·</span>

        {/* Export */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors disabled:opacity-50"
          title="Open ledger in browser"
        >
          <ExternalLink className="h-3 w-3" />
          {exporting ? 'Loading…' : 'View ledger'}
        </button>
      </div>
    </div>
  )
}
