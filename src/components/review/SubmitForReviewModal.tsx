"use client"

import { useState, useEffect } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import { logAudit } from '@/lib/audit'

interface SubmitForReviewModalProps {
  open: boolean
  onClose: () => void
  documentId: string
  documentVersion: number
  currentProfile: Profile | null
  onSubmitted: () => void
}

export function SubmitForReviewModal({
  open,
  onClose,
  documentId,
  documentVersion,
  currentProfile,
  onSubmitted,
}: SubmitForReviewModalProps) {
  const [supervisors, setSupervisors] = useState<Profile[]>([])
  const [assignedTo, setAssignedTo] = useState('')
  const [priority, setPriority] = useState('normal')
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!open) return
    const fetchSupervisors = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['pi', 'coordinator', 'admin'])
        .neq('id', currentProfile?.id ?? '')
      if (data) setSupervisors(data)
    }
    fetchSupervisors()
  }, [open, supabase])

  const handleSubmit = async () => {
    if (!assignedTo || !currentProfile) return
    setSubmitting(true)

    // Create review request
    const { data: review } = await supabase
      .from('review_requests')
      .insert({
        document_id: documentId,
        document_version: documentVersion,
        requested_by: currentProfile.id,
        assigned_to: assignedTo,
        priority,
        due_date: dueDate || null,
      })
      .select()
      .single()

    // Update document status
    const { data: docData } = await supabase
      .from('documents')
      .update({ status: 'in_review' })
      .eq('id', documentId)
      .select('project_id, title')
      .single()

    if (docData) {
      logAudit(
        'document.submitted',
        'document',
        documentId,
        {
          summary: `Document "${docData.title}" submitted for review`,
          operation: {
            review_request_id: review?.id ?? null,
            assigned_to: assignedTo,
            priority,
            due_date: dueDate || null,
            document_version: documentVersion,
          },
        },
        docData.project_id,
      )
    }

    setSubmitting(false)
    onSubmitted()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit for Review</DialogTitle>
          <DialogDescription>
            Send this document to a supervisor for review and approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Assign to Supervisor</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a supervisor..." />
              </SelectTrigger>
              <SelectContent>
                {supervisors.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name ?? s.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Due Date (optional)</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !assignedTo}>
            <Send className="h-4 w-4 mr-2" />
            {submitting ? 'Submitting...' : 'Submit for Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
