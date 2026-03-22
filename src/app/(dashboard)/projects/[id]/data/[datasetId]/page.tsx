'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Wand2, BarChart2, GitMerge, GitCommit, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DatasetTable } from '@/components/data/DatasetTable'
import { VersionSelector } from '@/components/data/VersionSelector'
import { BranchSelector } from '@/components/data/BranchSelector'
import { loadVersionData } from '@/lib/data/storage'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import type { Dataset, DatasetVersion, DatasetBranch, ParsedDataset } from '@/types/database'

export default function DatasetViewerPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const datasetId = params.datasetId as string
  const { user, loading: authLoading } = useAuth()

  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [versions, setVersions] = useState<DatasetVersion[]>([])
  const [branches, setBranches] = useState<DatasetBranch[]>([])
  const [activeVersionId, setActiveVersionId] = useState<string>('')
  const [activeBranchId, setActiveBranchId] = useState<string>('')
  const [parsedData, setParsedData] = useState<ParsedDataset | null>(null)
  const [metaLoading, setMetaLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  // Fetch dataset metadata: record, versions, branches
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
        setBranches(branchList)

        // Set defaults: default branch and its head version
        const defaultBranch = branchList.find(b => b.is_default) ?? branchList[0]
        if (defaultBranch) {
          setActiveBranchId(defaultBranch.id)
          const headVersion = versionList.find(v => v.id === defaultBranch.head_version)
          if (headVersion) {
            setActiveVersionId(headVersion.id)
          } else if (versionList.length > 0) {
            setActiveVersionId(versionList[0].id)
          }
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

  // Load data file when active version changes
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

  const handleVersionChange = (versionId: string) => {
    setActiveVersionId(versionId)
  }

  const handleBranchChange = (branchId: string) => {
    setActiveBranchId(branchId)
    const branch = branches.find(b => b.id === branchId)
    if (branch) {
      const headVersion = versions.find(v => v.id === branch.head_version)
      if (headVersion) {
        setActiveVersionId(headVersion.id)
      }
    }
  }

  const activeVersion = versions.find(v => v.id === activeVersionId)

  if (authLoading || metaLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (!dataset) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <p className="text-muted-foreground text-sm">Dataset not found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b bg-white">
        <Link href={`/projects/${projectId}/data`}>
          <Button variant="ghost" size="sm" className="mb-3 h-7 text-xs -ml-2">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            All Datasets
          </Button>
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{dataset.name}</h1>
            {dataset.description && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">{dataset.description}</p>
            )}
            {activeVersion && (
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>{activeVersion.row_count.toLocaleString()} rows</span>
                <span>{activeVersion.column_count} columns</span>
                <span>{versions.length} version{versions.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Navigation actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/projects/${projectId}/data/${datasetId}/clean`}>
              <Button variant="outline" size="sm">
                <Wand2 className="h-4 w-4 mr-1.5" />
                Clean
              </Button>
            </Link>
            <Link href={`/projects/${projectId}/data/${datasetId}/explore`}>
              <Button variant="outline" size="sm">
                <BarChart2 className="h-4 w-4 mr-1.5" />
                Explore
              </Button>
            </Link>
            <Link href={`/projects/${projectId}/data/${datasetId}/versions`}>
              <Button variant="outline" size="sm">
                <GitCommit className="h-4 w-4 mr-1.5" />
                Versions
              </Button>
            </Link>
            <Link href={`/projects/${projectId}/data/${datasetId}/merge`}>
              <Button variant="outline" size="sm">
                <GitMerge className="h-4 w-4 mr-1.5" />
                Merge
              </Button>
            </Link>
          </div>
        </div>

        {/* Branch and Version selectors */}
        {(branches.length > 0 || versions.length > 0) && (
          <div className="flex items-center gap-4 mt-4">
            {branches.length > 0 && activeBranchId && (
              <BranchSelector
                branches={branches}
                currentBranchId={activeBranchId}
                onBranchChange={handleBranchChange}
              />
            )}
            {versions.length > 0 && activeVersionId && (
              <VersionSelector
                versions={versions}
                currentVersionId={activeVersionId}
                onVersionChange={handleVersionChange}
              />
            )}
          </div>
        )}
      </div>

      {/* Data area */}
      <div className="flex-1 overflow-hidden">
        {error && (
          <div className="m-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm flex items-center justify-between">
            <span>{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setError(null)
                if (activeVersion) {
                  setDataLoading(true)
                  loadVersionData(activeVersion.file_path)
                    .then(data => setParsedData(data))
                    .catch(e => setError(e instanceof Error ? e.message : 'Failed to load data'))
                    .finally(() => setDataLoading(false))
                }
              }}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
        )}

        {dataLoading ? (
          <div className="flex items-center justify-center h-full min-h-[300px]">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading data...</p>
            </div>
          </div>
        ) : parsedData ? (
          <DatasetTable
            rows={parsedData.rows}
            columns={parsedData.columns}
            className="h-full"
          />
        ) : !error ? (
          <div className="flex items-center justify-center h-full min-h-[300px]">
            <p className="text-sm text-muted-foreground">No data available for this version.</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
