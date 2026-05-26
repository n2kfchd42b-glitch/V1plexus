'use client'

/**
 * Thesis lifecycle state widget.
 *
 * Fetches GET /api/thesis/[projectId]/transition which returns the current
 * state + which transitions the caller can make from here. Renders the
 * state as a chip and the allowed next states as buttons. Calling POST
 * with the target state advances the lifecycle.
 *
 * Coordinators / admins must also supply a reason (the API rejects forced
 * transitions without one); a small modal prompts for it when they pick
 * a non-canonical edge.
 */

import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Loader2, GitBranch } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ThesisLifecycleState, ThesisRole } from '@/types/thesis-workflow'
import { canForceTransition } from '@/types/thesis-workflow'

interface Props {
  projectId: string
}

interface DeniedTransition {
  state: ThesisLifecycleState
  reason: string | null
  code: string | null
}

interface PreviewResponse {
  current_state: ThesisLifecycleState | null
  role: ThesisRole
  allowed_next: ThesisLifecycleState[]
  denied: DeniedTransition[]
}

const STATE_LABEL: Record<ThesisLifecycleState, string> = {
  matched:         'Matched',
  proposal_draft:  'Proposal draft',
  proposal_review: 'Proposal review',
  active:          'Active',
  chapter_review:  'Final chapter review',
  submitted:       'Submitted',
  approved:        'Approved',
  archived:        'Archived',
}

const STATE_COLOR: Record<ThesisLifecycleState, string> = {
  matched:         'bg-gray-100 text-gray-800',
  proposal_draft:  'bg-blue-50 text-blue-700',
  proposal_review: 'bg-purple-50 text-purple-700',
  active:          'bg-emerald-50 text-emerald-700',
  chapter_review:  'bg-purple-50 text-purple-700',
  submitted:       'bg-indigo-50 text-indigo-700',
  approved:        'bg-green-100 text-green-800',
  archived:        'bg-gray-200 text-gray-700',
}

export function ThesisLifecyclePanel({ projectId }: Props) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<ThesisLifecycleState | null>(null)
  const [reasonFor, setReasonFor] = useState<ThesisLifecycleState | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/thesis/${projectId}/transition`)
      if (res.ok) setPreview(await res.json())
      else setPreview(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void load() }, [load])

  async function transition(to: ThesisLifecycleState, reasonText?: string) {
    setSubmitting(to)
    try {
      const res = await fetch(`/api/thesis/${projectId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_state: to, reason: reasonText }),
      })
      const body = await res.json()
      if (!res.ok) {
        toast.error(body.error ?? 'Transition failed')
        return
      }
      toast.success(`${STATE_LABEL[body.from as ThesisLifecycleState]} → ${STATE_LABEL[body.to as ThesisLifecycleState]}`)
      setReasonFor(null)
      setReason('')
      await load()
    } finally {
      setSubmitting(null)
    }
  }

  function handleClick(to: ThesisLifecycleState) {
    if (!preview) return
    if (canForceTransition(preview.role)) {
      setReasonFor(to)
    } else {
      void transition(to)
    }
  }

  if (loading) {
    return (
      <div
        className="rounded-xl border p-5"
        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
      >
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading workflow state…
        </div>
      </div>
    )
  }

  if (!preview || !preview.current_state) return null

  const current = preview.current_state

  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Workflow State
          </h3>
        </div>
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold', STATE_COLOR[current])}>
          {STATE_LABEL[current]}
        </span>
      </div>

      {preview.allowed_next.length > 0 ? (
        <div>
          <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
            You can move this thesis to:
          </p>
          <div className="space-y-1.5">
            {preview.allowed_next.map(state => (
              <button
                key={state}
                onClick={() => handleClick(state)}
                disabled={submitting !== null}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-colors hover:bg-[var(--bg-surface-hover)] disabled:opacity-50"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
              >
                <span>{STATE_LABEL[state]}</span>
                {submitting === state ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                )}
              </button>
            ))}
          </div>
          {canForceTransition(preview.role) && (
            <p className="mt-2 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              You'll be asked for a reason — coordinator transitions are audited as forced.
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          No transitions available from this state for your role ({preview.role}).
        </p>
      )}

      {/* Reason modal for force-transitions */}
      {reasonFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setReasonFor(null)}>
          <div
            className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-md p-5 border border-[var(--border-default)]"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              Reason for force-transition
            </h3>
            <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
              Moving {STATE_LABEL[current]} → {STATE_LABEL[reasonFor]} as {preview.role}.
              This is recorded in the audit trail.
            </p>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Why are you advancing this thesis directly?"
              rows={3}
              autoFocus
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] resize-none"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setReasonFor(null); setReason('') }}
                className="px-3 py-1.5 text-xs font-medium rounded-md border"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => transition(reasonFor, reason.trim() || undefined)}
                disabled={!reason.trim() || submitting !== null}
                className="px-3 py-1.5 text-xs font-semibold rounded-md bg-[var(--accent-blue)] text-white disabled:opacity-50"
              >
                {submitting === reasonFor ? 'Transitioning…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
