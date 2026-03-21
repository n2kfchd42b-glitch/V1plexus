'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus, CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { ProjectMilestone, MilestoneStatus } from '@/types/app'

const statusIcons: Record<MilestoneStatus, React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-[#A0AEC0]" />,
  in_progress: <Clock className="h-4 w-4 text-[#2E75B6]" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  overdue: <AlertCircle className="h-4 w-4 text-red-500" />,
}

interface MilestoneTrackerProps {
  projectId: string
  isOwner: boolean
}

export function MilestoneTracker({ projectId, isOwner }: MilestoneTrackerProps) {
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchMilestones = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('project_milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    setMilestones((data as ProjectMilestone[]) ?? [])
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    fetchMilestones()
  }, [fetchMilestones])

  async function addMilestone() {
    if (!newTitle.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('project_milestones').insert({
      project_id: projectId,
      title: newTitle.trim(),
      due_date: newDueDate || null,
      sort_order: milestones.length,
    } as Record<string, unknown>)
    if (error) {
      toast.error('Failed to add milestone')
    } else {
      toast.success('Milestone added')
      setNewTitle('')
      setNewDueDate('')
      setShowForm(false)
      await fetchMilestones()
    }
    setSaving(false)
  }

  async function toggleMilestone(milestone: ProjectMilestone) {
    const supabase = createClient()
    const newStatus: MilestoneStatus =
      milestone.status === 'completed' ? 'pending' : 'completed'
    const { error } = await supabase
      .from('project_milestones')
      .update({
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
      } as Record<string, unknown>)
      .eq('id', milestone.id)
    if (!error) await fetchMilestones()
  }

  if (loading) {
    return <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 bg-[#F7F8FA] rounded-md animate-pulse" />
      ))}
    </div>
  }

  return (
    <div className="space-y-3">
      {milestones.length === 0 && !showForm && (
        <p className="text-sm text-[#A0AEC0] text-center py-4">No milestones yet</p>
      )}

      {milestones.map((milestone) => (
        <div
          key={milestone.id}
          className="flex items-center gap-3 p-3 rounded-md border border-[#E2E8F0] hover:bg-[#F7F8FA] transition-colors"
        >
          <button
            onClick={() => toggleMilestone(milestone)}
            disabled={!isOwner}
            className="shrink-0 disabled:cursor-not-allowed"
          >
            {statusIcons[milestone.status]}
          </button>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${milestone.status === 'completed' ? 'line-through text-[#A0AEC0]' : 'text-[#1A202C]'}`}>
              {milestone.title}
            </p>
            {milestone.due_date && (
              <p className="text-xs text-[#718096]">{formatDate(milestone.due_date)}</p>
            )}
          </div>
          <StatusBadge type="milestone" value={milestone.status} />
        </div>
      ))}

      {showForm && (
        <div className="flex gap-2 p-3 border border-[#2E75B6] rounded-md bg-[#F7F8FA]">
          <div className="flex-1 space-y-2">
            <Input
              placeholder="Milestone title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addMilestone()}
              autoFocus
            />
            <Input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Button size="sm" onClick={addMilestone} disabled={saving || !newTitle.trim()}>
              {saving ? '...' : 'Add'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {isOwner && !showForm && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full border border-dashed border-[#E2E8F0] text-[#718096] hover:text-[#1A202C]"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add milestone
        </Button>
      )}
    </div>
  )
}
