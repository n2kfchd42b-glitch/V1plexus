'use client'

import { ShieldCheck, ScanSearch, Clock, Globe2, Lock, AlertTriangle } from 'lucide-react'
import { NETWORK_COMPLIANCE_ENABLED } from '@/lib/flags'

const FEATURES = [
  {
    icon: ShieldCheck,
    label: 'Compliance Profiles',
    description: 'Configure institution-wide compliance rules for GDPR, Ghana DPA, Kenya DPA, HIPAA, POPIA, NDPR, and custom frameworks.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: ScanSearch,
    label: 'PII Detection',
    description: 'Automatic scanning for names, phone numbers, national IDs, GPS coordinates, and email addresses in uploaded datasets.',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    icon: AlertTriangle,
    label: 'PII Remediation',
    description: 'Guided actions to anonymize, hash, remove, or exclude sensitive columns before datasets are shared on the network.',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
  {
    icon: Clock,
    label: 'Data Retention Policies',
    description: 'Set institution-wide retention periods with automatic flags, archive, or deletion actions on expiry.',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
  },
  {
    icon: Globe2,
    label: 'Cross-Border Checks',
    description: 'Identify and flag cross-border data transfers that require additional compliance review under applicable law.',
    color: 'text-cyan-500',
    bg: 'bg-cyan-50',
  },
  {
    icon: Lock,
    label: 'Consent Verification',
    description: 'Verify that consent records cover all data sharing operations before datasets are published to the network.',
    color: 'text-rose-500',
    bg: 'bg-rose-50',
  },
]

export default function CompliancePage() {
  if (NETWORK_COMPLIANCE_ENABLED) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[var(--text-secondary)]" />
            <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">Compliance Engine</h1>
          </div>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            Configure regulatory compliance profiles and run automated checks
          </p>
        </div>
        <div className="flex items-center justify-center h-64 text-[var(--text-tertiary)] text-sm">
          Compliance dashboard coming soon.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-emerald-50 mb-4">
          <ShieldCheck className="h-6 w-6 text-emerald-600" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Compliance Engine</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          Automated regulatory compliance across GDPR, Ghana DPA, Kenya DPA, HIPAA, and more — with PII detection and data retention management.
        </p>
      </div>

      <div className="space-y-3">
        {FEATURES.map(f => {
          const Icon = f.icon
          return (
            <div
              key={f.label}
              className="flex items-start gap-4 p-4 border border-slate-100 rounded-xl bg-white"
            >
              <div className={`flex-shrink-0 h-9 w-9 rounded-lg ${f.bg} flex items-center justify-center`}>
                <Icon className={`h-4 w-4 ${f.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">{f.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{f.description}</p>
              </div>
              <span className="ml-auto flex-shrink-0 text-[11px] font-medium text-slate-400 bg-gray-100 px-2 py-0.5 rounded-full h-fit mt-0.5">
                Soon
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-slate-400 mt-8">
        Supports GDPR, Ghana DPA, Kenya DPA, HIPAA, South Africa POPIA, Nigeria NDPR, and custom frameworks.
      </p>
    </div>
  )
}
