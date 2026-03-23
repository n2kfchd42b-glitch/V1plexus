'use client'

import { useState } from 'react'
import { Loader2, ExternalLink, ChevronRight, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ODKForm {
  xmlFormId: string
  name: string
  submissions: number
}

interface ODKConnectWizardProps {
  projectId: string
  onConnected: () => void
  onCancel: () => void
}

export function ODKConnectWizard({ projectId, onConnected, onCancel }: ODKConnectWizardProps) {
  const supabase = createClient()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [serverUrl, setServerUrl] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [odkProjectId, setOdkProjectId] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [forms, setForms] = useState<ODKForm[]>([])
  const [selectedForm, setSelectedForm] = useState<ODKForm | null>(null)
  const [datasetName, setDatasetName] = useState('')
  const [syncFrequency, setSyncFrequency] = useState<'hourly' | 'daily' | 'manual'>('daily')
  const [saving, setSaving] = useState(false)
  const [sessionToken, setSessionToken] = useState('')

  const handleConnect = async () => {
    if (!serverUrl || !email || !password || !odkProjectId) {
      toast.error('Fill in all fields')
      return
    }
    setConnecting(true)
    try {
      // ODK Central session auth
      const authRes = await fetch(`${serverUrl}/v1/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!authRes.ok) throw new Error('Authentication failed')
      const { token } = await authRes.json()
      setSessionToken(token)

      // Fetch forms for project
      const formsRes = await fetch(`${serverUrl}/v1/projects/${odkProjectId}/forms`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!formsRes.ok) throw new Error('Could not fetch forms')
      const formsList: ODKForm[] = await formsRes.json()
      setForms(formsList)
      setStep(2)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not connect to ODK Central')
    } finally {
      setConnecting(false)
    }
  }

  const handleSave = async () => {
    if (!selectedForm) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('integration_connections')
        .insert({
          project_id: projectId,
          provider: 'odk_central',
          config: {
            server_url: serverUrl,
            email,
            password_encrypted: password,
            odk_project_id: odkProjectId,
            form_id: selectedForm.xmlFormId,
            dataset_name: datasetName,
            session_token: sessionToken,
          },
          status: 'active',
          sync_frequency: syncFrequency,
        })
      if (error) throw error
      toast.success('ODK Central connected! Syncing submissions…')
      onConnected()
    } catch {
      toast.error('Failed to save connection')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        {([1, 2, 3] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
            <div className={`flex items-center gap-1.5 ${step === s ? 'text-blue-600 font-medium' : step > s ? 'text-emerald-600' : 'text-gray-400'}`}>
              {step > s ? <CheckCircle2 className="h-4 w-4" /> : (
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold border ${step === s ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>{s}</span>
              )}
              <span>{['Server', 'Select Form', 'Configure'][i]}</span>
            </div>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">ODK Central Server URL</Label>
            <Input placeholder="https://odk.yourinstitution.org" value={serverUrl} onChange={e => setServerUrl(e.target.value)} className="text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1 block">Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1 block">Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">ODK Project ID</Label>
            <Input placeholder="1" value={odkProjectId} onChange={e => setOdkProjectId(e.target.value)} className="text-sm" />
            <a href="https://docs.getodk.org/central-intro/" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 flex items-center gap-1">
              ODK Central documentation <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
            <Button onClick={handleConnect} disabled={connecting} className="flex-1">
              {connecting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Connecting…</> : 'Connect'}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Select the ODK form to sync:</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {forms.map(f => (
              <button
                key={f.xmlFormId}
                onClick={() => { setSelectedForm(f); setDatasetName(`${f.name} — ODK Sync`); setStep(3) }}
                className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{f.name}</p>
                  <p className="text-xs text-gray-500">{(f.submissions ?? 0).toLocaleString()} submissions</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={() => setStep(1)} className="w-full">Back</Button>
        </div>
      )}

      {step === 3 && selectedForm && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
            <span className="font-medium">{selectedForm.name}</span>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">Dataset name in PLEXUS</Label>
            <Input value={datasetName} onChange={e => setDatasetName(e.target.value)} className="text-sm" />
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">Sync frequency</Label>
            <div className="flex gap-2">
              {(['hourly', 'daily', 'manual'] as const).map(f => (
                <button key={f} onClick={() => setSyncFrequency(f)} className={`px-3 py-1.5 text-sm rounded-md border transition-colors capitalize ${syncFrequency === f ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>{f}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
            <Button onClick={handleSave} disabled={saving || !datasetName.trim()} className="flex-1">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : 'Start Sync'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
