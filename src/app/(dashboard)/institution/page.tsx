'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Building2, Users, UserPlus, Mail, GraduationCap,
  ArrowRight, ShieldCheck, Loader2, Activity, ClipboardList, Layers, ScrollText,
} from 'lucide-react'
import { tierLabel } from '@/lib/institutions/tier'

interface AuditEntry {
  id: string
  action: string
  resource_type: string | null
  timestamp: string
  actor: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null
}

interface OverviewData {
  institution: {
    id: string
    name: string
    short_name: string | null
    type: string | null
    country: string | null
    email_domain: string | null
    auto_link_domains: string[]
    verification_tier: string | null
    provisioned_at: string | null
  } | null
  institutional_workspace: { id: string; name: string } | null
  counts: {
    members: number
    departments: number
    pending_link_requests: number
    inquiries: number
    programmes: number
    roster_unclaimed: number
    roster_claimed: number
    enrollments_active: number
  }
  recent_audit: AuditEntry[]
}

export default function InstitutionOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch('/api/institution/overview', { cache: 'no-store' })
      if (cancelled) return
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Could not load overview')
        setLoading(false)
        return
      }
      setData(await res.json())
      setLoading(false)
    }
    void load()
    // Re-fetch when the tab regains focus so the pending-link counter doesn't
    // stay stale after the admin actions a request in another tab.
    const onFocus = () => { void load() }
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="px-8 py-10 text-center text-sm text-[var(--text-tertiary)]">
        {error ?? 'Could not load overview'}
      </div>
    )
  }

  const inst = data.institution

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent-blue)]/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-6 w-6 text-[var(--accent-blue)]" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">
              Institution
            </p>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] font-manrope">
              {inst?.name ?? 'Your institution'}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {[inst?.type?.replace(/_/g, ' '), inst?.country, inst?.email_domain].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        </div>
        {inst?.verification_tier && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--status-success-bg)] text-[var(--status-success-text)] text-[11px] font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" />
            {tierLabel(inst.verification_tier)}
          </span>
        )}
      </header>

      {/* Stat tiles */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatTile icon={Users} label="Members" value={data.counts.members} href="/institution/members" />
        <StatTile icon={GraduationCap} label="Programmes" value={data.counts.programmes} href="/institution/programmes" />
        <StatTile icon={Layers} label="Active enrollments" value={data.counts.enrollments_active} href="/institution/programmes" />
        <StatTile
          icon={UserPlus}
          label="Pending link requests"
          value={data.counts.pending_link_requests}
          href="/institution/link-requests"
          highlight={data.counts.pending_link_requests > 0}
        />
      </section>
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatTile icon={ClipboardList} label="Roster · unclaimed" value={data.counts.roster_unclaimed} href="/institution/roster" />
        <StatTile icon={ClipboardList} label="Roster · claimed" value={data.counts.roster_claimed} href="/institution/roster" />
        <StatTile icon={Building2} label="Departments" value={data.counts.departments} href="/institution/departments" />
        <StatTile icon={Mail} label="Inquiries" value={data.counts.inquiries} href="/institution/inquiries" />
      </section>

      {/* Quick actions */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        <QuickAction
          href="/institution/programmes"
          icon={GraduationCap}
          title="Programmes & cohorts"
          subtitle="Bachelors, Masters, PhD — and who's in each. Upload a roster here to auto-provision."
        />
        <QuickAction
          href="/institution/policy"
          icon={ScrollText}
          title="Thesis policy"
          subtitle="Workflow rules for every new thesis"
        />
      </section>

      {/* Auto-link domains */}
      {inst && (
        <section className="mb-8 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Auto-link domains</h2>
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">
              Edits via platform admin
            </span>
          </div>
          {inst.auto_link_domains.length === 0 ? (
            <p className="text-xs text-[var(--text-tertiary)] italic">
              None configured. Every link request needs manual approval.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {inst.auto_link_domains.map((d) => (
                <span key={d} className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--bg-surface-2)] text-xs font-mono text-[var(--text-secondary)]">
                  {d}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Recent activity */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl">
        <div className="px-5 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--text-tertiary)]" />
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Recent activity</h2>
          </div>
          <Link href="/institution/audit" className="text-xs font-semibold text-[var(--accent-blue)] hover:underline">
            View all
          </Link>
        </div>
        {data.recent_audit.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-[var(--text-tertiary)]">
            No institutional audit entries yet.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border-default)]">
            {data.recent_audit.map((entry) => (
              <li key={entry.id} className="px-5 py-3 text-sm flex items-center gap-3">
                <span className="font-mono text-[11px] text-[var(--text-tertiary)] flex-shrink-0">
                  {formatTime(entry.timestamp)}
                </span>
                <span className="font-semibold text-[var(--text-primary)] flex-shrink-0">
                  {entry.action.replace(/\./g, ' › ')}
                </span>
                <span className="text-xs text-[var(--text-secondary)] truncate">
                  {entry.actor?.full_name ?? entry.actor?.email ?? 'System'}
                </span>
                {entry.resource_type && (
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] flex-shrink-0">
                    {entry.resource_type}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function StatTile({
  icon: Icon, label, value, href, highlight,
}: { icon: React.ElementType; label: string; value: number; href: string; highlight?: boolean }) {
  return (
    <Link
      href={href}
      className={`block rounded-xl border p-4 transition-colors ${
        highlight
          ? 'bg-[var(--accent-blue-subtle)] border-[var(--accent-blue)]/30 hover:border-[var(--accent-blue)]/50'
          : 'bg-[var(--bg-surface)] border-[var(--border-default)] hover:border-[var(--accent-blue)]/30'
      }`}
    >
      <div className="flex items-center gap-2 mb-2 text-[var(--text-tertiary)]">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{value}</p>
    </Link>
  )
}

function QuickAction({
  href, icon: Icon, title, subtitle,
}: { href: string; icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4 hover:border-[var(--accent-blue)]/40 hover:bg-[var(--bg-surface-hover)] transition-colors"
    >
      <div className="w-9 h-9 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-[var(--accent-blue)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{title}</p>
        <p className="text-xs text-[var(--text-tertiary)] truncate">{subtitle}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-[var(--text-tertiary)] group-hover:text-[var(--accent-blue)] flex-shrink-0 transition-colors" />
    </Link>
  )
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch { return iso }
}
