'use client'

import Link from 'next/link'
import { Building2, GraduationCap } from 'lucide-react'
import { useAffiliation } from '@/hooks/useAffiliation'

const DEGREE_SHORT: Record<string, string> = {
  bachelor: 'BSc',
  master: 'MSc',
  phd: 'PhD',
  postdoc: 'Postdoc',
  staff: 'Staff',
  other: '',
}

/**
 * Header chip showing the user's institutional affiliation. Hidden when
 * unlinked or while loading (no skeleton — quiet absence is better than a
 * placeholder users learn to ignore).
 *
 * Clicks through to /settings#affiliation for the full panel.
 */
export function AffiliationBadge() {
  const { data, loading, linked, activeEnrollment } = useAffiliation()
  if (loading || !linked || !data?.profile?.institution) return null

  const institution = data.profile.institution
  const programme = activeEnrollment?.programme
  const cohort = activeEnrollment?.cohort

  return (
    <Link
      href="/settings#affiliation"
      title="Institutional affiliation"
      className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--bg-inset)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-row)] hover:border-[var(--border-strong)] transition-colors max-w-[300px] group"
    >
      {institution.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={institution.logo_url}
          alt=""
          className="w-5 h-5 rounded object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-5 h-5 rounded bg-[var(--accent-blue)]/10 flex items-center justify-center flex-shrink-0">
          <Building2 className="h-3 w-3 text-[var(--accent-blue)]" />
        </div>
      )}
      <div className="min-w-0 leading-tight">
        <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
          {institution.short_name ?? institution.name}
        </p>
        {programme ? (
          <p className="text-[10px] text-[var(--text-tertiary)] truncate flex items-center gap-0.5">
            <GraduationCap className="h-2.5 w-2.5" />
            {DEGREE_SHORT[programme.degree_level] || programme.degree_level}
            {cohort && <> · {cohort.year}</>}
          </p>
        ) : (
          <p className="text-[10px] text-[var(--text-tertiary)] truncate">Affiliated</p>
        )}
      </div>
    </Link>
  )
}
