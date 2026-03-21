'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SYSTEM_ROLES } from '@/lib/constants'
import type { SystemRole } from '@/types/app'

interface InviteFormProps {
  onInvite: (email: string, role: SystemRole) => Promise<void>
}

export function InviteForm({ onInvite }: InviteFormProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<SystemRole>('researcher')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    await onInvite(email.trim(), role)
    setEmail('')
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 flex-wrap">
      <div className="flex-1 min-w-48">
        <Input
          type="email"
          placeholder="member@university.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <Select value={role} onValueChange={(v) => setRole(v as SystemRole)}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SYSTEM_ROLES.map(({ value, label }) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" disabled={loading || !email.trim()}>
        {loading ? 'Inviting...' : 'Invite'}
      </Button>
    </form>
  )
}
