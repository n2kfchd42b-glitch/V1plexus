'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Shield, ShieldCheck, ShieldX, ShieldAlert, ChevronRight,
  CheckCircle2, XCircle, RefreshCw, Pencil,
} from 'lucide-react'
import type { ApprovalRequestStatus, ReviewHistoryEntry } from '@/types/approvals'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string
  action: string
  timestamp: string
  details: {
    summary?: string
    justification?: string
    justification_category?: string
  } | null
  actor: { full_name: string | null } | null
  entry_hash: string
}

interface FullRequest {
  id: string
  status: ApprovalRequestStatus
  requested_at: string
  reviewed_at: string | null
  reviewer_note: string | null
  approved_version_hash: string | null
  request_message: string | null
  dataset: { id: string; name: string; project_id: string } | null
  version: {
    id: string
    version_number: number
    row_count: number
    column_count: number
    file_size: number | null
    operations: Array<{ type?: string; [k: string]: unknown }>
    schema_info: Array<{ name: string; type: string }>
  } | null
  project: { id: string; name: string } | null
  researcher: { full_name: string | null; role: string | null } | null
  supervisor: { full_name: string | null } | null
  history: Array<ReviewHistoryEntry & { reviewer: { full_name: string | null } | null }>
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

const STATUS_CHIP: Record<ApprovalRequestStatus, { label: string; className: string }> = {
  pending:            { label: 'Pending',          className: 'bg-amber-100 text-amber-700' },
  in_review:          { label: 'In Review',        className: 'bg-blue-100 text-blue-700' },
  approved:           { label: 'Approved',         className: 'bg-green-100 text-green-700' },
  rejected:           { label: 'Declined',         className: 'bg-red-100 text-red-700' },
  revision_requested: { label: 'Revisions Needed', className: 'bg-amber-100 text-amber-700' },
}

const HISTORY_COLORS: Record<string, string> = {
  submitted:          'bg-slate-400',
  viewed:             'bg-slate-300',
  approved:           'bg-green-500',
  rejected:           'bg-red-500',
  revision_requested: 'bg-amber-500',
  resubmitted:        'bg-blue-500',
}

// ── Inline action panel ───────────────────────────────────────────────────────

function ActionPanel({
  requestId,
  status,
  onDecision,
}: {
  requestId: string
  status: ApprovalRequestStatus
  onDecision: () => void
}) {
  const [activeAction, setActiveAction] = useState<'approve' | 'reject' | 'revision' | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const isResolved = status === 'approved' || status === 'rejected'

  const submit = async (action: 'approve' | 'reject' | 'request_revision') => {
    if ((action !== 'approve') && !note.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/approvals/${requestId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: note.trim() || undefined }),
      })
      if (res.ok) {
        setActiveAction(null)
        setNote('')
        onDecision()
      }
    } finally {
      setLoading(false)
    }
  }

  if (isResolved) {
    return (
      <div className="rounded-xl bg-[var(--bg-inset)] px-4 py-3 text-center text-[13px] text-[var(--text-tertiary)]">
        This request has been {status === 'approved' ? 'approved' : 'declined'}.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Your decision</p>

      {/* APPROVE */}
      {activeAction !== 'approve' ? (
        <button
          onClick={() => setActiveAction('approve')}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-green-700 to-green-600 hover:opacity-90 transition-opacity"
        >
          <ShieldCheck className="h-4 w-4" /> Approve Dataset
        </button>
      ) : (
        <div className="rounded-xl border border-green-200 bg-green-50/40 p-3 space-y-2">
          <p className="text-[11px] text-[var(--text-secondary)]">Optional note to researcher:</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Looks good. MICE imputation approach is sound."
            className="w-full min-h-[72px] rounded-lg border border-[var(--border-default)] bg-white p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => submit('approve')}
              disabled={loading}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-green-700 to-green-600 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Approving…' : 'Confirm Approval'}
            </button>
            <button onClick={() => { setActiveAction(null); setNote('') }} className="px-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* REQUEST REVISIONS */}
      {activeAction !== 'revision' ? (
        <button
          onClick={() => setActiveAction('revision')}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-amber-700 border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors"
        >
          <Pencil className="h-4 w-4" /> Request Revisions
        </button>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-2">
          <p className="text-[11px] text-[var(--text-secondary)]">
            Describe required revisions: <span className="text-red-500">*</span>
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Be specific about what needs to change before you can approve."
            className="w-full min-h-[100px] rounded-lg border border-[var(--border-default)] bg-white p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <div className="flex gap-2">
            <button
              onClick={() => submit('request_revision')}
              disabled={loading || !note.trim()}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Sending…' : 'Send Revision Request'}
            </button>
            <button onClick={() => { setActiveAction(null); setNote('') }} className="px-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* REJECT */}
      {activeAction !== 'reject' ? (
        <button
          onClick={() => setActiveAction('reject')}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-red-600 border border-[var(--border-subtle)] hover:bg-red-50 transition-colors"
        >
          <XCircle className="h-4 w-4" /> Decline Approval
        </button>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50/40 p-3 space-y-2">
          <p className="text-[11px] text-[var(--text-secondary)]">
            Reason for declining: <span className="text-red-500">*</span>
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Explain why this version cannot be approved."
            className="w-full min-h-[80px] rounded-lg border border-[var(--border-default)] bg-white p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <p className="text-[11px] italic text-red-500">
            This cannot be undone. The researcher will need to create a new dataset version.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => submit('reject')}
              disabled={loading || !note.trim()}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Declining…' : 'Confirm Decline'}
            </button>
            <button onClick={() => { setActiveAction(null); setNote('') }} className="px-3 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ApprovalReviewPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const router = useRouter()
  const [req, setReq] = useState<FullRequest | null>(null)
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [chainStatus, setChainStatus] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle')

  const fetchRequest = useCallback(async () => {
    setLoading(true)
    try {
      // We build the full request detail from Supabase directly (server would be cleaner
      // but this keeps it consistent with the existing client pattern)
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { data } = await supabase
        .from('dataset_approval_requests')
        .select(`
          id, status, requested_at, reviewed_at, reviewer_note,
          approved_version_hash, request_message,
          dataset:dataset_id(id, name, project_id),
          version:version_id(id, version_number, row_count, column_count, file_size, operations, schema_info),
          project:project_id(id, name),
          researcher:requested_by(full_name, role),
          supervisor:assigned_supervisor(full_name)
        `)
        .eq('id', requestId)
        .single()

      if (!data) return

      const { data: history } = await supabase
        .from('approval_review_history')
        .select('id, action, note, created_at, reviewer:reviewer_id(full_name)')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true })

      setReq({ ...data, history: history ?? [] } as unknown as FullRequest)

      // Load audit trail for version
      if (data.version) {
        const { data: entries } = await supabase
          .from('audit_logs')
          .select('id, action, timestamp, details, entry_hash, actor:actor_id(full_name)')
          .eq('resource_id', (data.version as unknown as { id: string }).id)
          .order('timestamp', { ascending: true })
        setAuditEntries((entries ?? []) as unknown as AuditEntry[])
      }
    } finally {
      setLoading(false)
    }
  }, [requestId])

  useEffect(() => { fetchRequest() }, [fetchRequest])

  const verifyChain = async () => {
    if (!req?.version) return
    setChainStatus('loading')
    try {
      const res = await fetch(
        `/api/audit/verify?resource_id=${(req.version as { id: string }).id}&resource_type=dataset_version`
      )
      const data = await res.json()
      setChainStatus(data.valid ? 'ok' : 'fail')
    } catch {
      setChainStatus('fail')
    }
  }

  if (loading) {
    return (
      <div className="max-w-[900px] mx-auto px-4 py-8 animate-pulse space-y-4">
        <div className="h-6 w-48 bg-[var(--bg-inset)] rounded" />
        <div className="h-10 w-64 bg-[var(--bg-inset)] rounded" />
        <div className="h-4 w-80 bg-[var(--bg-inset)] rounded" />
      </div>
    )
  }

  if (!req) {
    return (
      <div className="max-w-[900px] mx-auto px-4 py-8 text-center text-[var(--text-secondary)]">
        Request not found.
      </div>
    )
  }

  const chip = STATUS_CHIP[req.status]
  const version = req.version
  const ops = version?.operations ?? []

  return (
    <div className="max-w-[900px] mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] mb-4">
        <button onClick={() => router.push('/approvals')} className="hover:text-[var(--text-primary)]">
          Approvals
        </button>
        <ChevronRight className="h-3 w-3" />
        <span>{req.dataset?.name ?? 'Dataset'} v{version?.version_number}</span>
      </div>

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1
            className="text-[28px] font-extrabold text-[var(--text-primary)]"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            {req.dataset?.name}
          </h1>
          <p className="text-[13px] text-[var(--text-tertiary)] mt-1">
            Submitted by {req.researcher?.full_name ?? 'Unknown'} · {relative(req.requested_at)} · {req.project?.name}
          </p>
        </div>
        <span className={`mt-1 text-[11px] font-bold px-3 py-1 rounded-full ${chip.className}`}>
          {chip.label}
        </span>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6 items-start flex-wrap lg:flex-nowrap">
        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* SECTION 1 — Dataset overview */}
          <div className="rounded-2xl bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] shadow-sm p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-4">
              Dataset Overview
            </p>
            <div className="grid grid-cols-4 gap-4 mb-4">
              {[
                { label: 'Rows', value: version?.row_count.toLocaleString() ?? '—' },
                { label: 'Columns', value: String(version?.column_count ?? '—') },
                { label: 'File size', value: formatBytes(version?.file_size ?? null) },
                { label: 'Version', value: `v${version?.version_number ?? '—'}` },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{s.label}</p>
                  <p className="font-mono text-sm font-bold text-[var(--text-primary)] mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
            {ops.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {ops.map((op, i) => {
                  const t = op.type ?? 'op'
                  const isRemove = t.includes('drop') || t.includes('remove') || t.includes('duplicate')
                  const isImpute = t.includes('impute') || t.includes('mice')
                  return (
                    <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      isRemove ? 'bg-red-100 text-red-700' : isImpute ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {t}
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* SECTION 2 — Data lineage timeline */}
          <div className="rounded-2xl bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
                Data Lineage
              </p>
              <button
                onClick={verifyChain}
                disabled={chainStatus === 'loading'}
                className="text-[11px] text-[var(--accent-blue)] hover:underline flex items-center gap-1"
              >
                {chainStatus === 'loading' && <RefreshCw className="h-3 w-3 animate-spin" />}
                Verify chain integrity
                {chainStatus === 'ok' && <span className="text-green-600 ml-1">✓ Valid</span>}
                {chainStatus === 'fail' && <span className="text-red-500 ml-1">✗ Invalid</span>}
              </button>
            </div>

            {auditEntries.length === 0 ? (
              <p className="text-[13px] text-[var(--text-tertiary)]">No audit entries found for this version.</p>
            ) : (
              <div className="space-y-4">
                {auditEntries.map((entry, idx) => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-5 w-5 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                        {idx + 1}
                      </div>
                      {idx < auditEntries.length - 1 && (
                        <div className="w-px flex-1 bg-[var(--border-subtle)] mt-1" />
                      )}
                    </div>
                    <div className="pb-4 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-[var(--text-primary)]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                          {entry.action}
                        </span>
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                          {entry.actor?.full_name ?? 'Unknown'} · {relative(entry.timestamp)}
                        </span>
                      </div>
                      {entry.details?.summary && (
                        <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">{entry.details.summary}</p>
                      )}
                      {entry.details?.justification && (
                        <div className="flex gap-2 mt-1.5">
                          <div className="w-0.5 rounded-full bg-amber-400 shrink-0" />
                          <div>
                            <p className="text-[12px] text-[var(--text-primary)] leading-relaxed">
                              {entry.details.justification}
                            </p>
                            {entry.details.justification_category && (
                              <span className="mt-1 inline-block text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                {entry.details.justification_category}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      <p className="font-mono text-[9px] text-[var(--text-tertiary)] mt-1">
                        {entry.entry_hash.slice(0, 12)}…
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 3 — Operations detail */}
          {ops.length > 0 && (
            <div className="rounded-2xl bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] shadow-sm p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-4">
                Data Cleaning Operations
              </p>
              <div className="space-y-3">
                {ops.map((op, i) => {
                  const t = op.type ?? 'operation'
                  const isRemove = t.includes('drop') || t.includes('remove') || t.includes('duplicate')
                  const isImpute = t.includes('impute') || t.includes('mice')
                  return (
                    <div key={i} className="rounded-xl bg-[var(--bg-inset)] p-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isRemove ? 'bg-red-100 text-red-700' : isImpute ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {t}
                      </span>
                      {Array.isArray(op.columns) && (
                        <p className="text-[12px] text-[var(--text-secondary)] mt-2">
                          Columns: {(op.columns as string[]).join(', ')}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column ─────────────────────────────────────────────────── */}
        <div className="w-full lg:w-80 lg:sticky lg:top-24 space-y-4">
          <div className="rounded-2xl bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] shadow-sm p-6">
            {/* Researcher info */}
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-sm font-bold shrink-0">
                {(req.researcher?.full_name ?? 'U').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div>
                <p className="text-[14px] font-bold text-[var(--text-primary)]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {req.researcher?.full_name ?? 'Unknown'}
                </p>
                <p className="text-[12px] text-[var(--text-tertiary)]">{req.researcher?.role ?? 'Researcher'}</p>
                <p className="text-[11px] text-[var(--text-tertiary)]">{req.project?.name}</p>
              </div>
            </div>

            {req.request_message && (
              <div className="mt-3 rounded-xl bg-[var(--bg-inset)] px-3 py-2.5">
                <p className="text-[12px] italic text-[var(--text-secondary)]">
                  &ldquo;{req.request_message}&rdquo;
                </p>
              </div>
            )}

            <div className="my-4 h-px bg-[var(--border-subtle)]" />

            {/* Action panel */}
            <ActionPanel
              requestId={requestId}
              status={req.status}
              onDecision={fetchRequest}
            />

            {/* Review history */}
            {req.history.length > 0 && (
              <>
                <div className="my-4 h-px bg-[var(--border-subtle)]" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-3">History</p>
                <div className="space-y-3">
                  {req.history.map((h) => (
                    <div key={h.id} className="flex items-start gap-2">
                      <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${HISTORY_COLORS[h.action] ?? 'bg-slate-400'}`} />
                      <div>
                        <p className="text-[11px] font-semibold text-[var(--text-primary)]">
                          {h.action.replace(/_/g, ' ')}
                          {h.reviewer?.full_name ? ` · ${h.reviewer.full_name}` : ''}
                        </p>
                        {h.note && (
                          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{h.note}</p>
                        )}
                        <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{relative(h.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
