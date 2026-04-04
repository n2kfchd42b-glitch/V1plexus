"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { ProjectInviteRole } from '@/types/database'

const ROLES: { value: ProjectInviteRole; label: string }[] = [
  { value: 'co_pi', label: 'Co-PI' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'collaborator', label: 'Collaborator' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'viewer', label: 'Viewer' },
]

interface ProjectInviteFormProps {
  projectId: string
  projectTitle: string
  onInvited?: () => void
}

export function ProjectInviteForm({ projectId, projectTitle, onInvited }: ProjectInviteFormProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ProjectInviteRole>('collaborator')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)

    const res = await fetch('/api/invitations/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'project',
        email: email.trim().toLowerCase(),
        role,
        projectId,
        projectTitle,
        message: message || null,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error ?? 'Failed to send invitation')
    } else {
      toast.success(`Invitation sent to ${email}`)
      setEmail('')
      setMessage('')
      onInvited?.()
    }

    setLoading(false)
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
        Invite Collaborators — {projectTitle}
      </h3>
      <form onSubmit={handleInvite} className="space-y-3">
        <div>
          <Label htmlFor="inviteEmail" className="text-xs">Email</Label>
          <Input
            id="inviteEmail"
            type="email"
            placeholder="collaborator@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="mt-1 h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Role</Label>
          <div className="flex gap-2 mt-1 flex-wrap">
            {ROLES.map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  role === r.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-blue-400'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="inviteMessage" className="text-xs">Message <span className="text-gray-400">(optional)</span></Label>
          <Input
            id="inviteMessage"
            placeholder="I'd like you to help with…"
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="mt-1 h-8 text-sm"
          />
        </div>
        <Button type="submit" size="sm" disabled={loading} className="w-full">
          {loading ? 'Sending…' : 'Send Invitation'}
        </Button>
      </form>
    </div>
  )
}
