"use client"

import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  ResponsiveContainer, Cell, ComposedChart, Area, AreaChart,
  ErrorBar
} from 'recharts'

type ChartSpec = {
  type: string
  title: string
  data: unknown[]
  config: Record<string, unknown>
}

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16']

interface Props {
  charts: ChartSpec[]
}

export function AnalysisCharts({ charts }: Props) {
  if (!charts || charts.length === 0) return null
  return (
    <div className="space-y-6">
      {charts.map((chart, idx) => (
        <ChartRenderer key={idx} chart={chart} />
      ))}
    </div>
  )
}

function ChartRenderer({ chart }: { chart: ChartSpec }) {
  const { type, title, data, config } = chart

  return (
    <div>
      <h4 className="text-sm font-semibold mb-3">{title}</h4>
      <div className="w-full">
        {type === 'histogram' && <HistogramChart data={data as { x0: number; x1: number; count: number }[]} />}
        {type === 'bar' && <FrequencyBarChart data={data as { value: string; count: number; percent: string | number }[]} />}
        {type === 'grouped_bar' && <GroupedBarChart data={data as Record<string, unknown>[]} config={config} />}
        {type === 'scatter_regression' && <ScatterRegressionChart data={data as Record<string, unknown>[]} config={config} />}
        {type === 'residual_plot' && <ResidualChart data={data as Record<string, unknown>[]} />}
        {type === 'coefficient_plot' && <CoefficientPlot data={data as CoefficientPlotData[]} isOR={false} />}
        {type === 'forest_or' && <CoefficientPlot data={data as CoefficientPlotData[]} isOR label="OR" nullLine={1} />}
        {type === 'forest_hr' && <CoefficientPlot data={data as CoefficientPlotData[]} isOR label="HR" nullLine={1} />}
        {type === 'forest_irr' && <CoefficientPlot data={data as CoefficientPlotData[]} isOR label="IRR" nullLine={1} />}
        {type === 'forest_meta' && <ForestPlot data={data as ForestPlotData[]} config={config} />}
        {type === 'funnel_plot' && <FunnelPlot data={data as { es: number; se: number }[]} config={config} />}
        {type === 'roc_curve' && <ROCCurve data={data as { fpr: number; tpr: number }[]} config={config} />}
        {type === 'km_curve' && <KMCurve data={data as KMPoint[]} config={config} />}
        {type === 'heatmap' && <CorrelationHeatmap data={data as HeatmapData[]} config={config} />}
        {type === 'time_series' && <TimeSeriesChart data={data as Record<string, unknown>[]} config={config} />}
        {type === 'scree_plot' && <ScreePlot data={data as { component: number; eigenvalue: number; varExplained: number }[]} />}
        {type === 'cluster_scatter' && <ClusterScatter data={data as { pc1: number; pc2: number; cluster: number }[]} config={config} />}
        {type === 'power_curve' && <PowerCurve data={data as { n: number; power: number }[]} config={config} />}
        {type === 'epi_curve' && <EpiCurve data={data as Record<string, unknown>[]} config={config} />}
        {type === 'acf_plot' && <ACFChart data={data as { lag: number; acf: number }[]} config={config} />}
        {type === 'biplot' && <Biplot data={data as unknown as BiplotData} config={config} />}
        {type === 'boxplot_2group' && <BoxPlot2Group data={data as unknown as Record<string, unknown>} />}
        {type === 'boxplot_groups' && <BoxPlotGroups data={data as unknown as Record<string, unknown>} />}
        {type === 'mosaic' && <MosaicPlot data={data as Record<string, unknown>[]} config={config} />}
      </div>
    </div>
  )
}

// ---- Histogram ----
function HistogramChart({ data }: { data: { x0: number; x1: number; count: number }[] }) {
  const d = data.map(b => ({ name: b.x0.toFixed(1), count: b.count }))
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={d} barCategoryGap="2%">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Bar dataKey="count" fill={COLORS[0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---- Frequency Bar ----
function FrequencyBarChart({ data }: { data: { value: string; count: number; percent: number | string }[] }) {
  const top = data.slice(0, 20)
  return (
    <ResponsiveContainer width="100%" height={Math.max(150, top.length * 28)}>
      <BarChart data={top} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="value" tick={{ fontSize: 10 }} width={100} />
        <Tooltip formatter={(v) => [String(v), 'Count']} />
        <Bar dataKey="count" fill={COLORS[0]}>
          {top.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---- Grouped Bar ----
function GroupedBarChart({ data, config }: { data: Record<string, unknown>[]; config: Record<string, unknown> }) {
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
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={pivoted}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="row" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {cols.map((col, i) => <Bar key={col} dataKey={col} fill={COLORS[i % COLORS.length]} />)}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---- Scatter + Regression ----
function ScatterRegressionChart({ data, config }: { data: Record<string, unknown>[]; config: Record<string, unknown> }) {
  const lineData = data.map(d => ({ x: d.x, y: d.yHat })).sort((a, b) => (a.x as number) - (b.x as number))
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="x" type="number" name="X" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Scatter data={data as Record<string, unknown>[]} fill={COLORS[0]} opacity={0.5} />
        <Line data={lineData} type="monotone" dataKey="y" stroke={COLORS[1]} dot={false} strokeWidth={2} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ---- Residual Plot ----
function ResidualChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="fitted" name="Fitted" tick={{ fontSize: 10 }} label={{ value: 'Fitted', position: 'bottom', fontSize: 11 }} />
        <YAxis dataKey="residual" name="Residual" tick={{ fontSize: 10 }} label={{ value: 'Residual', angle: -90, position: 'insideLeft', fontSize: 11 }} />
        <ReferenceLine y={0} stroke="#888" strokeDasharray="4 4" />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
        <Scatter data={data} fill={COLORS[0]} opacity={0.5} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

// ---- Coefficient Plot (forest plot style for regression) ----
interface CoefficientPlotData { name: string; estimate?: number; or?: number; hr?: number; irr?: number; ciLow: number; ciHigh: number; p: string; sig?: string }

function CoefficientPlot({ data, isOR, label, nullLine }: { data: CoefficientPlotData[]; isOR: boolean; label?: string; nullLine?: number }) {
  const plotData = data.map(d => ({
    name: d.name,
    value: d.or ?? d.hr ?? d.irr ?? d.estimate ?? 0,
    error: [((d.or ?? d.hr ?? d.irr ?? d.estimate ?? 0) - d.ciLow), (d.ciHigh - (d.or ?? d.hr ?? d.irr ?? d.estimate ?? 0))] as [number, number],
    ciLow: d.ciLow, ciHigh: d.ciHigh, p: d.p
  }))

  const allValues = plotData.flatMap(d => [d.value, d.ciLow, d.ciHigh]).filter(v => isFinite(v))
  const domain: [number, number] = [Math.min(...allValues) * 0.9, Math.max(...allValues) * 1.1]

  return (
    <ResponsiveContainer width="100%" height={Math.max(120, plotData.length * 32)}>
      <BarChart data={plotData} layout="vertical" margin={{ left: 120, right: 40 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" domain={domain} tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
        {nullLine !== undefined && <ReferenceLine x={nullLine} stroke="#888" strokeDasharray="4 4" />}
        <Tooltip formatter={(v) => [Number(v).toFixed(3), label ?? 'Estimate']} />
        <Bar dataKey="value" fill={COLORS[0]}>
          <ErrorBar dataKey="error" width={4} strokeWidth={2} stroke={COLORS[0]} direction="x" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---- Forest Plot (meta-analysis) ----
interface ForestPlotData { label: string; es: number; ciLow: number; ciHigh: number; weight: number; isSummary: boolean }

function ForestPlot({ data, config }: { data: ForestPlotData[]; config: Record<string, unknown> }) {
  const plotData = data.map(d => ({
    name: d.label, value: d.es, ciLow: d.ciLow, ciHigh: d.ciHigh, weight: d.weight, isSummary: d.isSummary,
    error: [(d.es - d.ciLow), (d.ciHigh - d.es)] as [number, number]
  }))
  const allV = plotData.flatMap(d => [d.ciLow, d.ciHigh]).filter(isFinite)
  const domain: [number, number] = [Math.min(...allV) - 0.1, Math.max(...allV) + 0.1]
  return (
    <ResponsiveContainer width="100%" height={Math.max(150, plotData.length * 28)}>
      <BarChart data={plotData} layout="vertical" margin={{ left: 120, right: 40 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" domain={domain} tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
        <ReferenceLine x={0} stroke="#888" strokeDasharray="4 4" />
        <Tooltip formatter={(v) => [Number(v).toFixed(3), 'Effect Size']} />
        <Bar dataKey="value">
          {plotData.map((d, i) => <Cell key={i} fill={d.isSummary ? COLORS[1] : COLORS[0]} />)}
          <ErrorBar dataKey="error" width={4} strokeWidth={2} stroke={COLORS[0]} direction="x" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---- Funnel Plot ----
function FunnelPlot({ data, config }: { data: { es: number; se: number }[]; config: Record<string, unknown> }) {
  const summaryES = (config.summaryES as number) ?? 0
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="es" name="Effect Size" tick={{ fontSize: 10 }} label={{ value: 'Effect Size', position: 'bottom', fontSize: 11 }} />
        <YAxis dataKey="se" name="SE" reversed tick={{ fontSize: 10 }} label={{ value: 'Standard Error', angle: -90, position: 'insideLeft', fontSize: 11 }} />
        <ReferenceLine x={summaryES} stroke={COLORS[1]} strokeDasharray="4 4" />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
        <Scatter data={data} fill={COLORS[0]} opacity={0.7} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

// ---- ROC Curve ----
function ROCCurve({ data, config }: { data: { fpr: number; tpr: number }[]; config: Record<string, unknown> }) {
  const auc = (config.auc as number)?.toFixed(3)
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="fpr" name="FPR" tick={{ fontSize: 10 }} domain={[0, 1]} label={{ value: '1 - Specificity (FPR)', position: 'bottom', fontSize: 11 }} />
        <YAxis dataKey="tpr" name="TPR" tick={{ fontSize: 10 }} domain={[0, 1]} label={{ value: 'Sensitivity (TPR)', angle: -90, position: 'insideLeft', fontSize: 11 }} />
        <ReferenceLine x={0} y={0} stroke="#888" />
        <Tooltip formatter={(v) => [Number(v).toFixed(3)]} />
        <Line type="monotone" dataKey="tpr" stroke={COLORS[0]} dot={false} strokeWidth={2} name={`AUC = ${auc}`} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ---- Kaplan-Meier ----
interface KMPoint { time: number; survival: number; ciLow: number; ciHigh: number; group: string }

function KMCurve({ data, config }: { data: KMPoint[]; config: Record<string, unknown> }) {
  const groups = (config.groups as string[]) ?? ['All']
  const logRankP = config.logRankP
  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" type="number" tick={{ fontSize: 10 }} label={{ value: 'Time', position: 'bottom', fontSize: 11 }} />
          <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} label={{ value: 'Survival Probability', angle: -90, position: 'insideLeft', fontSize: 11 }} />
          <Tooltip formatter={(v) => [Number(v).toFixed(4)]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {groups.map((group, i) => (
            <Line
              key={group}
              data={data.filter(d => d.group === group)}
              type="stepAfter"
              dataKey="survival"
              name={group}
              stroke={COLORS[i % COLORS.length]}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {!!logRankP && <p className="text-xs text-center text-muted-foreground mt-1">Log-rank test: p {String(logRankP)}</p>}
    </div>
  )
}

// ---- Correlation Heatmap ----
interface HeatmapData { x: string; y: string; r: number; p: number }

function CorrelationHeatmap({ data, config }: { data: HeatmapData[]; config: Record<string, unknown> }) {
  const variables = (config.variables as string[]) ?? []
  const n = variables.length
  if (n === 0) return null

  const cellSize = Math.min(60, Math.max(30, 300 / n))

  return (
    <div className="overflow-x-auto">
      <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${n}, ${cellSize}px)`, gap: 2 }}>
        <div />
        {variables.map(v => (
          <div key={v} style={{ fontSize: 10, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v}>{v}</div>
        ))}
        {variables.map((v1, i) => (
          <>
            <div key={`label-${v1}`} style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v1}</div>
            {variables.map((v2, j) => {
              const cell = data.find(d => d.x === v1 && d.y === v2)
              const r = cell?.r ?? (i === j ? 1 : 0)
              const bg = r > 0
                ? `rgba(59,130,246,${Math.abs(r)})`
                : `rgba(239,68,68,${Math.abs(r)})`
              return (
                <div key={`${v1}-${v2}`} title={`r = ${r.toFixed(3)}`}
                  style={{ width: cellSize, height: cellSize, background: i === j ? '#e5e7eb' : bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: Math.abs(r) > 0.5 ? 'white' : 'black', borderRadius: 2 }}>
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

// ---- Time Series ----
function TimeSeriesChart({ data, config }: { data: Record<string, unknown>[]; config: Record<string, unknown> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="observed" stroke={COLORS[0]} dot={false} strokeWidth={1.5} name="Observed" />
        <Line type="monotone" dataKey="trend" stroke={COLORS[1]} dot={false} strokeWidth={2} name="Trend" strokeDasharray="5 5" />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ---- Scree Plot ----
function ScreePlot({ data }: { data: { component: number; eigenvalue: number; varExplained: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="component" tick={{ fontSize: 10 }} label={{ value: 'Component', position: 'bottom', fontSize: 11 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="eigenvalue" fill={COLORS[0]} name="Eigenvalue" />
        <Line type="monotone" dataKey="varExplained" stroke={COLORS[1]} dot name="% Variance" />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ---- Cluster Scatter ----
function ClusterScatter({ data, config }: { data: { pc1: number; pc2: number; cluster: number }[]; config: Record<string, unknown> }) {
  const nClusters = (config.nClusters as number) ?? 3
  const clusterData = Array.from({ length: nClusters }, (_, i) => ({
    name: `Cluster ${i + 1}`,
    data: data.filter(d => d.cluster === i + 1)
  }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" dataKey="pc1" name="PC1" tick={{ fontSize: 10 }} />
        <YAxis type="number" dataKey="pc2" name="PC2" tick={{ fontSize: 10 }} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {clusterData.map((c, i) => (
          <Scatter key={c.name} name={c.name} data={c.data} fill={COLORS[i % COLORS.length]} opacity={0.7} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  )
}

// ---- Power Curve ----
function PowerCurve({ data, config }: { data: { n: number; power: number }[]; config: Record<string, unknown> }) {
  const targetPower = (config.targetPower as number) ?? 0.8
  const targetN = (config.targetN as number)
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="n" tick={{ fontSize: 10 }} label={{ value: 'Sample Size (n)', position: 'bottom', fontSize: 11 }} />
        <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} label={{ value: 'Power', angle: -90, position: 'insideLeft', fontSize: 11 }} />
        <ReferenceLine y={targetPower} stroke={COLORS[1]} strokeDasharray="4 4" label={{ value: `${targetPower * 100}%`, fontSize: 10 }} />
        {targetN && <ReferenceLine x={targetN} stroke={COLORS[2]} strokeDasharray="4 4" />}
        <Tooltip formatter={(v) => [`${(Number(v) * 100).toFixed(1)}%`, 'Power']} />
        <Line type="monotone" dataKey="power" stroke={COLORS[0]} dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ---- Epidemic Curve ----
function EpiCurve({ data, config }: { data: Record<string, unknown>[]; config: Record<string, unknown> }) {
  const classifications = (config.classifications as string[]) ?? ['Case']
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {classifications.map((cls, i) => (
          <Bar key={cls} dataKey={cls} stackId="a" fill={COLORS[i % COLORS.length]} name={cls} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---- ACF Chart ----
function ACFChart({ data, config }: { data: { lag: number; acf: number }[]; config: Record<string, unknown> }) {
  const n = (config.n as number) ?? 100
  const ci = 1.96 / Math.sqrt(n)
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="lag" tick={{ fontSize: 10 }} label={{ value: 'Lag', position: 'bottom', fontSize: 11 }} />
        <YAxis domain={[-1, 1]} tick={{ fontSize: 10 }} />
        <ReferenceLine y={ci} stroke={COLORS[1]} strokeDasharray="4 4" />
        <ReferenceLine y={-ci} stroke={COLORS[1]} strokeDasharray="4 4" />
        <ReferenceLine y={0} stroke="#888" />
        <Tooltip formatter={(v) => [Number(v).toFixed(4), 'ACF']} />
        <Bar dataKey="acf" fill={COLORS[0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---- Biplot ----
interface BiplotData { scores: { id: number; pc1: number; pc2: number }[]; loadings: { variable: string; pc1: number; pc2: number }[] }

function Biplot({ data, config }: { data: BiplotData; config: Record<string, unknown> }) {
  if (!data || !data.scores) return null
  const sample = data.scores.slice(0, 500) // limit for performance
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" dataKey="pc1" name="PC1" tick={{ fontSize: 10 }} />
        <YAxis type="number" dataKey="pc2" name="PC2" tick={{ fontSize: 10 }} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
        <Scatter data={sample} fill={COLORS[0]} opacity={0.4} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

// ---- Box Plot (2 groups, approximation using bar+error) ----
function BoxPlot2Group({ data }: { data: Record<string, unknown> }) {
  const groups = (data.groups as { group: string; mean: number; sd: number }[]) ?? []
  if (!groups.length) return null
  const plotData = groups.map(g => ({ name: g.group, mean: g.mean, error: g.sd }))
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={plotData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v) => [Number(v).toFixed(3)]} />
        <Bar dataKey="mean" fill={COLORS[0]}>
          <ErrorBar dataKey="error" width={4} strokeWidth={2} stroke={COLORS[0]} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---- Box Plot (multiple groups) ----
function BoxPlotGroups({ data }: { data: Record<string, unknown> }) {
  const groupData = (data.data as { group: string; mean: number; sd: number }[]) ?? []
  if (!groupData.length) return null
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={groupData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="group" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v) => [Number(v).toFixed(3)]} />
        <Bar dataKey="mean">
          {groupData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          <ErrorBar dataKey="sd" width={4} strokeWidth={2} stroke="#555" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---- Mosaic Plot (simplified as grouped bar) ----
function MosaicPlot({ data, config }: { data: Record<string, unknown>[]; config: Record<string, unknown> }) {
  const cats1 = (config.cats1 as string[]) ?? []
  const cats2 = (config.cats2 as string[]) ?? []
  return <GroupedBarChart data={data} config={{ rowCats: cats1, colCats: cats2 }} />
}
