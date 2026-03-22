'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { useState, useEffect } from 'react'
import { BarChart2, ExternalLink, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { loadVersionData } from '@/lib/data/storage'
import { BarChart } from '@/components/charts/BarChart'
import { LineChart } from '@/components/charts/LineChart'
import { ScatterPlot } from '@/components/charts/ScatterPlot'
import { Histogram } from '@/components/charts/Histogram'
import { BoxPlot } from '@/components/charts/BoxPlot'
import { PieChart } from '@/components/charts/PieChart'
import { Heatmap } from '@/components/charts/Heatmap'
import { AreaChart } from '@/components/charts/AreaChart'
import type { ChartConfig, ChartType, ColumnSchema, DataRow } from '@/types/database'

// ─── Render the right chart type ─────────────────────────────────────────────

function RenderEmbeddedChart({
  chartType,
  rows,
  columns,
  config,
}: {
  chartType: ChartType
  rows: DataRow[]
  columns: ColumnSchema[]
  config: ChartConfig
}) {
  const props = { data: rows, columns, config, height: 280 }
  switch (chartType) {
    case 'bar': return <BarChart {...props} />
    case 'line': return <LineChart {...props} />
    case 'area': return <AreaChart {...props} />
    case 'scatter': return <ScatterPlot {...props} />
    case 'histogram': return <Histogram {...props} />
    case 'box': return <BoxPlot {...props} />
    case 'pie': return <PieChart {...props} chartType="pie" />
    case 'donut': return <PieChart {...props} chartType="donut" />
    case 'heatmap': return <Heatmap {...props} />
    default:
      return (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Chart type &ldquo;{chartType}&rdquo; not supported in document view
        </div>
      )
  }
}

// ─── React component rendered inside the editor ─────────────────────────────

function ChartNodeView({ node }: { node: { attrs: Record<string, unknown> } }) {
  const {
    explorationId,
    chartTitle,
    chartType: savedChartType,
    chartConfig: savedConfig,
    datasetId,
    versionId,
  } = node.attrs as {
    explorationId: string
    chartTitle: string
    chartType: string
    chartConfig: string // JSON-stringified ChartConfig
    datasetId: string
    versionId: string
  }

  const [rows, setRows] = useState<DataRow[]>([])
  const [columns, setColumns] = useState<ColumnSchema[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const chartType = (savedChartType || 'bar') as ChartType
  let config: ChartConfig = {}
  try {
    config = savedConfig ? JSON.parse(savedConfig) : {}
  } catch {
    // ignore parse error, use empty config
  }

  useEffect(() => {
    if (!versionId) {
      setLoading(false)
      setError('No version specified')
      return
    }

    const supabase = createClient()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: version } = await supabase
          .from('dataset_versions')
          .select('file_path')
          .eq('id', versionId)
          .single()

        if (!version) throw new Error('Version not found')

        const parsed = await loadVersionData(version.file_path)
        setRows(parsed.rows)
        setColumns(parsed.columns)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load chart data')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [versionId])

  return (
    <NodeViewWrapper className="my-4">
      <div className="border rounded-lg overflow-hidden bg-white shadow-sm" contentEditable={false}>
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border-b border-emerald-100">
          <BarChart2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="text-sm font-medium text-emerald-900 truncate flex-1">
            {chartTitle || `${chartType} chart`}
          </span>
          {datasetId && (
            <a
              href={`/projects/data/${datasetId}/explore`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-500 hover:text-emerald-700"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {/* Chart body */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading chart...
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-sm text-red-600">{error}</div>
        ) : (
          <div className="p-4">
            {config.title && (
              <div className="text-center text-sm font-medium mb-2 text-foreground">{config.title}</div>
            )}
            <RenderEmbeddedChart
              chartType={chartType}
              rows={rows}
              columns={columns}
              config={config}
            />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

// ─── TipTap Node Extension ──────────────────────────────────────────────────

export const ChartNodeExtension = Node.create({
  name: 'chartEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      explorationId: { default: '' },
      chartTitle: { default: '' },
      chartType: { default: 'bar' },
      chartConfig: { default: '{}' },
      datasetId: { default: '' },
      versionId: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="chart-embed"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'chart-embed' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChartNodeView)
  },
})
