"use client"

import { useState } from 'react'
import { Plus, ChevronDown, ChevronUp, Calendar, Hash, FileText, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface JournalSubmission {
  id: string
  document_id: string
  project_id: string | null
  journal_id: string | null
  journal_name: string
  status: 'preparing' | 'submitted' | 'under_review' | 'revision_requested' | 'revision_submitted' | 'accepted' | 'rejected' | 'published' | 'withdrawn'
  submission_id: string | null
  submitted_at: string | null
  response_at: string | null
  published_at: string | null
  published_doi: string | null
  published_url: string | null
  cover_letter: string | null
  notes: string | null
  revision_count: number
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<JournalSubmission['status'], { label: string; color: string; bg: string }> = {
  preparing:          { label: 'Preparing',           color: 'text-gray-600',   bg: 'bg-gray-100' },
  submitted:          { label: 'Submitted',            color: 'text-blue-600',   bg: 'bg-blue-50' },
  under_review:       { label: 'Under Review',         color: 'text-amber-600',  bg: 'bg-amber-50' },
  revision_requested: { label: 'Revision Requested',   color: 'text-orange-600', bg: 'bg-orange-50' },
  revision_submitted: { label: 'Revision Submitted',   color: 'text-blue-600',   bg: 'bg-blue-50' },
  accepted:           { label: 'Accepted',             color: 'text-green-600',  bg: 'bg-green-50' },
  rejected:           { label: 'Rejected',             color: 'text-red-600',    bg: 'bg-red-50' },
  published:          { label: 'Published',            color: 'text-green-700',  bg: 'bg-green-100' },
  withdrawn:          { label: 'Withdrawn',            color: 'text-gray-500',   bg: 'bg-gray-50' },
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysAgo(iso: string | null): string {
  if (!iso) return ''
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'yesterday'
  return `${diff} days ago`
}

interface SubmissionCardProps {
  submission: JournalSubmission
  onUpdate: (id: string, patch: Partial<JournalSubmission>) => void
  isCurrent?: boolean
}

function SubmissionCard({ submission, onUpdate, isCurrent }: SubmissionCardProps) {
  const [expanded, setExpanded] = useState(isCurrent)
  const cfg = STATUS_CONFIG[submission.status]

  return (
    <div className={cn(
      'border rounded-xl overflow-hidden bg-white',
      isCurrent ? 'border-blue-200' : 'border-gray-200'
    )}>
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          {isCurrent && <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">Current</span>}
          <span className="font-medium text-sm text-gray-900">{submission.journal_name}</span>
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cfg.bg, cfg.color)}>
            {cfg.label}
          </span>
          {submission.revision_count > 0 && (
            <span className="text-xs text-gray-400 flex items-center gap-0.5">
              <RefreshCw className="h-3 w-3" />
              Rev {submission.revision_count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{formatDate(submission.submitted_at ?? submission.created_at)}</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {submission.submission_id && (
              <div>
                <span className="text-gray-500 flex items-center gap-1"><Hash className="h-3 w-3" />Manuscript ID</span>
                <span className="font-mono text-gray-900 mt-0.5 block">{submission.submission_id}</span>
              </div>
            )}
            {submission.submitted_at && (
              <div>
                <span className="text-gray-500 flex items-center gap-1"><Calendar className="h-3 w-3" />Submitted</span>
                <span className="text-gray-900 mt-0.5 block">{formatDate(submission.submitted_at)} <span className="text-gray-400">({daysAgo(submission.submitted_at)})</span></span>
              </div>
            )}
            {submission.response_at && (
              <div>
                <span className="text-gray-500 flex items-center gap-1"><Calendar className="h-3 w-3" />Response</span>
                <span className="text-gray-900 mt-0.5 block">{formatDate(submission.response_at)}</span>
              </div>
            )}
            {submission.published_doi && (
              <div>
                <span className="text-gray-500 flex items-center gap-1"><Hash className="h-3 w-3" />Published DOI</span>
                <a href={`https://doi.org/${submission.published_doi}`} target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:underline mt-0.5 block">{submission.published_doi}</a>
              </div>
            )}
          </div>

          {submission.notes && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700">
              <p className="font-medium text-gray-500 mb-1 flex items-center gap-1"><FileText className="h-3 w-3" />Notes</p>
              <p>{submission.notes}</p>
            </div>
          )}

          {/* Status update */}
          <div className="flex items-center gap-2 pt-1">
            <select
              value={submission.status}
              onChange={e => onUpdate(submission.id, { status: e.target.value as JournalSubmission['status'] })}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <span className="text-xs text-gray-400">Update status</span>
          </div>
        </div>
      )}
    </div>
  )
}

interface SubmissionTrackerProps {
  submissions: JournalSubmission[]
  documentId: string
  projectId: string
  onUpdate: (id: string, patch: Partial<JournalSubmission>) => void
  onAdd: () => void
}

export function SubmissionTracker({ submissions, documentId, projectId, onUpdate, onAdd }: SubmissionTrackerProps) {
  const current = submissions.find(s => !['rejected', 'withdrawn', 'published'].includes(s.status))
  const previous = submissions.filter(s => ['rejected', 'withdrawn', 'published'].includes(s.status))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">Submission History</h3>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Record submission
        </button>
      </div>

      {submissions.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
          <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-600">No submissions recorded</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Track where and when you submit this manuscript</p>
          <button
            onClick={onAdd}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Record first submission →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {current && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Current</p>
              <SubmissionCard submission={current} onUpdate={onUpdate} isCurrent />
            </div>
          )}
          {previous.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Previous</p>
              <div className="space-y-2">
                {previous.map(s => (
                  <SubmissionCard key={s.id} submission={s} onUpdate={onUpdate} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
