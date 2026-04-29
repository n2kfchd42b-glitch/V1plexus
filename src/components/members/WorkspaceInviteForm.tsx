"use client"

import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useWorkspaceContext } from '@/components/workspace/WorkspaceProvider'
import type { WorkspaceMemberRole, Department } from '@/types/database'


const ROLES: { value: WorkspaceMemberRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'department_head', label: 'Department Head' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'pi', label: 'PI' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'student', label: 'Student' },
  { value: 'collaborator', label: 'Collaborator' },
  { value: 'viewer', label: 'Viewer' },
]

export function WorkspaceInviteForm({ onInvited }: { onInvited?: () => void }) {
  const { activeWorkspace } = useWorkspaceContext()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<WorkspaceMemberRole>('researcher')
  const [departmentId, setDepartmentId] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!activeWorkspace?.institution_id) return
    supabase
      .from('departments')
      .select('*')
      .eq('institution_id', activeWorkspace.institution_id)
      .then(({ data }) => setDepartments(data ?? []))
  }, [activeWorkspace, supabase])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeWorkspace) return
    setLoading(true)

    try {
      const res = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'workspace',
          email: email.trim().toLowerCase(),
          role,
          workspaceId: activeWorkspace.id,
          workspaceName: activeWorkspace.name,
          departmentId: departmentId || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to send invitation')
      } else {
        toast.success(`Invitation sent to ${email}`)
        setEmail('')
        onInvited?.()
      }
    } catch {
      toast.error('Network error sending invitation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
        Invite Members — {activeWorkspace?.name}
      </h3>
      <form onSubmit={handleInvite} className="space-y-3">
        <div>
          <Label htmlFor="wsInviteEmail" className="text-xs">Email</Label>
          <Input
            id="wsInviteEmail"
            type="email"
            placeholder="newmember@institution.edu"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="mt-1 h-8 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="wsInviteRole" className="text-xs">Role</Label>
          <div className="relative">
            <select
              id="wsInviteRole"
              value={role}
              onChange={e => setRole(e.target.value as WorkspaceMemberRole)}
              className="mt-1 w-full rounded-md border border-[var(--border-default)] px-3 py-1.5 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-[var(--bg-surface)] text-[var(--text-primary)]"
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          </div>
        </div>
        {departments.length > 0 && (
          <div>
            <Label htmlFor="wsInviteDept" className="text-xs">Department <span className="text-gray-400">(optional)</span></Label>
            <div className="relative">
              <select
                id="wsInviteDept"
                value={departmentId}
                onChange={e => setDepartmentId(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--border-default)] px-3 py-1.5 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-[var(--bg-surface)] text-[var(--text-primary)]"
              >
                <option value="">No department</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}
        <Button type="submit" size="sm" disabled={loading} className="w-full">
          {loading ? 'Sending…' : 'Send Invitation'}
        </Button>
      </form>
    </div>
  )
}
