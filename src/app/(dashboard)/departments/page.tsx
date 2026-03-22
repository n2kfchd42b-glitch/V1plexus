"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWorkspaceContext } from '@/components/workspace/WorkspaceProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import type { Department } from '@/types/database'
import { Building2, Plus, Users } from 'lucide-react'

export default function DepartmentsPage() {
  const { activeWorkspace, isAdmin } = useWorkspaceContext()
  const [departments, setDepartments] = useState<Department[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const supabase = createClient()

  const load = async () => {
    if (!activeWorkspace?.institution_id) { setLoading(false); return }
    const { data } = await supabase
      .from('departments')
      .select('*')
      .eq('institution_id', activeWorkspace.institution_id)
      .order('name')
    setDepartments(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [activeWorkspace]) // eslint-disable-line react-hooks/exhaustive-deps

  const addDepartment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !activeWorkspace?.institution_id) return
    setAdding(true)
    const { error } = await supabase
      .from('departments')
      .insert({ institution_id: activeWorkspace.institution_id, name: newName.trim() })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Department added')
      setNewName('')
      load()
    }
    setAdding(false)
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Building2 className="h-5 w-5 text-[var(--text-primary)]" />
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Departments</h1>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--text-tertiary)]">Loading…</div>
      ) : (
        <div className="space-y-2 mb-6">
          {departments.map(d => (
            <div key={d.id} className="flex items-center gap-3 p-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg">
              <Building2 className="h-4 w-4 text-[var(--text-tertiary)] flex-shrink-0" />
              <span className="text-sm font-medium text-[var(--text-primary)] flex-1">{d.name}</span>
            </div>
          ))}
          {departments.length === 0 && (
            <p className="text-sm text-[var(--text-tertiary)]">No departments yet.</p>
          )}
        </div>
      )}

      {isAdmin && (
        <form onSubmit={addDepartment} className="flex gap-2">
          <Input
            placeholder="New department name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={adding || !newName.trim()} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </form>
      )}
    </div>
  )
}
