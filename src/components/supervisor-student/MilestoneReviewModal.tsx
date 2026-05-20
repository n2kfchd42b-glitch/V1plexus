'use client'

import { useState, useEffect } from 'react'
import { StudentMilestone, MilestoneSubmission } from '@/types/database'
import { X, CheckCircle2, RotateCcw, Database, BarChart2, FileText, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface LinkedArtifact {
  type: 'document' | 'dataset' | 'analysis_run'
  label: string
  projectId: string
  href: string
}

const ARTIFACT_CONFIG = {
  document:     { icon: FileText,  label: 'Document', color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-100' },
  dataset:      { icon: Database,  label: 'Dataset',  color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-100' },
  analysis_run: { icon: BarChart2, label: 'Analysis', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
}

interface Props {
  milestone: StudentMilestone
  onClose: () => void
  onSuccess: () => void
}

export function MilestoneReviewModal({ milestone, onClose, onSuccess }: Props) {
  const [decision, setDecision] = useState<'approved' | 'revision_requested' | null>(null)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkedArtifact, setLinkedArtifact] = useState<LinkedArtifact | null>(null)

  // Pick highest round submission
  const rawSubmissions = milestone.latest_submission
  const submission: MilestoneSubmission | undefined = Array.isArray(rawSubmissions)
    ? [...rawSubmissions].sort((a, b) => b.round - a.round)[0]
    : (rawSubmissions as MilestoneSubmission | undefined)

  // Resolve linked artifact metadata
  useEffect(() => {
    if (!submission) return
    const supabase = createClient()

    async function resolve() {
      if (!submission) return

      if (submission.document_id) {
        const { data } = await supabase
          .from('documents')
          .select('id, title, project_id')
          .eq('id', submission.document_id)
          .single()
        if (data) setLinkedArtifact({
          type: 'document',
          label: data.title || 'Untitled document',
          projectId: data.project_id,
          href: `/supervisor/projects/${data.project_id}/documents/${data.id}`,
        })
      } else if (submission.dataset_id) {
        const { data } = await supabase
          .from('datasets')
          .select('id, name, project_id')
          .eq('id', submission.dataset_id)
          .single()
        if (data) setLinkedArtifact({
          type: 'dataset',
          label: data.name,
          projectId: data.project_id,
          href: `/supervisor/projects/${data.project_id}/datasets/${data.id}`,
        })
      } else if (submission.analysis_run_id) {
        const { data } = await supabase
          .from('analysis_runs')
          .select('id, analysis_type, project_id')
          .eq('id', submission.analysis_run_id)
          .single()
        if (data) setLinkedArtifact({
          type: 'analysis_run',
          label: data.analysis_type.replace(/_/g, ' '),
          projectId: data.project_id,
          href: `/supervisor/projects/${data.project_id}/analyses/${data.id}`,
        })
      }
    }

    resolve()
  }, [submission])

  async function handleReview() {
    if (!decision || !feedback.trim() || !submission) return
    setSubmitting(true)
    setError(null)

    const res = await fetch(`/api/milestones/${milestone.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submission_id: submission.id, decision, feedback: feedback.trim() }),
    })

    if (res.ok) {
      onSuccess()
    } else {
      const body = await res.json()
      setError(body.error ?? 'Review failed')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Review Submission</h2>
            <p className="text-xs text-slate-500 mt-0.5">{milestone.title}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Student's submission */}
          {submission && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Student submission · Round {submission.round}
                </p>
                <p className="text-xs text-slate-400">
                  {format(new Date(submission.submitted_at), 'dd MMM yyyy, HH:mm')}
                </p>
              </div>

              {submission.note ? (
                <p className="text-sm text-slate-700">{submission.note}</p>
              ) : (
                <p className="text-xs text-slate-400 italic">No note provided</p>
              )}

              {/* Linked artifact */}
              {linkedArtifact && (() => {
                const cfg = ARTIFACT_CONFIG[linkedArtifact.type]
                const Icon = cfg.icon
                return (
                  <a
                    href={linkedArtifact.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all hover:shadow-sm group',
                      cfg.bg, cfg.border
                    )}
                  >
                    <Icon className={cn('h-4 w-4 flex-shrink-0', cfg.color)} />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs font-semibold capitalize truncate', cfg.color)}>{linkedArtifact.label}</p>
                      <p className="text-[10px] text-slate-400">{cfg.label} · click to open in Plexus</p>
                    </div>
                    <ExternalLink className={cn('h-3.5 w-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity', cfg.color)} />
                  </a>
                )
              })()}
            </div>
          )}

          {/* Decision */}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Your decision</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDecision('approved')}
                className={cn(
                  'flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all',
                  decision === 'approved'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-600 hover:border-emerald-300'
                )}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </button>
              <button
                onClick={() => setDecision('revision_requested')}
                className={cn(
                  'flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all',
                  decision === 'revision_requested'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-slate-200 text-slate-600 hover:border-orange-300'
                )}
              >
                <RotateCcw className="h-4 w-4" />
                Request revision
              </button>
            </div>
          </div>

          {/* Feedback */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Feedback <span className="text-red-400">*</span>
            </label>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={4}
              placeholder="Provide clear, constructive feedback for the student…"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReview}
              disabled={!decision || !feedback.trim() || submitting}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving…' : 'Submit Review'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
