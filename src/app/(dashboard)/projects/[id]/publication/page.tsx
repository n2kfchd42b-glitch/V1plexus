'use client'

import { BookOpen, FileText, Globe, Award, Search, Upload } from 'lucide-react'

// Phase 9: Publication Pipeline
// UI and engine are ready but deployment is pending.
// To enable: set PUBLICATION_ENABLED = true in src/lib/flags.ts

const FEATURES = [
  {
    icon: Search,
    label: 'Journal Finder',
    description: 'Automated journal matching based on your research topic, scope, and impact factor targets.',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    icon: FileText,
    label: 'Citation Management',
    description: 'Import from Zotero or DOI, generate APA/MLA/Vancouver/Chicago bibliographies in one click.',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
  },
  {
    icon: Upload,
    label: 'Submission Tracker',
    description: 'Track manuscript submissions, reviewer rounds, revisions, and final decisions across journals.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: Globe,
    label: 'Protocol Registry',
    description: 'Register your study protocol on PROSPERO, ClinicalTrials.gov, or OSF with auto-filled forms.',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
  {
    icon: Award,
    label: 'DOI Minting',
    description: 'Mint a permanent DOI for your dataset or preprint and publish it to the PLEXUS open registry.',
    color: 'text-rose-500',
    bg: 'bg-rose-50',
  },
  {
    icon: BookOpen,
    label: 'Cover Letter Generator',
    description: 'AI-drafted cover letters tailored to each journal\'s editorial focus and your study highlights.',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
  },
]

export default function PublicationComingSoonPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-16 text-center">
      <div className="h-14 w-14 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center mb-5 shadow-sm">
        <BookOpen className="h-7 w-7 text-[var(--text-secondary)]" />
      </div>

      <span className="text-xs font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/25 rounded-full px-3 py-1 mb-4">
        Phase 9 · Coming Soon
      </span>

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">Publication Pipeline</h1>
      <p className="text-sm text-[var(--text-secondary)] max-w-md leading-relaxed mb-10">
        The Publication Pipeline connects your finished research to the world — from journal discovery
        and submission tracking to DOI minting and open protocol registration.
        Backend deployment is scheduled for next week.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-3xl text-left">
        {FEATURES.map(f => {
          const Icon = f.icon
          return (
            <div
              key={f.label}
              className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4"
            >
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center mb-3 ${f.bg}`}>
                <Icon className={`h-4 w-4 ${f.color}`} />
              </div>
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">{f.label}</p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{f.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
