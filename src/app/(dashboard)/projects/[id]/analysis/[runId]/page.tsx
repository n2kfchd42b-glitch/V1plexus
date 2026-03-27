"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Calendar, Database, CheckCircle2, Loader2,
  AlertCircle, Clock
} from 'lucide-react'
import { ResultsPanel } from '@/components/analysis/results/ResultsPanel'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import type { AnalysisRun, AnalysisType } from '@/types/database'
import type { AnalysisResult } from '@/lib/analysis/engine'
import { ANALYSIS_TYPES } from '@/components/analysis/AnalysisTypePicker'

const statusConfig = {
  completed: { icon: CheckCircle2, label: 'Completed', iconClass: 'text-[#22C55E]', badgeClass: 'bg-[#F0FDF4] text-[#166534]' },
  failed:    { icon: AlertCircle,  label: 'Failed',    iconClass: 'text-[#EF4444]', badgeClass: 'bg-[#FEF2F2] text-[#991B1B]' },
  running:   { icon: Loader2,      label: 'Running',   iconClass: 'text-[#3B82F6]', badgeClass: 'bg-[#EFF6FF] text-[#1E40AF]' },
  pending:   { icon: Clock,        label: 'Pending',   iconClass: 'text-[#A1A1AA]', badgeClass: 'bg-[#F0F0F0] text-[#52525B]' },
  cancelled: { icon: AlertCircle,  label: 'Cancelled', iconClass: 'text-[#A1A1AA]', badgeClass: 'bg-[#F0F0F0] text-[#52525B]' },
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
      <div className="min-h-screen bg-[#f7f9fb]">
        <div className="max-w-5xl mx-auto px-6 py-10 space-y-5">
          <div className="h-6 w-48 bg-[#F0F0F0] rounded animate-pulse" />
          <div className="h-8 w-80 bg-[#F0F0F0] rounded animate-pulse" />
          <div className="h-4 w-56 bg-[#F0F0F0] rounded animate-pulse" />
          <div className="h-48 bg-white border border-[#E4E4E7] rounded-lg animate-pulse" />
        </div>
      </div>
    )
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-[#f7f9fb]">
        <div className="max-w-5xl mx-auto px-6 py-20 text-center">
          <AlertCircle className="h-10 w-10 text-[#A1A1AA] mx-auto mb-4" />
          <p className="font-manrope font-bold text-[#18181B]">Analysis run not found</p>
          <Link href={`/projects/${projectId}/analysis`}>
            <Button variant="outline" className="mt-4">Back to Analysis Hub</Button>
          </Link>
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
    <div className="min-h-screen bg-[#f7f9fb]">
      {/* Page Header */}
      <div className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-6 pt-5 pb-6">
          <Link href={`/projects/${projectId}/analysis`}>
            <Button variant="ghost" size="sm" className="mb-3 h-7 text-xs -ml-2 text-[#A1A1AA] hover:text-[#18181B]">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Analysis Hub
            </Button>
          </Link>

          <div className="flex items-start gap-3">
            <StatusIcon className={`h-5 w-5 mt-0.5 shrink-0 ${status.iconClass} ${run.status === 'running' ? 'animate-spin' : ''}`} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="font-manrope font-extrabold text-xl tracking-tight text-[#003D9B] truncate">
                  {run.title ?? typeInfo?.label ?? run.analysis_type}
                </h1>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded shrink-0 ${status.badgeClass}`}>
                  {status.label}
                </span>
              </div>
              <p className="text-sm text-[#52525B]">
                {typeInfo?.label ?? run.analysis_type.replace(/_/g, ' ')}
              </p>
              <div className="flex items-center gap-4 mt-2">
                {run.dataset && (
                  <span className="flex items-center gap-1.5 text-xs text-[#A1A1AA]">
                    <Database className="h-3.5 w-3.5" />
                    {(run.dataset as { name: string }).name}
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-xs text-[#A1A1AA]">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDateTime(run.created_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {run.status === 'failed' ? (
          <div className="bg-white border border-[#E4E4E7] rounded-lg p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-[#FEF2F2] p-3">
                <AlertCircle className="h-5 w-5 text-[#EF4444]" />
              </div>
              <div>
                <p className="font-manrope font-bold text-[#18181B]">Analysis Failed</p>
                <p className="text-sm text-[#52525B] mt-1.5 leading-relaxed">
                  {run.error_message ?? 'An unknown error occurred during analysis.'}
                </p>
                <Link href={`/projects/${projectId}/analysis/new`}>
                  <Button variant="outline" size="sm" className="mt-4">Try Again</Button>
                </Link>
              </div>
            </div>
          </div>
        ) : run.status === 'running' || run.status === 'pending' ? (
          <div className="bg-white border border-[#E4E4E7] rounded-lg p-12 text-center">
            <Loader2 className="h-8 w-8 text-[#3B82F6] animate-spin mx-auto mb-4" />
            <p className="font-manrope font-bold text-[#18181B]">Analysis in progress</p>
            <p className="text-sm text-[#52525B] mt-1">Results will appear here when complete.</p>
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
