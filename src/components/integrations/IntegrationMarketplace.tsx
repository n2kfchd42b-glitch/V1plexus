'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IntegrationCategorySection } from './IntegrationCategorySection'
import { ActiveConnectionsList } from './ActiveConnectionsList'
import { IntegrationCard } from './IntegrationCard'
import { KoboConnectWizard } from './KoboConnectWizard'
import { REDCapConnectWizard } from './REDCapConnectWizard'
import { ODKConnectWizard } from './ODKConnectWizard'
import { SurveyCTOConnectWizard } from './SurveyCTOConnectWizard'
import { DHIS2ConnectWizard } from './DHIS2ConnectWizard'
import { ZoteroConnectWizard } from './ZoteroConnectWizard'
import { SyncHistoryLog } from './SyncHistoryLog'
import type { IntegrationConnection } from '@/types/database'
import type { ProviderDefinition } from './IntegrationProviderCard'

const DATA_COLLECTION_PROVIDERS: ProviderDefinition[] = [
  {
    id: 'kobotoolbox',
    label: 'KoboToolbox',
    description: 'Sync submissions from KoboToolbox forms with real-time webhook support',
    color: 'bg-teal-600',
    textColor: 'text-teal-700',
    borderColor: 'border-teal-300',
    type: 'data_source',
  },
  {
    id: 'redcap',
    label: 'REDCap',
    description: 'Import records from REDCap projects with full data dictionary support',
    color: 'bg-red-600',
    textColor: 'text-red-700',
    borderColor: 'border-red-300',
    type: 'data_source',
  },
  {
    id: 'surveycto',
    label: 'SurveyCTO',
    description: 'Pull submissions from SurveyCTO forms via scheduled polling',
    color: 'bg-purple-600',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-300',
    type: 'data_source',
  },
  {
    id: 'odk_central',
    label: 'ODK Central',
    description: 'Connect to ODK Central servers and pull form submissions',
    color: 'bg-blue-600',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-300',
    type: 'data_source',
  },
  {
    id: 'commcare',
    label: 'CommCare',
    description: 'Import cases and forms from CommCare HQ projects',
    color: 'bg-orange-500',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-300',
    type: 'data_source',
    comingSoon: true,
  },
]

const HIS_PROVIDERS: ProviderDefinition[] = [
  {
    id: 'dhis2',
    label: 'DHIS2',
    description: 'Aggregate and push research data into national health information systems',
    color: 'bg-green-700',
    textColor: 'text-green-700',
    borderColor: 'border-green-300',
    type: 'data_target',
    docsUrl: 'https://docs.dhis2.org/en/develop/using-the-api/dhis-core-version-master/data.html',
  },
]

const REFERENCE_PROVIDERS: ProviderDefinition[] = [
  {
    id: 'zotero',
    label: 'Zotero',
    description: 'Sync your Zotero reference library with project citations (bidirectional)',
    color: 'bg-orange-600',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-300',
    type: 'bidirectional',
    docsUrl: 'https://www.zotero.org/support/dev/web_api/v3/start',
  },
  {
    id: 'mendeley',
    label: 'Mendeley',
    description: 'Sync references from your Mendeley library into project citations',
    color: 'bg-indigo-600',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-300',
    type: 'bidirectional',
    comingSoon: true,
  },
]

interface IntegrationMarketplaceProps {
  projectId: string
}

type WizardProvider = 'kobotoolbox' | 'redcap' | 'odk_central' | 'surveycto' | 'dhis2' | 'zotero' | null

export function IntegrationMarketplace({ projectId }: IntegrationMarketplaceProps) {
  const supabase = createClient()
  const [connections, setConnections] = useState<IntegrationConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [activeWizard, setActiveWizard] = useState<WizardProvider>(null)
  const [manageConn, setManageConn] = useState<IntegrationConnection | null>(null)
  const [historyConn, setHistoryConn] = useState<IntegrationConnection | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)

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

  const handleConnect = (providerId: string) => {
    if (['kobotoolbox', 'redcap', 'odk_central', 'surveycto', 'dhis2', 'zotero'].includes(providerId)) {
      setActiveWizard(providerId as WizardProvider)
    }
  }

  const handleSyncNow = async (conn: IntegrationConnection) => {
    setSyncingId(conn.id)
    try {
      await supabase.functions.invoke('kobo-sync', {
        body: { action: 'sync', connection_id: conn.id },
      })
      await load()
    } catch {
      // silently fail — individual card handles toasts
    } finally {
      setSyncingId(null)
    }
  }

  const allProviders = [...DATA_COLLECTION_PROVIDERS, ...HIS_PROVIDERS, ...REFERENCE_PROVIDERS]
  const disconnected = connections.filter(c => c.status === 'disconnected')

  const wizardTitle: Record<string, string> = {
    kobotoolbox: 'Connect to KoboToolbox',
    redcap: 'Connect to REDCap',
    odk_central: 'Connect to ODK Central',
    surveycto: 'Connect to SurveyCTO',
    dhis2: 'Connect to DHIS2',
    zotero: 'Connect to Zotero',
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Connect PLEXUS to every tool in your research ecosystem. Collect data with any platform, push to national HIS, sync your references.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-5 w-5 rounded-full border-2 border-gray-200 border-t-blue-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Data collection category */}
          <IntegrationCategorySection
            title="Data Collection"
            description="Pull submissions from mobile data collection platforms"
            providers={DATA_COLLECTION_PROVIDERS}
            connections={connections}
            onConnect={handleConnect}
            onManage={setManageConn}
          />

          {/* Health information systems */}
          <IntegrationCategorySection
            title="Health Information Systems"
            description="Push aggregated research data to national health information systems"
            providers={HIS_PROVIDERS}
            connections={connections}
            onConnect={handleConnect}
            onManage={setManageConn}
          />

          {/* Reference managers */}
          <IntegrationCategorySection
            title="Reference Managers"
            description="Keep your citation library in sync with project references"
            providers={REFERENCE_PROVIDERS}
            connections={connections}
            onConnect={handleConnect}
            onManage={setManageConn}
          />

          {/* Active connections list */}
          <ActiveConnectionsList
            connections={connections}
            onSyncNow={handleSyncNow}
            onSettings={setHistoryConn}
          />

          {/* Disconnected connections */}
          {disconnected.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Disconnected</h3>
              {disconnected.map(conn => (
                <IntegrationCard
                  key={conn.id}
                  connection={conn}
                  onUpdated={load}
                  onSettings={() => setHistoryConn(conn)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Connect wizards */}
      <Dialog open={!!activeWizard} onOpenChange={() => setActiveWizard(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{activeWizard ? wizardTitle[activeWizard] : ''}</DialogTitle>
          </DialogHeader>
          {activeWizard === 'kobotoolbox' && (
            <KoboConnectWizard projectId={projectId} onConnected={() => { setActiveWizard(null); load() }} onCancel={() => setActiveWizard(null)} />
          )}
          {activeWizard === 'redcap' && (
            <REDCapConnectWizard projectId={projectId} onConnected={() => { setActiveWizard(null); load() }} onCancel={() => setActiveWizard(null)} />
          )}
          {activeWizard === 'odk_central' && (
            <ODKConnectWizard projectId={projectId} onConnected={() => { setActiveWizard(null); load() }} onCancel={() => setActiveWizard(null)} />
          )}
          {activeWizard === 'surveycto' && (
            <SurveyCTOConnectWizard projectId={projectId} onConnected={() => { setActiveWizard(null); load() }} onCancel={() => setActiveWizard(null)} />
          )}
          {activeWizard === 'dhis2' && (
            <DHIS2ConnectWizard projectId={projectId} onConnected={() => { setActiveWizard(null); load() }} onCancel={() => setActiveWizard(null)} />
          )}
          {activeWizard === 'zotero' && (
            <ZoteroConnectWizard projectId={projectId} onConnected={() => { setActiveWizard(null); load() }} onCancel={() => setActiveWizard(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Manage / settings dialog */}
      <Dialog open={!!manageConn} onOpenChange={() => setManageConn(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Connection</DialogTitle>
          </DialogHeader>
          {manageConn && (
            <IntegrationCard
              connection={manageConn}
              onUpdated={() => { load(); setManageConn(null) }}
              onSettings={() => { setHistoryConn(manageConn); setManageConn(null) }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Sync history dialog */}
      <Dialog open={!!historyConn} onOpenChange={() => setHistoryConn(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sync History</DialogTitle>
          </DialogHeader>
          {historyConn && <SyncHistoryLog connectionId={historyConn.id} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
