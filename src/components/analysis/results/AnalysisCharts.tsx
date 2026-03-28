"use client"

import { useState, Fragment } from 'react'
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

// Chart types that should always span the full grid width
const FULL_WIDTH_CHART_TYPES = new Set([
  'km_curve', 'time_series', 'heatmap', 'biplot',
  'epi_curve', 'mosaic', 'roc_curve', 'forest_meta',
  'forest_or', 'forest_hr', 'forest_irr', 'coefficient_plot',
])

export function AnalysisCharts({ charts }: Props) {
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
          <ChartRenderer chart={chart} index={idx} />
        </div>
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
const SUPPORTED_CHART_TYPES = new Set([
  'histogram', 'bar', 'grouped_bar', 'scatter_regression', 'residual_plot',
  'coefficient_plot', 'forest_or', 'forest_hr', 'forest_irr', 'forest_meta',
  'funnel_plot', 'roc_curve', 'km_curve', 'heatmap', 'time_series',
  'scree_plot', 'cluster_scatter', 'power_curve', 'epi_curve', 'acf_plot',
  'biplot', 'boxplot_2group', 'boxplot_groups', 'mosaic',
])

function ChartRenderer({ chart, index }: { chart: ChartSpec; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const { type, title, data, config } = chart

  if (!SUPPORTED_CHART_TYPES.has(type)) return null

  return (
    <div
      className={`bg-white rounded-2xl overflow-hidden h-full transition-all duration-200 ${expanded ? '' : 'hover:-translate-y-0.5'}`}
      style={{ boxShadow: '0 20px 50px rgba(0,24,72,0.04), 0 4px 12px rgba(0,24,72,0.03)' }}
    >
      {/* Chart Header */}
      <div className="flex items-start justify-between px-7 pt-6 pb-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0040a2] font-manrope mb-1">
            Visualization
          </p>
          <h4 className="font-manrope font-bold text-[1.0625rem] text-[#18181B]">{title}</h4>
          <p className="text-[11px] text-[#A1A1AA] mt-0.5">Interactive chart · hover for details</p>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="p-2 rounded-lg hover:bg-[#f2f4f6] text-[#A1A1AA] hover:text-[#18181B] transition-colors mt-0.5"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Chart Body */}
      <div className={`px-7 pb-7 ${expanded ? 'min-h-[500px]' : ''}`}>
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

// ── Forest Plot (Table-based, responsive) ─────────────────────
interface CoefficientPlotData { name: string; estimate?: number; or?: number; hr?: number; irr?: number; ciLow: number; ciHigh: number; p: string; sig?: string }
interface ForestPlotData { label: string; es: number; ciLow: number; ciHigh: number; weight: number; isSummary: boolean }

type ForestRow = { name: string; value: number; ciLow: number; ciHigh: number; p: string; isSummary?: boolean; weight?: number }

const BAR_W = 220
const BAR_H = 28

function computeForestDomain(rows: ForestRow[], nullLine: number) {
  const finite = (v: unknown): v is number => typeof v === 'number' && isFinite(v) && !isNaN(v)
  const rawVals = rows.flatMap(r => [r.value, r.ciLow, r.ciHigh]).filter(finite)
  rawVals.push(nullLine)

  if (rawVals.length === 0) return { domainMin: nullLine - 1, domainMax: nullLine + 1 }

  // IQR-based fence to suppress extreme outliers (e.g. infinite CIs from perfect separation)
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
    return <p className="text-xs text-[#94a3b8] py-4 text-center">No data to display</p>
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

  // Generate 5 axis tick values across the domain
  const ticks = Array.from({ length: 5 }, (_, i) => domainMin + (i / 4) * domainSpan)

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-[#e2e8f0]">
            <th className="pb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b] font-manrope pr-4 whitespace-nowrap">Variable</th>
            <th className="pb-3 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b] font-manrope" style={{ width: BAR_W + 'px', minWidth: BAR_W + 'px' }}>
              {effectLabel} Scale
            </th>
            <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b] font-manrope pr-4 whitespace-nowrap">{effectLabel} [95% CI]</th>
            <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b] font-manrope whitespace-nowrap">P-Value</th>
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

            let color: string
            if (row.isSummary) color = '#6d28d9'
            else if (!isSig) color = '#94a3b8'
            else if (isRatio) color = val > nullLine ? '#ef4444' : '#10b981'
            else color = val > nullLine ? '#0040a2' : '#8b5cf6'

            const xVal = toBarX(val)
            const xLow = toBarX(ciLow)
            const xHigh = toBarX(ciHigh)
            const cy = BAR_H / 2

            const annotText = `${safeNum(val)} [${safeNum(ciLow)}, ${safeNum(ciHigh)}]`
            const pText = pStr === '<0.001' || pStr === '< 0.001'
              ? '<0.001'
              : isNaN(pNum) ? pStr : pNum.toFixed(3)

            const rowBg = row.isSummary
              ? 'bg-[#f5f3ff]'
              : i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'

            return (
              <tr key={i} className={rowBg}>
                {/* Variable label */}
                <td className="py-3 pr-4">
                  <span className={`text-sm leading-tight ${row.isSummary ? 'font-bold text-[#6d28d9]' : 'font-medium text-[#1e293b]'}`}>
                    {row.name}
                  </span>
                  {/* Meta-analysis weight bar */}
                  {row.weight != null && !row.isSummary && (
                    <div className="mt-1 h-1 rounded-full bg-[#e2e8f0] overflow-hidden" style={{ width: '80px' }}>
                      <div className="h-full rounded-full bg-[#cbd5e1]" style={{ width: `${Math.max(4, row.weight * 100)}%` }} />
                    </div>
                  )}
                </td>

                {/* Mini SVG bar */}
                <td className="py-3" style={{ width: BAR_W + 'px', minWidth: BAR_W + 'px' }}>
                  <svg width={BAR_W} height={BAR_H} viewBox={`0 0 ${BAR_W} ${BAR_H}`} style={{ display: 'block' }}>
                    {/* Null reference line */}
                    <line x1={nullX} y1={2} x2={nullX} y2={BAR_H - 2}
                      stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" />

                    {!row.isSummary ? (
                      <>
                        {/* CI whisker */}
                        <line x1={xLow} y1={cy} x2={xHigh} y2={cy}
                          stroke={color} strokeWidth={2} strokeLinecap="round" />
                        {/* Left cap or arrow when clipped */}
                        {isClippedLow
                          ? <polygon points={`4,${cy} 12,${cy - 5} 12,${cy + 5}`} fill={color} />
                          : <line x1={xLow} y1={cy - 5} x2={xLow} y2={cy + 5} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
                        }
                        {/* Right cap or arrow when clipped */}
                        {isClippedHigh
                          ? <polygon points={`${BAR_W - 4},${cy} ${BAR_W - 12},${cy - 5} ${BAR_W - 12},${cy + 5}`} fill={color} />
                          : <line x1={xHigh} y1={cy - 5} x2={xHigh} y2={cy + 5} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
                        }
                        {/* Point estimate square */}
                        <rect x={xVal - 5} y={cy - 5} width={10} height={10} fill={color} rx={2} />
                        <circle cx={xVal} cy={cy} r={2} fill="white" />
                      </>
                    ) : (
                      <>
                        {/* Summary CI whisker */}
                        <line x1={xLow} y1={cy} x2={xHigh} y2={cy}
                          stroke={color} strokeWidth={1.5} strokeOpacity={0.4} strokeLinecap="round" />
                        {/* Summary diamond */}
                        <polygon
                          points={`${xVal},${cy - 9} ${xHigh},${cy} ${xVal},${cy + 9} ${xLow},${cy}`}
                          fill={color} fillOpacity={0.18} stroke={color} strokeWidth={2}
                        />
                      </>
                    )}
                  </svg>
                </td>

                {/* Annotation */}
                <td className="py-3 pr-4 text-right">
                  <span className={`text-[11px] font-mono ${row.isSummary ? 'font-bold text-[#6d28d9]' : 'text-[#334155]'}`}>
                    {annotText}
                  </span>
                  {(isClippedLow || isClippedHigh) && (
                    <span className="ml-1 text-[9px] text-[#f59e0b] font-bold">†</span>
                  )}
                </td>

                {/* P-value */}
                <td className="py-3 text-right">
                  <span className={`text-[11px] font-mono font-bold ${isSig ? 'text-[#0f766e]' : 'text-[#94a3b8]'}`}>
                    {pText || '—'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Axis ticks */}
      <div className="mt-1 pl-0" style={{ paddingLeft: '0px' }}>
        <svg width="100%" height="20" style={{ display: 'block', overflow: 'visible' }}>
          {/* We render ticks relative to the bar column — approximate via absolute positioning trick below */}
        </svg>
      </div>

      {/* Scale labels */}
      <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-[#94a3b8] mt-2 border-t border-[#f1f5f9] pt-2">
        {isRatio ? (
          <>
            <span className="text-[#0f766e]">Favors Treatment</span>
            <span className="text-[#64748b]">1.0 (Null)</span>
            <span className="text-[#ef4444]">Favors Control</span>
          </>
        ) : (
          ticks.map((v, i) => (
            <span key={i}>{v.toFixed(2)}</span>
          ))
        )}
      </div>

      {/* Legend */}
      {isRatio && (
        <div className="flex flex-wrap items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-[#10b981]" />
            <span className="text-[10px] text-[#64748b]">Protective (p&lt;0.05)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-[#ef4444]" />
            <span className="text-[10px] text-[#64748b]">Harmful (p&lt;0.05)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-[#94a3b8]" />
            <span className="text-[10px] text-[#64748b]">Non-significant</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[9px] text-[#f59e0b] font-bold">†</span>
            <span className="text-[10px] text-[#94a3b8]">CI extends beyond axis</span>
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
          <Fragment key={v1}>
            <div className="text-[10px] font-semibold text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap flex items-center">{v1}</div>
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
          </Fragment>
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
  const loadings = data.loadings ?? []
  const varExp = config.varExplained as number[] | undefined

  const VW = 600
  const VH = expanded ? 520 : 380
  const PAD = { t: 24, r: 24, b: 44, l: 44 }
  const plotW = VW - PAD.l - PAD.r
  const plotH = VH - PAD.t - PAD.b

  // Score axis ranges (symmetric around 0)
  const pc1s = sample.map(d => d.pc1)
  const pc2s = sample.map(d => d.pc2)
  const xRange = Math.max(Math.abs(Math.min(...pc1s)), Math.abs(Math.max(...pc1s))) * 1.25 || 1
  const yRange = Math.max(Math.abs(Math.min(...pc2s)), Math.abs(Math.max(...pc2s))) * 1.25 || 1

  const toSvgX = (x: number) => PAD.l + ((x + xRange) / (2 * xRange)) * plotW
  const toSvgY = (y: number) => PAD.t + plotH - ((y + yRange) / (2 * yRange)) * plotH
  const oX = toSvgX(0)
  const oY = toSvgY(0)

  // Scale loadings to fill ~72% of score range
  const maxL = Math.max(...loadings.flatMap(l => [Math.abs(l.pc1), Math.abs(l.pc2)]), 0.001)
  const lScale = (xRange * 0.72) / maxL

  // Axis tick values
  const axisTicks = [-1, -0.5, 0, 0.5, 1].map(f => f * xRange)

  const pc1Label = varExp ? `PC1 (${(varExp[0] * 100).toFixed(1)}%)` : 'PC1'
  const pc2Label = varExp ? `PC2 (${(varExp[1] * 100).toFixed(1)}%)` : 'PC2'

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height={VH} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        {loadings.map((_, i) => (
          <marker key={i} id={`bp-arrow-${i}`} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <polygon points="0,0 7,3.5 0,7" fill={COLORS[i % COLORS.length]} />
          </marker>
        ))}
      </defs>

      {/* Subtle grid */}
      {[-0.5, 0, 0.5].map(f => {
        const gx = toSvgX(f * xRange)
        const gy = toSvgY(f * yRange)
        return (
          <g key={f}>
            <line x1={gx} y1={PAD.t} x2={gx} y2={PAD.t + plotH} stroke={f === 0 ? '#cbd5e1' : '#e2e8f0'} strokeWidth={f === 0 ? 1.5 : 1} strokeDasharray={f === 0 ? undefined : '3 5'} />
            <line x1={PAD.l} y1={gy} x2={PAD.l + plotW} y2={gy} stroke={f === 0 ? '#cbd5e1' : '#e2e8f0'} strokeWidth={f === 0 ? 1.5 : 1} strokeDasharray={f === 0 ? undefined : '3 5'} />
          </g>
        )
      })}

      {/* Score scatter points */}
      {sample.map((d, i) => (
        <circle key={i} cx={toSvgX(d.pc1)} cy={toSvgY(d.pc2)} r={3.5} fill="#3b82f6" fillOpacity={0.35} stroke="#3b82f6" strokeOpacity={0.5} strokeWidth={0.5} />
      ))}

      {/* Loading arrows + labels */}
      {loadings.map((l, i) => {
        const ex = toSvgX(l.pc1 * lScale)
        const ey = toSvgY(l.pc2 * lScale)
        const color = COLORS[i % COLORS.length]
        const dx = ex - oX, dy = ey - oY
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        // Shorten endpoint by arrowhead size so head touches the target
        const ax = ex - (dx / len) * 8
        const ay = ey - (dy / len) * 8
        // Label offset away from origin
        const lx = ex + (dx / len) * 13
        const ly = ey + (dy / len) * 13
        return (
          <g key={i}>
            <line x1={oX} y1={oY} x2={ax} y2={ay} stroke={color} strokeWidth={1.8} strokeOpacity={0.85} markerEnd={`url(#bp-arrow-${i})`} />
            <text x={lx} y={ly} fontSize={10} fill={color} fontWeight={700} textAnchor="middle" dominantBaseline="middle"
              style={{ filter: 'drop-shadow(0 0 2px white)' }}>
              {l.variable.length > 14 ? l.variable.slice(0, 12) + '…' : l.variable}
            </text>
          </g>
        )
      })}

      {/* Axes border */}
      <rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} fill="none" stroke="#cbd5e1" strokeWidth={1} rx={2} />

      {/* X-axis ticks */}
      {axisTicks.map((v, i) => {
        const tx = toSvgX(v)
        return (
          <g key={i}>
            <line x1={tx} y1={PAD.t + plotH} x2={tx} y2={PAD.t + plotH + 4} stroke="#94a3b8" strokeWidth={1} />
            <text x={tx} y={PAD.t + plotH + 14} fontSize={9} fill="#94a3b8" textAnchor="middle">{v.toFixed(1)}</text>
          </g>
        )
      })}

      {/* Y-axis ticks */}
      {axisTicks.map((v, i) => {
        const ty = toSvgY(v)
        return (
          <g key={i}>
            <line x1={PAD.l - 4} y1={ty} x2={PAD.l} y2={ty} stroke="#94a3b8" strokeWidth={1} />
            <text x={PAD.l - 6} y={ty + 4} fontSize={9} fill="#94a3b8" textAnchor="end">{v.toFixed(1)}</text>
          </g>
        )
      })}

      {/* Axis labels */}
      <text x={PAD.l + plotW / 2} y={VH - 4} fontSize={11} fill="#64748b" textAnchor="middle" fontWeight={600}>{pc1Label}</text>
      <text x={14} y={PAD.t + plotH / 2} fontSize={11} fill="#64748b" textAnchor="middle" fontWeight={600}
        transform={`rotate(-90, 14, ${PAD.t + plotH / 2})`}>{pc2Label}</text>

      {/* Sample size note */}
      {data.scores.length > 500 && (
        <text x={PAD.l + plotW - 4} y={PAD.t + plotH - 6} fontSize={9} fill="#94a3b8" textAnchor="end">first 500 observations shown</text>
      )}
    </svg>
  )
}

// ── Box Plot (2 groups) ──────────────────────────────────────
function BoxPlot2Group({ data, expanded }: { data: Record<string, unknown>; expanded: boolean }) {
  const groups = (Array.isArray(data) ? data : (data.groups as { group: string; mean: number; sd: number }[])) ?? []
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
  const groupData = (Array.isArray(data) ? data : (data.data as { group: string; mean: number; sd: number }[])) ?? []
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
