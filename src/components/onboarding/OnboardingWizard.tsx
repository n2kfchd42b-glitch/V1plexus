"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlaskConical, ArrowRight, ArrowLeft, CheckCircle, User, Building2, FolderPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

interface OnboardingWizardProps {
  profile: Profile
  onComplete: () => void
}

type Step = 'welcome' | 'profile' | 'join-or-create' | 'first-project' | 'done'

const STEPS: Step[] = ['welcome', 'profile', 'join-or-create', 'first-project', 'done']

export function OnboardingWizard({ profile, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>('welcome')
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [role, setRole] = useState<string>(profile.role ?? 'researcher')
  const [affiliation, setAffiliation] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [institutionName, setInstitutionName] = useState('')
  const [institutionChoice, setInstitutionChoice] = useState<'join' | 'create' | 'individual'>('individual')
  const [projectTitle, setProjectTitle] = useState('')
  const [projectDesc, setProjectDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const currentIndex = STEPS.indexOf(step)
  const progress = (currentIndex / (STEPS.length - 1)) * 100

  const next = () => {
    const nextStep = STEPS[currentIndex + 1]
    if (nextStep) setStep(nextStep)
  }

  const back = () => {
    const prevStep = STEPS[currentIndex - 1]
    if (prevStep) setStep(prevStep)
  }

  const saveProfile = async () => {
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim(), role: role as Profile['role'] })
        .eq('id', profile.id)
      if (error) throw error
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile')
      setLoading(false)
      return false
    }
    setLoading(false)
    return true
  }

  const createProject = async () => {
    if (!projectTitle.trim()) return true
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase
        .from('projects')
        .insert({
          title: projectTitle.trim(),
          description: projectDesc.trim() || null,
          owner_id: profile.id,
        })
      if (error) throw error
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create project')
      setLoading(false)
      return false
    }
    setLoading(false)
    return true
  }

  const handleProfileNext = async () => {
    if (!fullName.trim()) { setError('Please enter your full name'); return }
    const ok = await saveProfile()
    if (ok) { setError(''); next() }
  }

  const handleProjectNext = async () => {
    const ok = await createProject()
    if (ok) next()
  }

  const handleFinish = () => {
    onComplete()
    router.push('/dashboard')
  }

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Welcome */}
          {step === 'welcome' && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-6">
                <FlaskConical className="h-8 w-8 text-blue-600" />
                <span className="text-2xl font-bold">PLEXUS</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Welcome to PLEXUS!</h2>
              <p className="text-gray-600 mb-8">
                Let&apos;s set up your research workspace in just a few steps. It only takes 2 minutes.
              </p>
              <div className="flex flex-col gap-3 mb-8 text-left">
                {[
                  { icon: User, label: 'Complete your profile' },
                  { icon: Building2, label: 'Join or create an institution' },
                  { icon: FolderPlus, label: 'Create your first project' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 text-sm text-gray-700">
                    <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-blue-600" />
                    </div>
                    {label}
                  </div>
                ))}
              </div>
              <Button className="w-full" size="lg" onClick={next}>
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Profile */}
          {step === 'profile' && (
            <div>
              <StepHeader
                icon={User}
                title="Tell us about yourself"
                subtitle="This helps supervisors and collaborators find you."
              />
              <div className="space-y-4 mt-6">
                <div>
                  <Label>Full name *</Label>
                  <Input
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Dr. Jane Smith"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="researcher">Student / Researcher</SelectItem>
                      <SelectItem value="supervisor">Faculty / Supervisor</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Affiliation (optional)</Label>
                  <Input
                    value={affiliation}
                    onChange={e => setAffiliation(e.target.value)}
                    placeholder="University of Ghana, School of Medicine"
                    className="mt-1"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
              <WizardFooter onBack={back} onNext={handleProfileNext} loading={loading} />
            </div>
          )}

          {/* Join or Create */}
          {step === 'join-or-create' && (
            <div>
              <StepHeader
                icon={Building2}
                title="Connect to an institution"
                subtitle="Institutions provide shared projects, dashboards, and compliance tracking."
              />
              <div className="mt-6 space-y-3">
                {[
                  {
                    value: 'join' as const,
                    label: 'Join an existing institution',
                    desc: 'Enter an invite code or link from your admin.',
                  },
                  {
                    value: 'create' as const,
                    label: 'Create a new institution',
                    desc: 'Set up PLEXUS for your university or department.',
                  },
                  {
                    value: 'individual' as const,
                    label: 'Continue as individual',
                    desc: 'Skip this for now — you can join later.',
                  },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setInstitutionChoice(opt.value)}
                    className={cn(
                      'w-full text-left border rounded-lg p-4 transition-all',
                      institutionChoice === opt.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:border-gray-300'
                    )}
                  >
                    <p className="font-medium text-sm text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>

              {institutionChoice === 'join' && (
                <div className="mt-4">
                  <Label>Invite code</Label>
                  <Input
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value)}
                    placeholder="e.g. UGMS-2025"
                    className="mt-1"
                  />
                </div>
              )}

              {institutionChoice === 'create' && (
                <div className="mt-4">
                  <Label>Institution name</Label>
                  <Input
                    value={institutionName}
                    onChange={e => setInstitutionName(e.target.value)}
                    placeholder="University of Ghana Medical School"
                    className="mt-1"
                  />
                </div>
              )}

              <WizardFooter onBack={back} onNext={next} />
            </div>
          )}

          {/* First Project */}
          {step === 'first-project' && (
            <div>
              <StepHeader
                icon={FolderPlus}
                title="Create your first project"
                subtitle="You can add more projects anytime from your dashboard."
              />
              <div className="mt-6 space-y-4">
                <div>
                  <Label>Project title</Label>
                  <Input
                    value={projectTitle}
                    onChange={e => setProjectTitle(e.target.value)}
                    placeholder="e.g. Cognitive Load in Medical Education"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Textarea
                    value={projectDesc}
                    onChange={e => setProjectDesc(e.target.value)}
                    placeholder="Brief description of your research..."
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
              <div className="mt-6 flex gap-3">
                <Button variant="ghost" onClick={back}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button variant="outline" className="flex-1" onClick={next}>
                  Skip for now
                </Button>
                <Button className="flex-1" onClick={handleProjectNext} disabled={loading || !projectTitle.trim()}>
                  {loading ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </div>
          )}

          {/* Done */}
          {step === 'done' && (
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">You&apos;re all set!</h2>
              <p className="text-gray-600 mb-8">
                Your PLEXUS workspace is ready. Start by creating a research protocol or exploring your dashboard.
              </p>
              <Button className="w-full" size="lg" onClick={handleFinish}>
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StepHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div>
      <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
        <Icon className="h-5 w-5 text-blue-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500">{subtitle}</p>
    </div>
  )
}

function WizardFooter({
  onBack,
  onNext,
  loading,
  nextLabel = 'Continue',
}: {
  onBack: () => void
  onNext: () => void
  loading?: boolean
  nextLabel?: string
}) {
  return (
    <div className="mt-6 flex gap-3">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back
      </Button>
      <Button className="flex-1" onClick={onNext} disabled={loading}>
        {loading ? 'Saving...' : nextLabel}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}
