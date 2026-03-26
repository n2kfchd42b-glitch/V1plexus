"use client"

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart2, Clock, Database, Trash2, X, Check } from 'lucide-react'
import { formatRelative } from '@/lib/utils'
import type { AnalysisRun } from '@/types/database'
import { ANALYSIS_TYPES } from './AnalysisTypePicker'

interface Props {
  run: AnalysisRun
  projectId: string
  onDelete?: (id: string) => void
}

export function AnalysisRunCard({ run, projectId, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false)
  const info = ANALYSIS_TYPES.find(t => t.type === run.analysis_type)

  const getStatusColor = () => {
    if (run.status === 'completed') return 'bg-green-100 text-green-700 border-green-200'
    if (run.status === 'failed') return 'bg-red-100 text-red-700 border-red-200'
    if (run.status === 'running') return 'bg-blue-100 text-blue-700 border-blue-200'
    return 'bg-gray-100 text-gray-600 border-gray-200'
  }

  const summary = run.results?.summary as Record<string, unknown> | undefined
  const keyResult = summary ? Object.entries(summary).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' | ') : ''

  return (
    <div className="group relative">
      <Link href={`/projects/${projectId}/analysis/${run.id}`}>
        <Card className="hover:shadow-sm transition-shadow cursor-pointer">
          <CardContent className="p-3 flex items-start gap-3">
            <div className="text-muted-foreground mt-0.5 shrink-0">
              <BarChart2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium truncate">{run.title ?? info?.label ?? run.analysis_type}</p>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${getStatusColor()}`}>
                  {run.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{info?.label ?? run.analysis_type}</p>
              {keyResult && <p className="text-xs text-muted-foreground mt-0.5 truncate font-mono">{keyResult}</p>}
              <div className="flex items-center gap-3 mt-1.5">
                {run.dataset && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Database className="h-3 w-3" />
                    {run.dataset.name}
                  </span>
                )}
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatRelative(run.created_at)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      {onDelete && (
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {confirming ? (
            <>
              <span className="text-[11px] text-red-600 font-medium mr-1">Delete?</span>
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(run.id); setConfirming(false) }}
                className="flex items-center justify-center h-6 w-6 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                title="Confirm delete"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirming(false) }}
                className="flex items-center justify-center h-6 w-6 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                title="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirming(true) }}
              className="flex items-center justify-center h-6 w-6 rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
              title="Delete analysis"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
