'use client'

import { useState } from 'react'
import { Loader2, ExternalLink, ChevronRight, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface REDCapConnectWizardProps {
  projectId: string
  onConnected: () => void
  onCancel: () => void
}

export function REDCapConnectWizard({ projectId, onConnected, onCancel }: REDCapConnectWizardProps) {
  const supabase = createClient()
  const [step, setStep] = useState<1 | 2>(1)
  const [apiUrl, setApiUrl] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [projectInfo, setProjectInfo] = useState<{ title: string; record_count: number } | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [datasetName, setDatasetName] = useState('')
  const [syncFrequency, setSyncFrequency] = useState<'hourly' | 'daily' | 'manual'>('daily')
  const [saving, setSaving] = useState(false)

  const handleConnect = async () => {
    if (!apiUrl.trim() || !apiToken.trim()) {
      toast.error('Enter your REDCap URL and API token')
      return
    }
    setConnecting(true)
    try {
      // Verify token by fetching project info
      const formData = new FormData()
      formData.append('token', apiToken)
      formData.append('content', 'project')
      formData.append('format', 'json')

      const res = await fetch(apiUrl.replace(/\/?$/, '/api/'), {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Could not reach REDCap API')
      const info = await res.json()
      setProjectInfo({ title: info.project_title ?? 'Untitled', record_count: info.in_production ?? 0 })
      setDatasetName(`${info.project_title ?? 'REDCap'} — Sync`)
      setStep(2)
    } catch {
      toast.error('Could not connect to REDCap — check your URL and token')
    } finally {
      setConnecting(false)
    }
  }

  const handleSave = async () => {
    if (!projectInfo) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('integration_connections')
        .insert({
          project_id: projectId,
          provider: 'redcap',
          config: {
            api_url: apiUrl,
            api_token: apiToken,
            dataset_name: datasetName,
          },
          status: 'active',
          sync_frequency: syncFrequency,
        })
      if (error) throw error
      toast.success('REDCap connected! Syncing records…')
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
        {([1, 2] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
            <div className={`flex items-center gap-1.5 ${step === s ? 'text-red-600 font-medium' : step > s ? 'text-emerald-600' : 'text-gray-400'}`}>
              {step > s ? <CheckCircle2 className="h-4 w-4" /> : (
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold border ${step === s ? 'border-red-600 bg-red-50' : 'border-gray-200'}`}>{s}</span>
              )}
              <span>{['Authentication', 'Configure'][i]}</span>
            </div>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">REDCap Base URL</Label>
            <Input
              placeholder="https://redcap.yourinstitution.edu"
              value={apiUrl}
              onChange={e => setApiUrl(e.target.value)}
              className="text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">The base URL of your REDCap instance (without /api/)</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">API Token</Label>
            <Input
              type="password"
              placeholder="Paste your REDCap API token"
              value={apiToken}
              onChange={e => setApiToken(e.target.value)}
              className="text-sm font-mono"
            />
            <a
              href="https://projectredcap.org/resources/videos/api-documentation/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-red-600 hover:underline mt-1 flex items-center gap-1"
            >
              REDCap API documentation <ExternalLink className="h-3 w-3" />
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

      {step === 2 && projectInfo && (
        <div className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-800">
            <span className="font-medium">{projectInfo.title}</span>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">Dataset name in PLEXUS</Label>
            <Input value={datasetName} onChange={e => setDatasetName(e.target.value)} className="text-sm" />
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">Sync frequency</Label>
            <div className="flex gap-2 flex-wrap">
              {(['hourly', 'daily', 'manual'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setSyncFrequency(f)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors capitalize ${syncFrequency === f ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
            <Button onClick={handleSave} disabled={saving || !datasetName.trim()} className="flex-1 bg-red-600 hover:bg-red-700">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : 'Start Sync'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
