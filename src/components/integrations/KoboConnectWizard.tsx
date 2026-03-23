'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, ExternalLink, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface KoboProject {
  uid: string
  name: string
  submission_count: number
  deployment_status: string
}

interface KoboConnectWizardProps {
  projectId: string
  onConnected: () => void
  onCancel: () => void
}

export function KoboConnectWizard({ projectId, onConnected, onCancel }: KoboConnectWizardProps) {
  const supabase = createClient()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [serverUrl, setServerUrl] = useState('https://kf.kobotoolbox.org')
  const [apiToken, setApiToken] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [projects, setProjects] = useState<KoboProject[]>([])
  const [selectedProject, setSelectedProject] = useState<KoboProject | null>(null)
  const [datasetName, setDatasetName] = useState('')
  const [syncFrequency, setSyncFrequency] = useState<'realtime' | 'hourly' | 'daily' | 'manual'>('realtime')
  const [saving, setSaving] = useState(false)

  const handleConnect = async () => {
    if (!apiToken.trim()) { toast.error('Enter your API token'); return }
    setConnecting(true)
    try {
      const res = await supabase.functions.invoke('kobo-sync', {
        body: { action: 'connect', api_token: apiToken, kobo_server_url: serverUrl },
      })
      if (res.error) throw res.error
      const list: KoboProject[] = res.data?.projects ?? []
      setProjects(list)
      setStep(2)
    } catch {
      toast.error('Could not connect to KoboToolbox — check your token and server URL')
    } finally {
      setConnecting(false)
    }
  }

  const handleSelectProject = (p: KoboProject) => {
    setSelectedProject(p)
    setDatasetName(`${p.name} — KoboSync`)
    setStep(3)
  }

  const handleStartSync = async () => {
    if (!selectedProject) return
    setSaving(true)
    try {
      const { data: connection, error } = await supabase
        .from('integration_connections')
        .insert({
          project_id: projectId,
          provider: 'kobotoolbox',
          config: {
            api_token: apiToken,
            server_url: serverUrl,
            kobo_asset_uid: selectedProject.uid,
            dataset_name: datasetName,
          },
          status: 'active',
          sync_frequency: syncFrequency,
        })
        .select()
        .single()

      if (error) throw error

      // Trigger initial full sync
      await supabase.functions.invoke('kobo-sync', {
        body: { action: 'setup', connection_id: connection.id, kobo_asset_uid: selectedProject.uid },
      })

      toast.success(`KoboToolbox connected! Syncing ${selectedProject.name}…`)
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
        {([1, 2, 3] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
            <div className={`flex items-center gap-1.5 ${step === s ? 'text-blue-600 font-medium' : step > s ? 'text-emerald-600' : 'text-gray-400'}`}>
              {step > s ? <CheckCircle2 className="h-4 w-4" /> : (
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold border ${step === s ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>{s}</span>
              )}
              <span className="hidden sm:inline">{['Authentication', 'Select Project', 'Configure'][i]}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Step 1: Auth */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">KoboToolbox Server</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setServerUrl('https://kf.kobotoolbox.org')}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${serverUrl === 'https://kf.kobotoolbox.org' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                kf.kobotoolbox.org
              </button>
              <button
                onClick={() => setServerUrl('https://kobo.humanitarianresponse.info')}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${serverUrl === 'https://kobo.humanitarianresponse.info' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                OCHA Server
              </button>
            </div>
            <div className="mt-2">
              <Input
                placeholder="https://your-kobo-server.org"
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">API Token</Label>
            <Input
              type="password"
              placeholder="Paste your KoboToolbox API token"
              value={apiToken}
              onChange={e => setApiToken(e.target.value)}
              className="text-sm font-mono"
            />
            <a
              href="https://kf.kobotoolbox.org/token/?format=json"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline mt-1 flex items-center gap-1"
            >
              Where do I find my token? <ExternalLink className="h-3 w-3" />
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

      {/* Step 2: Select project */}
      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Select the KoboToolbox project to sync:</p>
          {projects.length === 0 ? (
            <div className="text-sm text-gray-400 py-6 text-center">No deployed projects found.</div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {projects.map(p => (
                <button
                  key={p.uid}
                  onClick={() => handleSelectProject(p)}
                  className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.submission_count.toLocaleString()} submissions</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </button>
              ))}
            </div>
          )}
          <Button variant="outline" onClick={() => setStep(1)} className="w-full">Back</Button>
        </div>
      )}

      {/* Step 3: Configure */}
      {step === 3 && selectedProject && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
            <span className="font-medium">{selectedProject.name}</span>
            <span className="text-blue-600"> — {selectedProject.submission_count.toLocaleString()} submissions</span>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">Dataset name in PLEXUS</Label>
            <Input
              value={datasetName}
              onChange={e => setDatasetName(e.target.value)}
              className="text-sm"
            />
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">Sync frequency</Label>
            <div className="flex gap-2 flex-wrap">
              {(['realtime', 'hourly', 'daily', 'manual'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setSyncFrequency(f)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors capitalize ${syncFrequency === f ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
            <Button onClick={handleStartSync} disabled={saving || !datasetName.trim()} className="flex-1">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Starting…</> : 'Start Sync'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
