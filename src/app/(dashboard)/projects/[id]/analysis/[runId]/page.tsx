"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Calendar, Database } from 'lucide-react'
import { ResultsPanel } from '@/components/analysis/results/ResultsPanel'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import type { AnalysisRun, AnalysisType } from '@/types/database'
import type { AnalysisResult } from '@/lib/analysis/engine'
import { ANALYSIS_TYPES } from '@/components/analysis/AnalysisTypePicker'

export default function AnalysisRunPage() {
  const params = useParams()
  const projectId = params.id as string
  const runId = params.runId as string
  const [run, setRun] = useState<AnalysisRun | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchRun = async () => {
      const { data } = await supabase
        .from('analysis_runs')
        .select('*, dataset:datasets(id, name)')
        .eq('id', runId)
        .single()
      if (data) setRun(data as AnalysisRun)
      setLoading(false)
    }
    fetchRun()
  }, [runId, supabase])

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="text-sm text-muted-foreground py-6 text-center">Loading analysis…</div>
      </div>
    )
  }

  if (!run) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <p className="text-sm text-muted-foreground">Analysis run not found.</p>
      </div>
    )
  }

  const typeInfo = ANALYSIS_TYPES.find(t => t.type === run.analysis_type)
  const result = run.results as unknown as AnalysisResult | null

  // Reconstruct result for display (stored results don't have charts data array, but we show tables)
  const displayResult: AnalysisResult = result ?? {
    type: run.analysis_type,
    summary: {},
    tables: [],
    charts: [],
    interpretation: run.interpretation ?? ''
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link href={`/projects/${projectId}/analysis`}>
          <Button variant="ghost" size="sm" className="mb-3 h-7 text-xs -ml-2">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Analysis Hub
          </Button>
        </Link>

        <h1 className="text-xl font-bold">{run.title ?? typeInfo?.label ?? run.analysis_type}</h1>

        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          {run.dataset && (
            <span className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              {(run.dataset as { name: string }).name}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDateTime(run.created_at)}
          </span>
        </div>
      </div>

      {run.status === 'failed' ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">Analysis Failed</p>
          <p className="text-sm text-muted-foreground mt-1">{run.error_message ?? 'Unknown error'}</p>
        </div>
      ) : (
        <ResultsPanel
          result={displayResult}
          analysisType={run.analysis_type as AnalysisType}
          title={run.title ?? typeInfo?.label}
          datasetName={(run.dataset as { name: string } | null)?.name}
          onSave={async () => {}}
          isSaved={true}
        />
      )}
    </div>
  )
}
