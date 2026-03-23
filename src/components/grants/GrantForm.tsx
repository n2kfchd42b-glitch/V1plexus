'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import type { Grant, GrantFunderType, GrantStatus } from '@/types/database'

interface GrantFormProps {
  existing?: Grant
  onSuccess?: (id: string) => void
}

export function GrantForm({ existing, onSuccess }: GrantFormProps) {
  const router = useRouter()
  const { profile } = useAuth()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    title:        existing?.title ?? '',
    funder_name:  existing?.funder_name ?? '',
    funder_type:  (existing?.funder_type ?? '') as GrantFunderType | '',
    grant_number: existing?.grant_number ?? '',
    amount:       existing?.amount ? String(existing.amount) : '',
    currency:     existing?.currency ?? 'USD',
    start_date:   existing?.start_date ?? '',
    end_date:     existing?.end_date ?? '',
    status:       (existing?.status ?? 'active') as GrantStatus,
    notes:        existing?.notes ?? '',
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.institution_id) return
    setSaving(true)

    const payload = {
      institution_id: profile.institution_id,
      title:          form.title,
      funder_name:    form.funder_name,
      funder_type:    form.funder_type || null,
      grant_number:   form.grant_number || null,
      amount:         form.amount ? parseFloat(form.amount) : null,
      currency:       form.currency,
      start_date:     form.start_date || null,
      end_date:       form.end_date || null,
      status:         form.status,
      notes:          form.notes || null,
      pi_id:          profile.id,
      created_by:     profile.id,
    }

    let id: string
    if (existing) {
      const { error } = await supabase.from('grants').update(payload).eq('id', existing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      id = existing.id
      toast.success('Grant updated.')
    } else {
      const { data, error } = await supabase.from('grants').insert(payload).select('id').single()
      if (error || !data) { toast.error(error?.message ?? 'Failed to create grant'); setSaving(false); return }
      id = data.id
      toast.success('Grant created.')
    }

    setSaving(false)
    if (onSuccess) onSuccess(id)
    else router.push(`/institution/grants/${id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 space-y-1.5">
          <Label>Grant Title *</Label>
          <Input
            placeholder="e.g. Malaria Prevention in Northern Ghana"
            value={form.title}
            onChange={set('title')}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label>Funder Name *</Label>
          <Input placeholder="e.g. Wellcome Trust" value={form.funder_name} onChange={set('funder_name')} required />
        </div>

        <div className="space-y-1.5">
          <Label>Funder Type</Label>
          <Select value={form.funder_type} onValueChange={v => setForm(f => ({ ...f, funder_type: v as GrantFunderType }))}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bilateral">Bilateral</SelectItem>
              <SelectItem value="multilateral">Multilateral</SelectItem>
              <SelectItem value="foundation">Foundation</SelectItem>
              <SelectItem value="government">Government</SelectItem>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="university">University</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Grant Number</Label>
          <Input placeholder="e.g. WT-2024-1234" value={form.grant_number} onChange={set('grant_number')} />
        </div>

        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as GrantStatus }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="applied">Applied</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Amount</Label>
          <Input type="number" min="0" placeholder="e.g. 450000" value={form.amount} onChange={set('amount')} />
        </div>

        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
              <SelectItem value="GHS">GHS</SelectItem>
              <SelectItem value="KES">KES</SelectItem>
              <SelectItem value="NGN">NGN</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Start Date</Label>
          <Input type="date" value={form.start_date} onChange={set('start_date')} />
        </div>

        <div className="space-y-1.5">
          <Label>End Date</Label>
          <Input type="date" value={form.end_date} onChange={set('end_date')} />
        </div>

        <div className="sm:col-span-2 space-y-1.5">
          <Label>Notes</Label>
          <Textarea
            placeholder="Any additional notes about this grant..."
            value={form.notes}
            onChange={set('notes')}
            rows={3}
          />
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : existing ? 'Save Changes' : 'Create Grant'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
