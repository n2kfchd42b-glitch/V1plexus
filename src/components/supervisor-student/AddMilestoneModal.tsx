'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Plus } from 'lucide-react'
import { PHASE_ORDER, PHASE_COLORS, PHASE_LABELS } from '@/components/ui/phase-bar'
import { cn } from '@/lib/utils'

interface Props {
  studentId: string
  projectId?: string
  onClose: () => void
  onSuccess: () => void
}

export function AddMilestoneModal({ studentId, projectId, onClose, onSuccess }: Props) {
  const [title, setTitle]           = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate]       = useState('')
  const [phase, setPhase]           = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const supabase = createClient()

  async function handleCreate() {
    if (!title.trim()) return
    setSubmitting(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setSubmitting(false); return }

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
        student_id:   studentId,
        workspace_id: membership.workspace_id,
        project_id:   projectId ?? null,
        phase:        phase || null,
        title:        title.trim(),
        description:  description.trim() || undefined,
        due_date:     dueDate || null,
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

          {/* Phase picker — the new connector */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Research phase <span className="text-slate-400 font-normal">(links this milestone to the project timeline)</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {PHASE_ORDER.map(p => {
                const color = PHASE_COLORS[p]
                const selected = phase === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPhase(selected ? '' : p)}
                    className={cn(
                      'flex flex-col items-center gap-1 px-2 py-2 rounded-lg border-2 text-[10px] font-semibold transition-all',
                      selected
                        ? 'border-transparent text-white'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'
                    )}
                    style={selected ? { backgroundColor: color, borderColor: color } : {}}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: selected ? 'rgba(255,255,255,0.6)' : color }}
                    />
                    {PHASE_LABELS[p]}
                  </button>
                )
              })}
              {/* "No phase" option at the end */}
              <button
                type="button"
                onClick={() => setPhase('')}
                className={cn(
                  'flex flex-col items-center gap-1 px-2 py-2 rounded-lg border-2 text-[10px] font-semibold transition-all col-span-4',
                  phase === ''
                    ? 'border-slate-400 bg-slate-50 text-slate-600'
                    : 'border-slate-200 text-slate-400 hover:border-slate-300'
                )}
              >
                No phase (general milestone)
              </button>
            </div>
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
