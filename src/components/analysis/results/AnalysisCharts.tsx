"use client"

import { useState, Fragment, useContext, createContext, useRef } from 'react'
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  ResponsiveContainer, Cell, ComposedChart, Area, AreaChart,
  ErrorBar
} from 'recharts'
import { Maximize2, Minimize2, SlidersHorizontal } from 'lucide-react'
import { ChartEditor } from '@/components/analysis/ChartEditor'
import { getDefaultConfig } from '@/lib/chartEditorConfig'
import type { ChartEditorConfig } from '@/lib/chartEditorConfig'
import type { AnalysisType } from '@/types/database'
import { CHART_TOKENS, chartColor, chartColorMid, chartColorDim, AXIS_TICK_STYLE, GRID_STYLE } from '@/lib/charts/design-tokens'

type ChartSpec = {
  type: string
  title: string
  data: unknown[]
  config: Record<string, unknown>
}

// ── Chart Render Context (drives live editor updates) ─────────
type RenderCfg = {
  colors: string[]
  showGrid: boolean
  gridColor: string
  showLegend: boolean
  legendPos: 'top' | 'bottom' | 'left' | 'right'
  height: number
  showAxisLabels: boolean
  xLabel: string
  yLabel: string
}

const DEFAULT_RENDER_CFG: RenderCfg = {
  colors: CHART_TOKENS.solidSequence as unknown as string[],
  showGrid: true,
  gridColor: CHART_TOKENS.grid,
  showLegend: true,
  legendPos: 'bottom',
  height: 160,
  showAxisLabels: false,
  xLabel: '',
  yLabel: '',
}

const ChartRenderContext = createContext<RenderCfg>(DEFAULT_RENDER_CFG)
function useCfg() { return useContext(ChartRenderContext) }

function legendAlign(pos: RenderCfg['legendPos']): {
  verticalAlign: 'top' | 'bottom' | 'middle'
  align: 'left' | 'center' | 'right'
} {
  if (pos === 'top')   return { verticalAlign: 'top',    align: 'center' }
  if (pos === 'left')  return { verticalAlign: 'middle', align: 'left'   }
  if (pos === 'right') return { verticalAlign: 'middle', align: 'right'  }
  return                        { verticalAlign: 'bottom', align: 'center' }
}

const axisLabel = { fontSize: 11, fill: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }

function axisLabelX(cfg: RenderCfg, defaultVal?: string) {
  const val = cfg.showAxisLabels && cfg.xLabel ? cfg.xLabel : defaultVal
  return val ? { label: { value: val, position: 'insideBottom' as const, offset: -4, ...axisLabel } } : {}
}
function axisLabelY(cfg: RenderCfg, defaultVal?: string) {
  const val = cfg.showAxisLabels && cfg.yLabel ? cfg.yLabel : defaultVal
  return val
    ? { label: { value: val, angle: -90 as const, position: 'insideLeft' as const, offset: 8, ...axisLabel } }
    : {}
}

// ── Public component props ───────────────────────────────────
interface Props {
  charts: ChartSpec[]
  runId?: string
  datasetId?: string | null
  versionId?: string | null
  analysisType?: AnalysisType
  savedConfig?: Record<string, unknown> | null
}

// Chart types that should always span the full grid width
const FULL_WIDTH_CHART_TYPES = new Set([
  'km_curve', 'time_series', 'heatmap', 'biplot',
  'epi_curve', 'mosaic', 'roc_curve', 'forest_meta',
  'forest_or', 'forest_hr', 'forest_irr', 'coefficient_plot',
  'forest_rrr', 'scatter_matrix', 'violin', 'ridge', 'correlogram',
])

export function AnalysisCharts({ charts, runId, datasetId, versionId, analysisType, savedConfig }: Props) {
  if (!charts || charts.length === 0) return null
  const visible = charts.filter(c => SUPPORTED_CHART_TYPES.has(c.type))
  if (visible.length === 0) return null

  const useGrid = visible.length > 1
  return (
    <div className={useGrid ? 'grid grid-cols-1 lg:grid-cols-2 gap-5' : 'flex flex-col gap-5'}>
      {visible.map((chart, idx) => (
        <div
          key={idx}
          className={useGrid && FULL_WIDTH_CHART_TYPES.has(chart.type) ? 'lg:col-span-2' : ''}
        >
          <ChartRenderer
            chart={chart}
            index={idx}
            runId={runId}
            datasetId={datasetId}
            versionId={versionId}
            analysisType={analysisType}
            savedConfig={savedConfig}
          />
        </div>
      ))}
    </div>
  )
}

// ── Chart Tooltip — matches global light-mode surfaces ───────
function DarkTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div
      className="rounded-xl min-w-[148px]"
      style={{
        background: '#ffffff',
        border: `1px solid ${CHART_TOKENS.border}`,
        padding: '10px 14px',
        boxShadow: '0 4px 16px rgba(0,24,72,0.08), 0 1px 4px rgba(0,24,72,0.06)',
      }}
    >
      {label && (
        <p
          className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}
        >
          {label}
        </p>
      )}
      <div className="space-y-1.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-[11px]" style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}>
                {entry.name}
              </span>
            </div>
            <span className="text-[12px] font-bold tabular-nums" style={{ color: CHART_TOKENS.text.primary, fontFamily: "'JetBrains Mono', monospace" }}>
              {typeof entry.value === 'number'
                ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 4 })
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Supported types ──────────────────────────────────────────
const SUPPORTED_CHART_TYPES = new Set([
  'histogram', 'bar', 'grouped_bar', 'scatter_regression', 'residual_plot',
  'coefficient_plot', 'forest_or', 'forest_hr', 'forest_irr', 'forest_meta',
  'funnel_plot', 'roc_curve', 'km_curve', 'heatmap', 'time_series',
  'scree_plot', 'cluster_scatter', 'power_curve', 'epi_curve', 'acf_plot',
  'biplot', 'boxplot_2group', 'boxplot_groups', 'mosaic',
  'forest_rrr', 'paired_diff', 'silhouette_plot', 'scatter_matrix',
  'qq_plot', 'violin', 'ridge', 'correlogram', 'dumbbell',
])

// ── Chart Wrapper ────────────────────────────────────────────
function ChartRenderer({
  chart,
  index: _index,
  runId,
  datasetId,
  versionId,
  analysisType,
  savedConfig,
}: {
  chart: ChartSpec
  index: number
  runId?: string
  datasetId?: string | null
  versionId?: string | null
  analysisType?: AnalysisType
  savedConfig?: Record<string, unknown> | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorConfig, setEditorConfig] = useState<ChartEditorConfig>(() =>
    getDefaultConfig(chart.type, savedConfig ?? undefined)
  )
  const chartAreaRef = useRef<HTMLDivElement>(null)
  const { type, title, data, config } = chart

  const renderCfg: RenderCfg = {
    colors: editorConfig.dataset_colors,
    showGrid: editorConfig.show_grid,
    gridColor: editorConfig.grid_color,
    showLegend: editorConfig.show_legend,
    legendPos: editorConfig.legend_position,
    height: editorConfig.height_px,
    showAxisLabels: editorConfig.show_axis_labels,
    xLabel: editorConfig.x_axis_label,
    yLabel: editorConfig.y_axis_label,
  }

  function handleDownload() {
    const svgEl = chartAreaRef.current?.querySelector('svg')
    if (!svgEl) return
    const scale = editorConfig.export_dpi / 96
    const w = svgEl.clientWidth || 800
    const h = svgEl.clientHeight || 400
    const svgData = new XMLSerializer().serializeToString(svgEl)
    const canvas = document.createElement('canvas')
    canvas.width = w * scale
    canvas.height = h * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.onload = () => {
      ctx.scale(scale, scale)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0)
      const link = document.createElement('a')
      link.download = `${title.replace(/[^a-z0-9]/gi, '_')}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`
  }

  if (!SUPPORTED_CHART_TYPES.has(type)) return null

  const displayTitle =
    editorConfig.show_title && editorConfig.chart_title ? editorConfig.chart_title : title

  return (
    <div
      className={`rounded-2xl overflow-hidden transition-all duration-200 ${!editorOpen && !expanded ? 'hover:-translate-y-0.5' : ''}`}
      style={{
        background: '#ffffff',
        border: `1px solid ${CHART_TOKENS.border}`,
        boxShadow: CHART_TOKENS.shadow.ambient,
      }}
    >
      <div className={editorOpen ? 'flex flex-col lg:flex-row' : ''}>
        {/* ── Chart area ── */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 pt-3 pb-2"
            style={{ borderBottom: `1px solid ${CHART_TOKENS.border}` }}
          >
            <div>
              <h4
                className="text-xs font-semibold leading-snug"
                style={{ color: CHART_TOKENS.text.primary, fontFamily: 'Manrope, sans-serif' }}
              >
                {displayTitle}
              </h4>
            </div>

            <div className="flex items-center gap-1 mt-0.5 flex-shrink-0">
              {/* Edit button */}
              <button
                type="button"
                onClick={() => setEditorOpen(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-150"
                style={
                  editorOpen
                    ? { color: chartColor(0), background: chartColorDim(0), border: `1px solid ${chartColorMid(0)}` }
                    : { color: CHART_TOKENS.text.secondary, background: 'transparent', border: `1px solid transparent` }
                }
                title={editorOpen ? 'Close editor' : 'Edit chart'}
              >
                {editorOpen ? (
                  <span style={{ fontFamily: 'Manrope, sans-serif' }}>Done</span>
                ) : (
                  <>
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline text-[10px] tracking-wide" style={{ fontFamily: 'Manrope, sans-serif' }}>Edit</span>
                  </>
                )}
              </button>
              {/* Expand */}
              <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="p-2 rounded-lg transition-all duration-150"
                style={{ color: CHART_TOKENS.text.muted }}
                title={expanded ? 'Collapse' : 'Expand'}
              >
                {expanded
                  ? <Minimize2 className="h-3.5 w-3.5" />
                  : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Chart Body */}
          <div className={`px-3 pb-3 pt-2 ${expanded ? 'min-h-[420px]' : ''}`} ref={chartAreaRef}>
            <ChartRenderContext.Provider value={renderCfg}>
              {type === 'histogram'         && <HistogramChart      data={data as { x0: number; x1: number; count: number }[]} expanded={expanded} />}
              {type === 'bar'               && <FrequencyBarChart   data={data as { value: string; count: number; percent: number | string }[]} expanded={expanded} />}
              {type === 'grouped_bar'       && <GroupedBarChart     data={data as Record<string, unknown>[]} config={config} expanded={expanded} />}
              {type === 'scatter_regression'&& <ScatterRegressionChart data={data as Record<string, unknown>[]} config={config} expanded={expanded} />}
              {type === 'residual_plot'     && <ResidualChart       data={data as Record<string, unknown>[]} expanded={expanded} />}
              {type === 'coefficient_plot'  && <CoefficientPlot     data={data as CoefficientPlotData[]} isOR={false} expanded={expanded} />}
              {type === 'forest_or'         && <CoefficientPlot     data={data as CoefficientPlotData[]} isOR label="OR"  nullLine={1} expanded={expanded} />}
              {type === 'forest_hr'         && <CoefficientPlot     data={data as CoefficientPlotData[]} isOR label="HR"  nullLine={1} expanded={expanded} />}
              {type === 'forest_irr'        && <CoefficientPlot     data={data as CoefficientPlotData[]} isOR label="IRR" nullLine={1} expanded={expanded} />}
              {type === 'forest_meta'       && <ForestPlot          data={data as ForestPlotData[]}      config={config} expanded={expanded} />}
              {type === 'funnel_plot'       && <FunnelPlot          data={data as { es: number; se: number }[]} config={config} expanded={expanded} />}
              {type === 'roc_curve'         && <ROCCurve            data={data as { fpr: number; tpr: number }[]} config={config} expanded={expanded} />}
              {type === 'km_curve'          && <KMCurve             data={data as KMPoint[]} config={config} expanded={expanded} />}
              {type === 'heatmap'           && <CorrelationHeatmap  data={data as HeatmapData[]} config={config} />}
              {type === 'time_series'       && <TimeSeriesChart     data={data as Record<string, unknown>[]} config={config} expanded={expanded} />}
              {type === 'scree_plot'        && <ScreePlot           data={data as { component: number; eigenvalue: number; varExplained: number }[]} expanded={expanded} />}
              {type === 'cluster_scatter'   && <ClusterScatter      data={data as { pc1: number; pc2: number; cluster: number }[]} config={config} expanded={expanded} />}
              {type === 'power_curve'       && <PowerCurve         data={data as { n: number; power: number }[]} config={config} expanded={expanded} />}
              {type === 'epi_curve'         && <EpiCurve           data={data as Record<string, unknown>[]} config={config} expanded={expanded} />}
              {type === 'acf_plot'          && <ACFChart           data={data as { lag: number; acf: number }[]} config={config} expanded={expanded} />}
              {type === 'biplot'            && <Biplot             data={data as unknown as BiplotData} config={config} expanded={expanded} />}
              {type === 'boxplot_2group'    && <BoxPlot2Group      data={data as unknown as Record<string, unknown>} expanded={expanded} />}
              {type === 'boxplot_groups'    && <BoxPlotGroups      data={data as unknown as Record<string, unknown>} expanded={expanded} />}
              {type === 'mosaic'            && <MosaicPlot         data={data as Record<string, unknown>[]} config={config} expanded={expanded} />}
              {type === 'forest_rrr'        && <ForestRRR          data={data as ForestRRRPoint[]} config={config ?? {}} expanded={expanded} />}
              {type === 'paired_diff'       && <PairedDiffChart    data={data as number[]} expanded={expanded} />}
              {type === 'silhouette_plot'   && <SilhouettePlot     data={data as SilhouettePoint[]} expanded={expanded} />}
              {type === 'scatter_matrix'    && <ScatterMatrix      data={data as ScatterPair[]} config={config ?? {}} expanded={expanded} />}
              {type === 'qq_plot'           && <QQPlot             data={data as { theoretical: number; observed: number }[]} config={config} expanded={expanded} />}
              {type === 'violin'            && <ViolinPlot         data={data as ViolinGroup[]} config={config} expanded={expanded} />}
              {type === 'ridge'             && <RidgePlot          data={data as ViolinGroup[]} config={config} expanded={expanded} />}
              {type === 'correlogram'       && <CorrelogramChart   data={data as HeatmapData[]} config={config} />}
              {type === 'dumbbell'          && <DumbbellChart      data={data as DumbbellPoint[]} config={config} />}
            </ChartRenderContext.Provider>
          </div>
        </div>

        {/* ── Editor Panel ── */}
        {editorOpen && (
          <div
            className="w-full lg:w-[280px] flex-shrink-0 flex flex-col overflow-hidden border-t lg:border-t-0"
            style={{
              background: '#f3f4f6',
              borderLeft: `1px solid ${CHART_TOKENS.border}`,
            }}
          >
            <ChartEditor
              config={editorConfig}
              onChange={update => setEditorConfig(c => ({ ...c, ...update }))}
              chartType={type}
              datasetLabels={[]}
              runId={runId}
              datasetId={datasetId}
              versionId={versionId}
              chartTitle={title}
              analysisTitle={analysisType}
              chartData={data}
              onDownload={handleDownload}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shared helpers ───────────────────────────────────────────
const axisTick = AXIS_TICK_STYLE
const gridStyle = GRID_STYLE

function chartHeight(expanded: boolean, base = 160) {
  return expanded ? Math.max(base, 400) : base
}

// ── SVG Gradients for area fills ─────────────────────────────
function ChartGradients() {
  return (
    <defs>
      {CHART_TOKENS.solidSequence.map((color, i) => (
        <linearGradient key={i} id={`plexGrad${i}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0.03} />
        </linearGradient>
      ))}
    </defs>
  )
}

function legendStyle() {
  return { fontSize: 11, color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif', paddingTop: 14 }
}

// ── Stat badge ───────────────────────────────────────────────
function StatBadge({ label, value, colorIdx = 0 }: { label: string; value: string | number; colorIdx?: number }) {
  return (
    <div
      className="inline-flex items-center gap-3 rounded-xl px-5 py-2.5"
      style={{
        background: chartColorDim(colorIdx),
        border: `1px solid ${chartColorMid(colorIdx)}`,
      }}
    >
      <span
        className="text-[9px] font-bold uppercase tracking-[0.14em]"
        style={{ color: chartColor(colorIdx), fontFamily: 'Manrope, sans-serif' }}
      >
        {label}
      </span>
      <span
        className="text-base font-extrabold tabular-nums"
        style={{ color: CHART_TOKENS.text.primary, fontFamily: "'JetBrains Mono', monospace" }}
      >
        {value}
      </span>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────
// CHART COMPONENTS
// ───────────────────────────────────────────────────────────────

// ── Histogram ────────────────────────────────────────────────
function HistogramChart({ data, expanded }: { data: { x0: number; x1: number; count: number }[]; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  const d = data.map(b => ({ name: `${b.x0.toFixed(1)}`, count: b.count }))
  return (
    <ResponsiveContainer width="100%" height={cfg.height ?? chartHeight(expanded, 160)}>
      <BarChart data={d} barCategoryGap="3%">
        <ChartGradients />
        {cfg.showGrid && <CartesianGrid {...gridStyle} />}
        <XAxis dataKey="name" tick={axisTick} {...axisLabelX(cfg)} />
        <YAxis tick={axisTick} {...axisLabelY(cfg)} />
        <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} animationDuration={700}>
          {d.map((_, i) => (
            <Cell key={i} fill={C[0] ?? chartColor(0)} fillOpacity={0.55 + (i / d.length) * 0.35} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Frequency Bar ────────────────────────────────────────────
function FrequencyBarChart({ data, expanded }: { data: { value: string; count: number; percent: number | string }[]; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  const top = data.slice(0, 20)
  return (
    <ResponsiveContainer width="100%" height={Math.max(cfg.height ?? chartHeight(expanded, 160), top.length * 28)}>
      <BarChart data={top} layout="vertical" margin={{ left: 8, right: 20 }}>
        {cfg.showGrid && <CartesianGrid {...gridStyle} horizontal={false} />}
        <XAxis type="number" tick={axisTick} {...axisLabelX(cfg)} />
        <YAxis type="category" dataKey="value" tick={axisTick} width={130} {...axisLabelY(cfg)} />
        <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="count" radius={[0, 5, 5, 0]} animationDuration={700}>
          {top.map((_, i) => (
            <Cell key={i} fill={C[i % C.length] ?? chartColor(i)} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Grouped Bar ──────────────────────────────────────────────
function GroupedBarChart({ data, config, expanded }: { data: Record<string, unknown>[]; config: Record<string, unknown>; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  const rows = (config.rowCats as string[]) ?? []
  const cols = (config.colCats as string[]) ?? []
  if (!rows.length || !cols.length) return <p className="text-xs py-4 text-center" style={{ color: CHART_TOKENS.text.muted }}>No chart data</p>
  const pivoted = rows.map(row => {
    const entry: Record<string, unknown> = { row }
    cols.forEach(col => {
      const d = data.find((x: Record<string, unknown>) => x.row === row && x.col === col)
      entry[col] = (d as Record<string, unknown> | undefined)?.count ?? 0
    })
    return entry
  })
  const la = legendAlign(cfg.legendPos)
  return (
    <ResponsiveContainer width="100%" height={cfg.height ?? chartHeight(expanded, 160)}>
      <BarChart data={pivoted} barCategoryGap="20%" barGap={4}>
        {cfg.showGrid && <CartesianGrid {...gridStyle} />}
        <XAxis dataKey="row" tick={axisTick} {...axisLabelX(cfg)} />
        <YAxis tick={axisTick} {...axisLabelY(cfg)} />
        <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        {cfg.showLegend && <Legend wrapperStyle={legendStyle()} {...la} />}
        {cols.map((col, i) => (
          <Bar key={col} dataKey={col} fill={C[i % C.length] ?? chartColor(i)} fillOpacity={0.8} radius={[4, 4, 0, 0]} animationDuration={700} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Scatter + Regression ─────────────────────────────────────
function ScatterRegressionChart({ data, config, expanded }: { data: Record<string, unknown>[]; config: Record<string, unknown>; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  void config
  const lineData = data.map(d => ({ x: d.x, y: d.yHat })).sort((a, b) => (a.x as number) - (b.x as number))
  return (
    <ResponsiveContainer width="100%" height={cfg.height ?? chartHeight(expanded, 160)}>
      <ComposedChart>
        <ChartGradients />
        {cfg.showGrid && <CartesianGrid {...gridStyle} />}
        <XAxis dataKey="x" type="number" name="X" tick={axisTick} {...axisLabelX(cfg)} />
        <YAxis tick={axisTick} {...axisLabelY(cfg)} />
        <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Area data={lineData} type="monotone" dataKey="y" fill={`url(#plexGrad2)`} stroke="none" />
        <Scatter data={data as Record<string, unknown>[]} fill={C[0] ?? chartColor(0)} opacity={0.55} animationDuration={700} />
        <Line data={lineData} type="monotone" dataKey="y" stroke={C[2] ?? chartColor(2)} dot={false} strokeWidth={2.5} strokeDasharray="6 3" animationDuration={700} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ── Residual Plot ────────────────────────────────────────────
function ResidualChart({ data, expanded }: { data: Record<string, unknown>[]; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  return (
    <ResponsiveContainer width="100%" height={cfg.height ?? chartHeight(expanded, 160)}>
      <ScatterChart>
        {cfg.showGrid && <CartesianGrid {...gridStyle} />}
        <XAxis dataKey="fitted" name="Fitted" tick={axisTick} {...axisLabelX(cfg, 'Fitted Values')} />
        <YAxis dataKey="residual" name="Residual" tick={axisTick} {...axisLabelY(cfg, 'Residuals')} />
        <ReferenceLine y={0} stroke={CHART_TOKENS.borderActive} strokeDasharray="6 4" />
        <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Scatter data={data} fill={C[0] ?? chartColor(0)} opacity={0.5} animationDuration={700} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

// ── Forest / Coefficient Plot (SVG table) ─────────────────────
interface CoefficientPlotData { name: string; estimate?: number; or?: number; hr?: number; irr?: number; ciLow: number; ciHigh: number; p: string; sig?: string }
interface ForestPlotData { label: string; es: number; ciLow: number; ciHigh: number; weight: number; isSummary: boolean }

type ForestRow = { name: string; value: number; ciLow: number; ciHigh: number; p: string; isSummary?: boolean; weight?: number }

const BAR_W = 220
const BAR_H = 30

function computeForestDomain(rows: ForestRow[], nullLine: number) {
  const finite = (v: unknown): v is number => typeof v === 'number' && isFinite(v) && !isNaN(v)
  const rawVals = rows.flatMap(r => [r.value, r.ciLow, r.ciHigh]).filter(finite)
  rawVals.push(nullLine)
  if (rawVals.length === 0) return { domainMin: nullLine - 1, domainMax: nullLine + 1 }
  const sorted = [...rawVals].sort((a, b) => a - b)
  const q1 = sorted[Math.floor(sorted.length * 0.25)]
  const q3 = sorted[Math.floor(sorted.length * 0.75)]
  const iqr = q3 - q1
  const fence = Math.max(iqr * 3, Math.abs(nullLine) + 1, 1)
  const clampMin = Math.min(q1 - fence, nullLine)
  const clampMax = Math.max(q3 + fence, nullLine)
  const pad = Math.max((clampMax - clampMin) * 0.12, 0.2)
  return { domainMin: clampMin - pad, domainMax: clampMax + pad }
}

function ForestPlotTable({ rows, nullLine = 0, effectLabel = 'Estimate', isRatio = false }: {
  rows: ForestRow[]
  nullLine?: number
  effectLabel?: string
  isRatio?: boolean
}) {
  if (rows.length === 0) {
    return <p className="text-xs py-4 text-center" style={{ color: CHART_TOKENS.text.muted }}>No data to display</p>
  }

  const { domainMin, domainMax } = computeForestDomain(rows, nullLine)
  const domainSpan = domainMax - domainMin

  const toBarX = (v: number) => {
    const clamped = Math.max(domainMin, Math.min(domainMax, v))
    return ((clamped - domainMin) / domainSpan) * BAR_W
  }
  const nullX = toBarX(nullLine)

  const safeNum = (n: number | null | undefined) =>
    n != null && typeof n === 'number' && isFinite(n) ? n.toFixed(2) : '—'

  const ticks = Array.from({ length: 5 }, (_, i) => domainMin + (i / 4) * domainSpan)

  // Map significance to design-token colors
  const getSigColor = (isSig: boolean, isSummaryRow: boolean, val: number) => {
    if (isSummaryRow) return chartColor(3) // violet
    if (!isSig) return CHART_TOKENS.text.muted
    if (isRatio) return val > nullLine ? chartColor(2) : chartColor(4) // rose / sage
    return val > nullLine ? chartColor(0) : chartColor(3) // teal / violet
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr style={{ borderBottom: `1px solid ${CHART_TOKENS.border}` }}>
            {['Variable', 'Effect Scale', `${effectLabel} [95% CI]`, 'P-Value'].map((h, i) => (
              <th
                key={i}
                className={`pb-3 text-[10px] font-bold uppercase tracking-[0.1em] whitespace-nowrap ${i === 0 ? 'pr-4' : i === 1 ? 'text-center' : i === 2 ? 'text-right pr-4' : 'text-right'}`}
                style={{
                  color: CHART_TOKENS.text.secondary,
                  fontFamily: 'Manrope, sans-serif',
                  ...(i === 1 ? { width: BAR_W + 'px', minWidth: BAR_W + 'px' } : {}),
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((row, i) => {
            const val = row.value ?? nullLine
            const ciLow = row.ciLow ?? val
            const ciHigh = row.ciHigh ?? val
            const pStr = String(row.p ?? '')
            const pNum = parseFloat(pStr)
            const isSig = !isNaN(pNum) && pNum < 0.05

            const isClippedLow = ciLow < domainMin
            const isClippedHigh = ciHigh > domainMax

            const color = getSigColor(isSig, !!row.isSummary, val)
            const xVal = toBarX(val)
            const xLow = toBarX(ciLow)
            const xHigh = toBarX(ciHigh)
            const cy = BAR_H / 2

            const annotText = `${safeNum(val)} [${safeNum(ciLow)}, ${safeNum(ciHigh)}]`
            const pText = pStr === '<0.001' || pStr === '< 0.001'
              ? '<0.001'
              : isNaN(pNum) ? pStr : pNum.toFixed(3)

            const rowBg = row.isSummary
              ? chartColorDim(3)
              : i % 2 === 0
                ? '#ffffff'
                : '#f7f9fb'

            return (
              <tr key={i} style={{ background: rowBg }}>
                {/* Variable label */}
                <td className="py-3 pr-4">
                  <span
                    className={`text-[12px] leading-tight ${row.isSummary ? 'font-bold' : 'font-medium'}`}
                    style={{ color: row.isSummary ? chartColor(3) : CHART_TOKENS.text.primary, fontFamily: 'Manrope, sans-serif' }}
                  >
                    {row.name}
                  </span>
                  {row.weight != null && !row.isSummary && (
                    <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ width: '80px', background: '#f0f0f0' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(4, row.weight * 100)}%`, background: CHART_TOKENS.border }}
                      />
                    </div>
                  )}
                </td>

                {/* SVG forest bar */}
                <td className="py-3" style={{ width: BAR_W + 'px', minWidth: BAR_W + 'px' }}>
                  <svg width={BAR_W} height={BAR_H} viewBox={`0 0 ${BAR_W} ${BAR_H}`} style={{ display: 'block' }}>
                    {/* Null reference line */}
                    <line x1={nullX} y1={2} x2={nullX} y2={BAR_H - 2} stroke={CHART_TOKENS.borderActive} strokeWidth={1.5} strokeDasharray="4 3" />

                    {!row.isSummary ? (
                      <>
                        <line x1={xLow} y1={cy} x2={xHigh} y2={cy} stroke={color} strokeWidth={2} strokeLinecap="round" />
                        {isClippedLow
                          ? <polygon points={`4,${cy} 12,${cy - 5} 12,${cy + 5}`} fill={color} />
                          : <line x1={xLow} y1={cy - 5} x2={xLow} y2={cy + 5} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
                        }
                        {isClippedHigh
                          ? <polygon points={`${BAR_W - 4},${cy} ${BAR_W - 12},${cy - 5} ${BAR_W - 12},${cy + 5}`} fill={color} />
                          : <line x1={xHigh} y1={cy - 5} x2={xHigh} y2={cy + 5} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
                        }
                        <rect x={xVal - 5} y={cy - 5} width={10} height={10} fill={color} rx={2} />
                        <circle cx={xVal} cy={cy} r={2} fill="#ffffff" />
                      </>
                    ) : (
                      <>
                        <line x1={xLow} y1={cy} x2={xHigh} y2={cy} stroke={color} strokeWidth={1.5} strokeOpacity={0.4} strokeLinecap="round" />
                        <polygon
                          points={`${xVal},${cy - 9} ${xHigh},${cy} ${xVal},${cy + 9} ${xLow},${cy}`}
                          fill={color} fillOpacity={0.22} stroke={color} strokeWidth={2}
                        />
                      </>
                    )}
                  </svg>
                </td>

                {/* Annotation */}
                <td className="py-3 pr-4 text-right">
                  <span
                    className={`text-[11px] ${row.isSummary ? 'font-bold' : 'font-normal'}`}
                    style={{
                      color: row.isSummary ? chartColor(3) : CHART_TOKENS.text.secondary,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {annotText}
                  </span>
                  {(isClippedLow || isClippedHigh) && (
                    <span className="ml-1 text-[9px] font-bold" style={{ color: chartColor(5) }}>†</span>
                  )}
                </td>

                {/* P-value */}
                <td className="py-3 text-right">
                  <span
                    className="text-[11px] font-bold"
                    style={{
                      color: isSig ? chartColor(4) : CHART_TOKENS.text.muted,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {pText || '—'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Scale legend */}
      <div
        className="flex justify-between text-[9px] font-bold uppercase tracking-widest mt-3 pt-2"
        style={{ borderTop: `1px solid ${CHART_TOKENS.border}`, color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}
      >
        {isRatio ? (
          <>
            <span style={{ color: chartColor(4) }}>Favors Treatment</span>
            <span>1.0 (Null)</span>
            <span style={{ color: chartColor(2) }}>Favors Control</span>
          </>
        ) : (
          ticks.map((v, i) => <span key={i}>{v.toFixed(2)}</span>)
        )}
      </div>

      {isRatio && (
        <div className="flex flex-wrap items-center gap-4 mt-3">
          {[
            { color: chartColor(4), label: 'Protective (p<0.05)' },
            { color: chartColor(2), label: 'Harmful (p<0.05)' },
            { color: CHART_TOKENS.text.muted, label: 'Non-significant' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
              <span className="text-[10px]" style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}>{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[9px] font-bold" style={{ color: chartColor(5) }}>†</span>
            <span className="text-[10px]" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>CI extends beyond axis</span>
          </div>
        </div>
      )}
    </div>
  )
}

function CoefficientPlot({ data, isOR: _isOR, label, nullLine, expanded: _expanded }: { data: CoefficientPlotData[]; isOR: boolean; label?: string; nullLine?: number; expanded: boolean }) {
  const rows: ForestRow[] = data.map(d => ({
    name: d.name,
    value: d.or ?? d.hr ?? d.irr ?? d.estimate ?? 0,
    ciLow: d.ciLow,
    ciHigh: d.ciHigh,
    p: String(d.p ?? ''),
  }))
  return <ForestPlotTable rows={rows} nullLine={nullLine ?? 0} effectLabel={label ?? 'Coefficient'} isRatio={nullLine === 1} />
}

function ForestPlot({ data, config: _config, expanded: _expanded }: { data: ForestPlotData[]; config: Record<string, unknown>; expanded: boolean }) {
  const rows: ForestRow[] = data.map(d => ({
    name: d.label,
    value: d.es,
    ciLow: d.ciLow,
    ciHigh: d.ciHigh,
    p: '',
    isSummary: d.isSummary,
    weight: d.weight,
  }))
  return <ForestPlotTable rows={rows} nullLine={0} effectLabel="Effect Size" isRatio={false} />
}

// ── Funnel Plot ──────────────────────────────────────────────
function FunnelPlot({ data, config, expanded }: { data: { es: number; se: number }[]; config: Record<string, unknown>; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  const summaryES = (config.summaryES as number) ?? 0
  return (
    <ResponsiveContainer width="100%" height={cfg.height ?? chartHeight(expanded, 160)}>
      <ScatterChart>
        {cfg.showGrid && <CartesianGrid {...gridStyle} />}
        <XAxis dataKey="es" name="Effect Size" tick={axisTick} {...axisLabelX(cfg, 'Effect Size')} />
        <YAxis dataKey="se" name="SE" reversed tick={axisTick} {...axisLabelY(cfg, 'Standard Error')} />
        <ReferenceLine x={summaryES} stroke={C[1] ?? chartColor(1)} strokeDasharray="6 4" strokeWidth={1.5} />
        <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Scatter data={data} fill={C[0] ?? chartColor(0)} opacity={0.7} animationDuration={700} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

// ── ROC Curve ────────────────────────────────────────────────
function ROCCurve({ data, config, expanded }: { data: { fpr: number; tpr: number }[]; config: Record<string, unknown>; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  const auc = (config.auc as number)?.toFixed(3)
  return (
    <div>
      <ResponsiveContainer width="100%" height={cfg.height ?? chartHeight(expanded, 160)}>
        <AreaChart data={data}>
          <ChartGradients />
          {cfg.showGrid && <CartesianGrid {...gridStyle} />}
          <XAxis dataKey="fpr" name="FPR" tick={axisTick} domain={[0, 1]} {...axisLabelX(cfg, '1 − Specificity (FPR)')} />
          <YAxis dataKey="tpr" name="TPR" tick={axisTick} domain={[0, 1]} {...axisLabelY(cfg, 'Sensitivity (TPR)')} />
          <ReferenceLine
            segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
            stroke={CHART_TOKENS.borderActive}
            strokeDasharray="6 4"
            strokeWidth={1.5}
          />
          <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Area
            type="monotone"
            dataKey="tpr"
            fill="url(#plexGrad0)"
            stroke={C[0] ?? chartColor(0)}
            strokeWidth={2.5}
            dot={false}
            name={`AUC = ${auc}`}
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
      {auc && (
        <div className="mt-4 flex justify-center">
          <StatBadge label="AUC" value={auc} colorIdx={0} />
        </div>
      )}
    </div>
  )
}

// ── Kaplan-Meier ─────────────────────────────────────────────
interface KMPoint { time: number; survival: number; ciLow: number; ciHigh: number; group: string }

function KMCurve({ data, config, expanded }: { data: KMPoint[]; config: Record<string, unknown>; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  const groups = (config.groups as string[]) ?? ['All']
  const logRankP = config.logRankP
  const la = legendAlign(cfg.legendPos)
  return (
    <div>
      <ResponsiveContainer width="100%" height={cfg.height ?? chartHeight(expanded, 180)}>
        <LineChart>
          {cfg.showGrid && <CartesianGrid {...gridStyle} />}
          <XAxis dataKey="time" type="number" tick={axisTick} {...axisLabelX(cfg, 'Time')} />
          <YAxis domain={[0, 1]} tick={axisTick} {...axisLabelY(cfg, 'Survival Probability')} />
          <Tooltip content={<DarkTooltip />} cursor={{ stroke: CHART_TOKENS.borderActive, strokeWidth: 1 }} />
          {cfg.showLegend && <Legend wrapperStyle={legendStyle()} {...la} />}
          {groups.map((group, i) => (
            <Line
              key={group}
              data={data.filter(d => d.group === group)}
              type="stepAfter"
              dataKey="survival"
              name={group}
              stroke={C[i % C.length] ?? chartColor(i)}
              dot={false}
              strokeWidth={2.5}
              animationDuration={700}
             
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {!!logRankP && (
        <div className="mt-4 flex justify-center">
          <StatBadge label="Log-rank p" value={String(logRankP)} colorIdx={1} />
        </div>
      )}
    </div>
  )
}

// ── Correlation Heatmap ──────────────────────────────────────
interface HeatmapData { x: string; y: string; r: number; p: number }

function CorrelationHeatmap({ data, config }: { data: HeatmapData[]; config: Record<string, unknown> }) {
  const variables = (config.variables as string[]) ?? []
  const n = variables.length
  if (n === 0) return null

  const cellSize = Math.min(64, Math.max(38, 380 / n))

  const heatBg = (i: number, j: number, r: number) => {
    if (i === j) return '#f0f0f0'
    const t = Math.abs(r)
    if (r > 0) {
      // teal → bright teal
      const R = Math.round(13 + t * (63 - 13))
      const G = Math.round(17 + t * (184 - 17))
      const B = Math.round(23 + t * (176 - 23))
      return `rgba(${R},${G},${B},${0.15 + t * 0.75})`
    } else {
      // rose
      const R = Math.round(13 + t * (224 - 13))
      const G = Math.round(17 + t * (92 - 17))
      const B = Math.round(23 + t * (122 - 23))
      return `rgba(${R},${G},${B},${0.15 + t * 0.75})`
    }
  }

  return (
    <div className="overflow-x-auto py-2">
      <div style={{ display: 'grid', gridTemplateColumns: `100px repeat(${n}, ${cellSize}px)`, gap: 3 }}>
        <div />
        {variables.map(v => (
          <div
            key={v}
            className="text-[10px] font-semibold text-center overflow-hidden text-ellipsis whitespace-nowrap"
            style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}
            title={v}
          >
            {v}
          </div>
        ))}
        {variables.map((v1, i) => (
          <Fragment key={v1}>
            <div
              className="text-[10px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap flex items-center"
              style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}
            >
              {v1}
            </div>
            {variables.map((v2, j) => {
              const cell = data.find(d => d.x === v1 && d.y === v2)
              const r = cell?.r ?? (i === j ? 1 : 0)
              const bg = heatBg(i, j, r)
              const textCol = i === j ? CHART_TOKENS.text.muted : Math.abs(r) > 0.45 ? '#ffffff' : CHART_TOKENS.text.primary
              return (
                <div
                  key={`${v1}-${v2}`}
                  title={`r = ${r.toFixed(3)}${cell?.p != null ? `, p = ${cell.p.toFixed(4)}` : ''}`}
                  className="rounded-lg flex items-center justify-center cursor-default transition-transform hover:scale-105"
                  style={{
                    width: cellSize,
                    height: cellSize,
                    background: bg,
                    fontSize: 10,
                    fontWeight: 700,
                    color: textCol,
                    fontFamily: "'JetBrains Mono', monospace",
                    border: `1px solid ${CHART_TOKENS.border}`,
                  }}
                >
                  {i === j ? '1' : r.toFixed(2)}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

// ── Time Series ──────────────────────────────────────────────
function TimeSeriesChart({ data, config, expanded }: { data: Record<string, unknown>[]; config: Record<string, unknown>; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  void config
  const la = legendAlign(cfg.legendPos)
  return (
    <ResponsiveContainer width="100%" height={cfg.height ?? chartHeight(expanded, 160)}>
      <ComposedChart data={data}>
        <ChartGradients />
        {cfg.showGrid && <CartesianGrid {...gridStyle} />}
        <XAxis dataKey="date" tick={{ ...axisTick, fontSize: 10 }} interval="preserveStartEnd" {...axisLabelX(cfg)} />
        <YAxis tick={axisTick} {...axisLabelY(cfg)} />
        <Tooltip content={<DarkTooltip />} cursor={{ stroke: CHART_TOKENS.borderActive, strokeWidth: 1 }} />
        {cfg.showLegend && <Legend wrapperStyle={legendStyle()} {...la} />}
        <Area type="monotone" dataKey="observed" fill="url(#plexGrad0)" stroke={C[0] ?? chartColor(0)} strokeWidth={2} dot={false} name="Observed" animationDuration={700} />
        <Line type="monotone" dataKey="trend" stroke={C[1] ?? chartColor(1)} dot={false} strokeWidth={2.5} name="Trend" strokeDasharray="8 4" animationDuration={700} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ── Scree Plot ───────────────────────────────────────────────
function ScreePlot({ data, expanded }: { data: { component: number; eigenvalue: number; varExplained: number }[]; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  const la = legendAlign(cfg.legendPos)
  return (
    <ResponsiveContainer width="100%" height={cfg.height ?? chartHeight(expanded, 160)}>
      <ComposedChart data={data}>
        {cfg.showGrid && <CartesianGrid {...gridStyle} />}
        <XAxis dataKey="component" tick={axisTick} {...axisLabelX(cfg, 'Component')} />
        <YAxis tick={axisTick} {...axisLabelY(cfg)} />
        <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        {cfg.showLegend && <Legend wrapperStyle={legendStyle()} {...la} />}
        <Bar dataKey="eigenvalue" fill={C[0] ?? chartColor(0)} fillOpacity={0.75} name="Eigenvalue" radius={[4, 4, 0, 0]} animationDuration={700} />
        <Line type="monotone" dataKey="varExplained" stroke={C[1] ?? chartColor(1)} dot={{ r: 4, fill: C[1] ?? chartColor(1) }} name="% Variance" strokeWidth={2.5} animationDuration={700} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ── Cluster Scatter ──────────────────────────────────────────
function ClusterScatter({ data, config, expanded }: { data: { pc1: number; pc2: number; cluster: number }[]; config: Record<string, unknown>; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  const nClusters = (config.nClusters as number) ?? 3
  const clusterData = Array.from({ length: nClusters }, (_, i) => ({
    name: `Cluster ${i + 1}`,
    data: data.filter(d => d.cluster === i + 1),
  }))
  const la = legendAlign(cfg.legendPos)
  return (
    <ResponsiveContainer width="100%" height={cfg.height ?? chartHeight(expanded, 160)}>
      <ScatterChart>
        {cfg.showGrid && <CartesianGrid {...gridStyle} />}
        <XAxis type="number" dataKey="pc1" name="PC1" tick={axisTick} {...axisLabelX(cfg, 'PC1')} />
        <YAxis type="number" dataKey="pc2" name="PC2" tick={axisTick} {...axisLabelY(cfg, 'PC2')} />
        <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        {cfg.showLegend && <Legend wrapperStyle={legendStyle()} {...la} />}
        {clusterData.map((c, i) => (
          <Scatter key={c.name} name={c.name} data={c.data} fill={C[i % C.length] ?? chartColor(i)} opacity={0.65} animationDuration={700} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  )
}

// ── Power Curve ──────────────────────────────────────────────
function PowerCurve({ data, config, expanded }: { data: { n: number; power: number }[]; config: Record<string, unknown>; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  const targetPower = (config.targetPower as number) ?? 0.8
  const targetN = (config.targetN as number)
  return (
    <div>
      <ResponsiveContainer width="100%" height={cfg.height ?? chartHeight(expanded, 160)}>
        <AreaChart data={data}>
          <ChartGradients />
          {cfg.showGrid && <CartesianGrid {...gridStyle} />}
          <XAxis dataKey="n" tick={axisTick} {...axisLabelX(cfg, 'Sample Size (n)')} />
          <YAxis domain={[0, 1]} tick={axisTick} {...axisLabelY(cfg, 'Power')} />
          <ReferenceLine
            y={targetPower}
            stroke={C[1] ?? chartColor(1)}
            strokeDasharray="6 4"
            strokeWidth={1.5}
            label={{ value: `${(targetPower * 100).toFixed(0)}%`, fontSize: 11, fill: C[1] ?? chartColor(1), fontFamily: 'Manrope, sans-serif' }}
          />
          {targetN && (
            <ReferenceLine x={targetN} stroke={C[2] ?? chartColor(2)} strokeDasharray="6 4" strokeWidth={1.5} />
          )}
          <Tooltip content={<DarkTooltip />} cursor={{ stroke: CHART_TOKENS.borderActive, strokeWidth: 1 }} />
          <Area type="monotone" dataKey="power" fill="url(#plexGrad0)" stroke={C[0] ?? chartColor(0)} strokeWidth={2.5} dot={false} animationDuration={700} />
        </AreaChart>
      </ResponsiveContainer>
      {targetN && (
        <div className="mt-4 flex justify-center gap-3 flex-wrap">
          <StatBadge label="Required N" value={targetN} colorIdx={0} />
          <StatBadge label="Target Power" value={`${(targetPower * 100).toFixed(0)}%`} colorIdx={1} />
        </div>
      )}
    </div>
  )
}

// ── Epidemic Curve ───────────────────────────────────────────
function EpiCurve({ data, config, expanded }: { data: Record<string, unknown>[]; config: Record<string, unknown>; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  const classifications = (config.classifications as string[]) ?? ['Case']
  const la = legendAlign(cfg.legendPos)
  return (
    <ResponsiveContainer width="100%" height={cfg.height ?? chartHeight(expanded, 160)}>
      <BarChart data={data} barCategoryGap="8%">
        {cfg.showGrid && <CartesianGrid {...gridStyle} />}
        <XAxis dataKey="date" tick={{ ...axisTick, fontSize: 10 }} interval="preserveStartEnd" {...axisLabelX(cfg)} />
        <YAxis tick={axisTick} {...axisLabelY(cfg)} />
        <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        {cfg.showLegend && <Legend wrapperStyle={legendStyle()} {...la} />}
        {classifications.map((cls, i) => (
          <Bar
            key={cls}
            dataKey={cls}
            stackId="a"
            fill={C[i % C.length] ?? chartColor(i)}
            fillOpacity={0.8}
            name={cls}
            radius={i === classifications.length - 1 ? [4, 4, 0, 0] : undefined}
            animationDuration={700}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── ACF Chart ────────────────────────────────────────────────
function ACFChart({ data, config, expanded }: { data: { lag: number; acf: number }[]; config: Record<string, unknown>; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  const n = (config.n as number) ?? 100
  const ci = 1.96 / Math.sqrt(n)
  return (
    <ResponsiveContainer width="100%" height={cfg.height ?? chartHeight(expanded, 160)}>
      <BarChart data={data}>
        {cfg.showGrid && <CartesianGrid {...gridStyle} />}
        <XAxis dataKey="lag" tick={axisTick} {...axisLabelX(cfg, 'Lag')} />
        <YAxis domain={[-1, 1]} tick={axisTick} {...axisLabelY(cfg)} />
        <ReferenceLine y={ci}  stroke={C[1] ?? chartColor(1)} strokeDasharray="6 4" strokeWidth={1.5} />
        <ReferenceLine y={-ci} stroke={C[1] ?? chartColor(1)} strokeDasharray="6 4" strokeWidth={1.5} />
        <ReferenceLine y={0}   stroke={CHART_TOKENS.borderActive} strokeWidth={1} />
        <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="acf" radius={[4, 4, 0, 0]} animationDuration={700}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={Math.abs(d.acf) > ci ? (C[2] ?? chartColor(2)) : (C[0] ?? chartColor(0))}
              fillOpacity={0.8}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Biplot ────────────────────────────────────────────────────
interface BiplotData { scores: { id: number; pc1: number; pc2: number }[]; loadings: { variable: string; pc1: number; pc2: number }[] }

function Biplot({ data, config, expanded }: { data: BiplotData; config: Record<string, unknown>; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  if (!data || !data.scores) return null
  const sample = data.scores.slice(0, 500)
  const loadings = data.loadings ?? []
  const varExp = config.varExplained as number[] | undefined

  const VW = 600
  const VH = cfg.height ?? (expanded ? 520 : 380)
  const PAD = { t: 24, r: 24, b: 44, l: 44 }
  const plotW = VW - PAD.l - PAD.r
  const plotH = VH - PAD.t - PAD.b

  const pc1s = sample.map(d => d.pc1)
  const pc2s = sample.map(d => d.pc2)
  const xRange = Math.max(Math.abs(Math.min(...pc1s)), Math.abs(Math.max(...pc1s))) * 1.25 || 1
  const yRange = Math.max(Math.abs(Math.min(...pc2s)), Math.abs(Math.max(...pc2s))) * 1.25 || 1

  const toSvgX = (x: number) => PAD.l + ((x + xRange) / (2 * xRange)) * plotW
  const toSvgY = (y: number) => PAD.t + plotH - ((y + yRange) / (2 * yRange)) * plotH
  const oX = toSvgX(0)
  const oY = toSvgY(0)

  const maxL = Math.max(...loadings.flatMap(l => [Math.abs(l.pc1), Math.abs(l.pc2)]), 0.001)
  const lScale = (xRange * 0.72) / maxL
  const axisTicks = [-1, -0.5, 0, 0.5, 1].map(f => f * xRange)
  const pc1Label = varExp ? `PC1 (${(varExp[0] * 100).toFixed(1)}%)` : 'PC1'
  const pc2Label = varExp ? `PC2 (${(varExp[1] * 100).toFixed(1)}%)` : 'PC2'

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height={VH} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        {loadings.map((_, i) => (
          <marker key={i} id={`bp-arrow-${i}`} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <polygon points="0,0 7,3.5 0,7" fill={C[i % C.length] ?? chartColor(i)} />
          </marker>
        ))}
      </defs>

      {cfg.showGrid && [-0.5, 0, 0.5].map(f => {
        const gx = toSvgX(f * xRange)
        const gy = toSvgY(f * yRange)
        return (
          <g key={f}>
            <line x1={gx} y1={PAD.t} x2={gx} y2={PAD.t + plotH} stroke={f === 0 ? CHART_TOKENS.borderActive : CHART_TOKENS.grid} strokeWidth={f === 0 ? 1.5 : 1} strokeDasharray={f === 0 ? undefined : '3 5'} />
            <line x1={PAD.l} y1={gy} x2={PAD.l + plotW} y2={gy} stroke={f === 0 ? CHART_TOKENS.borderActive : CHART_TOKENS.grid} strokeWidth={f === 0 ? 1.5 : 1} strokeDasharray={f === 0 ? undefined : '3 5'} />
          </g>
        )
      })}

      {sample.map((d, i) => (
        <circle key={i} cx={toSvgX(d.pc1)} cy={toSvgY(d.pc2)} r={3.5} fill={chartColor(0)} fillOpacity={0.3} stroke={chartColor(0)} strokeOpacity={0.4} strokeWidth={0.5} />
      ))}

      {loadings.map((l, i) => {
        const ex = toSvgX(l.pc1 * lScale)
        const ey = toSvgY(l.pc2 * lScale)
        const color = C[i % C.length] ?? chartColor(i)
        const dx = ex - oX, dy = ey - oY
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        const ax = ex - (dx / len) * 8
        const ay = ey - (dy / len) * 8
        const lx = ex + (dx / len) * 13
        const ly = ey + (dy / len) * 13
        return (
          <g key={i}>
            <line x1={oX} y1={oY} x2={ax} y2={ay} stroke={color} strokeWidth={1.8} strokeOpacity={0.9} markerEnd={`url(#bp-arrow-${i})`} />
            <text x={lx} y={ly} fontSize={10} fill={color} fontWeight={700} textAnchor="middle" dominantBaseline="middle" fontFamily="Manrope, sans-serif">
              {l.variable.length > 14 ? l.variable.slice(0, 12) + '…' : l.variable}
            </text>
          </g>
        )
      })}

      <rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} fill="none" stroke={CHART_TOKENS.border} strokeWidth={1} rx={2} />

      {axisTicks.map((v, i) => {
        const tx = toSvgX(v)
        return (
          <g key={i}>
            <line x1={tx} y1={PAD.t + plotH} x2={tx} y2={PAD.t + plotH + 4} stroke={CHART_TOKENS.text.muted} strokeWidth={1} />
            <text x={tx} y={PAD.t + plotH + 14} fontSize={9} fill={CHART_TOKENS.text.muted} textAnchor="middle" fontFamily="Manrope, sans-serif">{v.toFixed(1)}</text>
          </g>
        )
      })}

      {axisTicks.map((v, i) => {
        const ty = toSvgY(v)
        return (
          <g key={i}>
            <line x1={PAD.l - 4} y1={ty} x2={PAD.l} y2={ty} stroke={CHART_TOKENS.text.muted} strokeWidth={1} />
            <text x={PAD.l - 6} y={ty + 4} fontSize={9} fill={CHART_TOKENS.text.muted} textAnchor="end" fontFamily="Manrope, sans-serif">{v.toFixed(1)}</text>
          </g>
        )
      })}

      <text x={PAD.l + plotW / 2} y={VH - 4} fontSize={11} fill={CHART_TOKENS.text.secondary} textAnchor="middle" fontWeight={600} fontFamily="Manrope, sans-serif">{pc1Label}</text>
      <text x={14} y={PAD.t + plotH / 2} fontSize={11} fill={CHART_TOKENS.text.secondary} textAnchor="middle" fontWeight={600} fontFamily="Manrope, sans-serif" transform={`rotate(-90, 14, ${PAD.t + plotH / 2})`}>{pc2Label}</text>

      {data.scores.length > 500 && (
        <text x={PAD.l + plotW - 4} y={PAD.t + plotH - 6} fontSize={9} fill={CHART_TOKENS.text.muted} textAnchor="end" fontFamily="Manrope, sans-serif">first 500 observations shown</text>
      )}
    </svg>
  )
}

// ── Box Plot (2 groups) ──────────────────────────────────────
function BoxPlot2Group({ data, expanded }: { data: Record<string, unknown>; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  const groups = (Array.isArray(data) ? data : (data.groups as { group: string; mean: number; sd: number }[])) ?? []
  if (!groups.length) return null
  const plotData = groups.map((g: { group: string; mean: number; sd: number }) => ({ name: g.group, mean: g.mean, error: g.sd }))
  return (
    <ResponsiveContainer width="100%" height={cfg.height ?? chartHeight(expanded, 160)}>
      <BarChart data={plotData} barCategoryGap="30%">
        {cfg.showGrid && <CartesianGrid {...gridStyle} />}
        <XAxis dataKey="name" tick={axisTick} {...axisLabelX(cfg)} />
        <YAxis tick={axisTick} {...axisLabelY(cfg)} />
        <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="mean" radius={[5, 5, 0, 0]} animationDuration={700}>
          {plotData.map((_, i) => <Cell key={i} fill={C[i % C.length] ?? chartColor(i)} fillOpacity={0.78} />)}
          <ErrorBar dataKey="error" width={7} strokeWidth={2} stroke={CHART_TOKENS.borderActive} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Box Plot (multiple groups) ───────────────────────────────
function BoxPlotGroups({ data, expanded }: { data: Record<string, unknown>; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  const groupData = (Array.isArray(data) ? data : (data.data as { group: string; mean: number; sd: number }[])) ?? []
  if (!groupData.length) return null
  return (
    <ResponsiveContainer width="100%" height={cfg.height ?? chartHeight(expanded, 160)}>
      <BarChart data={groupData} barCategoryGap="20%">
        {cfg.showGrid && <CartesianGrid {...gridStyle} />}
        <XAxis dataKey="group" tick={axisTick} {...axisLabelX(cfg)} />
        <YAxis tick={axisTick} {...axisLabelY(cfg)} />
        <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="mean" radius={[5, 5, 0, 0]} animationDuration={700}>
          {groupData.map((_: unknown, i: number) => <Cell key={i} fill={C[i % C.length] ?? chartColor(i)} fillOpacity={0.78} />)}
          <ErrorBar dataKey="sd" width={7} strokeWidth={2} stroke={CHART_TOKENS.borderActive} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Mosaic Plot ──────────────────────────────────────────────
function MosaicPlot({ data, config, expanded }: { data: Record<string, unknown>[]; config: Record<string, unknown>; expanded: boolean }) {
  const cats1 = (config.cats1 as string[]) ?? []
  const cats2 = (config.cats2 as string[]) ?? []
  return <GroupedBarChart data={data} config={{ rowCats: cats1, colCats: cats2 }} expanded={expanded} />
}

// ── Multinomial Forest (RRR per outcome category) ─────────────
interface ForestRRRPoint { name: string; category: string; rrr: number; ciLow: number; ciHigh: number; p: string }

function ForestRRR({ data, config }: { data: ForestRRRPoint[]; config: Record<string, unknown>; expanded: boolean }) {
  const reference = (config.reference as string) ?? 'reference'
  const categories = [...new Set(data.map(d => d.category))]

  if (categories.length === 0) {
    return <p className="text-xs py-4 text-center" style={{ color: CHART_TOKENS.text.muted }}>No chart data</p>
  }

  return (
    <div className="space-y-6">
      {categories.map((cat, ci) => {
        const rows: ForestRow[] = data
          .filter(d => d.category === cat)
          .map(d => ({ name: d.name, value: d.rrr, ciLow: d.ciLow, ciHigh: d.ciHigh, p: d.p }))
        return (
          <div key={cat}>
            <div
              className="text-[10px] font-bold uppercase tracking-[0.12em] mb-3 pb-1.5"
              style={{ color: chartColor(ci), borderBottom: `1px solid ${CHART_TOKENS.border}`, fontFamily: 'Manrope, sans-serif' }}
            >
              {cat} vs {reference}
            </div>
            <ForestPlotTable rows={rows} nullLine={1} effectLabel="RRR" isRatio />
          </div>
        )
      })}
    </div>
  )
}

// ── Paired Difference Histogram ───────────────────────────────
function PairedDiffChart({ data, expanded }: { data: number[]; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  const diffs = (Array.isArray(data) ? data : []).filter((d): d is number => typeof d === 'number' && !isNaN(d))
  if (diffs.length === 0) return <p className="text-xs py-4 text-center" style={{ color: CHART_TOKENS.text.muted }}>No data</p>

  const minVal = Math.min(...diffs)
  const maxVal = Math.max(...diffs)
  const nBins = Math.min(30, Math.max(8, Math.round(Math.sqrt(diffs.length))))
  const binWidth = (maxVal - minVal) / nBins || 1
  const bins = Array.from({ length: nBins }, (_, i) => ({
    name: (minVal + i * binWidth).toFixed(2),
    count: 0,
    x0: minVal + i * binWidth,
  }))
  diffs.forEach(d => {
    const idx = Math.min(Math.floor((d - minVal) / binWidth), nBins - 1)
    bins[idx].count++
  })
  const diffMean = diffs.reduce((s, d) => s + d, 0) / diffs.length

  return (
    <div>
      <ResponsiveContainer width="100%" height={cfg.height ?? chartHeight(expanded, 160)}>
        <BarChart data={bins} barCategoryGap="3%">
          <ChartGradients />
          {cfg.showGrid && <CartesianGrid {...gridStyle} />}
          <XAxis dataKey="name" tick={axisTick} {...axisLabelX(cfg, 'Difference')} />
          <YAxis tick={axisTick} {...axisLabelY(cfg, 'Count')} />
          <ReferenceLine x={bins.reduce((best, b) => Math.abs(b.x0) < Math.abs(best.x0) ? b : best, bins[0])?.name} stroke={CHART_TOKENS.borderActive} strokeDasharray="6 4" strokeWidth={1.5} label={{ value: '0', fontSize: 10, fill: CHART_TOKENS.text.muted }} />
          <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} animationDuration={700}>
            {bins.map((_, i) => <Cell key={i} fill={C[0] ?? chartColor(0)} fillOpacity={0.55 + (i / bins.length) * 0.35} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex justify-center gap-3 flex-wrap">
        <StatBadge label="Mean diff" value={diffMean.toFixed(3)} colorIdx={0} />
        <StatBadge label="N pairs" value={diffs.length} colorIdx={1} />
      </div>
    </div>
  )
}

// ── Silhouette Plot ───────────────────────────────────────────
interface SilhouettePoint { id: number; silhouette: number; cluster: number }

function SilhouettePlot({ data, expanded }: { data: SilhouettePoint[]; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  if (!data || data.length === 0) return <p className="text-xs py-4 text-center" style={{ color: CHART_TOKENS.text.muted }}>No data</p>

  const sorted = [...data]
    .sort((a, b) => a.cluster - b.cluster || b.silhouette - a.silhouette)
    .slice(0, 300)
  const avgSil = data.reduce((s, d) => s + d.silhouette, 0) / data.length
  const nClusters = Math.max(...data.map(d => d.cluster))
  const plotData = sorted.map(d => ({ ...d, fill: C[(d.cluster - 1) % C.length] ?? chartColor(d.cluster - 1) }))

  return (
    <div>
      <ResponsiveContainer width="100%" height={cfg.height ?? chartHeight(expanded, 180)}>
        <BarChart data={plotData} barCategoryGap="0%">
          {cfg.showGrid && <CartesianGrid {...gridStyle} horizontal />}
          <XAxis dataKey="id" hide />
          <YAxis domain={[-1, 1]} tick={axisTick} {...axisLabelY(cfg, 'Silhouette score')} />
          <ReferenceLine y={0} stroke={CHART_TOKENS.borderActive} strokeWidth={1.5} />
          <ReferenceLine y={0.5} stroke={C[1] ?? chartColor(1)} strokeDasharray="6 4" strokeWidth={1} label={{ value: '0.5', fontSize: 9, fill: C[1] ?? chartColor(1) }} />
          <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="silhouette" animationDuration={700} radius={0}>
            {plotData.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.78} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex justify-center gap-3 flex-wrap">
        <StatBadge label="Avg silhouette" value={avgSil.toFixed(3)} colorIdx={avgSil >= 0.5 ? 2 : avgSil >= 0.25 ? 1 : 4} />
        <StatBadge label="Clusters" value={nClusters} colorIdx={0} />
      </div>
      {cfg.showLegend && (
        <div className="mt-3 flex justify-center flex-wrap gap-3">
          {Array.from({ length: nClusters }, (_, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: C[i % C.length] ?? chartColor(i) }} />
              <span className="text-[10px]" style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}>Cluster {i + 1}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Q-Q Plot ─────────────────────────────────────────────────
function QQPlot({ data, config, expanded }: { data: { theoretical: number; observed: number }[]; config: Record<string, unknown>; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  void config

  if (!data || data.length === 0) return <p className="text-xs py-4 text-center" style={{ color: CHART_TOKENS.text.muted }}>No data</p>

  const sorted = [...data].sort((a, b) => a.theoretical - b.theoretical)
  const xMin = sorted[0].theoretical
  const xMax = sorted[sorted.length - 1].theoretical
  const refLine = [{ theoretical: xMin, ref: xMin }, { theoretical: xMax, ref: xMax }]
  const merged = sorted.map(d => ({ ...d, ref: d.theoretical }))

  return (
    <div>
      <ResponsiveContainer width="100%" height={cfg.height ?? chartHeight(expanded, 160)}>
        <ComposedChart data={merged} margin={{ left: 4, right: 8, bottom: 4, top: 4 }}>
          {cfg.showGrid && <CartesianGrid {...gridStyle} />}
          <XAxis dataKey="theoretical" type="number" name="Theoretical Quantile" tick={axisTick} domain={['dataMin', 'dataMax']} {...axisLabelX(cfg, 'Theoretical Quantiles')} />
          <YAxis dataKey="observed" type="number" name="Sample Quantile" tick={axisTick} {...axisLabelY(cfg, 'Sample Quantiles')} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0]?.payload as { theoretical: number; observed: number }
              return (
                <div className="rounded-xl min-w-[140px]" style={{ background: '#ffffff', border: `1px solid ${CHART_TOKENS.border}`, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,24,72,0.08)' }}>
                  <div className="space-y-1">
                    <div className="flex justify-between gap-4">
                      <span className="text-[10px]" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>Theoretical</span>
                      <span className="text-[11px] font-bold tabular-nums" style={{ color: CHART_TOKENS.text.primary, fontFamily: "'JetBrains Mono', monospace" }}>{d?.theoretical?.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[10px]" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>Sample</span>
                      <span className="text-[11px] font-bold tabular-nums" style={{ color: CHART_TOKENS.text.primary, fontFamily: "'JetBrains Mono', monospace" }}>{d?.observed?.toFixed(3)}</span>
                    </div>
                  </div>
                </div>
              )
            }}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <Line data={refLine} dataKey="ref" type="linear" stroke={CHART_TOKENS.borderActive} strokeDasharray="6 4" strokeWidth={1.5} dot={false} legendType="none" animationDuration={0} />
          <Scatter data={merged} dataKey="observed" fill={C[0] ?? chartColor(0)} opacity={0.55} animationDuration={600} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-center mt-1" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>
        Points close to the dashed line indicate approximate normality
      </p>
    </div>
  )
}

// ── Scatter Matrix ────────────────────────────────────────────
interface ScatterPair { var1: string; var2: string; r: number; pairs: { x: number; y: number }[] }

function ScatterMatrix({ data, config, expanded }: { data: ScatterPair[]; config: Record<string, unknown>; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors
  void config
  if (!data || data.length === 0) return <p className="text-xs py-4 text-center" style={{ color: CHART_TOKENS.text.muted }}>No data</p>

  const panelH = expanded ? 200 : 140

  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(260px, 1fr))` }}
    >
      {data.map((pair, idx) => {
        const sample = pair.pairs.slice(0, 300)
        const rAbs = Math.abs(pair.r)
        const rColor = pair.r >= 0 ? chartColor(0) : chartColor(4)
        const rLabel = `r = ${pair.r.toFixed(2)}`
        return (
          <div key={idx} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${CHART_TOKENS.border}` }}>
            <div className="px-3 pt-2 pb-1 flex items-center justify-between" style={{ borderBottom: `1px solid ${CHART_TOKENS.border}` }}>
              <span className="text-[10px] font-semibold truncate" style={{ color: CHART_TOKENS.text.primary, fontFamily: 'Manrope, sans-serif' }}>
                {pair.var1} × {pair.var2}
              </span>
              <span
                className="text-[10px] font-bold tabular-nums ml-2 flex-shrink-0"
                style={{ color: rAbs >= 0.3 ? rColor : CHART_TOKENS.text.muted, fontFamily: "'JetBrains Mono', monospace" }}
              >
                {rLabel}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={panelH}>
              <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                {cfg.showGrid && <CartesianGrid {...gridStyle} />}
                <XAxis type="number" dataKey="x" name={pair.var1} tick={axisTick} label={{ value: pair.var1, position: 'insideBottom', offset: -2, fontSize: 9, fill: CHART_TOKENS.text.muted }} />
                <YAxis type="number" dataKey="y" name={pair.var2} tick={axisTick} label={{ value: pair.var2, angle: -90, position: 'insideLeft', offset: 8, fontSize: 9, fill: CHART_TOKENS.text.muted }} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Scatter data={sample} fill={C[idx % C.length] ?? chartColor(idx)} opacity={0.45} animationDuration={700} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )
      })}
    </div>
  )
}

// ── Shared KDE helper ─────────────────────────────────────────
interface ViolinGroup { group: string; values: number[] }

function computeKDE(values: number[], nPoints = 80): { x: number; y: number }[] {
  if (values.length < 2) return []
  const n = values.length
  const m = values.reduce((s, v) => s + v, 0) / n
  const std = Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, n - 1))
  const h = Math.max(1e-6, 1.06 * std * Math.pow(n, -0.2))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = (max - min) * 0.2 || h * 3
  const xMin = min - pad
  const xMax = max + pad
  return Array.from({ length: nPoints }, (_, i) => {
    const x = xMin + (i / (nPoints - 1)) * (xMax - xMin)
    const y = values.reduce((sum, xi) => sum + Math.exp(-0.5 * ((x - xi) / h) ** 2), 0) / (n * h * Math.sqrt(2 * Math.PI))
    return { x, y }
  })
}

// ── Violin Plot ───────────────────────────────────────────────
function ViolinPlot({ data, config: _config, expanded }: { data: ViolinGroup[]; config: Record<string, unknown>; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors

  if (!data || data.length === 0) return <p className="text-xs py-4 text-center" style={{ color: CHART_TOKENS.text.muted }}>No data</p>

  const kdeGroups = data.map((g, i) => ({
    group: g.group,
    color: C[i % C.length] ?? chartColor(i),
    kde: computeKDE(g.values),
    sorted: [...g.values].sort((a, b) => a - b),
    n: g.values.length,
  }))

  const allX = kdeGroups.flatMap(g => g.kde.map(p => p.x))
  const allY = kdeGroups.flatMap(g => g.kde.map(p => p.y))
  if (allX.length === 0) return null

  const xMin = Math.min(...allX)
  const xMax = Math.max(...allX)
  const yMax = Math.max(...allY) || 1

  const H = cfg.height ?? (expanded ? 420 : 280)
  const W = 600
  const PAD = { t: 20, r: 20, b: 48, l: 50 }
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b

  const nGroups = kdeGroups.length
  const groupW = plotW / nGroups
  const maxHalfW = groupW * 0.38

  const toSvgY = (x: number) => PAD.t + plotH - ((x - xMin) / (xMax - xMin || 1)) * plotH
  const normDensity = (y: number) => (y / yMax) * maxHalfW

  const nTicks = 5
  const yTicks = Array.from({ length: nTicks }, (_, i) => xMin + (i / (nTicks - 1)) * (xMax - xMin))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', overflow: 'visible' }}>
      {cfg.showGrid && yTicks.map((v, i) => {
        const sy = toSvgY(v)
        return <line key={i} x1={PAD.l} y1={sy} x2={W - PAD.r} y2={sy} stroke={CHART_TOKENS.grid} strokeWidth={1} strokeDasharray="3 5" />
      })}
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + plotH} stroke={CHART_TOKENS.border} strokeWidth={1} />
      {yTicks.map((v, i) => {
        const sy = toSvgY(v)
        return (
          <g key={i}>
            <line x1={PAD.l - 4} y1={sy} x2={PAD.l} y2={sy} stroke={CHART_TOKENS.border} strokeWidth={1} />
            <text x={PAD.l - 7} y={sy + 4} fontSize={9} fill={CHART_TOKENS.text.muted} textAnchor="end" fontFamily="Manrope, sans-serif">{v.toFixed(1)}</text>
          </g>
        )
      })}
      {kdeGroups.map((g, gi) => {
        const cx = PAD.l + gi * groupW + groupW / 2
        if (g.kde.length === 0 || g.sorted.length === 0) return null
        const n = g.sorted.length
        const rightPts = g.kde.map(p => ({ sx: cx + normDensity(p.y), sy: toSvgY(p.x) }))
        const leftPts = [...g.kde].reverse().map(p => ({ sx: cx - normDensity(p.y), sy: toSvgY(p.x) }))
        const pathD = [...rightPts, ...leftPts].map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`).join(' ') + ' Z'
        const q1 = g.sorted[Math.floor(n * 0.25)]
        const q3 = g.sorted[Math.floor(n * 0.75)]
        const med = g.sorted[Math.floor(n * 0.5)]
        const iqrVal = q3 - q1
        const whiskerLo = Math.max(g.sorted[0], q1 - iqrVal * 1.5)
        const whiskerHi = Math.min(g.sorted[n - 1], q3 + iqrVal * 1.5)
        const boxW = Math.min(12, groupW * 0.13)
        const syQ1 = toSvgY(q1), syQ3 = toSvgY(q3), syMed = toSvgY(med)
        const syWLo = toSvgY(whiskerLo), syWHi = toSvgY(whiskerHi)
        return (
          <g key={g.group}>
            <path d={pathD} fill={g.color} fillOpacity={0.18} stroke={g.color} strokeWidth={1.5} strokeOpacity={0.6} />
            <line x1={cx} y1={syWHi} x2={cx} y2={syQ3} stroke={g.color} strokeWidth={1.5} strokeOpacity={0.6} strokeDasharray="3 2" />
            <line x1={cx} y1={syQ1} x2={cx} y2={syWLo} stroke={g.color} strokeWidth={1.5} strokeOpacity={0.6} strokeDasharray="3 2" />
            <rect x={cx - boxW / 2} y={syQ3} width={boxW} height={Math.max(1, syQ1 - syQ3)} fill={g.color} fillOpacity={0.55} rx={2} stroke={g.color} strokeWidth={1} strokeOpacity={0.8} />
            <line x1={cx - boxW / 2 - 2} y1={syMed} x2={cx + boxW / 2 + 2} y2={syMed} stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
            <line x1={cx - boxW / 2 - 2} y1={syMed} x2={cx + boxW / 2 + 2} y2={syMed} stroke={g.color} strokeWidth={1} strokeLinecap="round" />
            <text x={cx} y={H - PAD.b + 14} fontSize={11} fill={CHART_TOKENS.text.secondary} textAnchor="middle" fontFamily="Manrope, sans-serif" fontWeight={500}>
              {g.group.length > 14 ? g.group.slice(0, 12) + '…' : g.group}
            </text>
            <text x={cx} y={H - PAD.b + 26} fontSize={9} fill={CHART_TOKENS.text.muted} textAnchor="middle" fontFamily="Manrope, sans-serif">n={g.n}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Ridge Plot ────────────────────────────────────────────────
function RidgePlot({ data, config: _config, expanded }: { data: ViolinGroup[]; config: Record<string, unknown>; expanded: boolean }) {
  const cfg = useCfg()
  const C = cfg.colors

  if (!data || data.length === 0) return <p className="text-xs py-4 text-center" style={{ color: CHART_TOKENS.text.muted }}>No data</p>

  const kdeGroups = data.map((g, i) => ({
    group: g.group,
    color: C[i % C.length] ?? chartColor(i),
    kde: computeKDE(g.values),
  }))

  const allX = kdeGroups.flatMap(g => g.kde.map(p => p.x))
  if (allX.length === 0) return null

  const xMin = Math.min(...allX)
  const xMax = Math.max(...allX)
  const nGroups = kdeGroups.length
  const H = cfg.height ?? (expanded ? 420 : Math.max(200, nGroups * 60 + 60))
  const W = 600
  const PAD = { t: 10, r: 20, b: 40, l: 110 }
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b
  const rowH = plotH / nGroups

  const toSvgX = (x: number) => PAD.l + ((x - xMin) / (xMax - xMin || 1)) * plotW

  const enriched = kdeGroups.map((g, gi) => {
    const maxY = Math.max(...g.kde.map(p => p.y)) || 1
    const baseline = PAD.t + (gi + 1) * rowH
    return { ...g, baseline, toSvgY: (y: number) => baseline - (y / maxY) * rowH * 1.4 }
  })

  const nTicks = 5
  const xTicks = Array.from({ length: nTicks }, (_, i) => xMin + (i / (nTicks - 1)) * (xMax - xMin))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', overflow: 'visible' }}>
      {cfg.showGrid && xTicks.map((v, i) => {
        const sx = toSvgX(v)
        return <line key={i} x1={sx} y1={PAD.t} x2={sx} y2={PAD.t + plotH} stroke={CHART_TOKENS.grid} strokeWidth={1} strokeDasharray="3 5" />
      })}
      {[...enriched].reverse().map(g => {
        if (g.kde.length === 0) return null
        const pts = g.kde.map(p => ({ sx: toSvgX(p.x), sy: g.toSvgY(p.y) }))
        const curve = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`).join(' ')
        const close = ` L ${pts[pts.length - 1].sx.toFixed(1)} ${g.baseline} L ${pts[0].sx.toFixed(1)} ${g.baseline} Z`
        return (
          <g key={g.group}>
            <path d={curve + close} fill={g.color} fillOpacity={0.22} stroke={g.color} strokeWidth={2} strokeOpacity={0.8} />
            <line x1={PAD.l} y1={g.baseline} x2={W - PAD.r} y2={g.baseline} stroke={CHART_TOKENS.border} strokeWidth={0.5} />
            <text x={PAD.l - 8} y={g.baseline - 4} fontSize={11} fill={CHART_TOKENS.text.secondary} textAnchor="end" fontFamily="Manrope, sans-serif" fontWeight={500}>
              {g.group.length > 16 ? g.group.slice(0, 14) + '…' : g.group}
            </text>
          </g>
        )
      })}
      <line x1={PAD.l} y1={PAD.t + plotH} x2={W - PAD.r} y2={PAD.t + plotH} stroke={CHART_TOKENS.border} strokeWidth={1} />
      {xTicks.map((v, i) => {
        const sx = toSvgX(v)
        return (
          <g key={i}>
            <line x1={sx} y1={PAD.t + plotH} x2={sx} y2={PAD.t + plotH + 4} stroke={CHART_TOKENS.border} strokeWidth={1} />
            <text x={sx} y={PAD.t + plotH + 14} fontSize={9} fill={CHART_TOKENS.text.muted} textAnchor="middle" fontFamily="Manrope, sans-serif">{v.toFixed(1)}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Correlogram ───────────────────────────────────────────────
function CorrelogramChart({ data, config }: { data: HeatmapData[]; config: Record<string, unknown> }) {
  const variables = (config.variables as string[]) ?? []
  const n = variables.length
  if (n === 0) return null

  const cellSize = Math.min(72, Math.max(36, 380 / n))
  const labelW = Math.min(110, Math.max(60, cellSize * 1.3))

  function stars(p: number): string {
    if (p < 0.001) return '***'
    if (p < 0.01) return '**'
    if (p < 0.05) return '*'
    return ''
  }

  const getCell = (v1: string, v2: string) => data.find(d => d.x === v1 && d.y === v2)

  return (
    <div className="overflow-x-auto py-2">
      <div style={{ display: 'grid', gridTemplateColumns: `${labelW}px repeat(${n}, ${cellSize}px)`, gap: 3 }}>
        <div />
        {variables.map(v => (
          <div key={v} className="text-[9px] font-semibold text-center overflow-hidden text-ellipsis whitespace-nowrap"
            style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }} title={v}>
            {v.length > 9 ? v.slice(0, 7) + '…' : v}
          </div>
        ))}
        {variables.map((v1, i) => (
          <Fragment key={v1}>
            <div className="text-[9px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap flex items-center pr-1"
              style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}>{v1}</div>
            {variables.map((v2, j) => {
              const cell = getCell(v1, v2)
              const r = cell?.r ?? (i === j ? 1 : 0)
              const p = cell?.p ?? 1
              const isDiag = i === j
              const isUpper = j > i

              if (isDiag) {
                return (
                  <div key={v2} className="rounded-lg flex items-center justify-center"
                    style={{ width: cellSize, height: cellSize, background: '#f5f5f5', border: `1px solid ${CHART_TOKENS.border}` }}>
                    <span className="text-[9px] font-bold text-center px-0.5" style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif', lineHeight: 1.2 }}>
                      {v1.length > 8 ? v1.slice(0, 6) + '…' : v1}
                    </span>
                  </div>
                )
              }

              if (isUpper) {
                const absR = Math.abs(r)
                const textColor = r > 0 ? chartColor(0) : chartColor(4)
                return (
                  <div key={v2} className="rounded-lg flex flex-col items-center justify-center gap-0.5"
                    style={{ width: cellSize, height: cellSize, background: '#fafafa', border: `1px solid ${CHART_TOKENS.border}` }}>
                    <span className="text-[10px] font-bold tabular-nums" style={{ color: absR >= 0.3 ? textColor : CHART_TOKENS.text.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                      {r.toFixed(2)}
                    </span>
                    {stars(p) && (
                      <span className="text-[9px] font-bold leading-none" style={{ color: chartColor(4) }}>{stars(p)}</span>
                    )}
                  </div>
                )
              }

              const absR = Math.abs(r)
              const fill = r > 0 ? chartColor(0) : chartColor(4)
              const circR = absR * (cellSize * 0.38) + cellSize * 0.04
              return (
                <div key={v2} className="rounded-lg flex items-center justify-center cursor-default"
                  title={`r = ${r.toFixed(3)}, p = ${p.toFixed(4)}`}
                  style={{ width: cellSize, height: cellSize, background: '#fafafa', border: `1px solid ${CHART_TOKENS.border}` }}>
                  <svg width={cellSize - 6} height={cellSize - 6} style={{ overflow: 'visible' }}>
                    <circle
                      cx={(cellSize - 6) / 2} cy={(cellSize - 6) / 2} r={circR}
                      fill={fill} fillOpacity={0.15 + absR * 0.65}
                      stroke={fill} strokeWidth={1} strokeOpacity={0.4 + absR * 0.4}
                    />
                  </svg>
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
      <div className="flex items-center gap-5 mt-4 px-1 flex-wrap">
        {[{ color: chartColor(0), label: 'Positive' }, { color: chartColor(4), label: 'Negative' }].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color, opacity: 0.75 }} />
            <span className="text-[10px]" style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}>{label}</span>
          </div>
        ))}
        <span className="text-[10px] ml-2" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>
          * p&lt;.05 &nbsp; ** p&lt;.01 &nbsp; *** p&lt;.001 (upper triangle)
        </span>
      </div>
    </div>
  )
}

// ── Dumbbell Chart ────────────────────────────────────────────
interface DumbbellPoint { label: string; value1: number; value2: number }

function DumbbellChart({ data, config }: { data: DumbbellPoint[]; config: Record<string, unknown> }) {
  const cfg = useCfg()
  const C = cfg.colors
  const label1 = (config.label1 as string) ?? 'Group 1'
  const label2 = (config.label2 as string) ?? 'Group 2'

  if (!data || data.length === 0) return <p className="text-xs py-4 text-center" style={{ color: CHART_TOKENS.text.muted }}>No data</p>

  const allVals = data.flatMap(d => [d.value1, d.value2]).filter(v => isFinite(v))
  if (allVals.length === 0) return null

  const rowH = 44
  const W = 560
  const PAD = { t: 30, r: 60, b: 30, l: 120 }
  const plotW = W - PAD.l - PAD.r
  const H = data.length * rowH + PAD.t + PAD.b

  const xMin = Math.min(...allVals)
  const xMax = Math.max(...allVals)
  const pad = (xMax - xMin) * 0.18 || 1
  const domMin = xMin - pad
  const domMax = xMax + pad

  const toSvgX = (v: number) => PAD.l + ((v - domMin) / (domMax - domMin)) * plotW

  const nTicks = 5
  const xTicks = Array.from({ length: nTicks }, (_, i) => domMin + (i / (nTicks - 1)) * (domMax - domMin))

  const c1 = C[0] ?? chartColor(0)
  const c2 = C[1] ?? chartColor(1)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
        {xTicks.map((v, i) => {
          const sx = toSvgX(v)
          return (
            <g key={i}>
              {cfg.showGrid && <line x1={sx} y1={PAD.t} x2={sx} y2={H - PAD.b} stroke={CHART_TOKENS.grid} strokeWidth={1} strokeDasharray="3 5" />}
              <line x1={sx} y1={H - PAD.b} x2={sx} y2={H - PAD.b + 4} stroke={CHART_TOKENS.border} strokeWidth={1} />
              <text x={sx} y={H - PAD.b + 14} fontSize={9} fill={CHART_TOKENS.text.muted} textAnchor="middle" fontFamily="Manrope, sans-serif">{v.toFixed(2)}</text>
            </g>
          )
        })}
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke={CHART_TOKENS.border} strokeWidth={1} />
        {data.map((d, i) => {
          const cy = PAD.t + i * rowH + rowH / 2
          const sx1 = toSvgX(d.value1)
          const sx2 = toSvgX(d.value2)
          const diff = d.value2 - d.value1
          const bg = i % 2 === 1 ? '#f7f9fb' : '#ffffff'
          const lineColor = diff >= 0 ? c2 : c1
          return (
            <g key={d.label}>
              <rect x={PAD.l} y={cy - rowH / 2} width={plotW} height={rowH} fill={bg} />
              <text x={PAD.l - 8} y={cy + 4} fontSize={11} fill={CHART_TOKENS.text.primary} textAnchor="end" fontFamily="Manrope, sans-serif" fontWeight={500}>
                {d.label.length > 16 ? d.label.slice(0, 14) + '…' : d.label}
              </text>
              <line x1={sx1} y1={cy} x2={sx2} y2={cy} stroke={lineColor} strokeWidth={2.5} strokeOpacity={0.45} />
              <circle cx={sx1} cy={cy} r={7} fill={c1} fillOpacity={0.9} stroke="#fff" strokeWidth={2} />
              <circle cx={sx2} cy={cy} r={7} fill={c2} fillOpacity={0.9} stroke="#fff" strokeWidth={2} />
              <text x={Math.max(sx1, sx2) + 12} y={cy + 4} fontSize={9} fill={lineColor} fontFamily="'JetBrains Mono', monospace" fontWeight={700}>
                {diff >= 0 ? '+' : ''}{diff.toFixed(2)}
              </text>
            </g>
          )
        })}
      </svg>
      {cfg.showLegend && (
        <div className="flex justify-center gap-6 mt-3">
          {[{ color: c1, label: label1 }, { color: c2, label: label2 }].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <span className="text-[11px]" style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
