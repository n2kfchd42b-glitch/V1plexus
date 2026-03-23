'use client'

// Phase 11: Research Impact Dashboard
// UI and engine are ready but deployment is pending.
// To enable: set INSTITUTIONAL_INTELLIGENCE_ENABLED = true in src/lib/flags.ts

import { BarChart3, Globe, Users, TrendingUp } from 'lucide-react'
import { INSTITUTIONAL_INTELLIGENCE_ENABLED } from '@/lib/flags'
import { ImpactDashboard } from '@/components/impact/ImpactDashboard'
import { useAuth } from '@/hooks/useAuth'

const FEATURES = [
  {
    icon: BarChart3,
    label: 'Research Output Metrics',
    description: 'Projects, publications, datasets, and analyses in one dashboard',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    icon: TrendingUp,
    label: 'Output Trends',
    description: 'Publications and datasets charted across quarters and years',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: Globe,
    label: 'Geographic Reach',
    description: 'Visual map of study locations and regional coverage',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
  {
    icon: Users,
    label: 'Collaboration Network',
    description: 'Force-directed graph showing researcher collaboration patterns',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
  },
]

export default function ImpactPage() {
  const { profile } = useAuth()

  if (INSTITUTIONAL_INTELLIGENCE_ENABLED) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">Research Impact</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            Institution-wide view of research output, collaborations, and geographic reach
            {profile?.institution?.name ? ` — ${profile.institution.name}` : ''}
          </p>
        </div>
        <ImpactDashboard />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gray-100 mb-4">
          <BarChart3 className="h-6 w-6 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Research Impact Dashboard</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
          Institution-wide view of research output, publications, citations, and collaboration networks. Coming soon.
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
        All metrics are pre-computed nightly from existing project, publication, and dataset records.
      </p>
    </div>
  )
}
