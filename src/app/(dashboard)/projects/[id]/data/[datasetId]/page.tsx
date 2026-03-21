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
        <p className="text-muted-foreground text-sm">Loading dataset…</p>
      </div>
    )
  }

  return (
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
