'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Plus } from 'lucide-react'

interface Props {
  studentId: string
  onClose: () => void
  onSuccess: () => void
}

export function AddMilestoneModal({ studentId, onClose, onSuccess }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handleCreate() {
    if (!title.trim()) return
    setSubmitting(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setSubmitting(false); return }

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_memberships')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!membership) { setError('No active workspace'); setSubmitting(false); return }

    const res = await fetch('/api/milestones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId,
        workspace_id: membership.workspace_id,
        title: title.trim(),
        description: description.trim() || undefined,
        due_date: dueDate || null,
      }),
    })

    if (res.ok) {
      onSuccess()
    } else {
      const body = await res.json()
      setError(body.error ?? 'Failed to create milestone')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Add Milestone</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Literature Review, Ethics Clearance, Proposal Defense…"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="What should the student complete for this milestone?"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Due date <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              onClick={handleCreate}
              disabled={!title.trim() || submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[#0052CC] text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {submitting ? 'Creating…' : 'Create Milestone'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
