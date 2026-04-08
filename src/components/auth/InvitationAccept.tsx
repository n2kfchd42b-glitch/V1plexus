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
      console.log('[InvitationAccept] Looking up token:', token)

      // RLS on invitation tables requires authentication — redirect to login first
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.log('[InvitationAccept] Not authenticated, redirecting to login')
        router.push(`/login?redirect=/invite/${token}`)
        return
      }

      // Try workspace invitation first
      const { data: wsInvite, error: wsError } = await supabase
        .from('workspace_invitations')
        .select('*, workspace:workspaces(*)')
        .eq('token', token)
        .maybeSingle()

      if (wsError) {
        console.error('[InvitationAccept] Workspace invitation lookup error:', wsError)
      }

      if (wsInvite) {
        console.log('[InvitationAccept] Found workspace invitation')
        setInviteType('workspace')
        setWorkspaceInvite(wsInvite as WorkspaceInvitation)
        setLoading(false)
        return
      }

      // Try project invitation
      const { data: projInvite, error: projError } = await supabase
        .from('project_invitations')
        .select('*, project:projects(*)')
        .eq('token', token)
        .maybeSingle()

      if (projError) {
        console.error('[InvitationAccept] Project invitation lookup error:', projError)
      }

      if (projInvite) {
        console.log('[InvitationAccept] Found project invitation')
        setInviteType('project')
        setProjectInvite(projInvite as ProjectInvitation)
        setLoading(false)
        return
      }

      console.error('[InvitationAccept] No invitation found for token:', token)
      setError('Invitation not found or has expired.')
      setLoading(false)
    }

    lookupToken()
  }, [token, supabase, router])

  const handleAccept = async () => {
    setAccepting(true)
    console.log('[InvitationAccept] Accept clicked')
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.log('[InvitationAccept] User not logged in, redirecting to login')
      router.push(`/login?redirect=/invite/${token}`)
      return
    }

    console.log('[InvitationAccept] User logged in:', user.id)

    if (inviteType === 'workspace' && workspaceInvite) {
      console.log('[InvitationAccept] Accepting workspace invitation')
      
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
        console.error('[InvitationAccept] Workspace membership error:', memErr)
        toast.error(memErr.message)
        setAccepting(false)
        return
      }

      // Mark invitation as accepted
      const { error: updateErr } = await supabase
        .from('workspace_invitations')
        .update({ status: 'accepted' })
        .eq('token', token)

      if (updateErr) {
        console.error('[InvitationAccept] Error marking invitation accepted:', updateErr)
      }

      console.log('[InvitationAccept] Workspace invitation accepted successfully')
      toast.success('You joined the workspace!')
      router.push('/dashboard')
    } else if (inviteType === 'project' && projectInvite) {
      console.log('[InvitationAccept] Accepting project invitation')
      
      // Add as project member
      const { error: memErr } = await supabase
        .from('project_members')
        .upsert({
          project_id: projectInvite.project_id,
          user_id: user.id,
          role: projectInvite.role === 'co_pi' ? 'pi' : (projectInvite.role === 'viewer' || projectInvite.role === 'reviewer') ? 'viewer' : 'member',
        }, { onConflict: 'project_id,user_id' })

      if (memErr) {
        console.error('[InvitationAccept] Project membership error:', memErr)
        toast.error(memErr.message)
        setAccepting(false)
        return
      }

      // Mark workspace setup as completed so the middleware doesn't redirect
      // new users to /setup when they land on the project page.
      // Invited collaborators don't need their own workspace to get started.
      await supabase
        .from('profiles')
        .update({ workspace_setup_completed: true })
        .eq('id', user.id)

      const { error: updateErr } = await supabase
        .from('project_invitations')
        .update({ status: 'accepted' })
        .eq('token', token)

      if (updateErr) {
        console.error('[InvitationAccept] Error marking invitation accepted:', updateErr)
      }

      console.log('[InvitationAccept] Project invitation accepted successfully')
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
