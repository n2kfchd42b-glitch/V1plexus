'use client'

import { Smartphone } from 'lucide-react'
import { NETWORK_COMPLIANCE_ENABLED } from '@/lib/flags'

export default function ConsentCapturePage() {
  if (NETWORK_COMPLIANCE_ENABLED) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="flex items-center gap-2 mb-6">
          <Smartphone className="h-5 w-5 text-[var(--text-secondary)]" />
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Consent Capture</h1>
        </div>
        <div className="flex items-center justify-center h-64 text-[var(--text-tertiary)] text-sm">
          Mobile consent capture coming soon.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto py-20 px-4 text-center">
      <Smartphone className="h-8 w-8 text-gray-300 mx-auto mb-4" />
      <h2 className="text-base font-medium text-gray-600">Consent Capture</h2>
      <p className="text-sm text-gray-400 mt-2">Field-optimised consent capture with touch signatures. Works offline.</p>
    </div>
  )
}
