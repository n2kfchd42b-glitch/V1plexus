'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield, ShieldCheck, ShieldX, ShieldAlert, Clock, CheckCircle2, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { SubmitApprovalModal } from './SubmitApprovalModal'
import type { ApprovalCheck } from '@/types/approvals'

interface ApprovalStatusCardProps {
  datasetId: string
  datasetName: string
  versionId: string
  versionNumber: number
  projectId: string
  onRunAnalysis?: () => void
}

export function ApprovalStatusCard({
  datasetId,
  datasetName,
  versionId,
  versionNumber,
  projectId,
  onRunAnalysis,
}: ApprovalStatusCardProps) {
  const { user } = useAuth()
  const [check, setCheck] = useState<ApprovalCheck | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const supabase = createClient()

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/datasets/${datasetId}/approval/status?version_id=${versionId}`
      )
      if (!res.ok) return
      const json = await res.json()
      setCheck({
        status: json.status,
        can_analyze: json.can_analyze,
        reason: json.reason,
        request: json.request
          ? {
              id: json.request.id,
              requested_at: json.request.requested_at,
              reviewed_at: json.request.reviewed_at,
              reviewer_note: json.request.reviewer_note,
              approved_version_hash: json.request.approved_version_hash,
            }
          : undefined,
      })
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [datasetId, versionId])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleCancelRequest = async () => {
    if (!check?.request?.id) return
    setCancelling(true)
    try {
      await supabase
        .from('dataset_approval_requests')
        .delete()
        .eq('id', check.request.id)
        .eq('requested_by', user?.id ?? '')
      await fetchStatus()
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] p-5 animate-pulse">
        <div className="h-4 w-32 bg-[var(--bg-inset)] rounded mb-3" />
        <div className="h-3 w-48 bg-[var(--bg-inset)] rounded" />
      </div>
    )
  }

  // NOT_REQUIRED — no supervisors on project, render nothing
  if (!check || check.status === 'not_required') return null

  const relative = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  // ── NOT REQUESTED ──────────────────────────────────────────────────────────
  if (check.status === 'not_requested') {
    return (
      <>
        <SubmitApprovalModal
          isOpen={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          datasetId={datasetId}
          datasetName={datasetName}
          versionId={versionId}
          versionNumber={versionNumber}
          projectId={projectId}
          onSubmitted={fetchStatus}
        />
        <div className="rounded-xl bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[var(--text-tertiary)]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Approval</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-inset)] text-[var(--text-tertiary)]">
              Not submitted
            </span>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
            Submit this dataset version for supervisor approval before running analyses.
          </p>
          <button
            onClick={() => setShowSubmitModal(true)}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[var(--accent-blue)] to-purple-600 hover:opacity-90 transition-opacity"
          >
            Submit for Approval →
          </button>
        </div>
      </>
    )
  }

  // ── PENDING ────────────────────────────────────────────────────────────────
  if (check.status === 'pending' || check.status === 'in_review') {
    const isPending = check.status === 'pending'
    return (
      <div className="rounded-xl bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className={`h-5 w-5 ${isPending ? 'text-amber-500' : 'text-[var(--accent-blue)]'}`} />
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Approval</span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isPending ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {isPending ? 'Awaiting Review' : 'Under Review'}
          </span>
        </div>
        {check.request && (
          <p className="text-[12px] text-[var(--text-tertiary)]">
            Submitted {relative(check.request.requested_at)}
          </p>
        )}
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
          {isPending ? 'Awaiting supervisor review.' : 'Supervisor is reviewing this version.'}
          {' '}Analysis will unlock upon approval.
        </p>
        {check.request && !check.request.reviewed_at && isPending && (
          <button
            onClick={handleCancelRequest}
            disabled={cancelling}
            className="text-[11px] text-[var(--status-error)] hover:underline disabled:opacity-50"
          >
            {cancelling ? 'Cancelling…' : 'Cancel request'}
          </button>
        )}
      </div>
    )
  }

  // ── REVISION REQUESTED ─────────────────────────────────────────────────────
  if (check.status === 'revision_requested') {
    return (
      <div className="rounded-xl bg-[var(--bg-surface-lowest)] border border-amber-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Approval</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            Revisions Requested
          </span>
        </div>
        {check.request?.reviewer_note && (
          <div className="flex gap-2">
            <div className="w-0.5 rounded-full bg-amber-400 shrink-0" />
            <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">
              {check.request.reviewer_note}
            </p>
          </div>
        )}
        <ResubmitModal requestId={check.request?.id ?? ''} onResubmitted={fetchStatus} />
      </div>
    )
  }

  // ── APPROVED ───────────────────────────────────────────────────────────────
  if (check.status === 'approved') {
    return (
      <div className="rounded-xl bg-[var(--bg-surface-lowest)] border border-green-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Approval</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
            Approved
          </span>
        </div>
        {check.request?.reviewed_at && (
          <p className="text-[12px] text-[var(--text-tertiary)]">
            Approved {relative(check.request.reviewed_at)}
          </p>
        )}
        {check.request?.reviewer_note && (
          <div className="rounded-lg bg-[var(--bg-inset)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
            {check.request.reviewer_note}
          </div>
        )}
        {check.request?.approved_version_hash && (
          <p
            className="font-mono text-[9px] text-[var(--text-tertiary)] truncate"
            title={`Approval hash: ${check.request.approved_version_hash}`}
          >
            Approval hash: {check.request.approved_version_hash.slice(0, 12)}…
          </p>
        )}
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-green-700">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          Ready to Analyse
        </div>
        {onRunAnalysis && (
          <button
            onClick={onRunAnalysis}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[var(--accent-blue)] to-purple-600 hover:opacity-90 transition-opacity"
          >
            Run Analysis →
          </button>
        )}
      </div>
    )
  }

  // ── REJECTED ───────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl bg-[var(--bg-surface-lowest)] border border-red-200 shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldX className="h-5 w-5 text-red-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Approval</span>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
          Not Approved
        </span>
      </div>
      {check.request?.reviewer_note && (
        <div className="flex gap-2">
          <div className="w-0.5 rounded-full bg-red-400 shrink-0" />
          <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">
            {check.request.reviewer_note}
          </p>
        </div>
      )}
      <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
        Create a revised dataset version addressing the feedback above, then submit again.
      </p>
    </div>
  )
}

// ── Inline resubmit sub-component ─────────────────────────────────────────────

function ResubmitModal({
  requestId,
  onResubmitted,
}: {
  requestId: string
  onResubmitted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const handleResubmit = async () => {
    if (!note.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/approvals/${requestId}/resubmit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resubmission_note: note }),
      })
      if (res.ok) {
        setOpen(false)
        setNote('')
        onResubmitted()
      }
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[var(--accent-blue)] to-purple-600 hover:opacity-90 transition-opacity"
      >
        Resubmit for Approval →
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Describe what you changed in response to the feedback…"
        className="w-full min-h-[72px] rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
      />
      <div className="flex gap-2">
        <button
          onClick={handleResubmit}
          disabled={!note.trim() || loading}
          className="flex-1 rounded-xl py-2 text-sm font-semibold text-white bg-gradient-to-r from-[var(--accent-blue)] to-purple-600 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Resubmitting…' : 'Confirm Resubmit'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-4 rounded-xl text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
