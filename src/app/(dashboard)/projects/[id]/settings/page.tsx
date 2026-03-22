"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Trash2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Project } from '@/types/database'

const STATUS_OPTIONS: { value: Project['status']; label: string }[] = [
  { value: 'draft',     label: 'Draft' },
  { value: 'active',    label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived',  label: 'Archived' },
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

  useEffect(() => {
    const fetchProject = async () => {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()
      if (data) {
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

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Project title is required'); return }
    setSaving(true)
    const { error } = await supabase
      .from('projects')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        status,
        phase: phase || null,
        start_date: startDate || null,
        end_date: endDate || null,
      })
      .eq('id', projectId)
    if (error) {
      toast.error('Failed to save changes')
    } else {
      toast.success('Project settings saved')
      setProject(prev => prev ? { ...prev, title: title.trim(), description: description.trim() || null, status } : prev)
    }
    setSaving(false)
  }

  const handleArchive = async () => {
    const { error } = await supabase
      .from('projects')
      .update({ status: 'archived' })
      .eq('id', projectId)
    if (error) { toast.error('Failed to archive project'); return }
    toast.success('Project archived')
    setStatus('archived')
  }

  const handleDelete = async () => {
    if (deleteConfirmText !== project?.title) {
      toast.error('Project title does not match')
      return
    }
    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', projectId)
    if (error) { toast.error('Failed to delete project'); return }
    toast.success('Project deleted')
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
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Project Settings</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Manage metadata, phase, and lifecycle for this project.</p>
      </div>

      {/* General */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">General</h3>

        <div>
          <Label htmlFor="proj-title" className="text-xs font-medium text-[var(--text-secondary)]">Title</Label>
          <Input
            id="proj-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="proj-desc" className="text-xs font-medium text-[var(--text-secondary)]">Description</Label>
          <Textarea
            id="proj-desc"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="mt-1.5 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="proj-status" className="text-xs font-medium text-[var(--text-secondary)]">Status</Label>
            <select
              id="proj-status"
              value={status}
              onChange={e => setStatus(e.target.value as Project['status'])}
              className="mt-1.5 w-full h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-blue)]/20 text-[var(--text-primary)]"
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <Label htmlFor="proj-phase" className="text-xs font-medium text-[var(--text-secondary)]">Phase</Label>
            <select
              id="proj-phase"
              value={phase}
              onChange={e => setPhase(e.target.value)}
              className="mt-1.5 w-full h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-blue)]/20 text-[var(--text-primary)]"
            >
              <option value="">— Select phase —</option>
              {PHASE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="proj-start" className="text-xs font-medium text-[var(--text-secondary)]">Start Date</Label>
            <Input
              id="proj-start"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="proj-end" className="text-xs font-medium text-[var(--text-secondary)]">Target End Date</Label>
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
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </section>

      {/* Danger zone */}
      <section className="bg-[var(--bg-surface)] border border-red-200 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-red-600">Danger Zone</h3>

        <div className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)]">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Archive project</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Hides the project from the active list. Can be undone.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleArchive}
            disabled={status === 'archived'}
            className="text-amber-600 border-amber-200 hover:bg-amber-50"
          >
            Archive
          </Button>
        </div>

        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">Delete project</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5 mb-3">
            Permanently removes this project. Type <span className="font-mono font-semibold">{project.title}</span> to confirm.
          </p>
          {!showDeleteConfirm ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete Project
            </Button>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder={`Type "${project.title}" to confirm`}
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                className="border-red-300 focus:border-red-400"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteConfirmText !== project.title}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Confirm Delete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
