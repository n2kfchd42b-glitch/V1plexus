"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Calendar, Database, CheckCircle2, Loader2,
  AlertCircle, Clock, BarChart2, Share2, FileText
} from 'lucide-react'
import { ResultsPanel } from '@/components/analysis/results/ResultsPanel'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import type { AnalysisRun, AnalysisType } from '@/types/database'
import type { AnalysisResult } from '@/lib/analysis/engine'
import { ANALYSIS_TYPES } from '@/components/analysis/AnalysisTypePicker'

const statusConfig = {
  completed: {
    icon: CheckCircle2,
    label: 'Completed',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconColor: 'text-emerald-500',
    bgGradient: 'from-emerald-50/50 via-white to-white',
  },
  failed: {
    icon: AlertCircle,
    label: 'Failed',
    color: 'bg-red-50 text-red-700 border-red-200',
    iconColor: 'text-red-500',
    bgGradient: 'from-red-50/50 via-white to-white',
  },
  running: {
    icon: Loader2,
    label: 'Running',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    iconColor: 'text-blue-500',
    bgGradient: 'from-blue-50/50 via-white to-white',
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    color: 'bg-gray-50 text-gray-600 border-gray-200',
    iconColor: 'text-gray-400',
    bgGradient: 'from-gray-50/50 via-white to-white',
  },
  cancelled: {
    icon: AlertCircle,
    label: 'Cancelled',
    color: 'bg-gray-50 text-gray-600 border-gray-200',
    iconColor: 'text-gray-400',
    bgGradient: 'from-gray-50/50 via-white to-white',
  },
}

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
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/50">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="space-y-6">
            <div className="h-8 w-64 bg-muted rounded-lg animate-pulse" />
            <div className="h-4 w-96 bg-muted rounded-lg animate-pulse" />
            <div className="h-48 bg-white border rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/50">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="text-center py-16">
            <AlertCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Analysis run not found</p>
            <Link href={`/projects/${projectId}/analysis`}>
              <Button variant="outline" className="mt-4">Back to Analysis Hub</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const typeInfo = ANALYSIS_TYPES.find(t => t.type === run.analysis_type)
  const result = run.results as unknown as AnalysisResult | null
  const status = statusConfig[run.status as keyof typeof statusConfig] ?? statusConfig.pending
  const StatusIcon = status.icon

  const displayResult: AnalysisResult = result ?? {
    type: run.analysis_type,
    summary: {},
    tables: [],
    charts: [],
    interpretation: run.interpretation ?? ''
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/50">
      {/* Hero Header */}
      <div className={`relative overflow-hidden border-b bg-gradient-to-br ${status.bgGradient}`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.04),transparent_50%)]" />
        <div className="relative max-w-5xl mx-auto px-6 pt-6 pb-8">
          <Link href={`/projects/${projectId}/analysis`}>
            <Button variant="ghost" size="sm" className="mb-4 h-7 text-xs -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Analysis Hub
            </Button>
          </Link>

          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3">
                <div className={`rounded-xl p-2.5 border ${status.color}`}>
                  <StatusIcon className={`h-5 w-5 ${status.iconColor} ${run.status === 'running' ? 'animate-spin' : ''}`} />
                </div>
                <Badge variant="outline" className={`text-xs font-bold ${status.color}`}>
                  {status.label}
                </Badge>
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                {run.title ?? typeInfo?.label ?? run.analysis_type}
              </h1>

              <p className="text-sm text-muted-foreground mt-1">
                {typeInfo?.label ?? run.analysis_type.replace(/_/g, ' ')}
              </p>

              <div className="flex items-center gap-5 mt-4">
                {run.dataset && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Database className="h-3.5 w-3.5" />
                    {(run.dataset as { name: string }).name}
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDateTime(run.created_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {run.status === 'failed' ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-red-100 p-3">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-base font-bold text-destructive">Analysis Failed</p>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {run.error_message ?? 'An unknown error occurred during analysis.'}
                </p>
                <Link href={`/projects/${projectId}/analysis/new`}>
                  <Button variant="outline" size="sm" className="mt-4">
                    Try Again
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ) : run.status === 'running' || run.status === 'pending' ? (
          <div className="rounded-2xl border bg-white p-12 text-center">
            <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
            <p className="font-semibold text-foreground">Analysis in progress</p>
            <p className="text-sm text-muted-foreground mt-1">Results will appear here when complete.</p>
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
    </div>
  )
}
