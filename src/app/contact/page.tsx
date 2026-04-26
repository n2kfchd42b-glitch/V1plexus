'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BrandLogo } from '@/components/layout/BrandLogo'

const SUPPORT_EMAIL = 'plexus.science@outlook.de'

const SUBJECTS = [
  'General enquiry',
  'Technical issue / bug report',
  'Account or login problem',
  'Data export or deletion request (GDPR)',
  'Beta feedback',
  'Privacy or data protection question',
  'Other',
]

type Status = 'idle' | 'sent' | 'error'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState(SUBJECTS[0])
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\n${message}`
    )
    const subjectEncoded = encodeURIComponent(`[PLEXUS Beta] ${subject}`)
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subjectEncoded}&body=${body}`

    try {
      window.location.href = mailto
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      {/* Header */}
      <header className="bg-[var(--bg-surface)] border-b border-[var(--border-default)] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-12 flex items-center justify-between">
          <BrandLogo variant="standalone" href="/" />
          <div className="flex items-center gap-4 text-sm">
            <Link href="/terms" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Terms</Link>
            <Link href="/privacy" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Privacy</Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-manrope)' }}>
            Contact Support
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Have a question, found a bug, or want to exercise your GDPR rights? We typically respond within 2 business days.
          </p>
        </div>

        {/* Direct email link */}
        <div className="mb-8 px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-[var(--shadow-xs)] flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--text-primary)]">Direct email</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              You can also reach us directly at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--accent-blue)] hover:underline font-medium">
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
        </div>

        {status === 'sent' ? (
          <div className="px-6 py-8 bg-[var(--status-success-bg)] border border-[var(--border-status-success)] rounded-lg text-center">
            <div className="text-2xl mb-3">✓</div>
            <h2 className="text-base font-semibold text-[var(--status-success-text)] mb-1">Your email client should have opened</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Your message has been pre-filled in your email client. Please send it from there to complete your request.
              If nothing opened,{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--accent-blue)] hover:underline">
                click here to email us directly
              </a>.
            </p>
            <button
              onClick={() => setStatus('idle')}
              className="text-sm text-[var(--accent-blue)] hover:underline"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                  Your name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Dr. Jane Smith"
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                  Your email address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@institution.edu"
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] transition-shadow"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                Subject
              </label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] transition-shadow"
              >
                {SUBJECTS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                Message
              </label>
              <textarea
                required
                rows={6}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Describe your question, issue, or request in detail. For GDPR requests (access, deletion, portability), please specify exactly what data you would like us to action."
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] resize-none transition-shadow"
              />
            </div>

            {status === 'error' && (
              <div className="px-4 py-3 bg-[var(--status-error-bg)] border border-[var(--border-status-error)] rounded-lg text-sm text-[var(--status-error-text)]">
                Could not open your email client. Please email us directly at{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>.
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[var(--accent-blue)] hover:bg-[var(--accent-blue-hover)] text-white rounded-md py-2.5 text-sm font-semibold transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
            >
              Open in email client
            </button>

            <p className="text-xs text-[var(--text-tertiary)] text-center">
              This form will open your default email client with your message pre-filled, addressed to{' '}
              <span className="text-[var(--text-secondary)]">{SUPPORT_EMAIL}</span>.
              Your data is not sent to any third-party form service.
            </p>
          </form>
        )}

        {/* GDPR note */}
        <div className="mt-10 pt-8 border-t border-[var(--border-default)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Exercising your GDPR rights</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            To exercise your rights under the GDPR (access, rectification, erasure, portability, restriction, or objection), select &ldquo;Data export or deletion request (GDPR)&rdquo; as the subject and describe your request in the message. We will respond within one calendar month as required by Article 12 GDPR.
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            Read our <Link href="/privacy" className="text-[var(--accent-blue)] hover:underline">Privacy Policy</Link> for full details of how we handle your data and your rights.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-[var(--border-default)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-xs text-[var(--text-tertiary)]">
            © {new Date().getFullYear()} Plexus Science · Beta Programme
          </p>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/terms" className="text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
