"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, BarChart2 } from 'lucide-react'
import { AnalysisRunCard } from './AnalysisRunCard'
import { createClient } from '@/lib/supabase/client'
import type { AnalysisRun } from '@/types/database'

interface Props {
  projectId: string
}

export function AnalysisHub({ projectId }: Props) {
  const [runs, setRuns] = useState<AnalysisRun[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchRuns = async () => {
      const { data } = await supabase
        .from('analysis_runs')
        .select('*, dataset:datasets(id, name)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) setRuns(data as AnalysisRun[])
      setLoading(false)
    }
    fetchRuns()
  }, [projectId, supabase])

  if (loading) {
    return <div className="text-sm text-muted-foreground py-6 text-center">Loading analyses…</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Analysis Runs ({runs.length})</h2>
        <Link href={`/projects/${projectId}/analysis/new`}>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            New Analysis
          </Button>
        </Link>
      </div>

      {runs.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <BarChart2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground text-sm">No analyses run yet</p>
          <p className="text-muted-foreground text-xs mt-1">Run your first analysis to get started</p>
          <Link href={`/projects/${projectId}/analysis/new`}>
            <Button size="sm" className="mt-3">
              <Plus className="h-4 w-4 mr-1.5" />
              Start Analysis
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map(run => (
            <AnalysisRunCard key={run.id} run={run} projectId={projectId} />
          ))}
        </div>
      )}
    </div>
  )
}
