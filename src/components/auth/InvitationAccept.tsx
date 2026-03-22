"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlaskConical, CheckCircle, XCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { WorkspaceInvitation, ProjectInvitation } from '@/types/database'

interface InvitationAcceptProps {
  token: string
}

type InviteType = 'workspace' | 'project' | null

export function InvitationAccept({ token }: InvitationAcceptProps) {
  const [inviteType, setInviteType] = useState<InviteType>(null)
  const [workspaceInvite, setWorkspaceInvite] = useState<WorkspaceInvitation | null>(null)
  const [projectInvite, setProjectInvite] = useState<ProjectInvitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const lookupToken = async () => {
      // Try workspace invitation first
      const { data: wsInvite } = await supabase
        .from('workspace_invitations')
        .select('*, workspace:workspaces(*)')
        .eq('token', token)
        .maybeSingle()

      if (wsInvite) {
        setInviteType('workspace')
        setWorkspaceInvite(wsInvite as WorkspaceInvitation)
        setLoading(false)
        return
      }

      // Try project invitation
      const { data: projInvite } = await supabase
        .from('project_invitations')
        .select('*, project:projects(*)')
        .eq('token', token)
        .maybeSingle()

      if (projInvite) {
        setInviteType('project')
        setProjectInvite(projInvite as ProjectInvitation)
        setLoading(false)
        return
      }

      setError('Invitation not found or has expired.')
      setLoading(false)
    }

    lookupToken()
  }, [token, supabase])

  const handleAccept = async () => {
    setAccepting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push(`/login?redirect=/invite/${token}`)
      return
    }

    if (inviteType === 'workspace' && workspaceInvite) {
      // Create workspace membership
      const { error: memErr } = await supabase
        .from('workspace_memberships')
        .upsert({
          workspace_id: workspaceInvite.workspace_id,
          user_id: user.id,
          role: workspaceInvite.role,
          department_id: workspaceInvite.department_id,
          supervisor_id: workspaceInvite.supervisor_id,
          status: 'active',
          invited_by: workspaceInvite.invited_by,
        }, { onConflict: 'workspace_id,user_id' })

      if (memErr) {
        toast.error(memErr.message)
        setAccepting(false)
        return
      }

      // Mark invitation as accepted
      await supabase
        .from('workspace_invitations')
        .update({ status: 'accepted' })
        .eq('token', token)

      toast.success('You joined the workspace!')
      router.push('/dashboard')
    } else if (inviteType === 'project' && projectInvite) {
      // Add as project member
      const { error: memErr } = await supabase
        .from('project_members')
        .upsert({
          project_id: projectInvite.project_id,
          user_id: user.id,
          role: projectInvite.role === 'co_pi' ? 'pi' : projectInvite.role === 'viewer' ? 'viewer' : 'member',
        }, { onConflict: 'project_id,user_id' })

      if (memErr) {
        toast.error(memErr.message)
        setAccepting(false)
        return
      }

      await supabase
        .from('project_invitations')
        .update({ status: 'accepted' })
        .eq('token', token)

      toast.success('You joined the project!')
      router.push(`/projects/${projectInvite.project_id}`)
    }

    setAccepting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center max-w-md w-full">
          <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">Invitation Not Found</h2>
          <p className="text-gray-600 text-sm mb-6">{error}</p>
          <Button onClick={() => router.push('/dashboard')} className="w-full">
            Go to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  const isExpired = workspaceInvite?.status === 'expired' || projectInvite?.status === 'expired'
  const isAccepted = workspaceInvite?.status === 'accepted' || projectInvite?.status === 'accepted'

  const inviteName = inviteType === 'workspace'
    ? (workspaceInvite?.workspace as { name?: string } | null)?.name ?? 'workspace'
    : (projectInvite?.project as { title?: string } | null)?.title ?? 'project'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <FlaskConical className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">PLEXUS</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          {isExpired ? (
            <>
              <Clock className="h-12 w-12 text-amber-400 mx-auto mb-4" />
              <h2 className="text-lg font-bold text-gray-900 mb-2">Invitation Expired</h2>
              <p className="text-gray-600 text-sm mb-6">
                This invitation has expired. Please request a new one.
              </p>
              <Button variant="outline" onClick={() => router.push('/dashboard')} className="w-full">
                Go to Dashboard
              </Button>
            </>
          ) : isAccepted ? (
            <>
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <h2 className="text-lg font-bold text-gray-900 mb-2">Already Accepted</h2>
              <p className="text-gray-600 text-sm mb-6">
                You&apos;ve already accepted this invitation.
              </p>
              <Button onClick={() => router.push('/dashboard')} className="w-full">
                Go to Dashboard
              </Button>
            </>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-gray-600 text-sm mb-1">You&apos;ve been invited to</p>
                <h2 className="text-xl font-bold text-gray-900">{inviteName}</h2>
                {inviteType === 'workspace' && workspaceInvite && (
                  <p className="text-sm text-gray-500 mt-1">Role: <span className="font-medium capitalize">{workspaceInvite.role}</span></p>
                )}
                {inviteType === 'project' && projectInvite && (
                  <p className="text-sm text-gray-500 mt-1">Role: <span className="font-medium capitalize">{projectInvite.role.replace('_', ' ')}</span></p>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push('/dashboard')}
                >
                  Decline
                </Button>
                <Button
                  className="flex-1"
                  disabled={accepting}
                  onClick={handleAccept}
                >
                  {accepting ? 'Accepting…' : 'Accept Invitation'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
