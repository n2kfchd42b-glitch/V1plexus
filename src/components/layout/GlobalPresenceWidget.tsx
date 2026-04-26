"use client"

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { X, Globe } from 'lucide-react'

// Full ResearcherGlobe — has discipline pills, country filter, cluster tooltips, stats
const GlobeModal = dynamic(
  () => import('@/components/auth/ResearcherGlobe').then(m => ({ default: m.ResearcherGlobe })),
  { ssr: false, loading: () => <div className="h-full w-full bg-[#060d1c]" /> }
)

interface Stats {
  total: number
  cities: number
  countries: number
  online: number
}

export function GlobalPresenceWidget() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/globe')
      .then(r => r.json())
      .then(d => setStats({ total: d.total, cities: d.cities, countries: d.countries, online: d.online }))
      .catch(() => {})
  }, [])

  if (!stats || dismissed || stats.total === 0) return null

  return (
    <>
      {/* Stats card — bottom-right */}
      <div className="fixed bottom-4 right-4 z-40 w-52 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-lg overflow-hidden">
        {/* Header row */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <div className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
            <span className="text-[11px] font-semibold text-[var(--text-primary)] uppercase tracking-wide">
              Global Activity
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="h-4 w-4 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-px bg-[var(--border-default)] border-t border-[var(--border-default)]">
          <div className="bg-[var(--bg-surface)] px-2 py-2.5 text-center">
            <p className="text-sm font-bold text-[var(--text-primary)] leading-none">{stats.total.toLocaleString()}</p>
            <p className="text-[9px] text-[var(--text-tertiary)] mt-0.5 uppercase tracking-wide">Researchers</p>
          </div>
          <div className="bg-[var(--bg-surface)] px-2 py-2.5 text-center">
            <p className="text-sm font-bold text-[var(--text-primary)] leading-none">{stats.cities}</p>
            <p className="text-[9px] text-[var(--text-tertiary)] mt-0.5 uppercase tracking-wide">Cities</p>
          </div>
          <div className="bg-[var(--bg-surface)] px-2 py-2.5 text-center">
            <p className="text-sm font-bold text-[var(--text-primary)] leading-none">{stats.countries}</p>
            <p className="text-[9px] text-[var(--text-tertiary)] mt-0.5 uppercase tracking-wide">Countries</p>
          </div>
        </div>

        {/* Online indicator + CTA */}
        <div className="flex items-center justify-between px-3 py-2.5 border-t border-[var(--border-default)]">
          {stats.online > 0 ? (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {stats.online} online now
            </span>
          ) : (
            <span className="text-[11px] text-[var(--text-tertiary)]">No one active</span>
          )}
          <button
            onClick={() => setModalOpen(true)}
            className="text-[10px] font-semibold text-[var(--accent-blue)] hover:underline underline-offset-2"
          >
            View map →
          </button>
        </div>
      </div>

      {/* Full globe modal with filters */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="relative w-full max-w-5xl h-[640px] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
            <GlobeModal />
            {/* Close button — sits above ResearcherGlobe's own logo */}
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 z-30 h-8 w-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
