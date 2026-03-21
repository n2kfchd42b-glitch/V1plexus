'use client'

import Link from 'next/link'
import { Database, GitBranch, Rows, Columns, Clock, ArrowRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Dataset } from '@/types/database'

const SOURCE_LABELS: Record<string, string> = {
  upload: 'Upload',
  merge: 'Merged',
  append: 'Appended',
  clean: 'Cleaned',
  branch: 'Branch',
  kobo: 'KoboToolbox',
  redcap: 'REDCap',
}

const SOURCE_COLORS: Record<string, string> = {
  upload: 'bg-blue-100 text-blue-700',
  merge: 'bg-purple-100 text-purple-700',
  append: 'bg-green-100 text-green-700',
  clean: 'bg-orange-100 text-orange-700',
  branch: 'bg-yellow-100 text-yellow-700',
  kobo: 'bg-teal-100 text-teal-700',
  redcap: 'bg-pink-100 text-pink-700',
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
  const version = dataset.latest_version
  const href = `/projects/${projectId}/data/${dataset.id}`

  return (
    <Link href={href} className="block group">
      <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 bg-blue-50 rounded-lg shrink-0">
              <Database className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                {dataset.name}
              </h3>
              {dataset.description && (
                <p className="text-sm text-gray-500 mt-0.5 truncate">{dataset.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                {version && (
                  <>
                    <span className="flex items-center gap-1">
                      <Rows className="h-3 w-3" />
                      {version.row_count.toLocaleString()} rows
                    </span>
                    <span className="flex items-center gap-1">
                      <Columns className="h-3 w-3" />
                      {version.column_count} cols
                    </span>
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      v{version.version_number}
                    </span>
                  </>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(dataset.updated_at), { addSuffix: true })}
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
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${SOURCE_COLORS[dataset.source] ?? 'bg-gray-100 text-gray-700'}`}>
              {SOURCE_LABELS[dataset.source] ?? dataset.source}
            </span>
            <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
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
