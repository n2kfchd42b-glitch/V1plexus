'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/utils'
import { toast } from 'sonner'
import type { Profile } from '@/types/app'

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      const p = data as Profile | null
      if (p) {
        setProfile(p)
        setForm({ full_name: p.full_name, email: p.email })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!profile || !form.full_name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: form.full_name.trim() } as Record<string, unknown>)
      .eq('id', profile.id)
    if (error) {
      toast.error('Failed to save')
    } else {
      toast.success('Profile updated')
      setProfile((prev) => prev ? { ...prev, full_name: form.full_name.trim() } : prev)
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="space-y-4">
      {[1, 2].map((i) => <div key={i} className="h-32 bg-[#E2E8F0] animate-pulse rounded-lg" />)}
    </div>
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Manage your account and preferences" />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="text-lg">
                {profile ? getInitials(profile.full_name) : '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-[#1A202C]">{profile?.full_name}</p>
              <p className="text-sm text-[#718096]">{profile?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={form.email} disabled className="bg-[#F7F8FA]" />
              <p className="text-xs text-[#A0AEC0]">Email cannot be changed here</p>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
