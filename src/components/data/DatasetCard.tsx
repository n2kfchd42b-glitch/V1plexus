"use client"

import Link from 'next/link'
import { Database, FileText, FileSpreadsheet, HardDrive, BarChart2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatRelative, formatDate } from '@/lib/utils'
import type { Dataset } from '@/types/database'

function formatBytes(bytes: number | null): string {
  if (!bytes) return 'Unknown size'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function SourceIcon({ source }: { source: string }) {
  if (source === 'excel') return <FileSpreadsheet className="h-4 w-4 text-green-600" />
  if (source === 'csv') return <FileText className="h-4 w-4 text-blue-600" />
  return <Database className="h-4 w-4 text-muted-foreground" />
}

interface DatasetCardProps {
  dataset: Dataset
  projectId: string
}

export function DatasetCard({ dataset, projectId }: DatasetCardProps) {
  return (
    <Link href={`/projects/${projectId}/data/${dataset.id}`}>
      <Card className="hover:shadow-sm transition-shadow cursor-pointer">
        <CardContent className="p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <SourceIcon source={dataset.source} />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{dataset.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{dataset.file_name}</p>
              <div className="flex items-center gap-3 mt-1.5">
                {dataset.row_count != null && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <BarChart2 className="h-3 w-3" />
                    {dataset.row_count.toLocaleString()} rows × {dataset.column_count} cols
                  </span>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <HardDrive className="h-3 w-3" />
                  {formatBytes(dataset.file_size)}
                </span>
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <Badge variant="outline" className="text-xs capitalize mb-1">
              {dataset.source}
            </Badge>
            <p className="text-xs text-muted-foreground">{formatRelative(dataset.created_at)}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
