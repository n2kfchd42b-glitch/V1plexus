'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface LinkProjectModalProps {
  grantId: string
  alreadyLinkedIds: string[]
  open: boolean
  onOpenChange: (v: boolean) => void
  onLinked: () => void
}

interface ProjectOption {
  id: string
  title: string
  status: string
}

export function LinkProjectModal({ grantId, alreadyLinkedIds, open, onOpenChange, onLinked }: LinkProjectModalProps) {
  const { profile } = useAuth()
  const supabase = createClient()
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [budget, setBudget] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !profile?.institution_id) return
    supabase
      .from('projects')
      .select('id, title, status')
      .eq('institution_id', profile.institution_id)
      .order('title')
      .then(({ data }) => {
        if (data) setProjects(data.filter(p => !alreadyLinkedIds.includes(p.id)))
      })
  }, [open, profile, supabase, alreadyLinkedIds])

  const filtered = projects.filter(p => p.title.toLowerCase().includes(search.toLowerCase()))

  const handleLink = async () => {
    if (selected.length === 0) return
    setSaving(true)
    const rows = selected.map(pid => ({
      grant_id: grantId,
      project_id: pid,
      budget_allocated: budget ? parseFloat(budget) : null,
    }))
    const { error } = await supabase.from('grant_projects').insert(rows)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(`${selected.length} project${selected.length > 1 ? 's' : ''} linked to grant.`)
    setSelected([])
    setBudget('')
    onLinked()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link Projects to Grant</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
            <Input
              placeholder="Search projects…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1 rounded-lg border border-[var(--border-default)] p-2">
            {filtered.length === 0 ? (
              <p className="text-xs text-[var(--text-tertiary)] py-4 text-center">No projects available.</p>
            ) : filtered.map(p => (
              <label
                key={p.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors',
                  selected.includes(p.id)
                    ? 'bg-blue-50 dark:bg-blue-950/30'
                    : 'hover:bg-[var(--bg-surface-hover)]'
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={e => setSelected(prev =>
                    e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                  )}
                  className="rounded"
                />
                <span className="flex-1 truncate">{p.title}</span>
                <span className="text-xs text-[var(--text-tertiary)] capitalize">{p.status}</span>
              </label>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Budget Allocated (optional)</Label>
            <Input
              type="number"
              min="0"
              placeholder="e.g. 100000"
              value={budget}
              onChange={e => setBudget(e.target.value)}
            />
            <p className="text-xs text-[var(--text-tertiary)]">Applied to all selected projects equally.</p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={handleLink} disabled={saving || selected.length === 0} className="flex-1">
              {saving ? 'Linking…' : `Link ${selected.length > 0 ? selected.length : ''} Project${selected.length !== 1 ? 's' : ''}`}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
