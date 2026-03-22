'use client'

import { useState, useMemo } from 'react'
import {
  BarChart2, TrendingUp, Circle, Activity, Box, PieChart as PieIcon,
  Grid3x3, AreaChart as AreaChartIcon, Hash, Tag, Calendar, ToggleLeft, ChevronDown,
  Save, ArrowLeft, Lightbulb, FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { BarChart } from '@/components/charts/BarChart'
import { LineChart } from '@/components/charts/LineChart'
import { ScatterPlot } from '@/components/charts/ScatterPlot'
import { Histogram } from '@/components/charts/Histogram'
import { BoxPlot } from '@/components/charts/BoxPlot'
import { PieChart } from '@/components/charts/PieChart'
import { Heatmap } from '@/components/charts/Heatmap'
import { AreaChart } from '@/components/charts/AreaChart'
import type { ChartConfig, DataRow, ColumnSchema, ChartType, ColumnType } from '@/types/database'

interface ChartBuilderProps {
  rows: DataRow[]
  columns: ColumnSchema[]
  datasetId: string
  versionId: string
  onBack?: () => void
  onSave?: (chartType: ChartType, config: ChartConfig) => void
  onInsertIntoDocument?: (chartType: ChartType, config: ChartConfig) => void
  initialChartType?: ChartType
  initialConfig?: ChartConfig
}

// ─── Chart type definitions ───────────────────────────────────────────────────

interface ChartTypeDef {
  id: ChartType
  label: string
  icon: React.ReactNode
  requiresX: boolean
  requiresY: boolean
  supportsColor: boolean
  supportsAgg: boolean
  preferredX: ColumnType[]
  preferredY: ColumnType[]
}

const CHART_TYPES: ChartTypeDef[] = [
  {
    id: 'bar', label: 'Bar', icon: <BarChart2 size={14} />,
    requiresX: true, requiresY: false, supportsColor: true, supportsAgg: true,
    preferredX: ['categorical', 'text'], preferredY: ['number', 'integer', 'decimal'],
  },
  {
    id: 'line', label: 'Line', icon: <TrendingUp size={14} />,
    requiresX: true, requiresY: true, supportsColor: true, supportsAgg: true,
    preferredX: ['date', 'integer', 'number'], preferredY: ['number', 'integer', 'decimal'],
  },
  {
    id: 'area', label: 'Area', icon: <AreaChartIcon size={14} />,
    requiresX: true, requiresY: true, supportsColor: true, supportsAgg: true,
    preferredX: ['date', 'integer', 'number'], preferredY: ['number', 'integer', 'decimal'],
  },
  {
    id: 'scatter', label: 'Scatter', icon: <Circle size={14} />,
    requiresX: true, requiresY: true, supportsColor: true, supportsAgg: false,
    preferredX: ['number', 'integer', 'decimal'], preferredY: ['number', 'integer', 'decimal'],
  },
  {
    id: 'histogram', label: 'Histogram', icon: <Activity size={14} />,
    requiresX: true, requiresY: false, supportsColor: false, supportsAgg: false,
    preferredX: ['number', 'integer', 'decimal'], preferredY: [],
  },
  {
    id: 'box', label: 'Box Plot', icon: <Box size={14} />,
    requiresX: false, requiresY: true, supportsColor: false, supportsAgg: false,
    preferredX: ['categorical', 'text'], preferredY: ['number', 'integer', 'decimal'],
  },
  {
    id: 'pie', label: 'Pie', icon: <PieIcon size={14} />,
    requiresX: true, requiresY: false, supportsColor: false, supportsAgg: true,
    preferredX: ['categorical', 'text'], preferredY: ['number', 'integer', 'decimal'],
  },
  {
    id: 'donut', label: 'Donut', icon: <PieIcon size={14} />,
    requiresX: true, requiresY: false, supportsColor: false, supportsAgg: true,
    preferredX: ['categorical', 'text'], preferredY: ['number', 'integer', 'decimal'],
  },
  {
    id: 'heatmap', label: 'Heatmap', icon: <Grid3x3 size={14} />,
    requiresX: false, requiresY: false, supportsColor: false, supportsAgg: false,
    preferredX: [], preferredY: [],
  },
]

// ─── Smart suggestion ─────────────────────────────────────────────────────────

function suggestChartType(
  columns: ColumnSchema[],
  xCol?: string,
  yCol?: string,
): { chartType: ChartType; reason: string } | null {
  const numericTypes: ColumnType[] = ['number', 'integer', 'decimal']
  const catTypes: ColumnType[] = ['categorical', 'text']

  if (!xCol && !yCol) return null

  const xSchema = columns.find(c => c.name === xCol)
  const ySchema = columns.find(c => c.name === yCol)

  if (xSchema && !ySchema) {
    if (numericTypes.includes(xSchema.type)) {
      return { chartType: 'histogram', reason: `Histogram recommended for numeric column "${xCol}"` }
    }
    if (catTypes.includes(xSchema.type)) {
      return { chartType: 'bar', reason: `Bar chart recommended to count categories in "${xCol}"` }
    }
  }

  if (xSchema && ySchema) {
    const xNum = numericTypes.includes(xSchema.type)
    const yNum = numericTypes.includes(ySchema.type)
    const xCat = catTypes.includes(xSchema.type)
    const xDate = xSchema.type === 'date'

    if (xNum && yNum) {
      return { chartType: 'scatter', reason: `Scatter plot recommended for two numeric variables` }
    }
    if (xDate && yNum) {
      return { chartType: 'area', reason: `Area chart recommended for time series data` }
    }
    if (xCat && yNum) {
      return { chartType: 'bar', reason: `Bar chart recommended for categorical X and numeric Y` }
    }
  }

  return null
}

// ─── Column type icons ────────────────────────────────────────────────────────

function ColIcon({ type }: { type: ColumnType }) {
  switch (type) {
    case 'number':
    case 'integer':
    case 'decimal':
      return <Hash size={12} className="text-blue-400" />
    case 'categorical':
    case 'text':
      return <Tag size={12} className="text-purple-400" />
    case 'date':
      return <Calendar size={12} className="text-green-400" />
    case 'boolean':
      return <ToggleLeft size={12} className="text-orange-400" />
    default:
      return <Hash size={12} className="text-muted-foreground" />
  }
}

// ─── Rendered chart ───────────────────────────────────────────────────────────

function RenderChart({
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
  const props = { data: rows, columns, config, height: 380 }
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
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          Chart type &quot;{chartType}&quot; not yet supported in explorer
        </div>
      )
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChartBuilder({ rows, columns, datasetId: _datasetId, versionId: _versionId, onBack, onSave, onInsertIntoDocument, initialChartType, initialConfig }: ChartBuilderProps) {
  const [chartType, setChartType] = useState<ChartType>(initialChartType ?? 'bar')
  const [config, setConfig] = useState<ChartConfig>(initialConfig ?? {})
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    numeric: true,
    categorical: true,
    date: true,
    boolean: false,
  })

  // Group columns by type
  const grouped = useMemo(() => {
    const numeric = columns.filter(c => ['number', 'integer', 'decimal'].includes(c.type))
    const categorical = columns.filter(c => ['categorical', 'text'].includes(c.type))
    const date = columns.filter(c => c.type === 'date')
    const boolean = columns.filter(c => c.type === 'boolean')
    return { numeric, categorical, date, boolean }
  }, [columns])

  const suggestion = useMemo(
    () => suggestChartType(columns, config.x_axis, config.y_axis),
    [columns, config.x_axis, config.y_axis]
  )

  const currentChartDef = CHART_TYPES.find(ct => ct.id === chartType)!

  function patchConfig(patch: Partial<ChartConfig>) {
    setConfig(prev => ({ ...prev, ...patch }))
  }

  function toggleGroup(group: string) {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }))
  }

  function handleSuggest() {
    if (suggestion) setChartType(suggestion.chartType)
  }

  // ── Variable panel section ──────────────────────────────────────────────────

  function VariableSection({ label, cols }: { label: string; cols: ColumnSchema[] }) {
    if (cols.length === 0) return null
    const key = label.toLowerCase()
    const isOpen = expandedGroups[key] ?? true
    return (
      <div>
        <button
          className="flex items-center gap-1 w-full text-left px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          onClick={() => toggleGroup(key)}
        >
          <ChevronDown size={10} className={`transition-transform ${isOpen ? '' : '-rotate-90'}`} />
          {label}
          <span className="ml-auto font-normal normal-case tracking-normal">{cols.length}</span>
        </button>
        {isOpen && (
          <div className="pl-2 pr-1 pb-1">
            {cols.map(col => (
              <div
                key={col.name}
                className="flex items-center gap-1.5 py-0.5 px-1 rounded text-xs hover:bg-muted cursor-default select-none"
                title={`${col.name} — ${col.type} (${col.unique_count} unique, ${col.null_count} nulls)`}
              >
                <ColIcon type={col.type} />
                <span className="truncate flex-1">{col.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Column select dropdown ──────────────────────────────────────────────────

  function ColumnSelect({
    value,
    onChange,
    placeholder,
    allowNone = true,
    filterTypes,
  }: {
    value?: string
    onChange: (v: string | undefined) => void
    placeholder: string
    allowNone?: boolean
    filterTypes?: ColumnType[]
  }) {
    const opts = filterTypes ? columns.filter(c => filterTypes.includes(c.type)) : columns
    return (
      <Select
        value={value ?? '__none__'}
        onValueChange={v => onChange(v === '__none__' ? undefined : v)}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value="__none__"><span className="text-muted-foreground italic">None</span></SelectItem>}
          {opts.map(col => (
            <SelectItem key={col.name} value={col.name}>
              <span className="flex items-center gap-1.5">
                <ColIcon type={col.type} />
                {col.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft size={14} />
            Back
          </Button>
        )}
        <span className="font-semibold text-sm">Dataset Explorer</span>
        <div className="flex items-center gap-2">
          {onInsertIntoDocument && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onInsertIntoDocument(chartType, config)}
            >
              <FileText size={14} />
              Insert into Document
            </Button>
          )}
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => onSave?.(chartType, config)}
            disabled={!onSave}
          >
            <Save size={14} />
            Save Chart
          </Button>
        </div>
      </div>

      {/* Body: 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Variables ────────────────────────────────────────────── */}
        <div className="w-48 border-r flex flex-col shrink-0">
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b">
            Variables
          </div>
          <ScrollArea className="flex-1">
            <div className="py-1 space-y-0.5">
              <VariableSection label="Numeric" cols={grouped.numeric} />
              <VariableSection label="Categorical" cols={grouped.categorical} />
              <VariableSection label="Date" cols={grouped.date} />
              <VariableSection label="Boolean" cols={grouped.boolean} />
            </div>
          </ScrollArea>
        </div>

        {/* ── Center: Chart canvas ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chart type pill bar */}
          <div className="flex items-center gap-1 px-3 py-2 border-b overflow-x-auto shrink-0">
            {CHART_TYPES.map(ct => (
              <button
                key={ct.id}
                onClick={() => setChartType(ct.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                  chartType === ct.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {ct.icon}
                {ct.label}
              </button>
            ))}
          </div>

          {/* Suggestion banner */}
          {suggestion && suggestion.chartType !== chartType && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 shrink-0">
              <Lightbulb size={12} />
              <span className="flex-1">{suggestion.reason}</span>
              <button
                onClick={handleSuggest}
                className="underline underline-offset-2 hover:no-underline"
              >
                Switch
              </button>
            </div>
          )}

          {/* Chart */}
          <div className="flex-1 overflow-auto p-4">
            {config.title && (
              <div className="text-center text-sm font-medium mb-2 text-foreground">{config.title}</div>
            )}
            <RenderChart
              chartType={chartType}
              rows={rows}
              columns={columns}
              config={config}
            />
          </div>
        </div>

        {/* ── Right: Config ───────────────────────────────────────────────── */}
        <div className="w-56 border-l flex flex-col shrink-0">
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b">
            Configuration
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-4">
              {/* X Axis */}
              {currentChartDef.requiresX || chartType !== 'heatmap' ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">X Axis</Label>
                  <ColumnSelect
                    value={config.x_axis}
                    onChange={v => patchConfig({ x_axis: v })}
                    placeholder="Select column…"
                    allowNone={!currentChartDef.requiresX}
                  />
                </div>
              ) : null}

              {/* Y Axis */}
              {chartType !== 'histogram' && chartType !== 'pie' && chartType !== 'donut' && chartType !== 'heatmap' && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Y Axis {!currentChartDef.requiresY && <span className="opacity-50">(optional)</span>}
                  </Label>
                  <ColumnSelect
                    value={config.y_axis}
                    onChange={v => patchConfig({ y_axis: v })}
                    placeholder="Count (default)"
                    allowNone={true}
                  />
                </div>
              )}

              {/* Y Axis for pie/donut */}
              {(chartType === 'pie' || chartType === 'donut') && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Value (optional)</Label>
                  <ColumnSelect
                    value={config.y_axis}
                    onChange={v => patchConfig({ y_axis: v })}
                    placeholder="Count (default)"
                    allowNone={true}
                  />
                </div>
              )}

              {/* Color */}
              {currentChartDef.supportsColor && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Color / Series</Label>
                  <ColumnSelect
                    value={config.color}
                    onChange={v => patchConfig({ color: v })}
                    placeholder="None"
                    allowNone={true}
                  />
                </div>
              )}

              <Separator />

              {/* Aggregation */}
              {currentChartDef.supportsAgg && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Aggregation</Label>
                  <Select
                    value={config.aggregation ?? 'count'}
                    onValueChange={v => patchConfig({ aggregation: v as ChartConfig['aggregation'] })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="count">Count</SelectItem>
                      <SelectItem value="sum">Sum</SelectItem>
                      <SelectItem value="mean">Mean</SelectItem>
                      <SelectItem value="median">Median</SelectItem>
                      <SelectItem value="min">Min</SelectItem>
                      <SelectItem value="max">Max</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Sort */}
              {(chartType === 'bar') && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Sort</Label>
                  <Select
                    value={config.sort ?? 'none'}
                    onValueChange={v => patchConfig({ sort: v as ChartConfig['sort'] })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="ascending">Ascending</SelectItem>
                      <SelectItem value="descending">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Bin count for histogram */}
              {chartType === 'histogram' && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Bin Count</Label>
                  <Select
                    value={String(config.bin_count ?? 20)}
                    onValueChange={v => patchConfig({ bin_count: Number(v) })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 10, 15, 20, 30, 50].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} bins</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Separator />

              {/* Options */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Options</Label>

                {/* Show values */}
                {(chartType === 'bar') && (
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.show_values ?? false}
                      onChange={e => patchConfig({ show_values: e.target.checked })}
                      className="rounded"
                    />
                    Show values
                  </label>
                )}

                {/* Trend line */}
                {(chartType === 'scatter' || chartType === 'line') && (
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.trend_line ?? false}
                      onChange={e => patchConfig({ trend_line: e.target.checked })}
                      className="rounded"
                    />
                    Trend line
                  </label>
                )}

                {/* Log Y */}
                {['bar', 'line', 'area', 'scatter'].includes(chartType) && (
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.log_scale_y ?? false}
                      onChange={e => patchConfig({ log_scale_y: e.target.checked })}
                      className="rounded"
                    />
                    Log scale Y
                  </label>
                )}

                  {/* Log X (scatter only) */}
                {chartType === 'scatter' && (
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.log_scale_x ?? false}
                      onChange={e => patchConfig({ log_scale_x: e.target.checked })}
                      className="rounded"
                    />
                    Log scale X
                  </label>
                )}

                {/* Histogram specific */}
                {chartType === 'histogram' && (
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(config.chart_specific as Record<string, unknown> | undefined)?.show_density as boolean ?? false}
                      onChange={e => patchConfig({ chart_specific: { ...(config.chart_specific as object), show_density: e.target.checked } })}
                      className="rounded"
                    />
                    Distribution curve
                  </label>
                )}

                {/* Box plot specific */}
                {chartType === 'box' && (
                  <>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(config.chart_specific as Record<string, unknown> | undefined)?.show_points as boolean ?? false}
                        onChange={e => patchConfig({ chart_specific: { ...(config.chart_specific as object), show_points: e.target.checked } })}
                        className="rounded"
                      />
                      Show data points
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(config.chart_specific as Record<string, unknown> | undefined)?.show_mean as boolean ?? false}
                        onChange={e => patchConfig({ chart_specific: { ...(config.chart_specific as object), show_mean: e.target.checked } })}
                        className="rounded"
                      />
                      Show mean (◇)
                    </label>
                  </>
                )}
              </div>

              <Separator />

              {/* Appearance */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Appearance</Label>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground/70">Color palette</Label>
                  <Select
                    value={config.palette ?? 'default'}
                    onValueChange={v => patchConfig({ palette: v === 'default' ? undefined : v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="ggplot">ggplot2</SelectItem>
                      <SelectItem value="tableau">Tableau</SelectItem>
                      <SelectItem value="cool">Cool blues</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Labels */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Labels</Label>
                <div className="space-y-1">
                  <input
                    type="text"
                    placeholder="Chart title…"
                    value={config.title ?? ''}
                    onChange={e => patchConfig({ title: e.target.value || undefined })}
                    className="w-full h-7 px-2 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="text"
                    placeholder="X axis label…"
                    value={config.x_label ?? ''}
                    onChange={e => patchConfig({ x_label: e.target.value || undefined })}
                    className="w-full h-7 px-2 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="text"
                    placeholder="Y axis label…"
                    value={config.y_label ?? ''}
                    onChange={e => patchConfig({ y_label: e.target.value || undefined })}
                    className="w-full h-7 px-2 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
