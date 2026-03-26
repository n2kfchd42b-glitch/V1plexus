"use client"

import { AuditLogViewer } from '@/components/audit/AuditLogViewer'
import { useWorkspaceContext } from '@/components/workspace/WorkspaceProvider'

export default function InstitutionAuditPage() {
  const { activeWorkspace } = useWorkspaceContext()
  const institutionId = activeWorkspace?.institution_id ?? undefined

  return (
    <div className="px-8 py-6 max-w-[1600px] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-headline">Institution Audit Log</h1>
        <p className="text-slate-500 mt-1 font-medium text-sm">
          Full audit trail for all projects and activities across your institution.
        </p>
      </div>

      <AuditLogViewer institutionId={institutionId} />
    </div>
  )
}
