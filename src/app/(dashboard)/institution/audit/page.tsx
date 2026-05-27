'use client'

import { useEffect, useState } from 'react'
import { FileSearch, Loader2 } from 'lucide-react'
import { AuditLogViewer } from '@/components/audit/AuditLogViewer'

export default function InstitutionAuditPage() {
  const [institutionId, setInstitutionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch('/api/me/roles', { cache: 'no-store' })
      if (cancelled) return
      if (!res.ok) {
        setError('Could not load institution context')
        setLoading(false)
        return
      }
      const data = await res.json() as { institution_id: string | null }
      setInstitutionId(data.institution_id)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  if (error || !institutionId) {
    return (
      <div className="px-8 py-10 text-center text-sm text-[var(--text-tertiary)]">
        {error ?? 'No institutional context found.'}
      </div>
    )
  }

  return (
    <div className="px-8 py-8 max-w-[1600px] mx-auto">
      <header className="mb-6 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue)]/10 flex items-center justify-center flex-shrink-0">
          <FileSearch className="h-5 w-5 text-[var(--accent-blue)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] font-manrope">Institutional audit</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Every action recorded against your institution. Filter, search, and export.
          </p>
        </div>
      </header>

      <AuditLogViewer institutionId={institutionId} />
    </div>
  )
}
