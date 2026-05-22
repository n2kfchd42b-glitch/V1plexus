"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getProject, updateProject, updateProjectStatus, updateProjectShareToken, softDeleteProject } from '@/lib/data'
import { toast } from 'sonner'
import { Trash2, Save, ChevronDown, Link2, Copy, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Project } from '@/types/database'
import { logAudit } from '@/lib/audit'
import { useTranslations } from '@/i18n/useTranslations'

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
  const { t } = useTranslations()

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
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

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
