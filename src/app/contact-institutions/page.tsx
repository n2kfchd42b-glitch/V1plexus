'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BrandLogo } from '@/components/layout/BrandLogo'

type Status = 'idle' | 'submitting' | 'sent' | 'error'

export default function ContactInstitutionsPage() {
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactRole, setContactRole] = useState('')
  const [institutionName, setInstitutionName] = useState('')
  const [country, setCountry] = useState('')
  const [estimatedSeats, setEstimatedSeats] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    setErrorMessage(null)

    const seatsNum = estimatedSeats.trim() ? Number(estimatedSeats) : undefined

    const res = await fetch('/api/institution-inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_name: contactName,
        contact_email: contactEmail,
        contact_role: contactRole,
        institution_name: institutionName,
        country,
        estimated_seats: seatsNum,
        message,
      }),
    })

    if (res.ok) {
      setStatus('sent')
      return
    }

    let detail = 'Could not submit your inquiry. Please try again or email plexus.science@outlook.de.'
    try {
      const json = await res.json()
      if (typeof json?.error === 'string') detail = json.error
    } catch {
      // ignore
    }
    setStatus('error')
    setErrorMessage(detail)
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      <header className="bg-[var(--bg-surface)] border-b border-[var(--border-default)] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-12 flex items-center justify-between">
          <BrandLogo variant="standalone" href="/" />
          <div className="flex items-center gap-4 text-sm">
            <Link href="/contact" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">General support</Link>
            <Link href="/privacy" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Privacy</Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface-2)] text-[var(--text-secondary)] text-[10px] uppercase tracking-widest font-bold mb-4 border border-[var(--border-default)]">
            For institutions
          </div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-manrope)' }}>
            Bring Plexus to your institution
          </h1>
          <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed">
            Plexus is provisioned per institution — we don&apos;t allow self-serve signups for organisations.
            Tell us about yours and we&apos;ll get back to you within two business days to scope a pilot.
          </p>
        </div>

        {status === 'sent' ? (
          <div className="px-6 py-8 bg-[var(--status-success-bg)] border border-[var(--border-status-success)] rounded-lg text-center">
            <div className="text-2xl mb-3">✓</div>
            <h2 className="text-base font-semibold text-[var(--status-success-text)] mb-1">Thanks — we&apos;ve received your inquiry</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              We&apos;ll be in touch at <span className="font-medium text-[var(--text-primary)]">{contactEmail}</span> within two business days.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Your name</label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Dr. Ama Mensah"
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Work email</label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@institution.edu"
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] transition-shadow"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Your role</label>
              <input
                type="text"
                value={contactRole}
                onChange={(e) => setContactRole(e.target.value)}
                placeholder="Dean of Research / Department Head / IT Director"
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] transition-shadow"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Institution name</label>
              <input
                type="text"
                required
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder="University of Ghana, Legon"
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] transition-shadow"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Ghana"
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                  Estimated seats <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={estimatedSeats}
                  onChange={(e) => setEstimatedSeats(e.target.value)}
                  placeholder="200"
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] transition-shadow"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                Anything we should know? <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
              </label>
              <textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Use case, timeline, compliance requirements, departments you'd start with…"
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] resize-none transition-shadow"
              />
            </div>

            {status === 'error' && errorMessage && (
              <div className="px-4 py-3 bg-[var(--status-error-bg)] border border-[var(--border-status-error)] rounded-lg text-sm text-[var(--status-error-text)]">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full bg-[var(--accent-blue)] hover:bg-[var(--accent-blue-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-md py-2.5 text-sm font-semibold transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
            >
              {status === 'submitting' ? 'Sending…' : 'Send inquiry'}
            </button>

            <p className="text-xs text-[var(--text-tertiary)] text-center">
              By submitting, you agree to be contacted about Plexus.
              See our <Link href="/privacy" className="text-[var(--accent-blue)] hover:underline">privacy policy</Link>.
            </p>
          </form>
        )}

        <div className="mt-12 pt-8 border-t border-[var(--border-default)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-xs text-[var(--text-tertiary)]">
            © {new Date().getFullYear()} Plexus Science
          </p>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/terms" className="text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] transition-colors">Terms</Link>
            <Link href="/privacy" className="text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] transition-colors">Privacy</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
