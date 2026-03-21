"use client"

import { useState, useCallback } from 'react'
import { Play, Square, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CodeEditor } from './CodeEditor'
import { EngineSelector } from './EngineSelector'
import { OutputPanel } from './OutputPanel'
import { createClient } from '@/lib/supabase/client'
import type { Dataset, Profile, AnalysisEngine } from '@/types/database'
import type { ExecutionResult } from '@/lib/analysisEngine'

const DEFAULT_R = `# Load your dataset
df <- plexus_data

# Summary statistics
summary(df)

# Print first few rows
head(df, 10)
`

const DEFAULT_PYTHON = `# Load your dataset
import pandas as pd
import io

# plexus_data is pre-loaded as a CSV string when a dataset is selected
# df = pd.read_csv(_plexus_csv)  # uncomment if dataset selected

# Example: generate a summary table
data = {
    "Statistic": ["Mean", "Median", "Std Dev"],
    "Value": [42.3, 38.0, 12.1],
}
df = pd.DataFrame(data)
show(df, "Summary Statistics")
print("Analysis complete.")
`

interface AnalysisWorkbenchProps {
  projectId: string
  datasets: Dataset[]
  profile: Profile
  onJobSaved?: () => void
}

export function AnalysisWorkbench({ projectId, datasets, profile, onJobSaved }: AnalysisWorkbenchProps) {
  const [engine, setEngine] = useState<AnalysisEngine>('python')
  const [script, setScript] = useState(DEFAULT_PYTHON)
  const [title, setTitle] = useState('')
  const [datasetId, setDatasetId] = useState<string>('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const supabase = createClient()

  function handleEngineChange(e: AnalysisEngine) {
    setEngine(e)
    setScript(e === 'r' ? DEFAULT_R : DEFAULT_PYTHON)
    setResult(null)
    setJobId(null)
  }

  const getCsvData = useCallback(async (dsId: string): Promise<string | undefined> => {
    const dataset = datasets.find(d => d.id === dsId)
    if (!dataset) return undefined
    const { data, error } = await supabase.storage.from('datasets').download(dataset.file_path)
    if (error || !data) return undefined
    return data.text()
  }, [datasets, supabase])

  async function handleRun() {
    setRunning(true)
    setResult(null)

    try {
      const { runScript } = await import('@/lib/analysisEngine')
      const csvData = datasetId ? await getCsvData(datasetId) : undefined
      const res = await runScript(engine, script, csvData)
      setResult(res)
    } finally {
      setRunning(false)
    }
  }

  async function handleSaveJob() {
    if (!result) return
    setSaving(true)
    try {
      const { data: job, error } = await supabase
        .from('analysis_jobs')
        .insert({
          project_id: projectId,
          dataset_id: datasetId || null,
          title: title || null,
          engine,
          script_content: script,
          status: result.error ? 'failed' : 'completed',
          started_at: new Date(Date.now() - result.durationMs).toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: result.durationMs,
          error_log: result.error || null,
          created_by: profile.id,
        })
        .select()
        .single()

      if (error || !job) throw new Error(error?.message ?? 'Failed to save job')
      setJobId(job.id)
      onJobSaved?.()
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveOutput(type: 'table' | 'log', index: number) {
    if (!result || !jobId) {
      alert('Please save the analysis job first before saving outputs.')
      return
    }

    if (type === 'table') {
      const t = result.tables[index]
      await supabase.from('analysis_outputs').insert({
        job_id: jobId,
        output_type: 'table',
        title: t.title || `Table ${index + 1}`,
        content: { headers: t.headers, rows: t.rows },
        sort_order: index,
      })
    } else {
      await supabase.from('analysis_outputs').insert({
        job_id: jobId,
        output_type: 'log',
        title: 'Console Log',
        content: { text: result.log },
        sort_order: 99,
      })
    }
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <EngineSelector value={engine} onChange={handleEngineChange} disabled={running} />

        <div className="flex-1 min-w-[200px]">
          <Select value={datasetId} onValueChange={setDatasetId}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select dataset (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No dataset</SelectItem>
              {datasets.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[150px]">
          <Input
            placeholder="Analysis title (optional)"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Split pane: editor + output */}
      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          <Label className="mb-1.5 text-xs text-muted-foreground uppercase tracking-wide">
            Script ({engine === 'r' ? 'R' : 'Python'})
          </Label>
          <CodeEditor
            value={script}
            onChange={setScript}
            language={engine}
            disabled={running}
            className="flex-1 min-h-[300px]"
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <Label className="mb-1.5 text-xs text-muted-foreground uppercase tracking-wide">Output</Label>
          <div className="flex-1 border rounded-md p-3 overflow-auto bg-background">
            <OutputPanel result={result} running={running} onSaveOutput={handleSaveOutput} />
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-3 shrink-0">
        <Button onClick={handleRun} disabled={running || !script.trim()}>
          {running ? (
            <>
              <Square className="h-4 w-4 mr-1.5" />
              Running…
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-1.5" />
              Run Analysis
            </>
          )}
        </Button>

        {result && !running && (
          <Button
            variant="outline"
            onClick={handleSaveJob}
            disabled={saving || !!jobId}
          >
            <Save className="h-4 w-4 mr-1.5" />
            {jobId ? 'Saved' : saving ? 'Saving…' : 'Save Job'}
          </Button>
        )}

        {result && (
          <span className="text-xs text-muted-foreground">
            {result.error ? (
              <span className="text-red-600">Failed · {result.durationMs}ms</span>
            ) : (
              <span className="text-green-700">Completed · {result.durationMs}ms</span>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
