"use client"

import { Shield } from 'lucide-react'
import { AuditLogViewer } from '@/components/audit/AuditLogViewer'
import { useWorkspaceContext } from '@/components/workspace/WorkspaceProvider'

export default function InstitutionAuditPage() {
  const { activeWorkspace } = useWorkspaceContext()
  const institutionId = activeWorkspace?.institution_id ?? undefined

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Institution Audit Log</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Full audit trail for all projects and activities across your institution.
        </p>
      </div>

      <AuditLogViewer institutionId={institutionId} />
    </div>
  )
}
