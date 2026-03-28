"use client"

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWorkspaceContext } from '@/components/workspace/WorkspaceProvider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Building2, Globe, Mail, Phone, MapPin, ExternalLink } from 'lucide-react'
import type { Institution, InstitutionType } from '@/types/database'

const INSTITUTION_TYPES: { value: InstitutionType; label: string }[] = [
  { value: 'university',        label: 'University' },
  { value: 'hospital',          label: 'Hospital' },
  { value: 'research_institute', label: 'Research Institute' },
  { value: 'ngo',               label: 'NGO' },
  { value: 'government',        label: 'Government' },
  { value: 'other',             label: 'Other' },
]

export default function InstitutionSettingsPage() {
  const { activeWorkspace, isAdmin, loading: wsLoading } = useWorkspaceContext()
  const supabase = useMemo(() => createClient(), [])

  const [institution, setInstitution] = useState<Institution | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({
    name:    '',
    type:    '' as InstitutionType | '',
    country: '',
    city:    '',
    website: '',
    email:   '',
    phone:   '',
  })

  useEffect(() => {
    if (wsLoading) return
    const institutionId = (activeWorkspace as any)?.institution?.id ?? (activeWorkspace as any)?.institution_id
    if (!institutionId) { setLoading(false); return }

    supabase
      .from('institutions')
      .select('*')
      .eq('id', institutionId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setInstitution(data)
          setForm({
            name:    data.name ?? '',
            type:    data.type ?? '',
            country: data.country ?? '',
            city:    data.city ?? '',
            website: data.website ?? '',
            email:   data.email ?? '',
            phone:   data.phone ?? '',
          })
        }
        setLoading(false)
      })
  }, [activeWorkspace, wsLoading, supabase])

  const handleSave = async () => {
    if (!institution) return
    setSaving(true)
    const { error } = await supabase
      .from('institutions')
      .update({
        name:    form.name,
        type:    form.type || null,
        country: form.country || null,
        city:    form.city || null,
        website: form.website || null,
        email:   form.email || null,
        phone:   form.phone || null,
      })
      .eq('id', institution.id)

    if (error) {
      toast.error('Failed to save changes')
    } else {
      toast.success('Institution settings saved')
    }
    setSaving(false)
  }

  if (loading || wsLoading) {
    return (
      <div className="px-8 py-6 max-w-[900px] mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-slate-100 rounded" />
          <div className="h-4 w-48 bg-slate-100 rounded" />
          <div className="h-64 bg-slate-100 rounded-xl mt-8" />
        </div>
      </div>
    )
  }

  if (!institution) {
    return (
      <div className="px-8 py-6 max-w-[900px] mx-auto">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Building2 className="h-12 w-12 text-slate-300 mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-1">No institution found</h2>
          <p className="text-sm text-slate-500">Switch to an institutional workspace to manage settings.</p>
        </div>
      </div>
    )
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
    disabled: !isAdmin,
  })

  return (
    <div className="px-8 py-6 max-w-[900px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-headline">
          Institution Settings
        </h1>
        <p className="text-slate-500 mt-1 text-sm font-medium">
          Manage your institution's profile and contact information.
        </p>
      </div>

      {/* Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100">
        {/* Institution identity */}
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Identity</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="inst-name">Institution name</Label>
              <Input id="inst-name" placeholder="e.g. University of Ghana" {...field('name')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inst-type">Type</Label>
              <select
                id="inst-type"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as InstitutionType }))}
                disabled={!isAdmin}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select type…</option>
                {INSTITUTION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inst-country">
                <MapPin className="inline h-3 w-3 mr-1 text-slate-400" />Country
              </Label>
              <Input id="inst-country" placeholder="e.g. Ghana" {...field('country')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inst-city">City</Label>
              <Input id="inst-city" placeholder="e.g. Accra" {...field('city')} />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contact</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label htmlFor="inst-email">
                <Mail className="inline h-3 w-3 mr-1 text-slate-400" />Email
              </Label>
              <Input id="inst-email" type="email" placeholder="info@institution.edu" {...field('email')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inst-phone">
                <Phone className="inline h-3 w-3 mr-1 text-slate-400" />Phone
              </Label>
              <Input id="inst-phone" type="tel" placeholder="+1 555 000 0000" {...field('phone')} />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="inst-website">
                <Globe className="inline h-3 w-3 mr-1 text-slate-400" />Website
              </Label>
              <div className="flex gap-2">
                <Input id="inst-website" type="url" placeholder="https://institution.edu" {...field('website')} />
                {form.website && (
                  <a
                    href={form.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center h-9 w-9 flex-shrink-0 rounded-md border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {isAdmin && (
          <div className="p-6 flex items-center justify-between bg-slate-50 rounded-b-2xl">
            <p className="text-xs text-slate-400">Only admins can edit institution settings.</p>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        )}
        {!isAdmin && (
          <div className="p-6 bg-slate-50 rounded-b-2xl">
            <p className="text-xs text-slate-400">Contact your institution admin to update these settings.</p>
          </div>
        )}
      </div>

      {/* Created date */}
      <p className="text-xs text-slate-400 mt-4 text-right">
        Institution created {new Date(institution.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </div>
  )
}
