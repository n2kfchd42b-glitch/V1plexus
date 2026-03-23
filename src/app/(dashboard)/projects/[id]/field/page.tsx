'use client'

import { Smartphone, MapPin, WifiOff, ClipboardCheck, Radio } from 'lucide-react'

const FEATURES = [
  {
    icon: Smartphone,
    label: 'Mobile Data Collection',
    description: 'Tablet-optimised forms for field enumerators. Works offline — data syncs automatically when connectivity is restored.',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    icon: MapPin,
    label: 'Coverage Map',
    description: 'Real-time geographic view of submission density. Identify coverage gaps and redeploy enumerators instantly.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: WifiOff,
    label: 'Offline-First PWA',
    description: 'Full Progressive Web App support. Install on any device and collect data in areas with no internet connection.',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
  },
  {
    icon: ClipboardCheck,
    label: 'Field Quality Monitoring',
    description: 'Live quality alerts, duplicate detection, and outlier flags pushed to supervisors as submissions arrive.',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
  {
    icon: Radio,
    label: 'Enumerator Management',
    description: 'Assign enumerators to geographic clusters, track submission rates, and communicate via in-app team chat.',
    color: 'text-rose-500',
    bg: 'bg-rose-50',
  },
]

export default function FieldOpsComingSoonPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-16 text-center">
      <div className="h-14 w-14 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center mb-5 shadow-sm">
        <Smartphone className="h-7 w-7 text-[var(--text-secondary)]" />
      </div>

      <span className="text-xs font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/25 rounded-full px-3 py-1 mb-4">
        Phase 7 · Coming Soon
      </span>

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">Field Operations Layer</h1>
      <p className="text-sm text-[var(--text-secondary)] max-w-md leading-relaxed mb-10">
        The Field Operations module brings offline-first data collection, real-time enumerator coordination,
        and live field quality monitoring directly into your project workflow.
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
