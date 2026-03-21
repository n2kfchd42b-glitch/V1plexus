'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { ChartBuilder } from '@/components/explorer/ChartBuilder'
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
  const [saving, setSaving] = useState(false)

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

        // Use head version of default branch, or latest version
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

  async function handleSave(chartType: ChartType, config: ChartConfig) {
    if (!user || !activeVersionId) return
    setSaving(true)
    try {
      const { error } = await supabase.from('dataset_explorations').insert({
        dataset_id: datasetId,
        version_id: activeVersionId,
        title: config.title ?? `${chartType} chart`,
        chart_type: chartType,
        config,
        created_by: user.id,
      })
      if (error) throw new Error(error.message)
      // Navigate back to dataset page after save
      router.push(`/projects/${projectId}/data/${datasetId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save chart')
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

  if (dataLoading || !parsedData) {
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
      {saving && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 flex items-center gap-3 shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Saving chart…</span>
          </div>
        </div>
      )}

      <ChartBuilder
        rows={parsedData.rows}
        columns={parsedData.columns}
        datasetId={datasetId}
        versionId={activeVersionId}
        onBack={handleBack}
        onSave={handleSave}
      />
    </div>
  )
}
