"use client"

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Download, FileText, File, Code, Loader2, RefreshCw, PackageOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ExportRecord {
  path: string
  documentId: string
  format: 'docx' | 'tex' | 'html'
  exportedAt: Date
  sizeBytes: number | null
  documentTitle: string | null
}

const formatMeta: Record<string, { label: string; icon: React.ElementType }> = {
  docx: { label: 'Word (.docx)', icon: FileText },
  tex:  { label: 'LaTeX (.tex)', icon: Code },
  html: { label: 'PDF/HTML',    icon: File },
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ExportHistoryPanel() {
  const [records, setRecords] = useState<ExportRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // List files in exports/{userId}/ inside the 'exports' bucket
      const { data: files } = await supabase.storage
        .from('exports')
        .list(`exports/${user.id}`, { sortBy: { column: 'created_at', order: 'desc' } })

      if (!files || files.length === 0) {
        setRecords([])
        return
      }

      // Parse filename: {documentId}_{timestamp}.{ext}
      const parsed: ExportRecord[] = files
        .filter(f => f.name && !f.name.startsWith('.'))
        .map(f => {
          const nameParts = f.name.split('.')
          const ext = (nameParts.pop() ?? 'docx') as ExportRecord['format']
          const stem = nameParts.join('.')
          // stem is {documentId}_{timestamp}
          const lastUnderscore = stem.lastIndexOf('_')
          const documentId = lastUnderscore > 0 ? stem.slice(0, lastUnderscore) : stem
          const tsStr = lastUnderscore > 0 ? stem.slice(lastUnderscore + 1) : ''
          const ts = parseInt(tsStr, 10)

          return {
            path: `exports/${user.id}/${f.name}`,
            documentId,
            format: ext,
            exportedAt: isNaN(ts) ? new Date((f as { created_at?: string }).created_at ?? Date.now()) : new Date(ts),
            sizeBytes: (f as { metadata?: { size?: number } }).metadata?.size ?? null,
            documentTitle: null,
          }
        })

      // Fetch document titles for unique document IDs
      const uniqueDocIds = [...new Set(parsed.map(r => r.documentId))]
      const { data: docs } = await supabase
        .from('documents')
        .select('id, title')
        .in('id', uniqueDocIds)

      const titleMap: Record<string, string> = {}
      for (const doc of docs ?? []) {
        titleMap[doc.id] = doc.title
      }

      setRecords(parsed.map(r => ({ ...r, documentTitle: titleMap[r.documentId] ?? null })))
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { load() }, [load])

  const handleDownload = async (record: ExportRecord) => {
    setDownloading(record.path)
    try {
      const { data } = await supabase.storage
        .from('exports')
        .createSignedUrl(record.path, 3600)

      if (data?.signedUrl) {
        const a = document.createElement('a')
        a.href = data.signedUrl
        const title = (record.documentTitle ?? 'export').replace(/[^a-z0-9]/gi, '_')
        a.download = `${title}.${record.format}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    } finally {
      setDownloading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <PackageOpen className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No exports yet.</p>
        <p className="text-xs text-muted-foreground/60">
          Export a document using the Export button inside any document.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{records.length} export{records.length !== 1 ? 's' : ''}</p>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={load}>
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>

      <div className="border rounded-lg divide-y">
        {records.map(record => {
          const meta = formatMeta[record.format] ?? formatMeta.docx
          const Icon = meta.icon
          const isDownloading = downloading === record.path

          return (
            <div key={record.path} className="flex items-center gap-4 px-4 py-3">
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-muted flex-shrink-0">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {record.documentTitle ?? `Document ${record.documentId.slice(0, 8)}…`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {meta.label} · {formatBytes(record.sizeBytes)} · {record.exportedAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 flex-shrink-0"
                disabled={isDownloading}
                onClick={() => handleDownload(record)}
                title="Re-download"
              >
                {isDownloading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5" />
                }
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
