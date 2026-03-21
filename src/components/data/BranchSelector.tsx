'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { GitBranch, Plus } from 'lucide-react'
import type { DatasetBranch } from '@/types/database'

interface BranchSelectorProps {
  branches: DatasetBranch[]
  currentBranchId: string
  onBranchChange: (branchId: string) => void
  onCreateBranch?: (name: string) => Promise<void>
}

export function BranchSelector({ branches, currentBranchId, onBranchChange, onCreateBranch }: BranchSelectorProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!newName || !onCreateBranch) return
    setCreating(true)
    try {
      await onCreateBranch(newName)
      setShowCreate(false)
      setNewName('')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-gray-500" />
        <Select value={currentBranchId} onValueChange={onBranchChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select branch" />
          </SelectTrigger>
          <SelectContent>
            {branches.map(b => (
              <SelectItem key={b.id} value={b.id}>
                <div className="flex items-center gap-2">
                  <span>{b.name}</span>
                  {b.is_default && <span className="text-xs text-blue-600">(default)</span>}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {onCreateBranch && (
          <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New Branch</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="branch-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName || creating}>
              {creating ? 'Creating...' : 'Create Branch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
