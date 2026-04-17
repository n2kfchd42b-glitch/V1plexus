'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CleaningWorkbench } from '@/components/cleaning/CleaningWorkbench'
import { loadVersionData } from '@/lib/data/storage'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { getDataset, getDatasetVersions, getDatasetBranches } from '@/lib/data'
import type { Dataset, DatasetVersion, DatasetBranch, DataRow, ColumnSchema } from '@/types/database'

export default function CleanPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const datasetId = params.datasetId as string
  const { user, loading: authLoading } = useAuth()

  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [version, setVersion] = useState<DatasetVersion | null>(null)
  const [branch, setBranch] = useState<DatasetBranch | null>(null)
  const [rows, setRows] = useState<DataRow[]>([])
  const [columns, setColumns] = useState<ColumnSchema[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [datasetResult, versionsResult, branchesResult] = await Promise.all([
          getDataset(supabase, datasetId),
          getDatasetVersions(supabase, datasetId),
          getDatasetBranches(supabase, datasetId),
        ])

        if (datasetResult.status === 'error') throw new Error(datasetResult.error ?? 'Failed to load dataset')
        setDataset(datasetResult.data)

        const versions: DatasetVersion[] = versionsResult.data
        const branches: DatasetBranch[] = branchesResult.data

        // Get the default/main branch's current head version
        const defaultBranch = branches.find(b => b.is_default) ?? branches[0]
        setBranch(defaultBranch ?? null)

        let activeVersion = versions[0] ?? null
        if (defaultBranch) {
          activeVersion = versions.find(v => v.id === defaultBranch.head_version) ?? versions[0] ?? null
        }
        setVersion(activeVersion)

        if (activeVersion) {
          const data = await loadVersionData(activeVersion.file_path)
          setRows(data.rows)
          setColumns(data.columns)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dataset')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user, datasetId])

  const handleVersionSaved = (newVersionId: string) => {
    router.push(`/projects/${projectId}/data/${datasetId}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-3" />
        <span className="text-gray-600">Loading dataset...</span>
      </div>
    )
  }

  if (error || !dataset || !version) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-gray-700">{error ?? 'Dataset not found'}</p>
        <Button asChild variant="outline">
          <Link href={`/projects/${projectId}/data/${datasetId}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dataset
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Nav breadcrumb */}
      <div className="px-6 py-3 border-b bg-white shrink-0">
        <Link href={`/projects/${projectId}/data/${datasetId}`}>
          <Button variant="ghost" size="sm" className="h-7 text-xs -ml-2">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to {dataset.name}
          </Button>
        </Link>
      </div>

      <div className="flex-1 overflow-hidden">
        <CleaningWorkbench
          datasetId={datasetId}
          projectId={projectId}
          version={version}
          initialRows={rows}
          initialColumns={columns}
          branchName={branch?.name ?? 'main'}
          onVersionSaved={handleVersionSaved}
        />
      </div>
    </div>
  )
}
