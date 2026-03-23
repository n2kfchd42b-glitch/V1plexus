'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Plus, Link2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IntegrationCard } from '@/components/integrations/IntegrationCard'
import { KoboConnectWizard } from '@/components/integrations/KoboConnectWizard'
import { REDCapConnectWizard } from '@/components/integrations/REDCapConnectWizard'
import { ODKConnectWizard } from '@/components/integrations/ODKConnectWizard'
import { SyncHistoryLog } from '@/components/integrations/SyncHistoryLog'
import type { IntegrationConnection, IntegrationProvider } from '@/types/database'

const PROVIDERS: { id: IntegrationProvider; label: string; description: string; color: string }[] = [
  { id: 'kobotoolbox', label: 'KoboToolbox', description: 'Sync submissions from KoboToolbox forms', color: 'text-teal-600' },
  { id: 'redcap', label: 'REDCap', description: 'Import records from REDCap projects', color: 'text-red-600' },
  { id: 'odk_central', label: 'ODK Central', description: 'Pull submissions from ODK Central forms', color: 'text-blue-600' },
]

export default function IntegrationsPage() {
  const params = useParams()
  const projectId = params.id as string
  const supabase = createClient()

  const [connections, setConnections] = useState<IntegrationConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [addProvider, setAddProvider] = useState<IntegrationProvider | null>(null)
  const [historyConnectionId, setHistoryConnectionId] = useState<string | null>(null)

  const load = async () => {
    const { data } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    setConnections((data ?? []) as IntegrationConnection[])
    setLoading(false)
  }

  useEffect(() => { load() }, [projectId])

  const active = connections.filter(c => c.status !== 'disconnected')
  const disconnected = connections.filter(c => c.status === 'disconnected')

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Data Integrations</h2>
          <p className="text-sm text-gray-500 mt-0.5">Connect to external data collection platforms for automatic sync</p>
        </div>
      </div>

      {/* Connect new */}
      <div className="border border-dashed border-gray-300 rounded-xl p-5 bg-gray-50">
        <p className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
          <Link2 className="h-4 w-4" />Connect a platform
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => setAddProvider(p.id)}
              className="flex flex-col items-start gap-1 p-3 border border-gray-200 rounded-lg bg-white hover:border-blue-300 hover:shadow-sm transition-all text-left"
            >
              <span className={`text-sm font-semibold ${p.color}`}>{p.label}</span>
              <span className="text-xs text-gray-500">{p.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Active connections */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 rounded-full border-2 border-gray-200 border-t-blue-500 animate-spin" />
        </div>
      ) : active.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Active ({active.length})</h3>
          {active.map(conn => (
            <div key={conn.id}>
              <IntegrationCard
                connection={conn}
                onUpdated={load}
                onSettings={() => setHistoryConnectionId(conn.id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-400 text-center py-4">No active integrations. Connect a platform above.</div>
      )}

      {/* Disconnected */}
      {disconnected.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-400">Disconnected</h3>
          {disconnected.map(conn => (
            <IntegrationCard key={conn.id} connection={conn} onUpdated={load} onSettings={() => setHistoryConnectionId(conn.id)} />
          ))}
        </div>
      )}

      {/* Connect wizard dialogs */}
      <Dialog open={addProvider === 'kobotoolbox'} onOpenChange={() => setAddProvider(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Connect to KoboToolbox</DialogTitle></DialogHeader>
          <KoboConnectWizard projectId={projectId} onConnected={() => { setAddProvider(null); load() }} onCancel={() => setAddProvider(null)} />
        </DialogContent>
      </Dialog>

      <Dialog open={addProvider === 'redcap'} onOpenChange={() => setAddProvider(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Connect to REDCap</DialogTitle></DialogHeader>
          <REDCapConnectWizard projectId={projectId} onConnected={() => { setAddProvider(null); load() }} onCancel={() => setAddProvider(null)} />
        </DialogContent>
      </Dialog>

      <Dialog open={addProvider === 'odk_central'} onOpenChange={() => setAddProvider(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Connect to ODK Central</DialogTitle></DialogHeader>
          <ODKConnectWizard projectId={projectId} onConnected={() => { setAddProvider(null); load() }} onCancel={() => setAddProvider(null)} />
        </DialogContent>
      </Dialog>

      {/* Sync history dialog */}
      <Dialog open={!!historyConnectionId} onOpenChange={() => setHistoryConnectionId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Sync History</DialogTitle></DialogHeader>
          {historyConnectionId && <SyncHistoryLog connectionId={historyConnectionId} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
