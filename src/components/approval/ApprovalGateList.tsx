"use client"

import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ApprovalGateCard } from './ApprovalGateCard'
import { createClient } from '@/lib/supabase/client'
import type { ApprovalGate, Profile } from '@/types/database'

interface ApprovalGateListProps {
  projectId: string
  currentProfile: Profile | null
}

export function ApprovalGateList({ projectId, currentProfile }: ApprovalGateListProps) {
  const [gates, setGates] = useState<ApprovalGate[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [gateType, setGateType] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetchGates = async () => {
    const { data } = await supabase
      .from('approval_gates')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
    if (data) setGates(data)
  }

  useEffect(() => { fetchGates() }, [projectId])

  const handleAdd = async () => {
    if (!title || !gateType) return
    setLoading(true)
    const { data } = await supabase
      .from('approval_gates')
      .insert({ project_id: projectId, gate_type: gateType, title, description: description || null })
      .select()
      .single()
    if (data) setGates(prev => [...prev, data])
    setTitle(''); setGateType(''); setDescription('')
    setShowAdd(false)
    setLoading(false)
  }

  const handleApprove = async (id: string) => {
    if (!currentProfile) return
    await supabase
      .from('approval_gates')
      .update({ status: 'approved', approved_by: currentProfile.id, approved_at: new Date().toISOString() })
      .eq('id', id)
    fetchGates()
  }

  const handleBlock = async (id: string) => {
    await supabase
      .from('approval_gates')
      .update({ status: 'blocked' })
      .eq('id', id)
    fetchGates()
  }

  const canManage = currentProfile?.role === 'supervisor' || currentProfile?.role === 'admin'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Approval Gates</h3>
        {canManage && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAdd(true)}>
            <Plus className="h-3 w-3 mr-1" />
            Add Gate
          </Button>
        )}
      </div>

      {gates.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No approval gates defined.</p>
      ) : (
        <div className="space-y-2">
          {gates.map(gate => (
            <ApprovalGateCard
              key={gate.id}
              gate={gate}
              currentProfile={currentProfile}
              onApprove={handleApprove}
              onBlock={handleBlock}
            />
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Approval Gate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Gate Type</Label>
              <Input
                placeholder="e.g. protocol_final, ethics_submit"
                value={gateType}
                onChange={e => setGateType(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Title</Label>
              <Input
                placeholder="Gate title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="What needs to be completed..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={loading || !title || !gateType}>
              {loading ? 'Adding...' : 'Add Gate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
