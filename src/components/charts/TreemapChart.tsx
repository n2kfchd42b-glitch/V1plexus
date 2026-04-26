'use client'

import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import type { ChartConfig, DataRow, ColumnSchema } from '@/types/database'

interface TreemapChartProps {
  data: DataRow[]
  config: ChartConfig
  columns: ColumnSchema[]
  width?: number | `${number}%`
  height?: number | `${number}%`
}

const PALETTES: Record<string, string[]> = {
  default: ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#84cc16'],
  ggplot:  ['#F8766D', '#7CAE00', '#00BFC4', '#C77CFF', '#FF7F00', '#A3A500', '#00B0F6', '#E76BF3'],
  tableau: ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7'],
  cool:    ['#00BFC4', '#619CFF', '#5E81F4', '#00A9FF', '#00C5CD', '#4682B4', '#6A5ACD', '#00BFFF'],
}

interface ContentProps {
  x: number
  y: number
  width: number
  height: number
  name: string
  value: number
  fill: string
}

function TreemapCell(props: ContentProps) {
  const { x, y, width, height, name, value, fill } = props
  if (width < 20 || height < 16) return null
  const showText = width > 50 && height > 28
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} rx={3} />
      {showText && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - (height > 50 ? 7 : 0)}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#fff"
            fontSize={Math.min(13, Math.max(9, width / 7))}
            fontFamily="Manrope, sans-serif"
            fontWeight={600}
          >
            {name.length > 18 ? name.slice(0, 16) + '…' : name}
          </text>
          {height > 50 && (
            <text
              x={x + width / 2}
              y={y + height / 2 + 10}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(255,255,255,0.75)"
              fontSize={Math.min(11, Math.max(8, width / 8))}
              fontFamily="Manrope, sans-serif"
            >
              {typeof value === 'number' ? value.toLocaleString() : ''}
            </text>
          )}
        </>
      )}
    </g>
  )
}

export function TreemapChart({ data, config, columns: _columns, width = '100%' as `${number}%`, height = 400 }: TreemapChartProps) {
  if (!config.x_axis) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select a category column to render the treemap
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

  const xCol = config.x_axis
  const yCol = config.y_axis
  const colors = PALETTES[config.palette ?? 'default']

  const groups = new Map<string, number>()
  for (const row of data) {
    const key = row[xCol] != null ? String(row[xCol]) : '(null)'
    const val = yCol != null ? Number(row[yCol]) : 1
    groups.set(key, (groups.get(key) ?? 0) + (isNaN(val) ? 0 : Math.abs(val)))
  }

  const treeData = Array.from(groups.entries())
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, size], i) => ({ name, size, fill: colors[i % colors.length] }))

  return (
    <ResponsiveContainer width={width} height={height}>
      <Treemap
        data={treeData}
        dataKey="size"
        content={(props: unknown) => {
          const p = props as ContentProps
          return <TreemapCell {...p} />
        }}
      >
        <Tooltip formatter={(value: unknown) => [Number(value).toLocaleString(), 'Value']} />
      </Treemap>
    </ResponsiveContainer>
  )
}
