import { notFound } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import {
  Building2, MapPin, Globe, ShieldCheck, ScrollText, GraduationCap, Users,
  FileCheck2, ExternalLink, Quote,
} from 'lucide-react'
import { BrandLogo } from '@/components/layout/BrandLogo'

interface PublicInstitution {
  id: string
  name: string
  short_name: string | null
  slug: string
  type: string | null
  country: string | null
  city: string | null
  website: string | null
  logo_url: string | null
  brand_color: string | null
  motto: string | null
  public_bio: string | null
  verification_tier: 'SELF_ATTESTED' | 'DOMAIN_VERIFIED' | 'OFFICIALLY_REGISTERED' | null
  members_public_default: boolean
  active: boolean | null
  created_at: string
}

interface PublicMember {
  id: string
  full_name: string | null
  avatar_url: string | null
  title: string | null
  city: string | null
  country: string | null
}

interface PublicOutput {
  project_id: string
  title: string | null
  lifecycle_state: string
  issued_at: string | null
  root_hash: string | null
}

interface PublicPayload {
  institution: PublicInstitution
  departments: Array<{ id: string; name: string; description: string | null }>
  members: PublicMember[]
  member_total: number
  outputs: PublicOutput[]
}

const TIER_INFO: Record<string, { label: string; subline: string; tone: 'gray' | 'blue' | 'green' }> = {
  SELF_ATTESTED: {
    label: 'Self-attested',
    subline: 'Institution is registered on Plexus by its own admin.',
    tone: 'gray',
  },
  DOMAIN_VERIFIED: {
    label: 'Domain verified',
    subline: 'Plexus has verified control of the institution\'s email domain.',
    tone: 'blue',
  },
  OFFICIALLY_REGISTERED: {
    label: 'Officially registered',
    subline: 'Plexus has confirmed registration with a recognised authority.',
    tone: 'green',
  },
}

async function fetchPayload(slug: string): Promise<PublicPayload | null> {
  const h = await headers()
  const host = h.get('host')
  const protocol = h.get('x-forwarded-proto') ?? 'https'
  const base = host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? '')
  if (!base) return null
  try {
    const res = await fetch(`${base}/api/institutions/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as PublicPayload
  } catch {
    return null
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const payload = await fetchPayload(slug)
  if (!payload) return { title: 'Institution Not Found — Plexus' }
  const { institution } = payload
  return {
    title: `${institution.name} — Plexus`,
    description:
      institution.public_bio?.slice(0, 200) ??
      `${institution.name} on Plexus — verified research institution${institution.country ? ` in ${institution.country}` : ''}.`,
    openGraph: {
      title: institution.name,
      description: institution.motto ?? institution.public_bio?.slice(0, 200) ?? undefined,
      images: institution.logo_url ? [institution.logo_url] : undefined,
    },
  }
}

export default async function PublicInstitutionPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const payload = await fetchPayload(slug)
  if (!payload) notFound()

  const { institution: inst, departments, members, member_total, outputs } = payload
  const tier = TIER_INFO[inst.verification_tier ?? 'SELF_ATTESTED']
  const accent = inst.brand_color ?? '#003D9B'

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-900">
            <BrandLogo />
          </Link>
          <Link
            href="/contact-institutions"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            For institutions →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section
        className="border-b border-slate-200"
        style={{
          background: `linear-gradient(135deg, ${accent}10 0%, transparent 60%), white`,
        }}
      >
        <div className="max-w-5xl mx-auto px-6 py-10 flex items-start gap-6">
          <div
            className="w-24 h-24 rounded-xl border border-slate-200 bg-white flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ borderColor: `${accent}30` }}
          >
            {inst.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={inst.logo_url} alt={`${inst.name} logo`} className="w-full h-full object-contain" />
            ) : (
              <Building2 className="h-10 w-10 text-slate-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-slate-900 font-manrope leading-tight">
              {inst.name}
            </h1>
            {inst.motto && (
              <p className="mt-1 text-sm text-slate-500 italic flex items-center gap-1.5">
                <Quote className="h-3.5 w-3.5" />
                {inst.motto}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2.5 text-xs text-slate-600">
              {inst.type && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 capitalize">
                  {inst.type.replace(/_/g, ' ')}
                </span>
              )}
              {(inst.city || inst.country) && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200">
                  <MapPin className="h-3 w-3" />
                  {[inst.city, inst.country].filter(Boolean).join(', ')}
                </span>
              )}
              {inst.website && (
                <a
                  href={inst.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 hover:border-slate-400 transition-colors"
                >
                  <Globe className="h-3 w-3" />
                  Website
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
          <TierBadge tier={inst.verification_tier} info={tier} accent={accent} />
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-6 py-10 grid lg:grid-cols-3 gap-8">
        {/* Left: bio + outputs */}
        <div className="lg:col-span-2 space-y-8">
          {inst.public_bio && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">About</h2>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {inst.public_bio}
              </p>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <FileCheck2 className="h-3.5 w-3.5" />
                Certified outputs
              </h2>
              {outputs.length > 0 && (
                <span className="text-[11px] text-slate-400">
                  {outputs.length} most recent
                </span>
              )}
            </div>
            {outputs.length === 0 ? (
              <EmptyState
                icon={FileCheck2}
                title="No certified outputs yet"
                body={`When researchers at ${inst.short_name ?? inst.name} submit verified theses on Plexus, they'll appear here with this institution's wordmark on the verification page.`}
              />
            ) : (
              <ul className="space-y-2">
                {outputs.map((o) => (
                  <li
                    key={o.project_id}
                    className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${accent}15`, color: accent }}>
                      <FileCheck2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {o.title ?? 'Untitled thesis'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span className="capitalize">{o.lifecycle_state.replace(/_/g, ' ')}</span>
                        {o.issued_at && <> · Certified {formatDate(o.issued_at)}</>}
                      </p>
                    </div>
                    {o.root_hash && (
                      <Link
                        href={`/verify/${o.root_hash}`}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 flex-shrink-0"
                      >
                        Verify
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
              <ScrollText className="h-3.5 w-3.5" />
              Departments
            </h2>
            {departments.length === 0 ? (
              <EmptyState
                icon={ScrollText}
                title="No departments listed"
                body="Department information has not been published yet."
              />
            ) : (
              <ul className="grid sm:grid-cols-2 gap-2">
                {departments.map((d) => (
                  <li key={d.id} className="bg-white border border-slate-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-slate-900">{d.name}</p>
                    {d.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{d.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right: stats + members */}
        <aside className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">At a glance</h3>
            <dl className="space-y-3 text-sm">
              <StatRow label="Researchers" value={member_total} icon={Users} />
              <StatRow label="Departments" value={departments.length} icon={ScrollText} />
              <StatRow label="Certified outputs" value={outputs.length} icon={FileCheck2} />
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
              <GraduationCap className="h-3.5 w-3.5" />
              Researchers
              {member_total > members.length && (
                <span className="text-slate-400 normal-case tracking-normal text-[10px] font-normal">
                  showing {members.length} of {member_total}
                </span>
              )}
            </h3>
            {members.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No public researchers"
                body={
                  inst.members_public_default
                    ? 'No affiliated researchers yet.'
                    : 'This institution has opted out of a public researcher list. Individual researchers can still opt in from their settings.'
                }
              />
            ) : (
              <ul className="space-y-1.5">
                {members.map((m) => (
                  <li key={m.id} className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {m.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-bold text-slate-500">
                          {initials(m.full_name)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {m.full_name ?? 'Researcher'}
                      </p>
                      {(m.title || m.city || m.country) && (
                        <p className="text-[11px] text-slate-500 truncate">
                          {[m.title, [m.city, m.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-6 text-xs text-slate-500 flex items-center justify-between">
          <span>
            Listed on Plexus since {formatDate(inst.created_at)}.
          </span>
          <Link href="/" className="font-semibold text-slate-600 hover:text-slate-900">
            What is Plexus?
          </Link>
        </div>
      </footer>
    </div>
  )
}

function TierBadge({
  tier,
  info,
  accent,
}: {
  tier: string | null
  info: { label: string; subline: string; tone: 'gray' | 'blue' | 'green' }
  accent: string
}) {
  const palette: Record<string, { bg: string; text: string; border: string }> = {
    gray:  { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
    blue:  { bg: `${accent}15`, text: accent, border: `${accent}30` },
    green: { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
  }
  const p = palette[info.tone]
  return (
    <div
      className="rounded-xl px-3.5 py-2.5 max-w-[220px] flex-shrink-0"
      style={{ background: p.bg, border: `1px solid ${p.border}`, color: p.text }}
      title={info.subline}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider">
        <ShieldCheck className="h-3.5 w-3.5" />
        {info.label}
      </div>
      <p className="text-[10.5px] mt-1 leading-snug" style={{ color: p.text, opacity: 0.85 }}>
        {info.subline}
      </p>
      <p className="sr-only">Tier: {tier ?? 'unset'}</p>
    </div>
  )
}

function EmptyState({
  icon: Icon, title, body,
}: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div className="bg-white border border-dashed border-slate-200 rounded-lg p-6 text-center">
      <Icon className="h-5 w-5 text-slate-300 mx-auto mb-2" />
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="text-xs text-slate-500 mt-1">{body}</p>
    </div>
  )
}

function StatRow({
  label, value, icon: Icon,
}: { label: string; value: number; icon: React.ElementType }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500 inline-flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="font-bold text-slate-900 tabular-nums">{value}</dd>
    </div>
  )
}

function initials(name: string | null): string {
  if (!name) return '·'
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}
