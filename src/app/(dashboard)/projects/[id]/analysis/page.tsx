"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AnalysisWorkbench } from '@/components/analysis/AnalysisWorkbench'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { formatRelative } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Dataset, AnalysisJob } from '@/types/database'

const statusColor: Record<string, string> = {
  completed: 'text-green-700 bg-green-50 border-green-200',
  failed: 'text-red-700 bg-red-50 border-red-200',
  running: 'text-blue-700 bg-blue-50 border-blue-200',
  pending: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  cancelled: 'text-gray-700 bg-gray-50 border-gray-200',
}

export default function AnalysisPage() {
  const params = useParams()
  const projectId = params.id as string
  const { profile } = useAuth()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [jobs, setJobs] = useState<AnalysisJob[]>([])
  const supabase = createClient()

  async function fetchData() {
    const [datasetsRes, jobsRes] = await Promise.all([
      supabase
        .from('datasets')
        .select('*')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('analysis_jobs')
        .select('*, dataset:datasets(name)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    if (datasetsRes.data) setDatasets(datasetsRes.data)
    if (jobsRes.data) setJobs(jobsRes.data)
  }

  useEffect(() => {
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  return (
    <div className="p-6 max-w-7xl mx-auto h-full flex flex-col">
      <div className="mb-4 shrink-0">
        <Link href={`/projects/${projectId}`}>
          <Button variant="ghost" size="sm" className="mb-3 h-7 text-xs -ml-2">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to Project
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Analysis Workbench</h1>
        <p className="text-muted-foreground text-sm mt-1">Write and run R or Python scripts against your datasets</p>
      </div>

      <Tabs defaultValue="workbench" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mb-4 shrink-0">
          <TabsTrigger value="workbench">Workbench</TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-3.5 w-3.5 mr-1.5" />
            History ({jobs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workbench" className="flex-1 min-h-0">
          {profile ? (
            <AnalysisWorkbench
              projectId={projectId}
              datasets={datasets}
              profile={profile}
              onJobSaved={fetchData}
            />
          ) : (
            <div className="text-muted-foreground text-sm">Loading…</div>
          )}
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-auto">
          {jobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No analysis jobs yet. Run a script to create one.
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map(job => (
                <Link key={job.id} href={`/projects/${projectId}/analysis/${job.id}`}>
                  <div className="border rounded-md p-4 hover:shadow-sm transition-shadow cursor-pointer bg-card">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {job.title ?? `Analysis · ${job.engine.toUpperCase()}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {job.engine.toUpperCase()} engine
                          {(job.dataset as { name?: string } | null)?.name && ` · ${(job.dataset as { name: string }).name}`}
                          {job.duration_ms && ` · ${job.duration_ms}ms`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={cn('text-xs border', statusColor[job.status] ?? '')}>
                          {job.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatRelative(job.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
