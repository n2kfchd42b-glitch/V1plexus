'use client'

import { useState } from 'react'
import type { ChartConfig, DataRow, ColumnSchema } from '@/types/database'

interface BoxPlotProps {
  data: DataRow[]
  config: ChartConfig
  columns: ColumnSchema[]
  width?: number | string
  height?: number | string
}

// ─── Color palettes ───────────────────────────────────────────────────────────

const PALETTES: Record<string, string[]> = {
  default:     ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'],
  ggplot:      ['#F8766D', '#7CAE00', '#00BFC4', '#C77CFF', '#FF7F00', '#A3A500', '#00B0F6', '#E76BF3'],
  tableau:     ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7'],
  cool:        ['#00BFC4', '#619CFF', '#5E81F4', '#00A9FF', '#00C5CD', '#4682B4', '#6A5ACD', '#00BFFF'],
}

function getPalette(palette?: string): string[] {
  return PALETTES[palette ?? 'default'] ?? PALETTES.default
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function computeQuantile(sorted: number[], p: number): number {
  const idx = p * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

interface BoxStats {
  label: string
  q1: number
  median: number
  mean: number
  q3: number
  whiskerLow: number
  whiskerHigh: number
  outliers: number[]
  n: number
  color: string
  rawValues: number[]
}

function computeBoxStats(values: number[], label: string, color: string): BoxStats {
  const sorted = [...values].sort((a, b) => a - b)
  const q1 = computeQuantile(sorted, 0.25)
  const median = computeQuantile(sorted, 0.5)
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length
  const q3 = computeQuantile(sorted, 0.75)
  const iqr = q3 - q1
  const whiskerLow = Math.max(sorted[0], q1 - 1.5 * iqr)
  const whiskerHigh = Math.min(sorted[sorted.length - 1], q3 + 1.5 * iqr)
  const outliers = sorted.filter(v => v < whiskerLow || v > whiskerHigh)
  return { label, q1, median, mean, q3, whiskerLow, whiskerHigh, outliers, n: values.length, color, rawValues: sorted }
}

function fmt(v: number): string {
  if (Math.abs(v) >= 10000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (Math.abs(v) >= 100) return v.toFixed(1)
  if (Math.abs(v) >= 1) return v.toFixed(2)
  return v.toFixed(3)
}

// ─── Seeded jitter (deterministic so it doesn't jump on re-render) ────────────

function seededJitter(index: number, seed: number): number {
  // Simple LCG for a stable pseudo-random offset
  const x = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453123
  return (x - Math.floor(x) - 0.5) * 0.6
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BoxPlot({ data, config, columns: _columns, height = 400 }: BoxPlotProps) {
  const [tooltip, setTooltip] = useState<{ clientX: number; clientY: number; d: BoxStats } | null>(null)

  if (!config.y_axis) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select a numeric Y axis variable for the box plot
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No data available
      </div>
    )
  }

  const palette = getPalette(config.palette)
  const yCol = config.y_axis
  const xCol = config.x_axis
  const showPoints = (config.chart_specific as Record<string, unknown> | undefined)?.show_points as boolean | undefined
  const showMean  = (config.chart_specific as Record<string, unknown> | undefined)?.show_mean  as boolean | undefined

  // ── Build box stats ─────────────────────────────────────────────────────────
  let boxData: BoxStats[] = []

  if (xCol) {
    const cleanData = data.filter(r => r[xCol] != null && r[xCol] !== '')
    const groups = new Map<string, number[]>()
    for (const row of cleanData) {
      const xVal = String(row[xCol])
      const yVal = Number(row[yCol])
      if (!isNaN(yVal)) {
        const arr = groups.get(xVal) ?? []
        arr.push(yVal)
        groups.set(xVal, arr)
      }
    }
    boxData = Array.from(groups.entries())
      .filter(([, vals]) => vals.length >= 4)
      .map(([label, vals], i) => computeBoxStats(vals, label, palette[i % palette.length]))
  } else {
    const values = data.map(r => Number(r[yCol])).filter(n => !isNaN(n))
    if (values.length < 4) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          Not enough numeric values in &quot;{yCol}&quot; (need at least 4)
        </div>
      )
    }
    boxData = [computeBoxStats(values, yCol, palette[0])]
  }

  if (boxData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No groups with enough data (minimum 4 values per group)
      </div>
    )
  }

  // ── Y domain ────────────────────────────────────────────────────────────────
  const allY = boxData.flatMap(d => [d.whiskerLow, d.whiskerHigh, ...d.outliers])
  const yMin = Math.min(...allY)
  const yMax = Math.max(...allY)
  const yRange = yMax - yMin || 1
  const domainMin = yMin - yRange * 0.08
  const domainMax = yMax + yRange * 0.08

  // ── SVG layout ──────────────────────────────────────────────────────────────
  const svgW = 640
  const svgH = typeof height === 'number' ? height : 400
  const ml = 62, mr = 24, mt = 20, mb = 58
  const plotW = svgW - ml - mr
  const plotH = svgH - mt - mb

  const toY = (v: number) => mt + plotH - ((v - domainMin) / (domainMax - domainMin)) * plotH

  const n = boxData.length
  const slotW = plotW / n
  const boxW = Math.min(slotW * 0.42, 72)
  const capW = boxW * 0.44

  // ── Y ticks ─────────────────────────────────────────────────────────────────
  const tickCount = 6
  const yTicks = Array.from({ length: tickCount }, (_, i) =>
    domainMin + (i / (tickCount - 1)) * (domainMax - domainMin)
  )

  return (
    <div className="relative w-full select-none" style={{ height: svgH }}>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid lines */}
        {yTicks.map((v, i) => (
          <line
            key={i}
            x1={ml} x2={ml + plotW}
            y1={toY(v)} y2={toY(v)}
            stroke="currentColor" strokeOpacity={0.07} strokeWidth={1}
          />
        ))}

        {/* Axes */}
        <line x1={ml} x2={ml} y1={mt} y2={mt + plotH} stroke="currentColor" strokeOpacity={0.18} strokeWidth={1} />
        <line x1={ml} x2={ml + plotW} y1={mt + plotH} y2={mt + plotH} stroke="currentColor" strokeOpacity={0.18} strokeWidth={1} />

        {/* Y ticks + labels */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={ml - 4} x2={ml} y1={toY(v)} y2={toY(v)} stroke="currentColor" strokeOpacity={0.25} strokeWidth={1} />
            <text
              x={ml - 8} y={toY(v)}
              textAnchor="end" dominantBaseline="middle"
              fontSize={10} fill="currentColor" fillOpacity={0.55}
            >
              {fmt(v)}
            </text>
          </g>
        ))}

        {/* Y axis label */}
        <text
          transform={`translate(${13}, ${mt + plotH / 2}) rotate(-90)`}
          textAnchor="middle" fontSize={11} fill="currentColor" fillOpacity={0.6}
        >
          {config.y_label ?? yCol}
        </text>

        {/* X axis label */}
        {xCol && (
          <text
            x={ml + plotW / 2} y={svgH - 4}
            textAnchor="middle" fontSize={11} fill="currentColor" fillOpacity={0.6}
          >
            {config.x_label ?? xCol}
          </text>
        )}

        {/* Box plots */}
        {boxData.map((d, i) => {
          const cx = ml + (i + 0.5) * slotW
          const bx = cx - boxW / 2
          const yq1  = toY(d.q1)
          const yq3  = toY(d.q3)
          const ymed = toY(d.median)
          const ymean = toY(d.mean)
          const ywl  = toY(d.whiskerLow)
          const ywh  = toY(d.whiskerHigh)
          const boxHeight = Math.max(yq1 - yq3, 1)

          return (
            <g
              key={d.label}
              onMouseMove={e => setTooltip({ clientX: e.clientX, clientY: e.clientY, d })}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: 'default' }}
            >
              {/* Jitter / raw data points (behind box) */}
              {showPoints && d.rawValues.map((v, j) => (
                <circle
                  key={j}
                  cx={cx + seededJitter(j, i) * boxW}
                  cy={toY(v)}
                  r={2}
                  fill={d.color}
                  fillOpacity={0.22}
                  stroke={d.color}
                  strokeWidth={0.5}
                  strokeOpacity={0.35}
                />
              ))}

              {/* Lower whisker stem (Q1 → whiskerLow) */}
              <line x1={cx} x2={cx} y1={yq1} y2={ywl} stroke={d.color} strokeWidth={1.5} />
              {/* Lower cap */}
              <line x1={cx - capW / 2} x2={cx + capW / 2} y1={ywl} y2={ywl} stroke={d.color} strokeWidth={1.5} />

              {/* Upper whisker stem (Q3 → whiskerHigh) */}
              <line x1={cx} x2={cx} y1={yq3} y2={ywh} stroke={d.color} strokeWidth={1.5} />
              {/* Upper cap */}
              <line x1={cx - capW / 2} x2={cx + capW / 2} y1={ywh} y2={ywh} stroke={d.color} strokeWidth={1.5} />

              {/* IQR box (Q1 to Q3) */}
              <rect
                x={bx} y={yq3}
                width={boxW} height={boxHeight}
                fill={d.color} fillOpacity={0.22}
                stroke={d.color} strokeWidth={1.5}
                rx={2}
              />

              {/* Median line */}
              <line x1={bx} x2={bx + boxW} y1={ymed} y2={ymed} stroke={d.color} strokeWidth={2.5} />

              {/* Mean diamond (optional) */}
              {showMean && (
                <polygon
                  points={`${cx},${ymean - 5} ${cx + 5},${ymean} ${cx},${ymean + 5} ${cx - 5},${ymean}`}
                  fill="white"
                  stroke={d.color}
                  strokeWidth={1.5}
                />
              )}

              {/* Outlier dots */}
              {d.outliers.map((v, j) => (
                <circle
                  key={j}
                  cx={cx} cy={toY(v)} r={3.5}
                  fill="none"
                  stroke={d.color} strokeWidth={1.5}
                  strokeOpacity={0.8}
                />
              ))}

              {/* X group label */}
              <text
                x={cx} y={mt + plotH + 16}
                textAnchor="middle" fontSize={11}
                fill="currentColor" fillOpacity={0.65}
              >
                {d.label.length > 15 ? d.label.slice(0, 14) + '…' : d.label}
              </text>

              {/* n= below label */}
              <text
                x={cx} y={mt + plotH + 30}
                textAnchor="middle" fontSize={9}
                fill="currentColor" fillOpacity={0.35}
              >
                n={d.n}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-background border border-border rounded-lg shadow-xl px-3 py-2.5 text-xs"
          style={{ left: tooltip.clientX + 14, top: tooltip.clientY - 70, minWidth: 160 }}
        >
          <div className="font-semibold mb-2" style={{ color: tooltip.d.color }}>
            {tooltip.d.label}
          </div>
          <div className="space-y-0.5 text-muted-foreground">
            <div className="flex justify-between gap-4">
              <span>Upper fence</span><span className="text-foreground font-mono">{fmt(tooltip.d.whiskerHigh)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Q3 (75%)</span><span className="text-foreground font-mono">{fmt(tooltip.d.q3)}</span>
            </div>
            <div className="flex justify-between gap-4 font-medium">
              <span className="text-foreground">Median</span><span className="text-foreground font-mono">{fmt(tooltip.d.median)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Mean</span><span className="text-foreground font-mono">{fmt(tooltip.d.mean)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Q1 (25%)</span><span className="text-foreground font-mono">{fmt(tooltip.d.q1)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Lower fence</span><span className="text-foreground font-mono">{fmt(tooltip.d.whiskerLow)}</span>
            </div>
            {tooltip.d.outliers.length > 0 && (
              <div className="flex justify-between gap-4 text-amber-500">
                <span>Outliers</span><span className="font-mono">{tooltip.d.outliers.length}</span>
              </div>
            )}
          </div>
          <div className="border-t border-border mt-2 pt-1.5 text-muted-foreground">
            n = {tooltip.d.n}
          </div>
        </div>
      )}
    </div>
  )
}
