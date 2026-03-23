"use client"

import { useState } from 'react'
import { X, Send } from 'lucide-react'
import type { JournalSubmission } from './SubmissionTracker'

interface SubmissionFormProps {
  documentId: string
  projectId: string
  onSubmit: (data: Partial<JournalSubmission>) => Promise<void>
  onClose: () => void
}

export function SubmissionForm({ documentId, projectId, onSubmit, onClose }: SubmissionFormProps) {
  const [form, setForm] = useState({
    journal_name: '',
    status: 'submitted' as JournalSubmission['status'],
    submission_id: '',
    submitted_at: new Date().toISOString().split('T')[0],
    notes: '',
    cover_letter: '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.journal_name.trim()) return
    setSaving(true)
    try {
      await onSubmit({
        document_id: documentId,
        project_id: projectId,
        journal_name: form.journal_name,
        status: form.status,
        submission_id: form.submission_id || null,
        submitted_at: form.submitted_at ? new Date(form.submitted_at).toISOString() : null,
        notes: form.notes || null,
        cover_letter: form.cover_letter || null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">Record Submission</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Journal Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. BMJ Global Health"
              value={form.journal_name}
              onChange={e => setForm(f => ({ ...f, journal_name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as JournalSubmission['status'] }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="preparing">Preparing</option>
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="revision_requested">Revision Requested</option>
                <option value="revision_submitted">Revision Submitted</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="published">Published</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Submitted Date</label>
              <input
                type="date"
                value={form.submitted_at}
                onChange={e => setForm(f => ({ ...f, submitted_at: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Manuscript ID <span className="text-gray-400">(optional)</span></label>
            <input
              type="text"
              placeholder="e.g. BMJGH-2026-01234"
              value={form.submission_id}
              onChange={e => setForm(f => ({ ...f, submission_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes <span className="text-gray-400">(optional)</span></label>
            <textarea
              rows={3}
              placeholder="Reviewer comments, decisions, follow-up actions…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.journal_name.trim()}
              className="flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {saving ? 'Saving…' : 'Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
