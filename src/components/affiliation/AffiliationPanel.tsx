'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, GraduationCap, Layers, Hash, MapPin, BadgeCheck, Loader2, ExternalLink, Eye, EyeOff, Unlink, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAffiliation } from '@/hooks/useAffiliation'
import { LinkInstitutionCard } from '@/components/settings/LinkInstitutionCard'
import { createClient as createBrowserClient } from '@/lib/supabase/client'

const DEGREE_LABEL: Record<string, string> = {
  bachelor: "Bachelor's",
  master: "Master's",
  phd: 'PhD',
  postdoc: 'Postdoc',
  staff: 'Staff',
  other: 'Programme',
}

/**
 * The user's institutional affiliation, end-to-end:
 *  - Linked institution (with logo, country, type)
 *  - Active enrollment (programme + cohort + department + matric)
 *  - Pending request state, if any
 *  - Unlinked → fall through to the existing LinkInstitutionCard picker
 *
 * This is the "you belong here" surface the user feels. Lives at
 * /settings#affiliation and is anchored by the AffiliationBadge in the header.
 */
export function AffiliationPanel({ userEmail }: { userEmail: string | null }) {
  const { data, loading, linked, activeEnrollment, refresh } = useAffiliation()
  const [unlinking, setUnlinking] = useState(false)

  async function handleUnlink() {
    if (!data?.profile?.institution) return
    const confirmed = window.confirm(
      `Unlink yourself from ${data.profile.institution.name}? Your workspace membership will be set to 'left' and any active enrollments withdrawn. You can re-link later if you need to.`
    )
    if (!confirmed) return
    setUnlinking(true)
    const res = await fetch('/api/me/institution-link', { method: 'DELETE' })
    setUnlinking(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not unlink')
      return
    }
    toast.success('Unlinked from institution')
    await refresh()
  }

  if (loading) {
    return (
      <section id="affiliation" className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] p-5 flex items-center gap-2 scroll-mt-24">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />
        <span className="text-sm text-[var(--text-tertiary)]">Loading affiliation…</span>
      </section>
    )
  }

  // Unlinked → defer to the picker card so the flow stays in one place.
  if (!linked || !data?.profile?.institution) {
    return (
      <section id="affiliation" className="scroll-mt-24">
        <LinkInstitutionCard userEmail={userEmail} />
      </section>
    )
  }

  const inst = data.profile.institution
  const programme = activeEnrollment?.programme
  const cohort = activeEnrollment?.cohort
  const department = activeEnrollment?.department

  return (
    <section
      id="affiliation"
      className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] overflow-hidden scroll-mt-24"
    >
      {/* Banner */}
      <div className="px-5 py-4 flex items-start gap-4 bg-gradient-to-br from-[var(--accent-blue-subtle)] to-transparent border-b border-[var(--border-default)]">
        {inst.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={inst.logo_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-[var(--border-default)] bg-white" />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-7 w-7 text-[var(--accent-blue)]" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold tracking-widest text-[var(--text-tertiary)] uppercase mb-0.5">Affiliated with</p>
          <h2 className="text-lg font-bold text-[var(--text-primary)] font-manrope">{inst.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
            {inst.country && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{inst.country}</span>}
            {inst.type && <span className="capitalize">{inst.type.replace(/_/g, ' ')}</span>}
            <span className="inline-flex items-center gap-1 text-emerald-700"><BadgeCheck className="h-3 w-3" />Linked</span>
          </div>
        </div>
        {inst.slug && (
          <Link
            href={`/institutions/${inst.slug}`}
            target="_blank"
            className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-blue)] flex-shrink-0"
          >
            Public page
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      {/* Enrollment */}
      <div className="px-5 py-4">
        {activeEnrollment ? (
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <DetailItem
              icon={GraduationCap}
              label="Programme"
              value={programme?.name ?? '—'}
              sub={programme ? DEGREE_LABEL[programme.degree_level] : null}
            />
            <DetailItem
              icon={Layers}
              label="Cohort"
              value={cohort ? `${cohort.year}${cohort.label ? ` ${cohort.label}` : ''}` : '—'}
              sub={activeEnrollment.enrolled_at ? `Enrolled ${formatDate(activeEnrollment.enrolled_at)}` : null}
            />
            <DetailItem
              icon={Building2}
              label="Department"
              value={department?.name ?? '—'}
            />
            <DetailItem
              icon={Hash}
              label="Matriculation"
              value={activeEnrollment.matriculation_number ?? '—'}
              mono
            />
          </dl>
        ) : (
          <MatricClaimPrompt institutionName={inst.name} onClaimed={refresh} />
        )}

        {data.enrollments.length > 1 && (
          <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
            <p className="text-[10px] font-bold tracking-widest text-[var(--text-tertiary)] uppercase mb-2">Past enrollments</p>
            <ul className="space-y-1.5">
              {data.enrollments.filter((e) => e !== activeEnrollment).map((e) => (
                <li key={e.id} className="text-xs text-[var(--text-secondary)] flex items-center justify-between gap-2">
                  <span>
                    {e.programme?.name ?? 'Enrollment'}
                    {e.cohort && <> · {e.cohort.year}</>}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">{e.status.replace('_', ' ')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="px-5 py-3 bg-[var(--bg-surface-2)] border-t border-[var(--border-default)] text-[11px] text-[var(--text-tertiary)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <span>
          Programme / matriculation changes are handled by your institution&rsquo;s admins. Unlink below if you need to leave or switch.
        </span>
        {data.profile && (
          <PublicVisibilityToggle
            userId={data.profile.id}
            initial={data.profile.public_affiliation_visible ?? true}
            institutionSlug={inst.slug ?? null}
          />
        )}
      </div>

      <div className="px-5 py-3 border-t border-[var(--border-default)] flex items-center justify-end">
        <button
          type="button"
          onClick={handleUnlink}
          disabled={unlinking}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[var(--border-default)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--status-error-text)] hover:border-[var(--status-error-text)]/40 disabled:opacity-60 transition-colors"
          title="Remove your link to this institution. Workspace membership is set to 'left' and active enrollments are withdrawn — recoverable by re-linking."
        >
          <Unlink className="h-3 w-3" />
          {unlinking ? 'Unlinking…' : 'Unlink from institution'}
        </button>
      </div>
    </section>
  )
}

/**
 * Shown when the user is linked to an institution but has no enrollment row
 * yet (admin approved the link without assigning a programme, or the user got
 * auto-linked via email domain). Lets them self-verify by entering their
 * matric number — the same path students use on first link.
 */
function MatricClaimPrompt({
  institutionName, onClaimed,
}: { institutionName: string; onClaimed: () => Promise<void> | void }) {
  const [matric, setMatric] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = matric.trim()
    if (!value) return
    setSubmitting(true)
    const res = await fetch('/api/me/enrollment/claim-matric', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matriculation_number: value }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Could not verify that matric number')
      return
    }
    toast.success('Programme verified')
    setMatric('')
    await onClaimed()
  }

  return (
    <div className="bg-[var(--bg-surface-2)] border border-[var(--border-default)] rounded-lg px-4 py-3.5">
      <div className="flex items-start gap-2 mb-2.5">
        <Hash className="h-3.5 w-3.5 text-[var(--accent-blue)] mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-[var(--text-primary)]">
            Add your matriculation number to unlock your programme
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            You&rsquo;re linked to {institutionName}, but your programme, cohort, and matric aren&rsquo;t set yet.
            Enter the matric your institution issued you, or ask an admin to assign you on
            {' '}<code className="text-[10px] font-mono bg-[var(--bg-app)] px-1 py-0.5 rounded">/institution/members</code>.
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
        <input
          value={matric}
          onChange={(e) => setMatric(e.target.value)}
          placeholder="e.g. UG-2024-001"
          maxLength={100}
          className="flex-1 min-w-0 px-3 py-2 text-sm font-mono bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
        />
        <button
          type="submit"
          disabled={submitting || !matric.trim()}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent-blue)] text-white text-xs font-semibold hover:bg-[var(--accent-blue-hover)] disabled:opacity-60 flex-shrink-0"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {submitting ? 'Verifying…' : 'Verify'}
        </button>
      </form>
    </div>
  )
}

function PublicVisibilityToggle({
  userId,
  initial,
  institutionSlug,
}: {
  userId: string
  initial: boolean
  institutionSlug: string | null
}) {
  const [visible, setVisible] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setVisible(initial) }, [initial])

  async function toggle() {
    setSaving(true)
    setError(null)
    const next = !visible
    const supabase = createBrowserClient()
    const { error: e } = await supabase
      .from('profiles')
      .update({ public_affiliation_visible: next })
      .eq('id', userId)
    setSaving(false)
    if (e) {
      setError(e.message)
      return
    }
    setVisible(next)
  }

  return (
    <div className="inline-flex items-center gap-2 text-[11px]">
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--accent-blue)]/40 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-60 transition-colors"
        title={visible
          ? 'You appear on your institution’s public page. Click to hide.'
          : 'You are hidden from your institution’s public page. Click to show.'}
      >
        {visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        {visible ? 'Listed publicly' : 'Hidden from public list'}
      </button>
      {institutionSlug && (
        <Link
          href={`/institutions/${institutionSlug}`}
          target="_blank"
          className="text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] inline-flex items-center gap-0.5"
        >
          preview
          <ExternalLink className="h-2.5 w-2.5" />
        </Link>
      )}
      {error && <span className="text-[var(--status-error-text)]">{error}</span>}
    </div>
  )
}

function DetailItem({
  icon: Icon, label, value, sub, mono,
}: { icon: React.ElementType; label: string; value: string; sub?: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-bold tracking-widest text-[var(--text-tertiary)] uppercase mb-1 flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </dt>
      <dd className={`text-sm font-semibold text-[var(--text-primary)] truncate ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </dd>
      {sub && <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}
