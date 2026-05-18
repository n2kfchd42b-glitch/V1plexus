'use client'

import { useState } from 'react'
import { X, UserPlus, Mail } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  workspaceId: string
  workspaceName: string
  supervisorId: string
  onClose: () => void
}

export function InviteStudentModal({ workspaceId, workspaceName, supervisorId, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)

    const res = await fetch('/api/invitations/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'workspace',
        email: email.trim().toLowerCase(),
        role: 'student',
        workspaceId,
        workspaceName,
        supervisorId,
        message: message.trim() || undefined,
      }),
    })

    const body = await res.json()
    if (res.ok) {
      toast.success(`Invitation sent to ${email.trim()}`)
      onClose()
    } else {
      toast.error(body.error ?? 'Failed to send invitation')
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Invite a Student</h2>
              <p className="text-xs text-slate-500 mt-0.5">They'll join your workspace as a student under your supervision</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSend} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Student email <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="student@university.edu"
                required
                autoFocus
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Personal message <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              placeholder="e.g. Looking forward to working with you on your research…"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {sending ? 'Sending…' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
