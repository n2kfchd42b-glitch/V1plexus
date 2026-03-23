'use client'

import { FileSignature, Smartphone, Link2, RotateCcw, Layers, Users } from 'lucide-react'
import { NETWORK_COMPLIANCE_ENABLED } from '@/lib/flags'

const FEATURES = [
  {
    icon: FileSignature,
    label: 'Consent Form Builder',
    description: 'Drag-and-drop builder for informed consent forms with tiered consent options, signature capture, and multi-language support.',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    icon: Smartphone,
    label: 'Mobile Consent Capture',
    description: 'Tablet-optimised consent capture for field use — large text, touch signatures, offline storage with automatic sync.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: Layers,
    label: 'Tiered Consent',
    description: 'Support for granular consent tiers: primary study participation, future research use, data sharing, and biobanking.',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
  },
  {
    icon: Link2,
    label: 'Consent-Data Linking',
    description: 'Each consent record maps to participant rows in research datasets. Sharing checks run automatically against consent status.',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
  {
    icon: RotateCcw,
    label: 'Withdrawal Workflows',
    description: 'Process consent withdrawal requests with guided actions: anonymize, delete, or retain with justification. Audit trail included.',
    color: 'text-rose-500',
    bg: 'bg-rose-50',
  },
  {
    icon: Users,
    label: 'Participant Records',
    description: 'Privacy-preserving consent records using participant IDs — no names stored, full audit of who collected consent and when.',
    color: 'text-cyan-500',
    bg: 'bg-cyan-50',
  },
]

export default function ConsentPage() {
  if (NETWORK_COMPLIANCE_ENABLED) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-[var(--text-secondary)]" />
            <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">Digital Consent</h1>
          </div>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            Build, deploy, and manage informed consent forms
          </p>
        </div>
        <div className="flex items-center justify-center h-64 text-[var(--text-tertiary)] text-sm">
          Consent management coming soon.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-blue-50 mb-4">
          <FileSignature className="h-6 w-6 text-blue-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Digital Consent Management</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
          Field-ready digital consent capture with tiered options, touch signatures, offline support, and full audit trails.
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
        Works offline on Android tablets. Syncs automatically when connectivity is restored.
      </p>
    </div>
  )
}
