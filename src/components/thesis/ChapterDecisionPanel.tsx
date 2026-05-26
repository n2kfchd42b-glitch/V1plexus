'use client'

/**
 * Supervisor decision UI for an open chapter submission.
 *
 * Mounted inside SupervisorDocumentViewer. On first render it asks the API
 * whether any chapter currently points at this document with an open
 * submission. If yes, renders "Approve" / "Request revisions" buttons +
 * a feedback textarea. The decide POST closes the submission and the
 * panel hides itself.
 *
 * Nothing renders when there's no open submission — supervisors browsing
 * documents that aren't under review see no chrome.
 */

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { THESIS_WORKFLOW_V2 } from '@/lib/flags'

interface OpenSubmission {
  chapter_id: string
  chapter_title: string
  round: number
  submitted_at: string
}

interface Props {
  projectId: string
  documentId: string
}

export function ChapterDecisionPanel({ projectId, documentId }: Props) {
  const [submission, setSubmission] = useState<OpenSubmission | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<'approved' | 'revision_requested' | null>(null)
  const [feedback, setFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)

  const load = useCallback(async () => {
    if (!THESIS_WORKFLOW_V2) { setLoading(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/thesis/document/${documentId}/open-submission`)
      if (res.ok) {
        const body = await res.json() as OpenSubmission | null
        setSubmission(body && body.chapter_id ? body : null)
      } else {
        setSubmission(null)
      }
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => { void load() }, [load])

  async function decide(decision: 'approved' | 'revision_requested') {
    if (!submission) return
    if (decision === 'revision_requested' && !feedback.trim()) {
      setShowFeedback(true)
      toast.error('Add feedback before requesting revisions')
      return
    }
    setSubmitting(decision)
    try {
      const res = await fetch(`/api/thesis/chapters/${submission.chapter_id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, feedback: feedback.trim() || undefined }),
      })
      const body = await res.json()
      if (!res.ok) {
        toast.error(body.error ?? 'Decision failed')
        return
      }
      toast.success(decision === 'approved' ? 'Chapter approved' : 'Revisions requested')
      setSubmission(null)
      setFeedback('')
      setShowFeedback(false)
    } finally {
      setSubmitting(null)
    }
  }

  if (loading || !submission) return null

  return (
    <div className="border-b bg-amber-50 border-amber-200">
      <div className="px-6 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              Awaiting your review: {submission.chapter_title} · round {submission.round}
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Submitted {new Date(submission.submitted_at).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowFeedback(v => !v)}
              className="text-xs font-medium text-amber-900 hover:text-amber-700 px-3 py-1.5 rounded-md border border-amber-300 hover:bg-amber-100 transition-colors"
            >
              {showFeedback ? 'Hide feedback' : 'Add feedback'}
            </button>
            <button
              onClick={() => decide('revision_requested')}
              disabled={submitting !== null}
              className={cn(
                'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors',
                'border border-amber-400 text-amber-900 hover:bg-amber-100 disabled:opacity-50',
              )}
            >
              {submitting === 'revision_requested' && <Loader2 className="h-3 w-3 animate-spin" />}
              <AlertCircle className="h-3 w-3" />
              Request revisions
            </button>
            <button
              onClick={() => decide('approved')}
              disabled={submitting !== null}
              className={cn(
                'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md text-white transition-colors',
                'bg-green-600 hover:bg-green-700 disabled:opacity-50',
              )}
            >
              {submitting === 'approved' && <Loader2 className="h-3 w-3 animate-spin" />}
              <CheckCircle2 className="h-3 w-3" />
              Approve
            </button>
          </div>
        </div>
        {showFeedback && (
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="Feedback to the student (optional for approval, required for revisions)"
            rows={3}
            className="mt-3 w-full px-3 py-2 text-sm border border-amber-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 text-text-primary resize-none"
          />
        )}
      </div>
    </div>
  )
}
