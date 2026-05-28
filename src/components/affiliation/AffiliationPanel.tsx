'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, GraduationCap, Layers, Hash, MapPin, BadgeCheck, Loader2, ExternalLink, Eye, EyeOff } from 'lucide-react'
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
  const { data, loading, linked, activeEnrollment } = useAffiliation()

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
          <p className="text-xs text-[var(--text-tertiary)]">
            You&rsquo;re linked to this institution, but you don&rsquo;t have a programme enrollment yet.
            Ask an admin to assign you to a programme, or enter a matriculation number to verify yourself.
          </p>
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
          Membership changes are handled by your institution&rsquo;s admins. Contact them to unlink, switch programme, or update your matriculation.
        </span>
        {data.profile && (
          <PublicVisibilityToggle
            userId={data.profile.id}
            initial={data.profile.public_affiliation_visible ?? true}
            institutionSlug={inst.slug ?? null}
          />
        )}
      </div>
    </section>
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
