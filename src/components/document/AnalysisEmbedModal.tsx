'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, BarChart2, CheckCircle, RefreshCw, FlaskConical } from 'lucide-react'
import { toast } from 'sonner'

interface AnalysisRun {
  id: string
  title: string | null
  analysis_type: string
  status: string
  interpretation: string | null
  results: Record<string, unknown> | null
  created_at: string
}

interface AnalysisEmbedModalProps {
  open: boolean
  onClose: () => void
  documentId: string
  projectId: string
  /** Called with HTML string to insert into the editor */
  onInsert: (html: string, analysisRunId: string) => void
}

const TYPE_LABELS: Record<string, string> = {
  descriptive: 'Descriptive Statistics',
  frequency: 'Frequency Tables',
  chi_square: 'Chi-Square Test',
  t_test: 'T-Test',
  anova: 'ANOVA',
  correlation: 'Correlation',
  simple_regression: 'Simple Linear Regression',
  multiple_regression: 'Multiple Regression',
  logistic_regression: 'Logistic Regression',
  kaplan_meier: 'Kaplan-Meier Survival',
  cox_regression: 'Cox Regression',
  time_series: 'Time Series',
  pca: 'PCA',
  meta_analysis: 'Meta-Analysis',
}

function buildEmbedHtml(run: AnalysisRun): string {
  const label = TYPE_LABELS[run.analysis_type] ?? run.analysis_type
  const title = run.title ?? label
  const lines: string[] = []

  lines.push(`<h3>${title}</h3>`)
  lines.push(`<p><em>Analysis type: ${label}</em></p>`)

  if (run.interpretation) {
    lines.push(`<p>${run.interpretation}</p>`)
  }

  // Embed key statistics if available
  if (run.results && typeof run.results === 'object') {
    const stats = run.results as Record<string, unknown>
    const keyStats = Object.entries(stats)
      .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
      .slice(0, 8)

    if (keyStats.length > 0) {
      lines.push('<table><thead><tr><th>Statistic</th><th>Value</th></tr></thead><tbody>')
      for (const [k, v] of keyStats) {
        const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        const val = typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(4)) : String(v)
        lines.push(`<tr><td>${label}</td><td>${val}</td></tr>`)
      }
      lines.push('</tbody></table>')
    }
  }

  lines.push(`<p><small>Source: PLEXUS Analysis Engine · Run ID: ${run.id.slice(0, 8)}…</small></p>`)
  return lines.join('\n')
}

export function AnalysisEmbedModal({
  open,
  onClose,
  documentId,
  projectId,
  onInsert,
}: AnalysisEmbedModalProps) {
  const supabase = createClient()
  const [runs, setRuns] = useState<AnalysisRun[]>([])
  const [loading, setLoading] = useState(false)
  const [inserting, setInserting] = useState<string | null>(null)

  const fetchRuns = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('analysis_runs')
      .select('id, title, analysis_type, status, interpretation, results, created_at')
      .eq('project_id', projectId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(50)
    if (!error) setRuns(data ?? [])
    setLoading(false)
  }, [projectId, supabase])

  useEffect(() => { if (open) fetchRuns() }, [open, fetchRuns])

  const handleEmbed = async (run: AnalysisRun) => {
    setInserting(run.id)
    try {
      // Register the embed in the DB
      await fetch(`/api/documents/${documentId}/analysis-embeds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis_run_id: run.id }),
      })
      // Build HTML and insert into editor
      const html = buildEmbedHtml(run)
      onInsert(html, run.id)
      toast.success(`Embedded "${run.title ?? run.analysis_type}" into document`)
      onClose()
    } catch {
      toast.error('Failed to embed analysis')
    } finally {
      setInserting(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-[var(--border-default)]">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4 text-[var(--color-clinical-blue)]" />
            Embed Analysis
          </DialogTitle>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            Insert a completed analysis run from this project into the document.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center gap-2">
              <BarChart2 className="h-8 w-8 text-[var(--text-tertiary)] opacity-40" />
              <p className="text-sm text-[var(--text-tertiary)]">No completed analyses in this project yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map(run => (
                <div
                  key={run.id}
                  className="flex items-start gap-3 border border-[var(--border-default)] rounded-lg p-3 hover:border-[var(--color-clinical-blue)] transition-colors"
                >
                  <BarChart2 className="h-4 w-4 text-[var(--color-clinical-blue)] mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {run.title ?? TYPE_LABELS[run.analysis_type] ?? run.analysis_type}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px]">
                        {TYPE_LABELS[run.analysis_type] ?? run.analysis_type}
                      </Badge>
                      <span className="text-[10px] text-[var(--text-tertiary)]">
                        {new Date(run.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {run.interpretation && (
                      <p className="text-xs text-[var(--text-tertiary)] mt-1 line-clamp-2">{run.interpretation}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs shrink-0"
                    disabled={inserting === run.id}
                    onClick={() => handleEmbed(run)}
                  >
                    {inserting === run.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Embed
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[var(--border-default)] flex justify-between items-center">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={fetchRuns}>
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
