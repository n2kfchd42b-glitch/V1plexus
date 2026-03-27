"use client"

import { useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  ResponsiveContainer, Cell, ComposedChart, Area, AreaChart,
  ErrorBar
} from 'recharts'
import { Maximize2, Minimize2 } from 'lucide-react'

type ChartSpec = {
  type: string
  title: string
  data: unknown[]
  config: Record<string, unknown>
}

// Premium color palette with gradients
const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#84cc16']
const GRADIENT_COLORS = [
  { start: '#3b82f6', end: '#1d4ed8' },
  { start: '#8b5cf6', end: '#6d28d9' },
  { start: '#06b6d4', end: '#0891b2' },
  { start: '#10b981', end: '#059669' },
]

interface Props {
  charts: ChartSpec[]
}

export function AnalysisCharts({ charts }: Props) {
  if (!charts || charts.length === 0) return null
  return (
    <div className="space-y-6">
      {charts.map((chart, idx) => (
        <ChartRenderer key={idx} chart={chart} index={idx} />
      ))}
    </div>
  )
}

// ── Custom Tooltip ──────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-white/95 backdrop-blur-md rounded-xl border border-slate-200 shadow-xl p-3 min-w-[140px]">
      {label && <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{label}</p>}
      <div className="space-y-1.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-xs text-muted-foreground">{entry.name}</span>
            </div>
            <span className="text-xs font-bold text-foreground">
              {typeof entry.value === 'number' ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 4 }) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Chart Wrapper with expand ────────────────────────────────
function ChartRenderer({ chart, index }: { chart: ChartSpec; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const { type, title, data, config } = chart

  return (
    <div className={`group relative bg-white border border-[#E4E4E7] rounded-lg overflow-hidden transition-all duration-150 ${expanded ? 'shadow-[0_8px_24px_rgba(0,0,0,0.08)]' : 'hover:shadow-[0_4px_12px_rgba(0,82,204,0.06)]'}`}>
      {/* Chart Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div>
          <h4 className="font-manrope font-bold text-sm text-[#18181B]">{title}</h4>
          <p className="text-[10px] text-[#A1A1AA] uppercase tracking-wider font-medium mt-0.5">
            Interactive visualization
          </p>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="p-2 rounded-lg hover:bg-slate-100 text-muted-foreground hover:text-foreground transition-colors"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Chart Body */}
      <div className={`px-5 pb-5 ${expanded ? 'min-h-[500px]' : ''}`}>
        {type === 'histogram' && <HistogramChart data={data as { x0: number; x1: number; count: number }[]} expanded={expanded} />}
        {type === 'bar' && <FrequencyBarChart data={data as { value: string; count: number; percent: string | number }[]} expanded={expanded} />}
        {type === 'grouped_bar' && <GroupedBarChart data={data as Record<string, unknown>[]} config={config} expanded={expanded} />}
        {type === 'scatter_regression' && <ScatterRegressionChart data={data as Record<string, unknown>[]} config={config} expanded={expanded} />}
        {type === 'residual_plot' && <ResidualChart data={data as Record<string, unknown>[]} expanded={expanded} />}
        {type === 'coefficient_plot' && <CoefficientPlot data={data as CoefficientPlotData[]} isOR={false} expanded={expanded} />}
        {type === 'forest_or' && <CoefficientPlot data={data as CoefficientPlotData[]} isOR label="OR" nullLine={1} expanded={expanded} />}
        {type === 'forest_hr' && <CoefficientPlot data={data as CoefficientPlotData[]} isOR label="HR" nullLine={1} expanded={expanded} />}
        {type === 'forest_irr' && <CoefficientPlot data={data as CoefficientPlotData[]} isOR label="IRR" nullLine={1} expanded={expanded} />}
        {type === 'forest_meta' && <ForestPlot data={data as ForestPlotData[]} config={config} expanded={expanded} />}
        {type === 'funnel_plot' && <FunnelPlot data={data as { es: number; se: number }[]} config={config} expanded={expanded} />}
        {type === 'roc_curve' && <ROCCurve data={data as { fpr: number; tpr: number }[]} config={config} expanded={expanded} />}
        {type === 'km_curve' && <KMCurve data={data as KMPoint[]} config={config} expanded={expanded} />}
        {type === 'heatmap' && <CorrelationHeatmap data={data as HeatmapData[]} config={config} />}
        {type === 'time_series' && <TimeSeriesChart data={data as Record<string, unknown>[]} config={config} expanded={expanded} />}
        {type === 'scree_plot' && <ScreePlot data={data as { component: number; eigenvalue: number; varExplained: number }[]} expanded={expanded} />}
        {type === 'cluster_scatter' && <ClusterScatter data={data as { pc1: number; pc2: number; cluster: number }[]} config={config} expanded={expanded} />}
        {type === 'power_curve' && <PowerCurve data={data as { n: number; power: number }[]} config={config} expanded={expanded} />}
        {type === 'epi_curve' && <EpiCurve data={data as Record<string, unknown>[]} config={config} expanded={expanded} />}
        {type === 'acf_plot' && <ACFChart data={data as { lag: number; acf: number }[]} config={config} expanded={expanded} />}
        {type === 'biplot' && <Biplot data={data as unknown as BiplotData} config={config} expanded={expanded} />}
        {type === 'boxplot_2group' && <BoxPlot2Group data={data as unknown as Record<string, unknown>} expanded={expanded} />}
        {type === 'boxplot_groups' && <BoxPlotGroups data={data as unknown as Record<string, unknown>} expanded={expanded} />}
        {type === 'mosaic' && <MosaicPlot data={data as Record<string, unknown>[]} config={config} expanded={expanded} />}
      </div>
    </div>
  )
}

// ── Shared axis tick style ──────────────────────────────────
const axisTick = { fontSize: 11, fill: '#64748b' }
const axisLabel = { fontSize: 12, fill: '#475569' }
const gridStyle = { stroke: '#e2e8f0', strokeDasharray: '3 6' }

function chartHeight(expanded: boolean, base: number = 300) {
  return expanded ? Math.max(base, 480) : base
}

// ── Gradient Definitions ────────────────────────────────────
function ChartGradients() {
  return (
    <defs>
      <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
        <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
      </linearGradient>
    </defs>
  )
}

// ── Histogram ────────────────────────────────────────────────
function HistogramChart({ data, expanded }: { data: { x0: number; x1: number; count: number }[]; expanded: boolean }) {
  const d = data.map(b => ({ name: b.x0.toFixed(1), count: b.count }))
  return (
    <ResponsiveContainer width="100%" height={chartHeight(expanded, 280)}>
      <BarChart data={d} barCategoryGap="4%">
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey="name" tick={axisTick} />
        <YAxis tick={axisTick} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="count" fill={COLORS[0]} radius={[4, 4, 0, 0]} animationDuration={800}>
          {d.map((_, i) => (
            <Cell key={i} fill={COLORS[0]} fillOpacity={0.7 + (i / d.length) * 0.3} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Frequency Bar ────────────────────────────────────────────
function FrequencyBarChart({ data, expanded }: { data: { value: string; count: number; percent: number | string }[]; expanded: boolean }) {
  const top = data.slice(0, 20)
  return (
    <ResponsiveContainer width="100%" height={Math.max(chartHeight(expanded, 200), top.length * 36)}>
      <BarChart data={top} layout="vertical" margin={{ left: 8 }}>
        <CartesianGrid {...gridStyle} horizontal={false} />
        <XAxis type="number" tick={axisTick} />
        <YAxis type="category" dataKey="value" tick={axisTick} width={120} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} animationDuration={800}>
          {top.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Grouped Bar ──────────────────────────────────────────────
function GroupedBarChart({ data, config, expanded }: { data: Record<string, unknown>[]; config: Record<string, unknown>; expanded: boolean }) {
  const rows = (config.rowCats as string[]) ?? []
  const cols = (config.colCats as string[]) ?? []
  if (!rows.length || !cols.length) return <p className="text-xs text-muted-foreground">No chart data</p>
  const pivoted = rows.map(row => {
    const entry: Record<string, unknown> = { row }
    cols.forEach(col => {
      const d = data.find((x: Record<string, unknown>) => x.row === row && x.col === col)
      entry[col] = (d as Record<string, unknown> | undefined)?.count ?? 0
    })
    return entry
  })
  return (
    <ResponsiveContainer width="100%" height={chartHeight(expanded, 320)}>
      <BarChart data={pivoted}>
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey="row" tick={axisTick} />
        <YAxis tick={axisTick} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
        {cols.map((col, i) => <Bar key={col} dataKey={col} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} animationDuration={800} />)}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Scatter + Regression ─────────────────────────────────────
function ScatterRegressionChart({ data, config, expanded }: { data: Record<string, unknown>[]; config: Record<string, unknown>; expanded: boolean }) {
  const lineData = data.map(d => ({ x: d.x, y: d.yHat })).sort((a, b) => (a.x as number) - (b.x as number))
  return (
    <ResponsiveContainer width="100%" height={chartHeight(expanded, 340)}>
      <ComposedChart>
        <ChartGradients />
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey="x" type="number" name="X" tick={axisTick} />
        <YAxis tick={axisTick} />
        <Tooltip content={<CustomTooltip />} />
        <Area data={lineData} type="monotone" dataKey="y" fill="url(#blueGrad)" stroke="none" />
        <Scatter data={data as Record<string, unknown>[]} fill={COLORS[0]} opacity={0.6} animationDuration={800} />
        <Line data={lineData} type="monotone" dataKey="y" stroke={COLORS[1]} dot={false} strokeWidth={2.5} animationDuration={800} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ── Residual Plot ────────────────────────────────────────────
function ResidualChart({ data, expanded }: { data: Record<string, unknown>[]; expanded: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={chartHeight(expanded, 280)}>
      <ScatterChart>
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey="fitted" name="Fitted" tick={axisTick} label={{ value: 'Fitted Values', position: 'bottom', ...axisLabel }} />
        <YAxis dataKey="residual" name="Residual" tick={axisTick} label={{ value: 'Residuals', angle: -90, position: 'insideLeft', ...axisLabel }} />
        <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="6 4" />
        <Tooltip content={<CustomTooltip />} />
        <Scatter data={data} fill={COLORS[0]} opacity={0.5} animationDuration={800} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

// ── Coefficient Plot ─────────────────────────────────────────
interface CoefficientPlotData { name: string; estimate?: number; or?: number; hr?: number; irr?: number; ciLow: number; ciHigh: number; p: string; sig?: string }

function CoefficientPlot({ data, isOR, label, nullLine, expanded }: { data: CoefficientPlotData[]; isOR: boolean; label?: string; nullLine?: number; expanded: boolean }) {
  const plotData = data.map(d => ({
    name: d.name,
    value: d.or ?? d.hr ?? d.irr ?? d.estimate ?? 0,
    error: [((d.or ?? d.hr ?? d.irr ?? d.estimate ?? 0) - d.ciLow), (d.ciHigh - (d.or ?? d.hr ?? d.irr ?? d.estimate ?? 0))] as [number, number],
    ciLow: d.ciLow, ciHigh: d.ciHigh, p: d.p
  }))

  const allValues = plotData.flatMap(d => [d.value, d.ciLow, d.ciHigh]).filter(v => isFinite(v))
  const domain: [number, number] = [Math.min(...allValues) * 0.9, Math.max(...allValues) * 1.1]

  return (
    <ResponsiveContainer width="100%" height={Math.max(chartHeight(expanded, 160), plotData.length * 40)}>
      <BarChart data={plotData} layout="vertical" margin={{ left: 130, right: 40 }}>
        <CartesianGrid {...gridStyle} horizontal={false} />
        <XAxis type="number" domain={domain} tick={axisTick} />
        <YAxis type="category" dataKey="name" tick={axisTick} width={120} />
        {nullLine !== undefined && <ReferenceLine x={nullLine} stroke="#94a3b8" strokeDasharray="6 4" />}
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="value" fill={COLORS[0]} radius={[0, 4, 4, 0]} animationDuration={800}>
          <ErrorBar dataKey="error" width={5} strokeWidth={2} stroke={COLORS[0]} direction="x" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Forest Plot (meta-analysis) ──────────────────────────────
interface ForestPlotData { label: string; es: number; ciLow: number; ciHigh: number; weight: number; isSummary: boolean }

function ForestPlot({ data, config, expanded }: { data: ForestPlotData[]; config: Record<string, unknown>; expanded: boolean }) {
  const plotData = data.map(d => ({
    name: d.label, value: d.es, ciLow: d.ciLow, ciHigh: d.ciHigh, weight: d.weight, isSummary: d.isSummary,
    error: [(d.es - d.ciLow), (d.ciHigh - d.es)] as [number, number]
  }))
  const allV = plotData.flatMap(d => [d.ciLow, d.ciHigh]).filter(isFinite)
  const domain: [number, number] = [Math.min(...allV) - 0.1, Math.max(...allV) + 0.1]
  return (
    <ResponsiveContainer width="100%" height={Math.max(chartHeight(expanded, 200), plotData.length * 36)}>
      <BarChart data={plotData} layout="vertical" margin={{ left: 130, right: 40 }}>
        <CartesianGrid {...gridStyle} horizontal={false} />
        <XAxis type="number" domain={domain} tick={axisTick} />
        <YAxis type="category" dataKey="name" tick={axisTick} width={120} />
        <ReferenceLine x={0} stroke="#94a3b8" strokeDasharray="6 4" />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="value" animationDuration={800} radius={[0, 4, 4, 0]}>
          {plotData.map((d, i) => <Cell key={i} fill={d.isSummary ? COLORS[1] : COLORS[0]} fillOpacity={d.isSummary ? 1 : 0.8} />)}
          <ErrorBar dataKey="error" width={5} strokeWidth={2} stroke={COLORS[0]} direction="x" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Funnel Plot ──────────────────────────────────────────────
function FunnelPlot({ data, config, expanded }: { data: { es: number; se: number }[]; config: Record<string, unknown>; expanded: boolean }) {
  const summaryES = (config.summaryES as number) ?? 0
  return (
    <ResponsiveContainer width="100%" height={chartHeight(expanded, 300)}>
      <ScatterChart>
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey="es" name="Effect Size" tick={axisTick} label={{ value: 'Effect Size', position: 'bottom', ...axisLabel }} />
        <YAxis dataKey="se" name="SE" reversed tick={axisTick} label={{ value: 'Standard Error', angle: -90, position: 'insideLeft', ...axisLabel }} />
        <ReferenceLine x={summaryES} stroke={COLORS[1]} strokeDasharray="6 4" />
        <Tooltip content={<CustomTooltip />} />
        <Scatter data={data} fill={COLORS[0]} opacity={0.7} animationDuration={800} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

// ── ROC Curve ────────────────────────────────────────────────
function ROCCurve({ data, config, expanded }: { data: { fpr: number; tpr: number }[]; config: Record<string, unknown>; expanded: boolean }) {
  const auc = (config.auc as number)?.toFixed(3)
  return (
    <div>
      <ResponsiveContainer width="100%" height={chartHeight(expanded, 340)}>
        <AreaChart data={data}>
          <ChartGradients />
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="fpr" name="FPR" tick={axisTick} domain={[0, 1]} label={{ value: '1 - Specificity (FPR)', position: 'bottom', ...axisLabel }} />
          <YAxis dataKey="tpr" name="TPR" tick={axisTick} domain={[0, 1]} label={{ value: 'Sensitivity (TPR)', angle: -90, position: 'insideLeft', ...axisLabel }} />
          <ReferenceLine x={0} y={0} stroke="#cbd5e1" />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="tpr" fill="url(#blueGrad)" stroke={COLORS[0]} strokeWidth={2.5} dot={false} name={`AUC = ${auc}`} animationDuration={800} />
        </AreaChart>
      </ResponsiveContainer>
      {auc && (
        <div className="mt-3 flex justify-center">
          <div className="bg-primary/5 border border-primary/10 rounded-xl px-4 py-2 inline-flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">AUC</span>
            <span className="text-lg font-extrabold text-foreground">{auc}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Kaplan-Meier ─────────────────────────────────────────────
interface KMPoint { time: number; survival: number; ciLow: number; ciHigh: number; group: string }

function KMCurve({ data, config, expanded }: { data: KMPoint[]; config: Record<string, unknown>; expanded: boolean }) {
  const groups = (config.groups as string[]) ?? ['All']
  const logRankP = config.logRankP
  return (
    <div>
      <ResponsiveContainer width="100%" height={chartHeight(expanded, 360)}>
        <LineChart>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="time" type="number" tick={axisTick} label={{ value: 'Time', position: 'bottom', ...axisLabel }} />
          <YAxis domain={[0, 1]} tick={axisTick} label={{ value: 'Survival Probability', angle: -90, position: 'insideLeft', ...axisLabel }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
          {groups.map((group, i) => (
            <Line
              key={group}
              data={data.filter(d => d.group === group)}
              type="stepAfter"
              dataKey="survival"
              name={group}
              stroke={COLORS[i % COLORS.length]}
              dot={false}
              strokeWidth={2.5}
              animationDuration={800}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {!!logRankP && (
        <div className="mt-3 flex justify-center">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 inline-flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Log-rank p</span>
            <span className="text-base font-bold text-foreground">{String(logRankP)}</span>
          </div>
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

  const cellSize = Math.min(64, Math.max(36, 360 / n))

  return (
    <div className="overflow-x-auto py-2">
      <div style={{ display: 'grid', gridTemplateColumns: `100px repeat(${n}, ${cellSize}px)`, gap: 3 }}>
        <div />
        {variables.map(v => (
          <div key={v} className="text-[10px] font-semibold text-center text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap" title={v}>{v}</div>
        ))}
        {variables.map((v1, i) => (
          <>
            <div key={`label-${v1}`} className="text-[10px] font-semibold text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap flex items-center">{v1}</div>
            {variables.map((v2, j) => {
              const cell = data.find(d => d.x === v1 && d.y === v2)
              const r = cell?.r ?? (i === j ? 1 : 0)
              const intensity = Math.abs(r)
              const bg = i === j
                ? '#f1f5f9'
                : r > 0
                  ? `rgba(59,130,246,${intensity * 0.8})`
                  : `rgba(239,68,68,${intensity * 0.8})`
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
                    fontWeight: 600,
                    color: i === j ? '#64748b' : intensity > 0.4 ? 'white' : '#334155',
                  }}
                >
                  {i === j ? '1' : r.toFixed(2)}
                </div>
              )
            })}
          </>
        ))}
      </div>
    </div>
  )
}

// ── Time Series ──────────────────────────────────────────────
function TimeSeriesChart({ data, config, expanded }: { data: Record<string, unknown>[]; config: Record<string, unknown>; expanded: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={chartHeight(expanded, 320)}>
      <ComposedChart data={data}>
        <ChartGradients />
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey="date" tick={{ ...axisTick, fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={axisTick} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
        <Area type="monotone" dataKey="observed" fill="url(#blueGrad)" stroke={COLORS[0]} strokeWidth={2} dot={false} name="Observed" animationDuration={800} />
        <Line type="monotone" dataKey="trend" stroke={COLORS[1]} dot={false} strokeWidth={2.5} name="Trend" strokeDasharray="8 4" animationDuration={800} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ── Scree Plot ───────────────────────────────────────────────
function ScreePlot({ data, expanded }: { data: { component: number; eigenvalue: number; varExplained: number }[]; expanded: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={chartHeight(expanded, 280)}>
      <ComposedChart data={data}>
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey="component" tick={axisTick} label={{ value: 'Component', position: 'bottom', ...axisLabel }} />
        <YAxis tick={axisTick} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
        <Bar dataKey="eigenvalue" fill={COLORS[0]} name="Eigenvalue" radius={[4, 4, 0, 0]} animationDuration={800} />
        <Line type="monotone" dataKey="varExplained" stroke={COLORS[1]} dot={{ r: 4, fill: COLORS[1] }} name="% Variance" strokeWidth={2.5} animationDuration={800} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ── Cluster Scatter ──────────────────────────────────────────
function ClusterScatter({ data, config, expanded }: { data: { pc1: number; pc2: number; cluster: number }[]; config: Record<string, unknown>; expanded: boolean }) {
  const nClusters = (config.nClusters as number) ?? 3
  const clusterData = Array.from({ length: nClusters }, (_, i) => ({
    name: `Cluster ${i + 1}`,
    data: data.filter(d => d.cluster === i + 1)
  }))
  return (
    <ResponsiveContainer width="100%" height={chartHeight(expanded, 320)}>
      <ScatterChart>
        <CartesianGrid {...gridStyle} />
        <XAxis type="number" dataKey="pc1" name="PC1" tick={axisTick} />
        <YAxis type="number" dataKey="pc2" name="PC2" tick={axisTick} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
        {clusterData.map((c, i) => (
          <Scatter key={c.name} name={c.name} data={c.data} fill={COLORS[i % COLORS.length]} opacity={0.7} animationDuration={800} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  )
}

// ── Power Curve ──────────────────────────────────────────────
function PowerCurve({ data, config, expanded }: { data: { n: number; power: number }[]; config: Record<string, unknown>; expanded: boolean }) {
  const targetPower = (config.targetPower as number) ?? 0.8
  const targetN = (config.targetN as number)
  return (
    <div>
      <ResponsiveContainer width="100%" height={chartHeight(expanded, 280)}>
        <AreaChart data={data}>
          <ChartGradients />
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="n" tick={axisTick} label={{ value: 'Sample Size (n)', position: 'bottom', ...axisLabel }} />
          <YAxis domain={[0, 1]} tick={axisTick} label={{ value: 'Power', angle: -90, position: 'insideLeft', ...axisLabel }} />
          <ReferenceLine y={targetPower} stroke={COLORS[3]} strokeDasharray="6 4" label={{ value: `${targetPower * 100}%`, fontSize: 11, fill: COLORS[3] }} />
          {targetN && <ReferenceLine x={targetN} stroke={COLORS[1]} strokeDasharray="6 4" />}
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="power" fill="url(#blueGrad)" stroke={COLORS[0]} strokeWidth={2.5} dot={false} animationDuration={800} />
        </AreaChart>
      </ResponsiveContainer>
      {targetN && (
        <div className="mt-3 flex justify-center gap-4">
          <div className="bg-primary/5 border border-primary/10 rounded-xl px-4 py-2 inline-flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Required N</span>
            <span className="text-lg font-extrabold text-foreground">{targetN}</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 inline-flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Target Power</span>
            <span className="text-lg font-extrabold text-foreground">{(targetPower * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Epidemic Curve ───────────────────────────────────────────
function EpiCurve({ data, config, expanded }: { data: Record<string, unknown>[]; config: Record<string, unknown>; expanded: boolean }) {
  const classifications = (config.classifications as string[]) ?? ['Case']
  return (
    <ResponsiveContainer width="100%" height={chartHeight(expanded, 300)}>
      <BarChart data={data}>
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey="date" tick={{ ...axisTick, fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={axisTick} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
        {classifications.map((cls, i) => (
          <Bar key={cls} dataKey={cls} stackId="a" fill={COLORS[i % COLORS.length]} name={cls} radius={i === classifications.length - 1 ? [4, 4, 0, 0] : undefined} animationDuration={800} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── ACF Chart ────────────────────────────────────────────────
function ACFChart({ data, config, expanded }: { data: { lag: number; acf: number }[]; config: Record<string, unknown>; expanded: boolean }) {
  const n = (config.n as number) ?? 100
  const ci = 1.96 / Math.sqrt(n)
  return (
    <ResponsiveContainer width="100%" height={chartHeight(expanded, 250)}>
      <BarChart data={data}>
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey="lag" tick={axisTick} label={{ value: 'Lag', position: 'bottom', ...axisLabel }} />
        <YAxis domain={[-1, 1]} tick={axisTick} />
        <ReferenceLine y={ci} stroke={COLORS[1]} strokeDasharray="6 4" />
        <ReferenceLine y={-ci} stroke={COLORS[1]} strokeDasharray="6 4" />
        <ReferenceLine y={0} stroke="#94a3b8" />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="acf" fill={COLORS[0]} radius={[4, 4, 0, 0]} animationDuration={800}>
          {data.map((d, i) => (
            <Cell key={i} fill={Math.abs(d.acf) > ci ? COLORS[5] : COLORS[0]} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Biplot ────────────────────────────────────────────────────
interface BiplotData { scores: { id: number; pc1: number; pc2: number }[]; loadings: { variable: string; pc1: number; pc2: number }[] }

function Biplot({ data, config, expanded }: { data: BiplotData; config: Record<string, unknown>; expanded: boolean }) {
  if (!data || !data.scores) return null
  const sample = data.scores.slice(0, 500)
  return (
    <ResponsiveContainer width="100%" height={chartHeight(expanded, 340)}>
      <ScatterChart>
        <CartesianGrid {...gridStyle} />
        <XAxis type="number" dataKey="pc1" name="PC1" tick={axisTick} />
        <YAxis type="number" dataKey="pc2" name="PC2" tick={axisTick} />
        <Tooltip content={<CustomTooltip />} />
        <Scatter data={sample} fill={COLORS[0]} opacity={0.4} animationDuration={800} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

// ── Box Plot (2 groups) ──────────────────────────────────────
function BoxPlot2Group({ data, expanded }: { data: Record<string, unknown>; expanded: boolean }) {
  const groups = (data.groups as { group: string; mean: number; sd: number }[]) ?? []
  if (!groups.length) return null
  const plotData = groups.map(g => ({ name: g.group, mean: g.mean, error: g.sd }))
  return (
    <ResponsiveContainer width="100%" height={chartHeight(expanded, 280)}>
      <BarChart data={plotData}>
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey="name" tick={axisTick} />
        <YAxis tick={axisTick} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="mean" radius={[4, 4, 0, 0]} animationDuration={800}>
          {plotData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />)}
          <ErrorBar dataKey="error" width={6} strokeWidth={2} stroke="#475569" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Box Plot (multiple groups) ───────────────────────────────
function BoxPlotGroups({ data, expanded }: { data: Record<string, unknown>; expanded: boolean }) {
  const groupData = (data.data as { group: string; mean: number; sd: number }[]) ?? []
  if (!groupData.length) return null
  return (
    <ResponsiveContainer width="100%" height={chartHeight(expanded, 280)}>
      <BarChart data={groupData}>
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey="group" tick={axisTick} />
        <YAxis tick={axisTick} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="mean" radius={[4, 4, 0, 0]} animationDuration={800}>
          {groupData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />)}
          <ErrorBar dataKey="sd" width={6} strokeWidth={2} stroke="#475569" />
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
