"use client"

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getProject, updateProject, updateProjectStatus, updateProjectShareToken, softDeleteProject } from '@/lib/data'
import { toast } from 'sonner'
import { Trash2, Save, ChevronDown, Link2, Copy, Check, X, UserPlus, Crown, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ProjectInviteForm } from '@/components/members/ProjectInviteForm'
import type { Project, ProjectMemberRole } from '@/types/database'
import { logAudit } from '@/lib/audit'
import { useTranslations } from '@/i18n/useTranslations'
import { useAuth } from '@/hooks/useAuth'

interface MemberRow {
  id: string
  user_id: string
  role: ProjectMemberRole
  joined_at: string
  user: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null
}

const ROLE_LABELS: Record<ProjectMemberRole, string> = {
  owner: 'Owner',
  pi: 'Co-PI',
  member: 'Editor',
  viewer: 'Viewer',
}

const ASSIGNABLE_ROLES: { value: ProjectMemberRole; label: string }[] = [
  { value: 'pi', label: 'Co-PI' },
  { value: 'member', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
]

function initials(name: string | null, email: string) {
  if (name) return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
  return email[0].toUpperCase()
}

const STATUS_OPTION_KEYS: { value: Project['status']; labelKey: string }[] = [
  { value: 'draft',     labelKey: 'common.draft' },
  { value: 'active',    labelKey: 'common.active' },
  { value: 'completed', labelKey: 'project.status.completed' },
  { value: 'archived',  labelKey: 'project.status.archived' },
]

const PHASE_OPTIONS = [
  { value: 'design',          label: 'Design' },
  { value: 'data_collection', label: 'Data Collection' },
  { value: 'analysis',        label: 'Analysis' },
  { value: 'writing',         label: 'Writing' },
  { value: 'submitted',       label: 'Submitted' },
  { value: 'published',       label: 'Published' },
]

export default function ProjectSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const supabase = createClient()
  const { user } = useAuth()

  const [project, setProject] = useState<Project | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<Project['status']>('draft')
  const [phase, setPhase] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const { t } = useTranslations()

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true)
    const res = await fetch(`/api/projects/${projectId}/members`)
    if (res.ok) setMembers(await res.json())
    setMembersLoading(false)
  }, [projectId])

  const handleRoleChange = async (memberId: string, newRole: ProjectMemberRole) => {
    const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    if (res.ok) {
      setMembers(prev => prev.map(m => m.user_id === memberId ? { ...m, role: newRole } : m))
      toast.success('Role updated')
    } else {
      toast.error('Failed to update role')
    }
  }

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, { method: 'DELETE' })
    if (res.ok) {
      setMembers(prev => prev.filter(m => m.user_id !== memberId))
      toast.success(`${memberName} removed from project`)
    } else {
      toast.error('Failed to remove member')
    }
  }

  useEffect(() => {
    const fetchProject = async () => {
      const result = await getProject(supabase, projectId)
      if (result.data) {
        const data = result.data
        setProject(data)
        setTitle(data.title ?? '')
        setDescription(data.description ?? '')
        setStatus(data.status ?? 'draft')
        setPhase(data.phase ?? '')
        setStartDate(data.start_date ?? '')
        setEndDate(data.end_date ?? '')
      }
      setLoading(false)
    }
    fetchProject()
    fetchMembers()
  }, [projectId, fetchMembers]) // eslint-disable-line react-hooks/exhaustive-deps

  const shareUrl = project?.share_token
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')}/share/${project.share_token}`
    : null

  const handleGenerateShareLink = async () => {
    setShareLoading(true)
    const token = crypto.randomUUID()
    const result = await updateProjectShareToken(supabase, projectId, token)
    if (result.status === 'error') { toast.error(t('projectSettings.toastShareFailed')); setShareLoading(false); return }
    setProject(prev => prev ? { ...prev, share_token: token } : prev)
    logAudit('project.share_link.generated', 'project', projectId, {}, projectId)
    toast.success(t('projectSettings.toastShareGenerated'))
    setShareLoading(false)
  }

  const handleRevokeShareLink = async () => {
    setShareLoading(true)
    const result = await updateProjectShareToken(supabase, projectId, null)
    if (result.status === 'error') { toast.error(t('projectSettings.toastRevokeFailed')); setShareLoading(false); return }
    setProject(prev => prev ? { ...prev, share_token: null } : prev)
    logAudit('project.share_link.revoked', 'project', projectId, {}, projectId)
    toast.success(t('projectSettings.toastRevoked'))
    setShareLoading(false)
  }

  const handleCopyShareLink = () => {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    })
  }

  const handleSave = async () => {
    if (!title.trim()) { toast.error(t('projectSettings.titleRequired')); return }
    setSaving(true)
    const result = await updateProject(supabase, projectId, {
      title: title.trim(),
      description: description.trim() || null,
      status,
      phase: (phase || null) as Project['phase'] | null,
      start_date: startDate || null,
      end_date: endDate || null,
    })
    if (result.status === 'error') {
      toast.error(t('projectSettings.toastSaveFailed'))
    } else {
      toast.success(t('projectSettings.toastSaved'))
      setProject(prev => prev ? { ...prev, title: title.trim(), description: description.trim() || null, status } : prev)
      logAudit('project.updated', 'project', projectId, { title: title.trim(), status, phase: phase || null }, projectId)
    }
    setSaving(false)
  }

  const handleArchive = async () => {
    const result = await updateProjectStatus(supabase, projectId, 'archived')
    if (result.status === 'error') { toast.error(t('projectSettings.toastArchiveFailed')); return }
    logAudit('project.archived', 'project', projectId, { title: project?.title }, projectId)
    toast.success(t('projectSettings.toastArchived'))
    setStatus('archived')
  }

  const handleDelete = async () => {
    if (deleteConfirmText.trim().toLowerCase() !== project?.title.toLowerCase()) {
      toast.error(t('projectSettings.titleMismatch'))
      return
    }
    const result = await softDeleteProject(supabase, projectId)
    if (result.status === 'error') { toast.error(t('projectSettings.toastDeleteFailed')); return }
    logAudit('project.deleted', 'project', projectId, { title: project?.title }, projectId)
    toast.success(t('projectSettings.toastDeleted'))
    router.push('/projects')
  }

  if (loading) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
      </div>
    )
  }

  if (!project) return null

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('projectSettings.title')}</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-0.5">{t('projectSettings.subtitle')}</p>
      </div>

      {/* General */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('projectSettings.general')}</h3>

        <div>
          <Label htmlFor="proj-title" className="text-xs font-medium text-[var(--text-secondary)]">{t('projectSettings.fieldTitle')}</Label>
          <Input
            id="proj-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="proj-desc" className="text-xs font-medium text-[var(--text-secondary)]">{t('projectSettings.fieldDesc')}</Label>
          <Textarea
            id="proj-desc"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="mt-1.5 resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="proj-status" className="text-xs font-medium text-[var(--text-secondary)]">{t('projectSettings.fieldStatus')}</Label>
            <div className="relative">
              <select
                id="proj-status"
                value={status}
                onChange={e => setStatus(e.target.value as Project['status'])}
                className="mt-1.5 w-full h-9 px-3 pr-8 text-sm appearance-none bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-blue)]/20 text-[var(--text-primary)]"
              >
                {STATUS_OPTION_KEYS.map(o => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <Label htmlFor="proj-start" className="text-xs font-medium text-[var(--text-secondary)]">{t('projectSettings.fieldStartDate')}</Label>
            <Input
              id="proj-start"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="proj-end" className="text-xs font-medium text-[var(--text-secondary)]">{t('projectSettings.fieldEndDate')}</Label>
            <Input
              id="proj-end"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save className="h-3.5 w-3.5" />
          {saving ? t('projectSettings.saving') : t('projectSettings.saveChanges')}
        </Button>
      </section>

      {/* Members */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <Users className="h-4 w-4 text-[var(--text-tertiary)]" />
              Members
            </h3>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Manage access and roles for this project.</p>
          </div>
          {project?.owner_id === user?.id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInviteForm(v => !v)}
              className="gap-1.5 text-xs"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {showInviteForm ? 'Close' : 'Invite'}
            </Button>
          )}
        </div>

        {showInviteForm && project && (
          <div className="border border-[var(--border-default)] rounded-lg p-4 bg-[var(--bg-app)]">
            <ProjectInviteForm
              projectId={projectId}
              projectTitle={project.title}
              onInvited={() => { setShowInviteForm(false); fetchMembers() }}
            />
          </div>
        )}

        {membersLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}
          </div>
        ) : members.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)] py-2">No members yet — invite collaborators above.</p>
        ) : (
          <ul className="space-y-2">
            {members.map(m => {
              const displayName = m.user?.full_name ?? m.user?.email ?? 'Unknown'
              const isOwner = m.role === 'owner' || m.user_id === project?.owner_id
              const isCurrentUser = m.user_id === user?.id
              const canManage = project?.owner_id === user?.id && !isOwner

              return (
                <li key={m.user_id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)]">
                  {/* Avatar */}
                  <div className="h-8 w-8 rounded-full bg-[var(--accent-blue)]/10 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-[var(--accent-blue)]">
                    {m.user?.avatar_url
                      ? <img src={m.user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      : initials(m.user?.full_name ?? null, m.user?.email ?? '?')}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {displayName}
                      {isCurrentUser && <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">(you)</span>}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] truncate">{m.user?.email}</p>
                  </div>

                  {/* Role */}
                  {isOwner ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex-shrink-0">
                      <Crown className="h-3 w-3" />
                      Owner
                    </span>
                  ) : canManage ? (
                    <div className="relative flex-shrink-0">
                      <select
                        value={m.role}
                        onChange={e => handleRoleChange(m.user_id, e.target.value as ProjectMemberRole)}
                        className="text-xs h-7 pl-2 pr-6 appearance-none bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md outline-none focus:border-[var(--border-focus)] text-[var(--text-secondary)]"
                      >
                        {ASSIGNABLE_ROLES.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-default)] px-2 py-0.5 rounded-full flex-shrink-0">
                      {ROLE_LABELS[m.role]}
                    </span>
                  )}

                  {/* Remove button */}
                  {canManage && (
                    <button
                      onClick={() => handleRemoveMember(m.user_id, displayName)}
                      className="text-[var(--text-tertiary)] hover:text-red-500 transition-colors flex-shrink-0"
                      title="Remove from project"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Share link */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('projectSettings.shareTimeline')}</h3>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            {t('projectSettings.shareTimelineDesc')}
          </p>
        </div>

        {shareUrl ? (
          <div className="space-y-3">
            {/* Link display */}
            <div className="flex items-center gap-2 px-3 py-2 rounded border border-[var(--border-default)] bg-[var(--bg-app)]">
              <Link2 className="h-3.5 w-3.5 text-[var(--text-tertiary)] flex-shrink-0" />
              <span className="text-xs text-[var(--text-secondary)] flex-1 truncate font-mono">{shareUrl}</span>
              <button
                onClick={handleCopyShareLink}
                className="flex items-center gap-1 text-xs font-medium text-[var(--accent-blue)] hover:opacity-80 flex-shrink-0"
              >
                {shareCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {shareCopied ? t('projectSettings.copied') : t('projectSettings.copy')}
              </button>
            </div>
            {/* Revoke */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevokeShareLink}
              disabled={shareLoading}
              className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              {t('projectSettings.revokeLink')}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateShareLink}
            disabled={shareLoading}
            className="gap-1.5"
          >
            <Link2 className="h-3.5 w-3.5" />
            {shareLoading ? t('projectSettings.generating') : t('projectSettings.generateShareLink')}
          </Button>
        )}
      </section>

      {/* Danger zone */}
      <section className="bg-[var(--bg-surface)] border border-red-200 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-red-600">{t('projectSettings.dangerZone')}</h3>

        <div className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)]">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">{t('projectSettings.archiveProject')}</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{t('projectSettings.archiveProjectDesc')}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleArchive}
            disabled={status === 'archived'}
            className="text-amber-600 border-amber-200 hover:bg-amber-50"
          >
            {t('projectSettings.archiveProject')}
          </Button>
        </div>

        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">{t('projectSettings.deleteProject')}</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5 mb-3">
            {t('projectSettings.deleteProjectDescPrefix')} <span className="font-mono font-semibold">{project.title}</span> {t('projectSettings.deleteProjectDescSuffix')}
          </p>
          {!showDeleteConfirm ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {t('projectSettings.deleteProject')}
            </Button>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder={`${t('projectSettings.typeToConfirmPrefix')} "${project.title}" ${t('projectSettings.typeToConfirmSuffix')}`}
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                className="border-red-300 focus:border-red-400"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteConfirmText.trim().toLowerCase() !== project.title.toLowerCase()}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {t('projectSettings.confirmDelete')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
