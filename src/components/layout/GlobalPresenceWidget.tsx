"use client"

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { X } from 'lucide-react'

const GlobeModal = dynamic(
  () => import('@/components/landing/LandingGlobe').then(m => ({ default: m.LandingGlobe })),
  { ssr: false, loading: () => <div className="h-full w-full bg-[#060d1c]" /> }
)

interface Stats {
  total: number
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
      .then(d => setStats({ total: d.total, countries: d.countries, online: d.online }))
      .catch(() => {})
  }, [])

  // Nothing to show until data loads, or if dismissed, or no researchers
  if (!stats || dismissed || stats.total === 0) return null

  return (
    <>
      {/* Pill widget — bottom-left, above potential mobile nav */}
      <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2.5 pl-3 pr-2 py-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-md">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
        <span className="text-xs font-medium text-[var(--text-primary)]">
          {stats.online > 0
            ? <>{stats.online} online now</>
            : <>{stats.total.toLocaleString()} researchers</>
          }
        </span>
        <button
          onClick={() => setModalOpen(true)}
          className="text-[10px] font-semibold text-[var(--accent-blue)] hover:underline underline-offset-2 whitespace-nowrap"
        >
          View map
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="h-5 w-5 flex items-center justify-center rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Globe modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="relative w-full max-w-4xl h-[580px] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
            <GlobeModal />

            {/* Header bar */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-3.5 bg-gradient-to-b from-[#060d1c] to-transparent z-10">
              <div>
                <p className="text-white text-sm font-semibold leading-tight">Global Researcher Activity</p>
                <p className="text-white/40 text-[11px] mt-0.5">
                  {stats.total.toLocaleString()} researchers · {stats.countries} countr{stats.countries !== 1 ? 'ies' : 'y'}
                  {stats.online > 0 && ` · ${stats.online} online now`}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
