'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { ChartConfig, DataRow, ColumnSchema } from '@/types/database'

interface HistogramProps {
  data: DataRow[]
  config: ChartConfig
  columns: ColumnSchema[]
  width?: number | `${number}%`
  height?: number | `${number}%`
}

interface BinData {
  label: string
  count: number
  start: number
  end: number
  mid: number
  kde?: number
}

function computeBins(values: number[], binCount: number): BinData[] {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) {
    return [{ label: String(min), count: values.length, start: min, end: max, mid: min }]
  }
  const binWidth = (max - min) / binCount
  const bins: BinData[] = Array.from({ length: binCount }, (_, i) => ({
    label: `${(min + i * binWidth).toFixed(2)}`,
    count: 0,
    start: min + i * binWidth,
    end: min + (i + 1) * binWidth,
    mid: min + (i + 0.5) * binWidth,
  }))
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), binCount - 1)
    bins[idx].count++
  }
  return bins
}

// ─── Gaussian KDE (Scott's rule bandwidth) ────────────────────────────────────

function gaussianKernel(u: number): number {
  return Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI)
}

function computeKDE(values: number[], points: number[], binWidth: number): number[] {
  const n = values.length
  const mean = values.reduce((a, b) => a + b, 0) / n
  const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / n)
  // Scott's rule: h = 1.06 × σ × n^(-1/5)
  const h = std > 0 ? 1.06 * std * Math.pow(n, -0.2) : binWidth

  return points.map(x => {
    const density = values.reduce((acc, xi) => acc + gaussianKernel((x - xi) / h), 0) / (n * h)
    // Scale density → count units so the curve sits on the same Y axis as the bars
    return density * binWidth * n
  })
}

// ─── Palettes ─────────────────────────────────────────────────────────────────

const PALETTE_PRIMARY: Record<string, string> = {
  default: '#6366f1',
  ggplot:  '#F8766D',
  tableau: '#4E79A7',
  cool:    '#00BFC4',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Histogram({ data, config, columns: _columns, width = ('100%' as `${number}%`), height = 400 }: HistogramProps) {
  if (!config.x_axis) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select a numeric variable for the histogram
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

  const primaryColor = PALETTE_PRIMARY[config.palette ?? 'default'] ?? PALETTE_PRIMARY.default
  const xCol = config.x_axis
  const binCount = config.bin_count ?? 20
  const showDensity = (config.chart_specific as Record<string, unknown> | undefined)?.show_density as boolean | undefined

  const values = data.map(r => Number(r[xCol])).filter(n => !isNaN(n))

  if (values.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No numeric values found in column &quot;{xCol}&quot;
      </div>
    )
  }

  const bins = computeBins(values, binCount)

  // Attach KDE values to bins when the overlay is enabled
  if (showDensity && bins.length > 1) {
    const binWidth = bins[0].end - bins[0].start
    const kdeValues = computeKDE(values, bins.map(b => b.mid), binWidth)
    kdeValues.forEach((v, i) => { bins[i].kde = v })
  }

  const maxCount = Math.max(...bins.map(b => b.count))

  return (
    <ResponsiveContainer width={width} height={height}>
      <ComposedChart data={bins} barCategoryGap={1} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="label"
          label={{ value: config.x_label ?? xCol, position: 'insideBottom', offset: -10 }}
          tick={{ fontSize: 11 }}
          interval={Math.floor(binCount / 8)}
          height={60}
        />
        <YAxis
          label={{ value: config.y_label ?? 'Count', angle: -90, position: 'insideLeft', offset: 10 }}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          formatter={(value, name) => {
            if (name === 'kde') return [Number(value).toFixed(2), 'Expected count (normal)']
            return [value, 'Count']
          }}
          labelFormatter={(label, payload) => {
            if (payload && payload[0]) {
              const bin = payload[0].payload as BinData
              return `[${bin.start.toFixed(2)}, ${bin.end.toFixed(2)})`
            }
            return label
          }}
        />
        {showDensity && (
          <Legend
            formatter={v => (v === 'kde' ? 'Normal curve' : 'Count')}
            wrapperStyle={{ fontSize: 11 }}
          />
        )}

        <Bar dataKey="count" name="count" radius={[2, 2, 0, 0]}>
          {bins.map((bin, i) => {
            const opacity = 0.45 + 0.5 * (bin.count / maxCount)
            return <Cell key={i} fill={primaryColor} opacity={opacity} />
          })}
        </Bar>

        {showDensity && (
          <Line
            type="monotone"
            dataKey="kde"
            name="kde"
            stroke={primaryColor}
            strokeWidth={2.5}
            dot={false}
            strokeOpacity={1}
            activeDot={{ r: 4, fill: primaryColor }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
