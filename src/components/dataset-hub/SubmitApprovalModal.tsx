'use client'

import { useState, useEffect } from 'react'
import { Shield, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Supervisor {
  user_id: string
  full_name: string | null
}

interface VersionInfo {
  row_count: number
  column_count: number
  operations: Array<{ type?: string; [key: string]: unknown }>
}

interface SubmitApprovalModalProps {
  isOpen: boolean
  onClose: () => void
  datasetId: string
  datasetName: string
  versionId: string
  versionNumber: number
  projectId: string
  onSubmitted: () => void
}

export function SubmitApprovalModal({
  isOpen,
  onClose,
  datasetId,
  datasetName,
  versionId,
  versionNumber,
  projectId,
  onSubmitted,
}: SubmitApprovalModalProps) {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [auditCount, setAuditCount] = useState(0)
  const [assignedSupervisor, setAssignedSupervisor] = useState<string>('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!isOpen) return
    setLoadingData(true)

    const load = async () => {
      // Load version info
      const { data: version } = await supabase
        .from('dataset_versions')
        .select('row_count, column_count, operations')
        .eq('id', versionId)
        .single()
      if (version) setVersionInfo(version as VersionInfo)

      // Load audit count for this version
      const { count } = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('resource_id', versionId)
      setAuditCount(count ?? 0)

      // Load supervisors from workspace
      const { data: project } = await supabase
        .from('projects')
        .select('workspace_id')
        .eq('id', projectId)
        .single()

      if (project?.workspace_id) {
        const { data: members } = await supabase
          .from('workspace_memberships')
          .select('user_id, profiles:user_id(full_name)')
          .eq('workspace_id', project.workspace_id)
          .eq('role', 'supervisor')
          .eq('status', 'active')

        if (members) {
          setSupervisors(
            members.map((m) => ({
              user_id: m.user_id,
              full_name: (m.profiles as unknown as { full_name: string | null } | null)?.full_name ?? null,
            }))
          )
        }
      }

      setLoadingData(false)
    }

    load()
  }, [isOpen, versionId, projectId])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/datasets/${datasetId}/approval/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version_id: versionId,
          project_id: projectId,
          request_message: message.trim() || undefined,
          assigned_supervisor: assignedSupervisor || undefined,
        }),
      })
      if (res.ok) {
        onClose()
        onSubmitted()
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  const ops = versionInfo?.operations ?? []
  const opChips = ops.slice(0, 6).map((op, i) => {
    const label = op.type ?? 'operation'
    const isRemove = label.includes('drop') || label.includes('remove') || label.includes('duplicate')
    const isImpute = label.includes('impute') || label.includes('mice')
    return (
      <span
        key={i}
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
          isRemove ? 'bg-red-100 text-red-700' : isImpute ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
        }`}
      >
        {label}
      </span>
    )
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[var(--bg-surface-lowest)] rounded-2xl shadow-2xl w-full max-w-[520px] overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-7 pb-5 border-b border-[var(--border-subtle)]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Submit for Approval</h2>
              <p className="text-[13px] text-[var(--text-tertiary)] mt-0.5">
                {datasetName} · v{versionNumber}
              </p>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)]">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-8 py-6 space-y-5">
          {/* Version summary */}
          {!loadingData && versionInfo && (
            <div className="rounded-xl bg-[var(--bg-inset)] p-4 space-y-3">
              <div className="flex gap-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Rows</p>
                  <p className="font-mono text-sm font-bold text-[var(--text-primary)]">{versionInfo.row_count.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Columns</p>
                  <p className="font-mono text-sm font-bold text-[var(--text-primary)]">{versionInfo.column_count}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Operations</p>
                  <p className="font-mono text-sm font-bold text-[var(--text-primary)]">{ops.length}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Audit entries</p>
                  <p className="font-mono text-sm font-bold text-[var(--text-primary)]">{auditCount}</p>
                </div>
              </div>
              {opChips.length > 0 && (
                <div className="flex flex-wrap gap-1.5">{opChips}</div>
              )}
            </div>
          )}

          {/* Supervisor selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
              Assign to supervisor
            </label>
            <select
              value={assignedSupervisor}
              onChange={(e) => setAssignedSupervisor(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
            >
              <option value="">Any project supervisor (default)</option>
              {supervisors.map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {s.full_name ?? s.user_id}
                </option>
              ))}
            </select>
          </div>

          {/* Message */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
              Message to supervisor <span className="font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="e.g. MICE applied to 2 variables with missingness >20%. Cleaning decisions documented. Ready for analysis."
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
            />
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1 text-right">{message.length}/500</p>
          </div>

          {/* What happens next */}
          <div className="rounded-xl bg-[var(--bg-inset)] px-4 py-3.5 space-y-1.5">
            <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">What happens next</p>
            {[
              'Your supervisor will be notified immediately',
              'You will be notified when they review your submission',
              'Analysis will unlock automatically upon approval',
            ].map((line) => (
              <p key={line} className="text-[12px] text-[var(--text-secondary)]">• {line}</p>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-7 flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || loadingData}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[var(--accent-blue)] to-purple-600 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Shield className="h-4 w-4" />
            {submitting ? 'Submitting…' : 'Submit for Approval →'}
          </button>
        </div>
      </div>
    </div>
  )
}
