'use client'

// Phase 11: Grant Management
// To enable: set INSTITUTIONAL_INTELLIGENCE_ENABLED = true in src/lib/flags.ts

import { DollarSign, CalendarCheck, FileText, Link2 } from 'lucide-react'
import { INSTITUTIONAL_INTELLIGENCE_ENABLED } from '@/lib/flags'
import { GrantList } from '@/components/grants/GrantList'

const FEATURES = [
  {
    icon: DollarSign,
    label: 'Grant Tracking',
    description: 'Link funder, PI, budget, and dates — NIH, Wellcome, Gates, and more',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: Link2,
    label: 'Project Linking',
    description: 'Connect grants to projects and track per-project budget allocation',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    icon: CalendarCheck,
    label: 'Reporting Deadlines',
    description: 'Automatic alerts for upcoming progress, annual, and final reports',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
  {
    icon: FileText,
    label: 'AI Report Generation',
    description: 'Auto-draft funder reports using funder-specific templates and project data',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
  },
]

export default function GrantsPage() {
  if (INSTITUTIONAL_INTELLIGENCE_ENABLED) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">Grants & Funding</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            Manage grants, link projects, and track reporting deadlines
          </p>
        </div>
        <GrantList />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gray-100 mb-4">
          <DollarSign className="h-6 w-6 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Grant Management</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
          Link projects to funding, track deliverables, and auto-generate funder reports. Coming soon.
        </p>
      </div>

      <div className="space-y-3">
        {FEATURES.map(f => {
          const Icon = f.icon
          return (
            <div
              key={f.label}
              className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl bg-white"
            >
              <div className={`flex-shrink-0 h-9 w-9 rounded-lg ${f.bg} flex items-center justify-center`}>
                <Icon className={`h-4 w-4 ${f.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{f.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{f.description}</p>
              </div>
              <span className="ml-auto flex-shrink-0 text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full h-fit mt-0.5">
                Soon
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-gray-400 mt-8">
        Supports NIH, Wellcome Trust, Gates Foundation, and custom funder formats.
      </p>
    </div>
  )
}
