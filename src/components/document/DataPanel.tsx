"use client"

import { useState, useEffect } from 'react'
import { Table2, BarChart2, Loader2, FlaskConical, ChevronRight, BarChartHorizontal } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalysisTable {
  id: string
  title: string
  content: { headers: string[]; rows: unknown[][] }
  jobId: string
  jobTitle: string | null
  engine: string
  createdAt: string
}

interface ChartExploration {
  id: string
  title: string
  chart_type: string
  config: unknown
  dataset_id: string
  version_id: string | null
  datasetName?: string
}

interface DataPanelProps {
  projectId: string
  onInsertTable: (params: { html: string; title: string }) => void
  onInsertChart: (params: {
    explorationId: string
    chartTitle: string
    chartType: string
    chartConfig: string
    datasetId: string
    versionId: string
  }) => void
}

type Section = 'tables' | 'charts'

// ── HTML table builder ────────────────────────────────────────────────────────

function buildTableHtml(title: string, headers: string[], rows: unknown[][]): string {
  const safeVal = (v: unknown): string => {
    if (v === null || v === undefined) return '—'
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(4)
    return String(v)
  }

  const headerRow = headers.map(h => `<th>${h}</th>`).join('')
  const bodyRows = rows
    .slice(0, 200) // cap at 200 rows for embed sanity
    .map(row => {
      const cells = (Array.isArray(row) ? row : []).map((v: unknown) => `<td>${safeVal(v)}</td>`).join('')
      return `<tr>${cells}</tr>`
    })
    .join('')

  return `<p><strong>${title}</strong></p><table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DataPanel({ projectId, onInsertTable, onInsertChart }: DataPanelProps) {
  const supabase = createClient()
  const [section, setSection] = useState<Section>('tables')

  // Tables
  const [tables, setTables] = useState<AnalysisTable[]>([])
  const [tablesLoading, setTablesLoading] = useState(true)

  // Charts
  const [charts, setCharts] = useState<ChartExploration[]>([])
  const [chartsLoading, setChartsLoading] = useState(true)

  useEffect(() => {
    async function loadTables() {
      setTablesLoading(true)
      // Fetch saved analysis output tables for this project via job join
      const { data: jobs } = await supabase
        .from('analysis_jobs')
        .select('id, title, engine, project_id, created_at')
        .eq('project_id', projectId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })

      if (!jobs || jobs.length === 0) { setTables([]); setTablesLoading(false); return }

      const { data: outputs } = await supabase
        .from('analysis_outputs')
        .select('id, job_id, title, content, sort_order')
        .in('job_id', jobs.map((j: { id: string }) => j.id))
        .eq('output_type', 'table')
        .order('sort_order', { ascending: true })

      const jobMap = new Map(jobs.map((j: { id: string; title: string | null; engine: string; created_at: string }) => [j.id, j]))

      const result: AnalysisTable[] = (outputs ?? []).map((o: {
        id: string
        job_id: string
        title: string
        content: { headers: string[]; rows: unknown[][] }
        sort_order: number
      }) => {
        const job = jobMap.get(o.job_id) as { id: string; title: string | null; engine: string; created_at: string } | undefined
        return {
          id: o.id,
          title: o.title,
          content: o.content as { headers: string[]; rows: unknown[][] },
          jobId: o.job_id,
          jobTitle: job?.title ?? null,
          engine: job?.engine ?? '',
          createdAt: job?.created_at ?? '',
        }
      })

      setTables(result)
      setTablesLoading(false)
    }

    async function loadCharts() {
      setChartsLoading(true)
      const { data: datasets } = await supabase
        .from('datasets')
        .select('id, name')
        .eq('project_id', projectId)
        .is('deleted_at', null)

      const dsMap = new Map((datasets ?? []).map((d: { id: string; name: string }) => [d.id, d.name]))

      const { data: exps } = await supabase
        .from('dataset_explorations')
        .select('id, title, chart_type, config, dataset_id, version_id')
        .in('dataset_id', datasets?.map((d: { id: string }) => d.id) ?? [])
        .order('created_at', { ascending: false })

      setCharts((exps ?? []).map((e: {
        id: string
        title: string
        chart_type: string
        config: unknown
        dataset_id: string
        version_id: string | null
      }) => ({
        ...e,
        datasetName: dsMap.get(e.dataset_id),
      })))
      setChartsLoading(false)
    }

    loadTables()
    loadCharts()
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full">

      {/* Section toggle */}
      <div className="flex border-b border-border-default shrink-0">
        {([
          ['tables', 'Tables', Table2],
          ['charts', 'Charts', BarChart2],
        ] as const).map(([s, label, Icon]) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
              section === s
                ? 'text-accent-blue border-b-2 border-accent-blue -mb-px bg-bg-surface'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">

        {/* ── Tables tab ──────────────────────────────────────────── */}
        {section === 'tables' && (
          <div className="space-y-1.5">
            <p className="text-[11px] text-text-tertiary mb-2">
              Tables saved from the Analysis workbench
            </p>

            {tablesLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-text-tertiary">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Loading…</span>
              </div>
            ) : tables.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                <FlaskConical className="h-8 w-8 text-text-tertiary opacity-30" />
                <p className="text-xs font-medium text-text-secondary">No saved analysis tables</p>
                <p className="text-[11px] text-text-tertiary leading-relaxed max-w-[180px]">
                  Run a script in the Analysis workbench and save a table output — it will appear here.
                </p>
              </div>
            ) : (
              tables.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    const html = buildTableHtml(t.title, t.content.headers, t.content.rows)
                    onInsertTable({ html, title: t.title })
                  }}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border-default hover:border-accent-blue hover:bg-accent-blue-subtle transition-colors group"
                >
                  <Table2 className="h-4 w-4 text-accent-blue shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">{t.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {t.jobTitle && (
                        <span className="text-[11px] text-text-tertiary truncate">{t.jobTitle}</span>
                      )}
                      <span className="text-[10px] font-mono uppercase text-text-tertiary opacity-60">{t.engine}</span>
                    </div>
                    <p className="text-[10px] text-text-tertiary mt-0.5">
                      {t.content.headers.length} columns · {t.content.rows.length} rows
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-text-tertiary shrink-0 opacity-0 group-hover:opacity-100" />
                </button>
              ))
            )}
          </div>
        )}

        {/* ── Charts tab ──────────────────────────────────────────── */}
        {section === 'charts' && (
          <div className="space-y-1.5">
            <p className="text-[11px] text-text-tertiary mb-2">
              Saved chart explorations from datasets
            </p>

            {chartsLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-text-tertiary">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Loading…</span>
              </div>
            ) : charts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                <BarChartHorizontal className="h-8 w-8 text-text-tertiary opacity-30" />
                <p className="text-xs font-medium text-text-secondary">No saved charts</p>
                <p className="text-[11px] text-text-tertiary leading-relaxed max-w-[180px]">
                  Go to a dataset's Explore tab to create and save charts.
                </p>
              </div>
            ) : (
              charts.map(c => (
                <button
                  key={c.id}
                  onClick={() => onInsertChart({
                    explorationId: c.id,
                    chartTitle: c.title,
                    chartType: c.chart_type,
                    chartConfig: JSON.stringify(c.config),
                    datasetId: c.dataset_id,
                    versionId: c.version_id ?? '',
                  })}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border-default hover:border-status-success hover:bg-status-success-bg transition-colors group"
                >
                  <BarChart2 className="h-4 w-4 text-status-success shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">{c.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="px-1.5 py-px rounded bg-status-success-bg text-[10px] font-semibold uppercase text-status-success-text border border-status-success/20">
                        {c.chart_type}
                      </span>
                      {c.datasetName && (
                        <span className="text-[11px] text-text-tertiary truncate">{c.datasetName}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-text-tertiary shrink-0 opacity-0 group-hover:opacity-100" />
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
