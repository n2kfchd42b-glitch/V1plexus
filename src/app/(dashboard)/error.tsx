"use client"

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[Dashboard error]', error)
  }, [error])

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-[var(--status-error-bg)] flex items-center justify-center">
        <AlertTriangle className="h-5 w-5 text-[var(--status-error)]" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">Something went wrong</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-xs leading-relaxed">
          {error.message ?? 'An unexpected error occurred. Your data is safe.'}
        </p>
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-inset)] border border-[var(--border-default)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Try again
      </button>
    </div>
  )
}
