'use client'

import { useState } from 'react'
import { Loader2, ChevronRight, CheckCircle2, ExternalLink, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ZoteroLibrary {
  id: number
  name: string
  type: 'user' | 'group'
  itemCount: number
}

interface ZoteroConnectWizardProps {
  projectId: string
  onConnected: () => void
  onCancel: () => void
}

export function ZoteroConnectWizard({ projectId, onConnected, onCancel }: ZoteroConnectWizardProps) {
  const supabase = createClient()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [apiKey, setApiKey] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [libraries, setLibraries] = useState<ZoteroLibrary[]>([])
  const [userId, setUserId] = useState<number | null>(null)
  const [selectedLibrary, setSelectedLibrary] = useState<ZoteroLibrary | null>(null)
  const [syncDirection, setSyncDirection] = useState<'pull' | 'bidirectional'>('pull')
  const [saving, setSaving] = useState(false)

  const handleConnect = async () => {
    if (!apiKey.trim()) { toast.error('Enter your Zotero API key'); return }
    setConnecting(true)
    try {
      // Verify key + get user ID
      const keyRes = await fetch(`https://api.zotero.org/keys/${apiKey}`, {
        headers: { 'Zotero-API-Version': '3' },
      })
      if (!keyRes.ok) throw new Error('Invalid API key')
      const keyData = await keyRes.json()
      const uid: number = keyData.userID
      setUserId(uid)

      // Fetch user library + group libraries
      const [userRes, groupsRes] = await Promise.all([
        fetch(`https://api.zotero.org/users/${uid}`, {
          headers: { 'Zotero-API-Key': apiKey, 'Zotero-API-Version': '3' },
        }),
        fetch(`https://api.zotero.org/users/${uid}/groups`, {
          headers: { 'Zotero-API-Key': apiKey, 'Zotero-API-Version': '3' },
        }),
      ])

      const libList: ZoteroLibrary[] = []

      if (userRes.ok) {
        const u = await userRes.json()
        libList.push({
          id: uid,
          name: `${u.username ?? 'My'} Library (personal)`,
          type: 'user',
          itemCount: 0,
        })
      }

      if (groupsRes.ok) {
        const groups = await groupsRes.json()
        for (const g of groups) {
          libList.push({
            id: g.id,
            name: g.data?.name ?? `Group ${g.id}`,
            type: 'group',
            itemCount: g.meta?.numItems ?? 0,
          })
        }
      }

      setLibraries(libList)
      setStep(2)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not connect to Zotero — check your API key')
    } finally {
      setConnecting(false)
    }
  }

  const handleSave = async () => {
    if (!selectedLibrary || userId === null) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('integration_connections')
        .insert({
          project_id: projectId,
          provider: 'zotero',
          display_name: `Zotero — ${selectedLibrary.name}`,
          provider_project_id: String(selectedLibrary.id),
          provider_project_name: selectedLibrary.name,
          config: {
            api_key_encrypted: apiKey,
            user_id: userId,
            library_id: selectedLibrary.id,
            library_type: selectedLibrary.type,
            library_name: selectedLibrary.name,
          },
          status: 'active',
          sync_frequency: 'daily',
          sync_direction: syncDirection,
        })
      if (error) throw error
      toast.success('Zotero connected! Your reference library will sync with project citations.')
      onConnected()
    } catch {
      toast.error('Failed to save connection')
    } finally {
      setSaving(false)
    }
  }

  const STEPS = ['API Key', 'Select Library', 'Configure'] as const

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {([1, 2, 3] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
            <div className={`flex items-center gap-1.5 ${step === s ? 'text-orange-600 font-medium' : step > s ? 'text-emerald-600' : 'text-gray-400'}`}>
              {step > s ? <CheckCircle2 className="h-4 w-4" /> : (
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold border ${step === s ? 'border-orange-600 bg-orange-50' : 'border-gray-200'}`}>{s}</span>
              )}
              <span>{STEPS[i]}</span>
            </div>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-100 rounded-lg text-xs text-orange-800">
            <BookOpen className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>Zotero syncs your reference library with PLEXUS project citations. Citations you add in PLEXUS can be sent back to Zotero (bidirectional sync).</span>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">Zotero API Key</Label>
            <Input
              type="password"
              placeholder="Paste your Zotero API key"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="text-sm font-mono"
            />
            <a
              href="https://www.zotero.org/settings/keys/new"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-orange-600 hover:underline mt-1 flex items-center gap-1"
            >
              Generate a Zotero API key <ExternalLink className="h-3 w-3" />
            </a>
            <p className="text-xs text-gray-400 mt-1">Key needs: read access to your library. For bidirectional sync, also enable write access.</p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
            <Button onClick={handleConnect} disabled={connecting} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white">
              {connecting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Connecting…</> : 'Connect'}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Select the Zotero library to sync:</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {libraries.map(lib => (
              <button
                key={`${lib.type}-${lib.id}`}
                onClick={() => { setSelectedLibrary(lib); setStep(3) }}
                className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{lib.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{lib.type} library · {lib.itemCount > 0 ? `${lib.itemCount.toLocaleString()} items` : 'items loading…'}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={() => setStep(1)} className="w-full">Back</Button>
        </div>
      )}

      {step === 3 && selectedLibrary && (
        <div className="space-y-4">
          <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg text-sm text-orange-800">
            <span className="font-medium">{selectedLibrary.name}</span>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">Sync direction</Label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-orange-300 transition-colors">
                <input
                  type="radio"
                  checked={syncDirection === 'pull'}
                  onChange={() => setSyncDirection('pull')}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">Zotero → PLEXUS only</p>
                  <p className="text-xs text-gray-500">Import your Zotero references into project citations. Changes in PLEXUS do not go back to Zotero.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-orange-300 transition-colors">
                <input
                  type="radio"
                  checked={syncDirection === 'bidirectional'}
                  onChange={() => setSyncDirection('bidirectional')}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">Bidirectional</p>
                  <p className="text-xs text-gray-500">Syncs both ways. Citations added in PLEXUS will appear in your Zotero library. Requires write access on your API key.</p>
                </div>
              </label>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : 'Start Sync'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
