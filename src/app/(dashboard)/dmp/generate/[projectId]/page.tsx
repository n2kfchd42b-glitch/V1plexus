'use client'

import { FileText } from 'lucide-react'
import { NETWORK_COMPLIANCE_ENABLED } from '@/lib/flags'

export default function GenerateDMPPage() {
  if (NETWORK_COMPLIANCE_ENABLED) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <FileText className="h-5 w-5 text-[var(--text-secondary)]" />
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Generate Data Management Plan</h1>
        </div>
        <div className="flex items-center justify-center h-64 text-[var(--text-tertiary)] text-sm">
          DMP generator coming soon.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto py-20 px-4 text-center">
      <FileText className="h-8 w-8 text-gray-300 mx-auto mb-4" />
      <h2 className="text-base font-medium text-gray-600">Generate DMP</h2>
      <p className="text-sm text-gray-400 mt-2">Select a funder template and generate a data management plan pre-filled from your project data.</p>
    </div>
  )
}
