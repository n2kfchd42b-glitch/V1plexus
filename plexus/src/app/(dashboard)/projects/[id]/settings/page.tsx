'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { PROJECT_PHASES, PROJECT_STATUSES } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Tables } from '@/types/database'
import type { ProjectPhase, ProjectStatus } from '@/types/app'

type ProjectRow = Tables<'projects'>

export default function ProjectSettingsPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [project, setProject] = useState<ProjectRow | null>(null)
  const [form, setForm] = useState({ title: '', description: '', phase: '', status: '', start_date: '', target_end_date: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase.from('projects').select('*').eq('id', id).single()
      if (data) {
        const p = data as ProjectRow
        setProject(p)
        setForm({
          title: p.title,
          description: p.description ?? '',
          phase: p.phase,
          status: p.status,
          start_date: p.start_date ?? '',
          target_end_date: p.target_end_date ?? '',
        })
        setIsOwner(user?.id === p.owner_id)
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('projects')
      .update({
        title: form.title.trim(),
        description: form.description.trim() || null,
        phase: form.phase as ProjectPhase,
        status: form.status as ProjectStatus,
        start_date: form.start_date || null,
        target_end_date: form.target_end_date || null,
      })
      .eq('id', id)
    if (error) toast.error('Failed to save settings')
    else toast.success('Settings saved')
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    toast.success('Project deleted')
    router.push('/projects')
  }

  if (loading) return <div className="h-8 w-48 bg-[#E2E8F0] animate-pulse rounded" />
  if (!project) return null

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Project settings</CardTitle>
          <CardDescription>Update your project details and phase</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} disabled={!isOwner} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={!isOwner} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Phase</Label>
                <Select value={form.phase} onValueChange={(v) => setForm({ ...form, phase: v })} disabled={!isOwner}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_PHASES.filter((p) => p.value !== 'archived').map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })} disabled={!isOwner}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} disabled={!isOwner} />
              </div>
              <div className="space-y-1.5">
                <Label>Target end date</Label>
                <Input type="date" value={form.target_end_date} onChange={(e) => setForm({ ...form, target_end_date: e.target.value })} disabled={!isOwner} />
              </div>
            </div>
            {isOwner && (
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</Button>
            )}
          </form>
        </CardContent>
      </Card>

      {isOwner && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700">Danger zone</CardTitle>
            <CardDescription>Permanently delete this project and all its data.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>Delete project</Button>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete project"
        description="This will permanently delete the project and all associated data. This action cannot be undone."
        confirmLabel="Delete project"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  )
}
