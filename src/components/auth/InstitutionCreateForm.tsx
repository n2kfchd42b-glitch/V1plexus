"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const INSTITUTION_TYPES = [
  { value: 'university', label: 'University' },
  { value: 'research_institute', label: 'Research Center' },
  { value: 'ngo', label: 'NGO' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'government', label: 'Government' },
  { value: 'other', label: 'Other' },
]

export function InstitutionCreateForm() {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [type, setType] = useState('university')
  const [country, setCountry] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [departments, setDepartments] = useState<string[]>([''])
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const generateSlug = (val: string) => {
    return val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }

  const handleNameChange = (val: string) => {
    setName(val)
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(val))
    }
  }

  const addDepartment = () => setDepartments(d => [...d, ''])
  const removeDepartment = (i: number) => setDepartments(d => d.filter((_, idx) => idx !== i))
  const updateDepartment = (i: number, val: string) => {
    setDepartments(d => d.map((dep, idx) => idx === i ? val : dep))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Institution name is required'); return }
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // ── Stage 1: fetch profile + check personal workspace in parallel ──
    const [profileRes, existingPersonalRes] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
      supabase.from('workspaces').select('id').eq('owner_id', user.id).eq('type', 'personal').maybeSingle(),
    ])

    // ── Stage 2: create institution ───────────────────────────────────
    // Generate IDs client-side so we never need .select() after INSERT.
    // PostgREST's RETURNING clause triggers a SELECT that fails for
    // institutional workspaces (owner_id is NULL, no membership yet).
    const instId = crypto.randomUUID()
    const { error: instErr } = await supabase
      .from('institutions')
      .insert({ id: instId, name: name.trim(), type, country: country || null, logo_url: logoUrl || null })

    if (instErr) {
      toast.error('Failed to create institution: ' + instErr.message)
      setLoading(false)
      return
    }

    // ── Stage 3: departments + workspace in parallel ──────────────────
    const validDepts = departments.filter(d => d.trim())
    const baseSlug  = slug || generateSlug(name)
    const wsSlug    = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
    const wsId      = crypto.randomUUID()

    const [, wsRes] = await Promise.all([
      validDepts.length > 0
        ? supabase.from('departments').insert(
            validDepts.map(d => ({ institution_id: instId, name: d.trim() }))
          )
        : Promise.resolve(null),
      supabase
        .from('workspaces')
        .insert({ id: wsId, type: 'institutional', name: name.trim(), slug: wsSlug, institution_id: instId }),
    ])

    if (wsRes.error) {
      toast.error('Failed to create workspace: ' + wsRes.error.message)
      setLoading(false)
      return
    }

    // ── Stage 4: memberships + personal workspace + profile in parallel ─
    const personalSlug   = `personal-${user.id}`
    const workspaceName  = (profileRes.data?.full_name ?? user.email ?? 'My') + "'s Workspace"
    const personalWsId   = crypto.randomUUID()

    await Promise.all([
      // Admin membership in institutional workspace
      supabase.from('workspace_memberships').insert({
        workspace_id: wsId, user_id: user.id, role: 'admin', status: 'active',
      }),
      // Personal workspace (create only if missing)
      existingPersonalRes.data
        ? Promise.resolve(null)
        : supabase.from('workspaces')
            .insert({ id: personalWsId, type: 'personal', name: workspaceName, slug: personalSlug, owner_id: user.id })
            .then(({ error }) =>
              !error
                ? supabase.from('workspace_memberships').insert({
                    workspace_id: personalWsId, user_id: user.id, role: 'owner', status: 'active',
                  })
                : null
            ),
      // Mark profile as set up
      supabase.from('profiles').update({
        workspace_setup_completed: true,
        onboarding_completed: true,
        institution_id: instId,
      }).eq('id', user.id),
    ])

    if (typeof window !== 'undefined') {
      localStorage.setItem('plexus_active_workspace_id', wsId)
    }
    toast.success('Institution created!')
    router.push('/dashboard')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <BrandLogo variant="standalone" href="/dashboard" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Create Your Institution on PLEXUS</h2>
          <p className="text-sm text-gray-600 mt-1">You will become the Institution Admin</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label htmlFor="instName">Institution Name</Label>
              <Input
                id="instName"
                placeholder="University of Ghana School of Public Health"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="instSlug">Short Name / Slug</Label>
              <Input
                id="instSlug"
                placeholder="ug-sph"
                value={slug}
                onChange={e => setSlug(generateSlug(e.target.value))}
                className="mt-1 font-mono text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">Used in URLs. Auto-generated from name.</p>
            </div>

            <div>
              <Label>Type</Label>
              <div className="flex gap-4 mt-2">
                {INSTITUTION_TYPES.map(t => (
                  <label key={t.value} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="instType"
                      value={t.value}
                      checked={type === t.value}
                      onChange={() => setType(t.value)}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-gray-700">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="instCountry">Country</Label>
              <Input
                id="instCountry"
                placeholder="Ghana"
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="instLogo">Logo URL <span className="text-gray-400 text-xs">(optional)</span></Label>
              <Input
                id="instLogo"
                placeholder="https://example.com/logo.png"
                value={logoUrl}
                onChange={e => setLogoUrl(e.target.value)}
                className="mt-1 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">Paste a URL to your institution&apos;s logo image.</p>
            </div>

            {/* Departments */}
            <div>
              <Label className="block mb-2">
                Departments <span className="text-gray-400 text-xs">(optional, can add later)</span>
              </Label>
              <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                {departments.map((dept, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="Department name…"
                      value={dept}
                      onChange={e => updateDepartment(i, e.target.value)}
                      className="flex-1 h-8 text-sm bg-white"
                    />
                    {departments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDepartment(i)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addDepartment}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Department
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating institution…' : 'Create Institution →'}
            </Button>
          </form>
        </div>

        <button
          onClick={() => router.back()}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700 w-full text-center"
        >
          ← Back
        </button>
      </div>
    </div>
  )
}
