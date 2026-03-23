'use client'

import { useState } from 'react'
import { Loader2, ChevronRight, CheckCircle2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SCTOForm {
  id: string
  title: string
  version: number
}

interface SurveyCTOConnectWizardProps {
  projectId: string
  onConnected: () => void
  onCancel: () => void
}

export function SurveyCTOConnectWizard({ projectId, onConnected, onCancel }: SurveyCTOConnectWizardProps) {
  const supabase = createClient()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [serverName, setServerName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [forms, setForms] = useState<SCTOForm[]>([])
  const [selectedForm, setSelectedForm] = useState<SCTOForm | null>(null)
  const [datasetName, setDatasetName] = useState('')
  const [syncFrequency, setSyncFrequency] = useState<'hourly' | 'daily' | 'manual'>('daily')
  const [saving, setSaving] = useState(false)

  const handleConnect = async () => {
    if (!serverName.trim() || !username.trim() || !password.trim()) {
      toast.error('Fill in all fields')
      return
    }
    setConnecting(true)
    try {
      // SurveyCTO API: list forms via REST API
      const base = `https://${serverName.replace(/^https?:\/\//, '').replace(/\/$/, '')}.surveycto.com`
      const res = await fetch(`${base}/api/v2/forms`, {
        headers: {
          Authorization: 'Basic ' + btoa(`${username}:${password}`),
        },
      })
      if (!res.ok) throw new Error(`Auth failed (${res.status})`)
      const data = await res.json()
      const formList: SCTOForm[] = (Array.isArray(data) ? data : data.forms ?? []).map((f: Record<string, unknown>) => ({
        id: String(f.id ?? f.formId ?? ''),
        title: String(f.title ?? f.name ?? f.id ?? 'Untitled'),
        version: Number(f.version ?? 1),
      }))
      setForms(formList)
      setStep(2)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not connect to SurveyCTO — check your credentials')
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
          provider: 'surveycto',
          display_name: datasetName,
          provider_project_id: selectedForm.id,
          provider_project_name: selectedForm.title,
          config: {
            server_name: serverName,
            username,
            password_encrypted: password,
            form_id: selectedForm.id,
            dataset_name: datasetName,
          },
          status: 'active',
          sync_frequency: syncFrequency,
          sync_direction: 'pull',
        })
      if (error) throw error
      toast.success('SurveyCTO connected! Data will sync on schedule.')
      onConnected()
    } catch {
      toast.error('Failed to save connection')
    } finally {
      setSaving(false)
    }
  }

  const STEPS = ['Server', 'Select Form', 'Configure'] as const

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {([1, 2, 3] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
            <div className={`flex items-center gap-1.5 ${step === s ? 'text-purple-600 font-medium' : step > s ? 'text-emerald-600' : 'text-gray-400'}`}>
              {step > s ? <CheckCircle2 className="h-4 w-4" /> : (
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold border ${step === s ? 'border-purple-600 bg-purple-50' : 'border-gray-200'}`}>{s}</span>
              )}
              <span>{STEPS[i]}</span>
            </div>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">SurveyCTO Server Name</Label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="yourorg"
                value={serverName}
                onChange={e => setServerName(e.target.value)}
                className="text-sm"
              />
              <span className="text-sm text-gray-400 whitespace-nowrap">.surveycto.com</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Enter just your server name (e.g. "unicef-ng")</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1 block">Username</Label>
              <Input
                type="email"
                placeholder="you@org.org"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1 block">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <a
            href="https://docs.surveycto.com/04-monitoring-and-management/01-the-server-console/02.api.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-purple-600 hover:underline flex items-center gap-1"
          >
            SurveyCTO API documentation <ExternalLink className="h-3 w-3" />
          </a>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
            <Button onClick={handleConnect} disabled={connecting} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white">
              {connecting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Connecting…</> : 'Connect'}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Select the SurveyCTO form to sync:</p>
          {forms.length === 0 ? (
            <div className="text-sm text-gray-400 py-6 text-center">No forms found on this server.</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {forms.map(f => (
                <button
                  key={f.id}
                  onClick={() => { setSelectedForm(f); setDatasetName(`${f.title} — SurveyCTO`); setStep(3) }}
                  className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{f.title}</p>
                    <p className="text-xs text-gray-500">Form ID: {f.id} · v{f.version}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </button>
              ))}
            </div>
          )}
          <Button variant="outline" onClick={() => setStep(1)} className="w-full">Back</Button>
        </div>
      )}

      {step === 3 && selectedForm && (
        <div className="space-y-4">
          <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg text-sm text-purple-800">
            <span className="font-medium">{selectedForm.title}</span>
            <span className="text-purple-500 ml-2 text-xs">Form ID: {selectedForm.id}</span>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">Dataset name in PLEXUS</Label>
            <Input value={datasetName} onChange={e => setDatasetName(e.target.value)} className="text-sm" />
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">Sync frequency</Label>
            <p className="text-xs text-gray-400 mb-2">SurveyCTO uses polling (no webhook support)</p>
            <div className="flex gap-2">
              {(['hourly', 'daily', 'manual'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setSyncFrequency(f)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors capitalize ${syncFrequency === f ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
            <Button onClick={handleSave} disabled={saving || !datasetName.trim()} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : 'Start Sync'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
