"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const RESEARCH_AREAS = [
  'Global Health',
  'Epidemiology',
  'Biostatistics',
  'Public Health',
  'Clinical Research',
  'Social Science',
  'Environmental Health',
  'Health Policy',
  'Infectious Disease',
  'Non-communicable Disease',
  'Maternal & Child Health',
  'Mental Health',
  'Other',
]

export function IndividualSetup() {
  const [researchArea, setResearchArea] = useState('')
  const [affiliation, setAffiliation] = useState('')
  const [orcid, setOrcid] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Get or create personal workspace
    const slug = `personal-${user.id}`

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    const workspaceName = (profile?.full_name ?? user.email ?? 'My') + "'s Workspace"

    // Create personal workspace if not exists
    const { data: existing } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .eq('type', 'personal')
      .maybeSingle()

    let wsId = existing?.id

    if (!wsId) {
      const { data: ws, error: wsErr } = await supabase
        .from('workspaces')
        .insert({ type: 'personal', name: workspaceName, slug, owner_id: user.id })
        .select('id')
        .single()

      if (wsErr) {
        toast.error('Failed to create workspace')
        setLoading(false)
        return
      }
      wsId = ws.id

      // Create membership
      await supabase.from('workspace_memberships').insert({
        workspace_id: wsId,
        user_id: user.id,
        role: 'owner',
        status: 'active',
      })
    }

    // Mark setup completed
    await supabase
      .from('profiles')
      .update({ workspace_setup_completed: true, onboarding_completed: true })
      .eq('id', user.id)

    toast.success('Workspace created!')
    router.push('/dashboard')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <FlaskConical className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">PLEXUS</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Set up your personal workspace</h2>
          <p className="text-gray-600 mt-2 text-sm">
            This is your private research space. You own everything here.
            Invite collaborators to specific projects when needed.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSetup} className="space-y-4">
            <div>
              <Label htmlFor="researchArea">Research Area <span className="text-gray-400 text-xs">(optional)</span></Label>
              <select
                id="researchArea"
                value={researchArea}
                onChange={e => setResearchArea(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Select research area…</option>
                {RESEARCH_AREAS.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="affiliation">Affiliation <span className="text-gray-400 text-xs">(optional)</span></Label>
              <Input
                id="affiliation"
                placeholder="Independent / Freelance"
                value={affiliation}
                onChange={e => setAffiliation(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="orcid">ORCID <span className="text-gray-400 text-xs">(optional)</span></Label>
              <Input
                id="orcid"
                placeholder="0000-0000-0000-0000"
                value={orcid}
                onChange={e => setOrcid(e.target.value)}
                className="mt-1"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Setting up…' : 'Set Up My Workspace →'}
            </Button>
          </form>
        </div>

        <button
          onClick={() => router.push('/setup')}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700 w-full text-center"
        >
          ← Back
        </button>
      </div>
    </div>
  )
}
