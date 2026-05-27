'use client'

import { useEffect, useState } from 'react'
import { Mail, Loader2 } from 'lucide-react'

interface Inquiry {
  id: string
  contact_name: string
  contact_email: string
  contact_role: string | null
  institution_name: string
  country: string | null
  estimated_seats: number | null
  message: string | null
  status: 'new' | 'responded' | 'converted' | 'declined'
  created_at: string
  responded_at: string | null
}

const STATUS_TONE: Record<Inquiry['status'], string> = {
  new:       'bg-[var(--accent-blue)] text-white',
  responded: 'bg-amber-100 text-amber-700',
  converted: 'bg-emerald-100 text-emerald-700',
  declined:  'bg-[var(--bg-surface-2)] text-[var(--text-tertiary)]',
}

export default function InstitutionInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch('/api/institution/inquiries', { cache: 'no-store' })
      if (cancelled) return
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Could not load inquiries')
        setLoading(false)
        return
      }
      const data = await res.json() as { inquiries: Inquiry[] }
      setInquiries(data.inquiries ?? [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto">
      <header className="mb-6 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue)]/10 flex items-center justify-center flex-shrink-0">
          <Mail className="h-5 w-5 text-[var(--accent-blue)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] font-manrope">Inquiries</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Contact requests other people from your institution have submitted via the public form.
            Matched by institution name — read-only.
          </p>
        </div>
      </header>

      {error && (
        <div className="mb-4 px-4 py-3 bg-[var(--status-error-bg)] border border-[var(--border-status-error)] rounded-md text-sm text-[var(--status-error-text)]">
          {error}
        </div>
      )}

      {inquiries.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)] py-12 text-center bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md">
          No inquiries found for your institution name.
        </p>
      ) : (
        <ul className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md divide-y divide-[var(--border-default)]">
          {inquiries.map((inq) => {
            const isOpen = expanded.has(inq.id)
            return (
              <li key={inq.id}>
                <button
                  type="button"
                  onClick={() => toggle(inq.id)}
                  className="w-full px-4 py-3 text-left flex items-start gap-3 hover:bg-[var(--bg-surface-hover)] transition-colors"
                >
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide flex-shrink-0 mt-0.5 ${STATUS_TONE[inq.status]}`}>
                    {inq.status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {inq.contact_name}{inq.contact_role ? ` · ${inq.contact_role}` : ''}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] truncate">
                      {inq.contact_email}
                      {inq.country ? ` · ${inq.country}` : ''}
                      {inq.estimated_seats ? ` · ~${inq.estimated_seats} seats` : ''}
                    </p>
                  </div>
                  <p className="text-[11px] text-[var(--text-tertiary)] flex-shrink-0">
                    {formatDate(inq.created_at)}
                  </p>
                </button>
                {isOpen && inq.message && (
                  <div className="mx-4 mb-3 px-3 py-2 bg-[var(--bg-surface-2)] rounded text-xs text-[var(--text-secondary)] whitespace-pre-wrap">
                    {inq.message}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return iso }
}
