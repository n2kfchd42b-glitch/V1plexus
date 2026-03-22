'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ChartBuilder } from '@/components/explorer/ChartBuilder'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { loadVersionData } from '@/lib/data/storage'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import type {
  Dataset,
  DatasetVersion,
  DatasetBranch,
  ParsedDataset,
  ChartConfig,
  ChartType,
} from '@/types/database'

export default function DatasetExplorePage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const datasetId = params.datasetId as string
  const { user, loading: authLoading } = useAuth()

  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [versions, setVersions] = useState<DatasetVersion[]>([])
  const [activeVersionId, setActiveVersionId] = useState<string>('')
  const [parsedData, setParsedData] = useState<ParsedDataset | null>(null)
  const [metaLoading, setMetaLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Save dialog
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [pendingSave, setPendingSave] = useState<{ chartType: ChartType; config: ChartConfig } | null>(null)
  const [chartTitle, setChartTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Load saved exploration (from ?load=id query param, set by client-side)
  const [initialChartType, setInitialChartType] = useState<ChartType | undefined>()
  const [initialConfig, setInitialConfig] = useState<ChartConfig | undefined>()
  const [explorationLoaded, setExplorationLoaded] = useState(false)

  const supabase = createClient()

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  // Load metadata
  useEffect(() => {
    if (!user) return

    const fetchMeta = async () => {
      setMetaLoading(true)
      setError(null)
      try {
        const [datasetRes, versionsRes, branchesRes] = await Promise.all([
          supabase.from('datasets').select('*').eq('id', datasetId).single(),
          supabase
            .from('dataset_versions')
            .select('*')
            .eq('dataset_id', datasetId)
            .order('version_number', { ascending: false }),
          supabase
            .from('dataset_branches')
            .select('*')
            .eq('dataset_id', datasetId)
            .order('is_default', { ascending: false }),
        ])

        if (datasetRes.error) throw new Error(datasetRes.error.message)
        if (datasetRes.data) setDataset(datasetRes.data)

        const versionList: DatasetVersion[] = versionsRes.data ?? []
        const branchList: DatasetBranch[] = branchesRes.data ?? []

        setVersions(versionList)

        const defaultBranch = branchList.find(b => b.is_default) ?? branchList[0]
        if (defaultBranch) {
          const headVersion = versionList.find(v => v.id === defaultBranch.head_version)
          setActiveVersionId(headVersion?.id ?? versionList[0]?.id ?? '')
        } else if (versionList.length > 0) {
          setActiveVersionId(versionList[0].id)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dataset')
      } finally {
        setMetaLoading(false)
      }
    }

    fetchMeta()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId, user])

  // Load data when version is ready
  useEffect(() => {
    if (!activeVersionId || versions.length === 0) return
    const version = versions.find(v => v.id === activeVersionId)
    if (!version) return

    const loadData = async () => {
      setDataLoading(true)
      setError(null)
      try {
        const data = await loadVersionData(version.file_path)
        setParsedData(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load data')
      } finally {
        setDataLoading(false)
      }
    }

    loadData()
  }, [activeVersionId, versions])

  // Read ?load= param and fetch that exploration's config
  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams(window.location.search)
    const loadId = params.get('load')

    if (!loadId) {
      setExplorationLoaded(true)
      return
    }

    supabase
      .from('dataset_explorations')
      .select('*')
      .eq('id', loadId)
      .single()
      .then(({ data }) => {
        if (data) {
          setInitialChartType(data.chart_type as ChartType)
          setInitialConfig(data.config as ChartConfig)
          setChartTitle(data.title ?? '')
        }
        setExplorationLoaded(true)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Open save dialog when ChartBuilder calls onSave
  function handleRequestSave(chartType: ChartType, config: ChartConfig) {
    setPendingSave({ chartType, config })
    // Pre-fill title from config if available
    setChartTitle(prev => prev || config.title || `${chartType} chart`)
    setSaveDialogOpen(true)
    // Focus input after dialog opens
    setTimeout(() => titleInputRef.current?.focus(), 50)
  }

  async function handleConfirmSave() {
    if (!pendingSave || !user || !activeVersionId) return
    setSaving(true)
    try {
      const { error } = await supabase.from('dataset_explorations').insert({
        dataset_id: datasetId,
        version_id: activeVersionId,
        title: chartTitle.trim() || `${pendingSave.chartType} chart`,
        chart_type: pendingSave.chartType,
        config: { ...pendingSave.config, title: chartTitle.trim() || pendingSave.config.title },
        created_by: user.id,
      })
      if (error) throw new Error(error.message)

      setSaveDialogOpen(false)
      setPendingSave(null)
      toast.success('Chart saved', {
        description: `"${chartTitle.trim()}" saved to this dataset.`,
        action: {
          label: 'View all charts',
          onClick: () => router.push(`/projects/${projectId}/data/${datasetId}?tab=charts`),
        },
      })
    } catch (e) {
      toast.error('Failed to save chart', {
        description: e instanceof Error ? e.message : 'Something went wrong',
      })
    } finally {
      setSaving(false)
    }
  }

  function handleBack() {
    router.push(`/projects/${projectId}/data/${datasetId}`)
  }

  // ── Loading states ──────────────────────────────────────────────────────────

  if (authLoading || metaLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) return null

  if (!dataset) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <p className="text-muted-foreground text-sm">Dataset not found.</p>
      </div>
    )
  }

  if (dataLoading || !parsedData || !explorationLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Loading dataset…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3">
        <p className="text-destructive text-sm">{error}</p>
        <button
          onClick={handleBack}
          className="text-xs text-muted-foreground underline hover:no-underline"
        >
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <ChartBuilder
        rows={parsedData.rows}
        columns={parsedData.columns}
        datasetId={datasetId}
        versionId={activeVersionId}
        onBack={handleBack}
        onSave={handleRequestSave}
        initialChartType={initialChartType}
        initialConfig={initialConfig}
      />

      {/* Save dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={open => { if (!saving) setSaveDialogOpen(open) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save Chart</DialogTitle>
            <DialogDescription>
              Give your chart a name so you can find it later.
            </DialogDescription>
          </DialogHeader>
          <input
            ref={titleInputRef}
            type="text"
            placeholder={`e.g. Viral Load by Sex`}
            value={chartTitle}
            onChange={e => setChartTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !saving && handleConfirmSave()}
            className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirmSave} disabled={saving || !chartTitle.trim()}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save Chart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
