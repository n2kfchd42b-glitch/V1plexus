'use client'

import { useParams } from 'next/navigation'
import { Plug, Database, BookOpen, ActivitySquare } from 'lucide-react'

// Phase 10: External Integrations Hub
// UI and engine are ready but deployment is pending.
// To enable: replace this page content with <IntegrationMarketplace projectId={projectId} />

const COMING_SOON_CATEGORIES = [
  {
    icon: Database,
    label: 'Data Collection',
    description: 'KoboToolbox, REDCap, SurveyCTO, ODK Central',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    icon: ActivitySquare,
    label: 'Health Information Systems',
    description: 'Push to DHIS2 national health information systems',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  {
    icon: BookOpen,
    label: 'Reference Managers',
    description: 'Zotero and Mendeley library sync',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
]

export default function IntegrationsPage() {
  const params = useParams()
  void params.id // will be used when marketplace is enabled

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gray-100 mb-4">
          <Plug className="h-6 w-6 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Integrations Hub</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
          Connect PLEXUS to every tool in your research ecosystem. Coming soon.
        </p>
      </div>

      <div className="space-y-3">
        {COMING_SOON_CATEGORIES.map(cat => {
          const Icon = cat.icon
          return (
            <div
              key={cat.label}
              className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl bg-white"
            >
              <div className={`flex-shrink-0 h-9 w-9 rounded-lg ${cat.bg} flex items-center justify-center`}>
                <Icon className={`h-4.5 w-4.5 ${cat.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{cat.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{cat.description}</p>
              </div>
              <span className="ml-auto flex-shrink-0 text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full h-fit mt-0.5">
                Soon
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-gray-400 mt-8">
        Data from existing KoboToolbox, REDCap, and ODK connections continues to sync normally.
      </p>
    </div>
  )
}
