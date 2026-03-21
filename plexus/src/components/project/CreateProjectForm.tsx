'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProjects } from '@/hooks/useProjects'
import { PROJECT_PHASES } from '@/lib/constants'
import { toast } from 'sonner'
import type { Department, ProjectPhase } from '@/types/app'

interface CreateProjectFormProps {
  departments?: Department[]
}

export function CreateProjectForm({ departments }: CreateProjectFormProps) {
  const router = useRouter()
  const { createProject } = useProjects()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    phase: 'concept' as ProjectPhase,
    start_date: '',
    target_end_date: '',
    department_id: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const errs: Record<string, string> = {}
    if (!form.title.trim()) errs.title = 'Title is required'
    if (form.start_date && form.target_end_date && form.target_end_date < form.start_date) {
      errs.target_end_date = 'End date must be after start date'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const project = await createProject({
        title: form.title.trim(),
        description: form.description.trim() || null,
        phase: form.phase,
        start_date: form.start_date || null,
        target_end_date: form.target_end_date || null,
        department_id: form.department_id || null,
      })
      toast.success('Project created!')
      router.push(`/projects/${project.id}/overview`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create project')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="title">Project title *</Label>
        <Input
          id="title"
          placeholder="e.g. Malaria prevalence in peri-urban areas"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className={errors.title ? 'border-red-400 focus-visible:ring-red-400' : ''}
        />
        {errors.title && <p className="text-xs text-red-600">{errors.title}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Brief description of your research project..."
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phase">Current phase</Label>
        <Select value={form.phase} onValueChange={(v) => setForm({ ...form, phase: v as ProjectPhase })}>
          <SelectTrigger id="phase">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROJECT_PHASES.filter((p) => p.value !== 'archived').map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="start_date">Start date</Label>
          <Input
            id="start_date"
            type="date"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="target_end_date">Target end date</Label>
          <Input
            id="target_end_date"
            type="date"
            value={form.target_end_date}
            onChange={(e) => setForm({ ...form, target_end_date: e.target.value })}
            className={errors.target_end_date ? 'border-red-400' : ''}
          />
          {errors.target_end_date && <p className="text-xs text-red-600">{errors.target_end_date}</p>}
        </div>
      </div>

      {departments && departments.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="department">Department (optional)</Label>
          <Select
            value={form.department_id}
            onValueChange={(v) => setForm({ ...form, department_id: v === 'none' ? '' : v })}
          >
            <SelectTrigger id="department">
              <SelectValue placeholder="Personal project (no department)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Personal project</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create project'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
