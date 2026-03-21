'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Wand2, BarChart2, GitMerge, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DatasetTable } from '@/components/data/DatasetTable'
import { VersionSelector } from '@/components/data/VersionSelector'
import { BranchSelector } from '@/components/data/BranchSelector'
import { loadVersionData } from '@/lib/data/storage'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import type { Dataset, DatasetVersion, DatasetBranch, ParsedDataset } from '@/types/database'

export default function DatasetViewerPage() {
"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download, Trash2, BarChart2, HardDrive, Hash, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DatasetPreview } from '@/components/data/DatasetPreview'
import { SchemaViewer } from '@/components/data/SchemaViewer'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { parseFile } from '@/lib/fileParser'
import type { Dataset } from '@/types/database'

function formatBytes(bytes: number | null): string {
  if (!bytes) return 'Unknown'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DatasetDetailPage() {
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
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<(string | number | boolean | null)[][]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function fetchDataset() {
      const { data } = await supabase
        .from('datasets')
        .select('*')
        .eq('id', datasetId)
        .single()
      if (data) setDataset(data)
    }
    fetchDataset()
  }, [datasetId, supabase])

  useEffect(() => {
    if (!dataset) return
    async function loadPreview() {
      if (!dataset) return
      setLoadingPreview(true)
      try {
        const { data: blob, error } = await supabase.storage
          .from('datasets')
          .download(dataset.file_path)
        if (error || !blob) return
        const file = new File([blob], dataset.file_name, { type: dataset.mime_type ?? '' })
        const parsed = await parseFile(file)
        setPreviewHeaders(parsed.headers)
        setPreviewRows(parsed.rows.slice(0, 100))
      } finally {
        setLoadingPreview(false)
      }
    }
    loadPreview()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset?.id])

  async function handleDownload() {
    if (!dataset) return
    const { data } = await supabase.storage.from('datasets').download(dataset.file_path)
    if (!data) return
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = dataset.file_name
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDelete() {
    if (!dataset || !confirm(`Delete dataset "${dataset.name}"? This cannot be undone.`)) return
    setDeleting(true)
    await supabase.from('datasets').update({ deleted_at: new Date().toISOString() }).eq('id', datasetId)
    router.push(`/projects/${projectId}/data`)
  }

  if (!dataset) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <p className="text-muted-foreground text-sm">Dataset not found.</p>
        <p className="text-muted-foreground text-sm">Loading dataset…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b bg-white">
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{dataset.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">{dataset.file_name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1.5" />
              Download
            </Button>
            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={handleDelete} disabled={deleting}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* Metadata chips */}
        <div className="flex flex-wrap gap-3 mt-4">
          {dataset.row_count != null && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <BarChart2 className="h-4 w-4" />
              {dataset.row_count.toLocaleString()} rows × {dataset.column_count} columns
            </div>
          )}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <HardDrive className="h-4 w-4" />
            {formatBytes(dataset.file_size)}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Uploaded {formatDate(dataset.created_at)}
          </div>
          {dataset.file_hash && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <Hash className="h-3.5 w-3.5" />
              SHA-256: {dataset.file_hash.slice(0, 16)}…
            </div>
          )}
          <Badge variant="outline" className="text-xs capitalize">{dataset.source}</Badge>
        </div>
      </div>

      <Tabs defaultValue="preview">
        <TabsList className="mb-4">
          <TabsTrigger value="preview">Data Preview</TabsTrigger>
          <TabsTrigger value="schema">Schema ({dataset.column_count ?? 0} columns)</TabsTrigger>
        </TabsList>

        <TabsContent value="preview">
          {loadingPreview ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading preview…</div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                Showing first {previewRows.length} of {dataset.row_count?.toLocaleString() ?? '?'} rows
              </p>
              <div className="border rounded-md overflow-hidden">
                <DatasetPreview headers={previewHeaders} rows={previewRows} />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="schema">
          {dataset.schema_info ? (
            <div className="max-w-2xl">
              <SchemaViewer schema={dataset.schema_info} totalRows={dataset.row_count ?? 0} />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No schema information available.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
