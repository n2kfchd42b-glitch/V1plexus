'use client'

import { Network, Globe, Search, Database, Building2, FileText, Lock, Unlock, ShieldCheck } from 'lucide-react'
import { NETWORK_COMPLIANCE_ENABLED } from '@/lib/flags'

const FEATURES = [
  {
    icon: Globe,
    label: 'Federated Dataset Discovery',
    description: 'Browse and search datasets published by institutions across the network — with full-text search, disease area filters, and geographic scope.',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    icon: Lock,
    label: 'Access Request Workflows',
    description: 'Request access to restricted datasets with a stated purpose. Dataset owners review, approve, and grant time-limited access.',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
  },
  {
    icon: Unlock,
    label: 'Open Access Publishing',
    description: 'Publish datasets openly under CC-BY, CC0, or custom licenses. Assign DOIs and track citations across the network.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: Building2,
    label: 'Cross-Institutional Collaboration',
    description: 'Invite researchers from partner institutions to collaborate on projects using secure, token-based invite workflows.',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
  {
    icon: Database,
    label: 'Dataset Metadata Standards',
    description: 'Structured metadata including disease area, geographic scope, methodology, date range, and sample size for discoverability.',
    color: 'text-cyan-500',
    bg: 'bg-cyan-50',
  },
  {
    icon: ShieldCheck,
    label: 'Consent-Aware Sharing',
    description: 'System automatically checks participant consent before allowing dataset publication — only data covered by data-sharing consent is shared.',
    color: 'text-rose-500',
    bg: 'bg-rose-50',
  },
]

export default function NetworkPage() {
  if (NETWORK_COMPLIANCE_ENABLED) {
    // Full implementation rendered when enabled
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-[var(--text-secondary)]" />
            <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">Research Network</h1>
          </div>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
            Discover and share research data across institutions
          </p>
        </div>
        <div className="flex items-center justify-center h-64 text-[var(--text-tertiary)] text-sm">
          Network browser coming soon.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-blue-50 mb-4">
          <Network className="h-6 w-6 text-blue-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Research Network</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
          The federated layer that connects PLEXUS institutions — share datasets, request access, and collaborate across borders.
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
        Cross-institutional data sharing with consent verification, access controls, and audit trails.
      </p>
    </div>
  )
}
