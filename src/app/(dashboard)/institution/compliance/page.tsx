"use client"

import { ClipboardCheck } from 'lucide-react'
import { ComplianceDashboard } from '@/components/compliance/ComplianceDashboard'

export default function InstitutionCompliancePage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Compliance Overview</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Ethics approval status across all projects in your institution.
        </p>
      </div>

      <ComplianceDashboard institutionLabel="Your Institution" />
    </div>
  )
}
