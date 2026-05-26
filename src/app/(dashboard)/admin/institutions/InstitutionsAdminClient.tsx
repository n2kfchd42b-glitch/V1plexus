'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Institution, InstitutionInquiry, InstitutionType } from '@/types/database'

interface Props {
  inquiries: InstitutionInquiry[]
  institutions: Institution[]
}

interface ProvisionForm {
  institution_name: string
  short_name: string
  type: InstitutionType | ''
  country: string
  email_domain: string
  admin_email: string
  admin_name: string
  inquiry_id: string | null
}

const EMPTY_FORM: ProvisionForm = {
  institution_name: '',
  short_name: '',
  type: '',
  country: '',
  email_domain: '',
  admin_email: '',
  admin_name: '',
  inquiry_id: null,
}

const INSTITUTION_TYPES: InstitutionType[] = [
  'university', 'hospital', 'research_institute', 'ngo', 'government', 'other',
]

export function InstitutionsAdminClient({ inquiries, institutions }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<ProvisionForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  function prefillFromInquiry(inq: InstitutionInquiry) {
    setForm({
      institution_name: inq.institution_name,
      short_name: '',
      type: '',
      country: inq.country ?? '',
      email_domain: inferDomain(inq.contact_email),
      admin_email: inq.contact_email,
      admin_name: inq.contact_name,
      inquiry_id: inq.id,
    })
    setShowForm(true)
    setError(null)
    setSuccess(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    const res = await fetch('/api/admin/institutions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        institution_name: form.institution_name.trim(),
        short_name: form.short_name.trim() || null,
        type: form.type || null,
        country: form.country.trim() || null,
        email_domain: form.email_domain.trim().toLowerCase() || null,
        admin_email: form.admin_email.trim().toLowerCase(),
        admin_name: form.admin_name.trim() || null,
        inquiry_id: form.inquiry_id,
      }),
    })

    setSubmitting(false)

    if (!res.ok) {
      let msg = 'Failed to provision institution.'
      try {
        const json = await res.json()
        if (typeof json?.error === 'string') msg = json.error
      } catch { /* ignore */ }
      setError(msg)
      return
    }

    let emailWarning: string | null = null
    try {
      const json = await res.json()
      if (typeof json?.email_warning === 'string') emailWarning = json.email_warning
    } catch { /* ignore */ }

    setSuccess(
      emailWarning
        ? `${form.institution_name} provisioned, but the invite email failed: ${emailWarning}. Resend manually from Supabase or check Resend logs.`
        : `${form.institution_name} provisioned. Invite sent to ${form.admin_email}.`
    )
    setForm(EMPTY_FORM)
    setShowForm(false)
    router.refresh()
  }

  const newInquiries = inquiries.filter((i) => i.status === 'new')
  const otherInquiries = inquiries.filter((i) => i.status !== 'new')

  return (
    <div className="space-y-10">
      {/* Inquiries */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">
            Inquiries {newInquiries.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-[var(--accent-blue)] text-white">
                {newInquiries.length}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={() => { setShowForm(true); setForm(EMPTY_FORM); setError(null); setSuccess(null) }}
            className="text-sm font-medium text-[var(--accent-blue)] hover:underline"
          >
            + Provision blank
          </button>
        </div>

        {inquiries.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)] py-6 text-center bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md">
            No inquiries yet.
          </p>
        ) : (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md divide-y divide-[var(--border-default)]">
            {[...newInquiries, ...otherInquiries].map((inq) => (
              <InquiryRow key={inq.id} inquiry={inq} onProvision={() => prefillFromInquiry(inq)} />
            ))}
          </div>
        )}
      </section>

      {/* Provisioning form */}
      {showForm && (
        <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">
              Provision institution
            </h2>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null); setSuccess(null) }}
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Institution name" required>
              <input
                type="text"
                required
                value={form.institution_name}
                onChange={(e) => setForm({ ...form, institution_name: e.target.value })}
                className={inputClass}
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Short name">
                <input
                  type="text"
                  value={form.short_name}
                  onChange={(e) => setForm({ ...form, short_name: e.target.value })}
                  placeholder="e.g. UoG"
                  className={inputClass}
                />
              </Field>
              <Field label="Type">
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as InstitutionType | '' })}
                  className={inputClass}
                >
                  <option value="">Select…</option>
                  {INSTITUTION_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Country">
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Email domain" hint="Used later for domain auto-link (off by default)">
                <input
                  type="text"
                  value={form.email_domain}
                  onChange={(e) => setForm({ ...form, email_domain: e.target.value })}
                  placeholder="ug.edu.gh"
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="pt-4 mt-4 border-t border-[var(--border-default)] space-y-4">
              <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">
                First admin
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Admin name">
                  <input
                    type="text"
                    value={form.admin_name}
                    onChange={(e) => setForm({ ...form, admin_name: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Admin email" required>
                  <input
                    type="email"
                    required
                    value={form.admin_email}
                    onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 bg-[var(--status-error-bg)] border border-[var(--border-status-error)] rounded text-sm text-[var(--status-error-text)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[var(--accent-blue)] hover:bg-[var(--accent-blue-hover)] disabled:opacity-60 text-white rounded-md py-2 text-sm font-semibold transition-colors"
            >
              {submitting ? 'Provisioning…' : 'Provision & send admin invite'}
            </button>
          </form>
        </section>
      )}

      {success && (
        <div className="px-4 py-3 bg-[var(--status-success-bg)] border border-[var(--border-status-success)] rounded text-sm text-[var(--status-success-text)]">
          {success}
        </div>
      )}

      {/* Existing institutions */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide mb-3">
          Existing institutions ({institutions.length})
        </h2>
        {institutions.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)] py-6 text-center bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md">
            None yet.
          </p>
        ) : (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md divide-y divide-[var(--border-default)]">
            {institutions.map((inst) => (
              <div key={inst.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{inst.name}</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                    {[inst.country, inst.email_domain, inst.type].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <p className="text-xs text-[var(--text-tertiary)]">
                  {inst.provisioned_at ? `Provisioned ${formatDate(inst.provisioned_at)}` : `Created ${formatDate(inst.created_at)}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function InquiryRow({ inquiry, onProvision }: { inquiry: InstitutionInquiry; onProvision: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const statusStyles = inquiry.status === 'new'
    ? 'bg-[var(--accent-blue)] text-white'
    : 'bg-[var(--bg-surface-2)] text-[var(--text-secondary)]'

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${statusStyles}`}>
              {inquiry.status}
            </span>
            <p className="font-medium text-[var(--text-primary)] text-sm">{inquiry.institution_name}</p>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            {inquiry.contact_name} &lt;{inquiry.contact_email}&gt;
            {inquiry.country ? ` · ${inquiry.country}` : ''}
            {inquiry.estimated_seats ? ` · ~${inquiry.estimated_seats} seats` : ''}
            {' · '}{formatDate(inquiry.created_at)}
          </p>
        </button>
        {inquiry.status !== 'converted' && (
          <button
            type="button"
            onClick={onProvision}
            className="text-xs font-medium text-[var(--accent-blue)] hover:underline shrink-0"
          >
            Provision →
          </button>
        )}
      </div>
      {expanded && inquiry.message && (
        <div className="mt-3 px-3 py-2 bg-[var(--bg-surface-2)] rounded text-xs text-[var(--text-secondary)] whitespace-pre-wrap">
          {inquiry.message}
        </div>
      )}
    </div>
  )
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
        {label}{required && <span className="text-[var(--status-error-text)]"> *</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-[var(--text-tertiary)] mt-1">{hint}</p>}
    </div>
  )
}

const inputClass =
  'w-full bg-[var(--bg-app)] border border-[var(--border-default)] rounded px-2.5 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] transition-shadow'

function inferDomain(email: string): string {
  const at = email.indexOf('@')
  return at >= 0 ? email.slice(at + 1).toLowerCase() : ''
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}
