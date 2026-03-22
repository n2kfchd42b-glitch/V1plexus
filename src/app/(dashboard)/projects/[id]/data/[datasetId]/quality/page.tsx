'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { QualityDashboard } from '@/components/quality/QualityDashboard'
import type { Dataset, DatasetVersion } from '@/types/database'

export default function DatasetQualityPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const datasetId = params.datasetId as string
  const { user, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [latestVersion, setLatestVersion] = useState<DatasetVersion | null>(null)
  const [columns, setColumns] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [dsRes, vRes] = await Promise.all([
        supabase.from('datasets').select('*').eq('id', datasetId).single(),
        supabase
          .from('dataset_versions')
          .select('*')
          .eq('dataset_id', datasetId)
          .order('version_number', { ascending: false })
          .limit(1)
          .single(),
      ])
      if (dsRes.data) setDataset(dsRes.data)
      if (vRes.data) {
        setLatestVersion(vRes.data)
        // Extract column names from schema_info
        const schema = dsRes.data?.schema_info
        if (schema?.columns) {
          setColumns(schema.columns.map((c: { name: string }) => c.name))
        }
      }
      setLoading(false)
    }
    load()
  }, [datasetId, user, supabase])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!dataset) return null

  return (
    <div className="max-w-3xl mx-auto py-6 px-6">
      <div className="mb-6">
        <Link href={`/projects/${projectId}/data/${datasetId}`}>
          <Button variant="ghost" size="sm" className="h-7 text-xs -ml-2 mb-3">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to Dataset
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Data Quality</h1>
        <p className="text-sm text-gray-500 mt-0.5">{dataset.name}</p>
      </div>

      {latestVersion ? (
        <QualityDashboard
          datasetId={datasetId}
          versionId={latestVersion.id}
          projectId={projectId}
          columns={columns}
        />
      ) : (
        <div className="text-center py-12 text-sm text-gray-400">
          No versions found. Upload data first to enable quality monitoring.
        </div>
      )}
    </div>
  )
}
