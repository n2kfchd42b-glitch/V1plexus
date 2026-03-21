"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OutputTable } from '@/components/analysis/OutputTable'
import { OutputFigure } from '@/components/analysis/OutputFigure'
import { OutputLog } from '@/components/analysis/OutputLog'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime, cn } from '@/lib/utils'
import type { AnalysisJob, AnalysisOutput } from '@/types/database'

const statusColor: Record<string, string> = {
  completed: 'text-green-700 bg-green-50 border-green-200',
  failed: 'text-red-700 bg-red-50 border-red-200',
  running: 'text-blue-700 bg-blue-50 border-blue-200',
  pending: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  cancelled: 'text-gray-700 bg-gray-50 border-gray-200',
}

export default function JobDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const jobId = params.jobId as string
  const [job, setJob] = useState<AnalysisJob | null>(null)
  const [outputs, setOutputs] = useState<AnalysisOutput[]>([])
  const [copied, setCopied] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function fetchJob() {
      const [jobRes, outputsRes] = await Promise.all([
        supabase.from('analysis_jobs').select('*, dataset:datasets(name)').eq('id', jobId).single(),
        supabase.from('analysis_outputs').select('*').eq('job_id', jobId).order('sort_order'),
      ])
      if (jobRes.data) setJob(jobRes.data)
      if (outputsRes.data) setOutputs(outputsRes.data)
    }
    fetchJob()
  }, [jobId, supabase])

  async function handleCopyScript() {
    if (!job?.script_content) return
    await navigator.clipboard.writeText(job.script_content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }

  const tables = outputs.filter(o => o.output_type === 'table')
  const figures = outputs.filter(o => o.output_type === 'figure')
  const logs = outputs.filter(o => o.output_type === 'log')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link href={`/projects/${projectId}/analysis`}>
          <Button variant="ghost" size="sm" className="mb-3 h-7 text-xs -ml-2">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Analysis History
          </Button>
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {job.title ?? `Analysis · ${job.engine.toUpperCase()}`}
            </h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
              <span>{job.engine.toUpperCase()} engine</span>
              {(job.dataset as { name?: string } | null)?.name && (
                <span>Dataset: {(job.dataset as { name: string }).name}</span>
              )}
              {job.created_at && <span>Run {formatDateTime(job.created_at)}</span>}
              {job.duration_ms && <span>{job.duration_ms}ms</span>}
            </div>
          </div>
          <Badge className={cn('text-xs border shrink-0', statusColor[job.status] ?? '')}>
            {job.status}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="outputs">
        <TabsList className="mb-4">
          <TabsTrigger value="outputs">
            Outputs ({outputs.length})
          </TabsTrigger>
          <TabsTrigger value="script">Script</TabsTrigger>
        </TabsList>

        <TabsContent value="outputs">
          {outputs.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/20">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-muted-foreground text-sm">No saved outputs for this job.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {tables.map(output => {
                const content = output.content as { headers: string[]; rows: (string | number | null)[][] } | null
                return content ? (
                  <div key={output.id}>
                    <OutputTable
                      headers={content.headers}
                      rows={content.rows}
                      title={output.title}
                    />
                  </div>
                ) : null
              })}
              {figures.map(output => (
                output.file_path ? (
                  <OutputFigure
                    key={output.id}
                    src={output.file_path}
                    title={output.title}
                  />
                ) : null
              ))}
              {logs.map(output => {
                const content = output.content as { text?: string } | null
                return (
                  <div key={output.id}>
                    {output.title && <p className="text-sm font-medium mb-1">{output.title}</p>}
                    <OutputLog log={content?.text ?? ''} />
                  </div>
                )
              })}
            </div>
          )}

          {job.error_log && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm font-medium text-red-700 mb-1">Error</p>
              <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono">{job.error_log}</pre>
            </div>
          )}
        </TabsContent>

        <TabsContent value="script">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2 z-10"
              onClick={handleCopyScript}
            >
              {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <pre className="bg-zinc-950 text-zinc-100 p-4 rounded-md text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[600px]">
              {job.script_content ?? '# No script content'}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
