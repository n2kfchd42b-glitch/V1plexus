'use client'

import { useState } from 'react'
import { Loader2, ChevronRight, CheckCircle2, ExternalLink, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface DHIS2ConnectWizardProps {
  projectId: string
  onConnected: () => void
  onCancel: () => void
}

interface DHIS2SystemInfo {
  systemName: string
  version: string
  instanceBaseUrl: string
}

export function DHIS2ConnectWizard({ projectId, onConnected, onCancel }: DHIS2ConnectWizardProps) {
  const supabase = createClient()
  const [step, setStep] = useState<1 | 2>(1)
  const [serverUrl, setServerUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pat, setPat] = useState('')
  const [authMethod, setAuthMethod] = useState<'basic' | 'pat'>('basic')
  const [connecting, setConnecting] = useState(false)
  const [systemInfo, setSystemInfo] = useState<DHIS2SystemInfo | null>(null)
  const [datasetName, setDatasetName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleConnect = async () => {
    const url = serverUrl.trim().replace(/\/$/, '')
    if (!url) { toast.error('Enter server URL'); return }
    if (authMethod === 'basic' && (!username || !password)) { toast.error('Enter username and password'); return }
    if (authMethod === 'pat' && !pat) { toast.error('Enter your Personal Access Token'); return }

    setConnecting(true)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (authMethod === 'basic') {
        headers['Authorization'] = 'Basic ' + btoa(`${username}:${password}`)
      } else {
        headers['Authorization'] = `ApiToken ${pat}`
      }

      const res = await fetch(`${url}/api/system/info.json`, { headers })
      if (!res.ok) throw new Error(`Server responded with ${res.status}`)
      const info = await res.json()
      setSystemInfo({
        systemName: info.systemName ?? 'DHIS2 Instance',
        version: info.version ?? 'unknown',
        instanceBaseUrl: info.instanceBaseUrl ?? url,
      })
      setDatasetName(`${info.systemName ?? 'DHIS2'} — Push`)
      setStep(2)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not connect — check URL and credentials')
    } finally {
      setConnecting(false)
    }
  }

  const handleSave = async () => {
    if (!systemInfo) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('integration_connections')
        .insert({
          project_id: projectId,
          provider: 'dhis2',
          display_name: datasetName,
          provider_project_name: systemInfo.systemName,
          config: {
            server_url: serverUrl.trim().replace(/\/$/, ''),
            auth_method: authMethod,
            username: authMethod === 'basic' ? username : undefined,
            password_encrypted: authMethod === 'basic' ? password : undefined,
            pat_encrypted: authMethod === 'pat' ? pat : undefined,
            system_name: systemInfo.systemName,
            dhis2_version: systemInfo.version,
            dataset_name: datasetName,
          },
          status: 'active',
          sync_frequency: 'manual',
          sync_direction: 'push',
        })
      if (error) throw error
      toast.success('DHIS2 connected! Configure your data element mappings to start pushing data.')
      onConnected()
    } catch {
      toast.error('Failed to save connection')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {([1, 2] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
            <div className={`flex items-center gap-1.5 ${step === s ? 'text-green-700 font-medium' : step > s ? 'text-emerald-600' : 'text-gray-400'}`}>
              {step > s ? <CheckCircle2 className="h-4 w-4" /> : (
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold border ${step === s ? 'border-green-700 bg-green-50' : 'border-gray-200'}`}>{s}</span>
              )}
              <span>{['Authentication', 'Confirm'][i]}</span>
            </div>
          </div>
        ))}
      </div>

      {/* DHIS2 info banner */}
      <div className="flex gap-2 p-3 rounded-lg bg-green-50 border border-green-100 text-xs text-green-800">
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>DHIS2 is a <strong>push target</strong>. PLEXUS aggregates your research data and pushes it to your national health information system. No data is read from DHIS2.</span>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">DHIS2 Server URL</Label>
            <Input
              placeholder="https://play.dhis2.org/2.40"
              value={serverUrl}
              onChange={e => setServerUrl(e.target.value)}
              className="text-sm"
            />
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">Authentication method</Label>
            <div className="flex gap-2">
              {(['basic', 'pat'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setAuthMethod(m)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${authMethod === m ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600'}`}
                >
                  {m === 'basic' ? 'Username/Password' : 'Personal Access Token'}
                </button>
              ))}
            </div>
          </div>
          {authMethod === 'basic' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">Username</Label>
                <Input value={username} onChange={e => setUsername(e.target.value)} className="text-sm" />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">Password</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="text-sm" />
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1 block">Personal Access Token</Label>
              <Input type="password" placeholder="d2pat_…" value={pat} onChange={e => setPat(e.target.value)} className="text-sm font-mono" />
            </div>
          )}
          <a
            href="https://docs.dhis2.org/en/use/user-guides/dhis-core-version-master/working-with-your-account/personal-access-tokens.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-700 hover:underline flex items-center gap-1"
          >
            DHIS2 API authentication <ExternalLink className="h-3 w-3" />
          </a>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
            <Button onClick={handleConnect} disabled={connecting} className="flex-1 bg-green-700 hover:bg-green-800 text-white">
              {connecting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Connecting…</> : 'Connect'}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && systemInfo && (
        <div className="space-y-4">
          <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
            <p className="text-sm font-medium text-green-800">{systemInfo.systemName}</p>
            <p className="text-xs text-green-600 mt-0.5">Version {systemInfo.version}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">Connection name</Label>
            <Input value={datasetName} onChange={e => setDatasetName(e.target.value)} className="text-sm" />
          </div>
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-800">
            After connecting, use the <strong>DHIS2 Mapping</strong> panel to map PLEXUS dataset columns to DHIS2 data elements and organisation units before pushing data.
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
            <Button onClick={handleSave} disabled={saving || !datasetName.trim()} className="flex-1 bg-green-700 hover:bg-green-800 text-white">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : 'Save Connection'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
