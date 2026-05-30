"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlaskConical, CheckCircle, XCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from '@/i18n/useTranslations'
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
  const { t } = useTranslations()

  useEffect(() => {
    const lookupToken = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push(`/login?redirect=/invite/${token}`)
        return
      }

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

      setError(t('invite.notFoundMessage', 'Invitation not found or has expired.'))
      setLoading(false)
    }

    lookupToken()
  }, [token, supabase, router, t])

  const handleAccept = async () => {
    setAccepting(true)

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      router.push(`/login?redirect=/invite/${token}`)
      return
    }

    if (inviteType === 'workspace' && workspaceInvite) {
      // Supervisor email invite: create the assignment, mark the user as
      // available to supervise (auto opt-in — they accepted, after all), and
      // make sure workspace setup is marked complete so they don't get bounced
      // back to /setup on next sign-in.
      if (workspaceInvite.role === 'supervisor') {
        const { error: assignErr } = await supabase
          .from('supervisor_assignments')
          .insert({
            supervisor_id: user.id,
            student_id: workspaceInvite.invited_by,
            workspace_id: workspaceInvite.workspace_id,
            department_id: null,
            role: 'primary',
            assigned_by: workspaceInvite.invited_by,
            status: 'active',
          })

        if (assignErr) {
          toast.error(assignErr.message)
          setAccepting(false)
          return
        }

        await Promise.all([
          supabase
            .from('workspace_invitations')
            .update({ status: 'accepted' })
            .eq('token', token),
          supabase
            .from('profiles')
            .update({
              available_to_supervise: true,
              workspace_setup_completed: true,
              onboarding_completed: true,
            })
            .eq('id', user.id),
        ])

        toast.success('You are now supervising this student on Plexus.')
        router.push('/supervisor/dashboard')
        return
      }

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

      // When accepting an institutional workspace admin invite, mirror the
      // role + institution onto the user's profile so the existing institution
      // admin surfaces (settings card, thesis policy page, workflow role
      // resolution) recognise them.
      //
      // The workspace must be fetched HERE (after the membership upsert),
      // not from the pre-accept invitation join — RLS on `workspaces` only
      // allows SELECT once the user is a member.
      let isInstitutionalLead = false
      if (workspaceInvite.role === 'admin' || workspaceInvite.role === 'department_head') {
        const { data: ws } = await supabase
          .from('workspaces')
          .select('type, institution_id')
          .eq('id', workspaceInvite.workspace_id)
          .maybeSingle()

        if (ws?.type === 'institutional' && ws.institution_id) {
          isInstitutionalLead = workspaceInvite.role === 'admin'
          const profileUpdate: Record<string, unknown> = {
            institution_id: ws.institution_id,
            workspace_setup_completed: true,
            onboarding_completed: true,
          }
          if (workspaceInvite.role === 'admin') profileUpdate.role = 'admin'
          // department_head invites keep the user's existing profile.role
          // (typically 'researcher' or 'pi'); the department_head capability
          // is granted by the workspace_memberships row alone.

          const { error: profileErr } = await supabase
            .from('profiles')
            .update(profileUpdate)
            .eq('id', user.id)
          if (profileErr) {
            toast.error(profileErr.message)
            setAccepting(false)
            return
          }
        }
      }

      await supabase
        .from('workspace_invitations')
        .update({ status: 'accepted' })
        .eq('token', token)

      toast.success(t('invite.joinedWorkspace', 'You joined the workspace!'))
      if (isInstitutionalLead) {
        router.push('/settings')
        return
      }
      router.push(workspaceInvite.role === 'student' ? '/student/milestones' : '/dashboard')
    } else if (inviteType === 'project' && projectInvite) {
      const { error: memErr } = await supabase
        .from('project_members')
        .upsert({
          project_id: projectInvite.project_id,
          user_id: user.id,
          role: projectInvite.role === 'co_pi' ? 'pi' : (projectInvite.role === 'viewer' || projectInvite.role === 'reviewer') ? 'viewer' : 'member',
        }, { onConflict: 'project_id,user_id' })

      if (memErr) {
        toast.error(memErr.message)
        setAccepting(false)
        return
      }

      await supabase
        .from('profiles')
        .update({ workspace_setup_completed: true })
        .eq('id', user.id)

      await supabase
        .from('project_invitations')
        .update({ status: 'accepted' })
        .eq('token', token)

      toast.success(t('invite.joinedProject', 'You joined the project!'))
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
          <h2 className="text-lg font-bold text-gray-900 mb-2">{t('invite.notFound', 'Invitation Not Found')}</h2>
          <p className="text-gray-600 text-sm mb-6">{error}</p>
          <Button onClick={() => router.push('/dashboard')} className="w-full">
            {t('common.goToDashboard', 'Go to Dashboard')}
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
              <h2 className="text-lg font-bold text-gray-900 mb-2">{t('invite.expired', 'Invitation Expired')}</h2>
              <p className="text-gray-600 text-sm mb-6">
                {t('invite.expiredMessage', 'This invitation has expired. Please request a new one.')}
              </p>
              <Button variant="outline" onClick={() => router.push('/dashboard')} className="w-full">
                {t('common.goToDashboard', 'Go to Dashboard')}
              </Button>
            </>
          ) : isAccepted ? (
            <>
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <h2 className="text-lg font-bold text-gray-900 mb-2">{t('invite.alreadyAccepted', 'Already Accepted')}</h2>
              <p className="text-gray-600 text-sm mb-6">
                {t('invite.alreadyAcceptedMessage', "You've already accepted this invitation.")}
              </p>
              <Button onClick={() => router.push('/dashboard')} className="w-full">
                {t('common.goToDashboard', 'Go to Dashboard')}
              </Button>
            </>
          ) : (
            <>
              <div className="mb-6">
                {inviteType === 'workspace' && workspaceInvite?.role === 'supervisor' ? (
                  <>
                    <p className="text-gray-600 text-sm mb-1">You&apos;ve been asked to supervise</p>
                    <h2 className="text-xl font-bold text-gray-900">a student on Plexus</h2>
                    <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                      Accepting makes you their supervisor. You&apos;ll be able to view their projects, annotate work, and log supervision sessions.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-600 text-sm mb-1">{t('invite.invitedTo', "You've been invited to")}</p>
                    <h2 className="text-xl font-bold text-gray-900">{inviteName}</h2>
                    {inviteType === 'workspace' && workspaceInvite && (
                      <p className="text-sm text-gray-500 mt-1">
                        {t('common.role', 'Role:')} <span className="font-medium capitalize">{workspaceInvite.role}</span>
                      </p>
                    )}
                    {inviteType === 'project' && projectInvite && (
                      <p className="text-sm text-gray-500 mt-1">
                        {t('common.role', 'Role:')} <span className="font-medium capitalize">{projectInvite.role.replace('_', ' ')}</span>
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push('/dashboard')}
                >
                  {t('invite.decline', 'Decline')}
                </Button>
                <Button
                  className="flex-1"
                  disabled={accepting}
                  onClick={handleAccept}
                >
                  {accepting ? t('invite.accepting', 'Accepting…') : t('invite.accept', 'Accept Invitation')}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
