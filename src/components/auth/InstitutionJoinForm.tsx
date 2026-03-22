"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FlaskConical, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Institution, Department, Profile } from '@/types/database'

const ROLES = [
  { value: 'pi', label: 'Faculty / PI / Supervisor' },
  { value: 'researcher', label: 'Postdoctoral researcher' },
  { value: 'student', label: 'Student (Master\'s, PhD, or DrPH)' },
  { value: 'researcher', label: 'Research staff' },
  { value: 'admin', label: 'Administrative staff' },
] as const

interface InstitutionJoinFormProps {
  institutionId: string
}

export function InstitutionJoinForm({ institutionId }: InstitutionJoinFormProps) {
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [supervisors, setSupervisors] = useState<Profile[]>([])
  const [selectedRole, setSelectedRole] = useState<string>('researcher')
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedSupervisor, setSelectedSupervisor] = useState('')
  const [noSupervisor, setNoSupervisor] = useState(false)
  const [institutionalEmail, setInstitutionalEmail] = useState('')
  const [studentId, setStudentId] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: inst } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', institutionId)
        .maybeSingle()
      setInstitution(inst)

      const { data: depts } = await supabase
        .from('departments')
        .select('*')
        .eq('institution_id', institutionId)
      setDepartments(depts ?? [])
    }
    load()
  }, [institutionId, supabase])

  useEffect(() => {
    if (!selectedDepartment) { setSupervisors([]); return }
    const loadSupervisors = async () => {
      // Find workspace for institution
      const { data: ws } = await supabase
        .from('workspaces')
        .select('id')
        .eq('institution_id', institutionId)
        .eq('type', 'institutional')
        .maybeSingle()
      if (!ws) return

      const { data: members } = await supabase
        .from('workspace_memberships')
        .select('*, user:profiles(*)')
        .eq('workspace_id', ws.id)
        .eq('department_id', selectedDepartment)
        .in('role', ['supervisor', 'pi', 'department_head'])
        .eq('status', 'active')
      setSupervisors(members?.map(m => m.user as Profile).filter(Boolean) ?? [])
    }
    loadSupervisors()
  }, [selectedDepartment, institutionId, supabase])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Ensure personal workspace exists
    const slug = `personal-${user.id}`
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    const workspaceName = (profile?.full_name ?? user.email ?? 'My') + "'s Workspace"

    const { data: existingPersonal } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .eq('type', 'personal')
      .maybeSingle()

    if (!existingPersonal) {
      const { data: ws } = await supabase
        .from('workspaces')
        .insert({ type: 'personal', name: workspaceName, slug, owner_id: user.id })
        .select('id')
        .single()
      if (ws) {
        await supabase.from('workspace_memberships').insert({
          workspace_id: ws.id,
          user_id: user.id,
          role: 'owner',
          status: 'active',
        })
      }
    }

    // Find institutional workspace
    const { data: instWs } = await supabase
      .from('workspaces')
      .select('id')
      .eq('institution_id', institutionId)
      .eq('type', 'institutional')
      .maybeSingle()

    if (!instWs) {
      toast.error('Institutional workspace not found')
      setLoading(false)
      return
    }

    // Create pending membership
    const { error: memberErr } = await supabase
      .from('workspace_memberships')
      .insert({
        workspace_id: instWs.id,
        user_id: user.id,
        role: selectedRole === 'student' ? 'student' : selectedRole,
        department_id: selectedDepartment || null,
        supervisor_id: selectedRole === 'student' && selectedSupervisor ? selectedSupervisor : null,
        status: 'invited',
        invited_by: user.id,
      })

    if (memberErr) {
      toast.error(memberErr.message)
      setLoading(false)
      return
    }

    // Mark setup completed
    await supabase
      .from('profiles')
      .update({ workspace_setup_completed: true, onboarding_completed: true })
      .eq('id', user.id)

    toast.success('Join request sent! You will be notified once approved.')
    router.push('/dashboard')
    setLoading(false)
  }

  if (!institution) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <FlaskConical className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">PLEXUS</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Building2 className="h-5 w-5 text-gray-500" />
            <h2 className="text-xl font-bold text-gray-900">Join {institution.name}</h2>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleJoin} className="space-y-5">
            {/* Role selection */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">I am a:</Label>
              <div className="space-y-2">
                {ROLES.map((r, i) => (
                  <label key={i} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={selectedRole === r.value && (i === 0 ? true : i !== 0)}
                      onChange={() => setSelectedRole(r.value)}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-gray-700">{r.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Department */}
            {departments.length > 0 && (
              <div>
                <Label htmlFor="department">Department</Label>
                <select
                  id="department"
                  value={selectedDepartment}
                  onChange={e => setSelectedDepartment(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select department…</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Supervisor (students only) */}
            {selectedRole === 'student' && selectedDepartment && (
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">My supervisor:</Label>
                <div className="space-y-2 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="supervisorChoice"
                      checked={!noSupervisor}
                      onChange={() => setNoSupervisor(false)}
                    />
                    <span className="text-sm text-gray-700">I know my supervisor — let me select them:</span>
                  </label>
                  {!noSupervisor && supervisors.length > 0 && (
                    <select
                      value={selectedSupervisor}
                      onChange={e => setSelectedSupervisor(e.target.value)}
                      className="ml-5 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Select supervisor…</option>
                      {supervisors.map(s => (
                        <option key={s.id} value={s.id}>{s.full_name ?? s.email}</option>
                      ))}
                    </select>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="supervisorChoice"
                      checked={noSupervisor}
                      onChange={() => { setNoSupervisor(true); setSelectedSupervisor('') }}
                    />
                    <span className="text-sm text-gray-700">I don&apos;t know my supervisor yet — it will be assigned later</span>
                  </label>
                </div>
              </div>
            )}

            {/* Institutional email */}
            <div>
              <Label htmlFor="instEmail">Institutional Email</Label>
              <Input
                id="instEmail"
                type="email"
                placeholder="you@institution.edu"
                value={institutionalEmail}
                onChange={e => setInstitutionalEmail(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Student ID */}
            {selectedRole === 'student' && (
              <div>
                <Label htmlFor="studentId">
                  Student ID <span className="text-gray-400 text-xs">(optional)</span>
                </Label>
                <Input
                  id="studentId"
                  placeholder="10876543"
                  value={studentId}
                  onChange={e => setStudentId(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending request…' : 'Request to Join →'}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              Your request will be reviewed by the institution admin.
              You&apos;ll be notified once approved.
            </p>
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
