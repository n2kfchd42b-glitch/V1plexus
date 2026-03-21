'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SYSTEM_ROLES } from '@/lib/constants'
import type { SystemRole, Profile } from '@/types/app'

interface RoleAssignmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: Profile | null
  currentRole?: SystemRole
  onAssign: (userId: string, role: SystemRole) => Promise<void>
}

export function RoleAssignmentModal({ open, onOpenChange, member, currentRole, onAssign }: RoleAssignmentModalProps) {
  const [role, setRole] = useState<SystemRole>(currentRole ?? 'researcher')
  const [loading, setLoading] = useState(false)

  async function handleAssign() {
    if (!member) return
    setLoading(true)
    await onAssign(member.id, role)
    setLoading(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign role</DialogTitle>
          <DialogDescription>
            Assign a system role to {member?.full_name ?? 'this member'}.
          </DialogDescription>
        </DialogHeader>
        <Select value={role} onValueChange={(v) => setRole(v as SystemRole)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SYSTEM_ROLES.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAssign} disabled={loading}>
            {loading ? 'Saving...' : 'Assign role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
