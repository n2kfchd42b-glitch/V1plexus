'use client'

import { useState, useMemo } from 'react'
import { CHART_TOKENS, chartColor, chartColorMid, chartColorDim } from '@/lib/charts/design-tokens'
import {
  BarChart2, TrendingUp, Circle, Activity, Box, PieChart as PieIcon,
  Grid3x3, AreaChart as AreaChartIcon, Hash, Tag, Calendar, ToggleLeft, ChevronDown,
  Save, ArrowLeft, Lightbulb, FileText, SlidersHorizontal,
  Target, LayoutGrid, Filter, Layers, Dot,
} from 'lucide-react'
import { ChartEditor } from '@/components/analysis/ChartEditor'
import { getDefaultConfig, DEFAULT_CHART_EDITOR_CONFIG } from '@/lib/chartEditorConfig'
import type { ChartEditorConfig } from '@/lib/chartEditorConfig'
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
import { RadarChart } from '@/components/charts/RadarChart'
import { BubbleChart } from '@/components/charts/BubbleChart'
import { TreemapChart } from '@/components/charts/TreemapChart'
import { FunnelChart } from '@/components/charts/FunnelChart'
import { DotPlot } from '@/components/charts/DotPlot'
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
  /** Replace the default Variables left panel with custom content */
  leftPanel?: React.ReactNode
  /** Hide the top header bar entirely */
  noHeader?: boolean
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
  {
    id: 'radar', label: 'Radar', icon: <Target size={14} />,
    requiresX: true, requiresY: true, supportsColor: true, supportsAgg: false,
    preferredX: ['categorical', 'text'], preferredY: ['number', 'integer', 'decimal'],
  },
  {
    id: 'bubble', label: 'Bubble', icon: <Layers size={14} />,
    requiresX: true, requiresY: true, supportsColor: true, supportsAgg: false,
    preferredX: ['number', 'integer', 'decimal'], preferredY: ['number', 'integer', 'decimal'],
  },
  {
    id: 'treemap', label: 'Treemap', icon: <LayoutGrid size={14} />,
    requiresX: true, requiresY: false, supportsColor: false, supportsAgg: true,
    preferredX: ['categorical', 'text'], preferredY: ['number', 'integer', 'decimal'],
  },
  {
    id: 'funnel', label: 'Funnel', icon: <Filter size={14} />,
    requiresX: true, requiresY: false, supportsColor: false, supportsAgg: true,
    preferredX: ['categorical', 'text'], preferredY: ['number', 'integer', 'decimal'],
  },
  {
    id: 'dot', label: 'Dot Plot', icon: <Dot size={14} />,
    requiresX: false, requiresY: true, supportsColor: false, supportsAgg: false,
    preferredX: ['categorical', 'text'], preferredY: ['number', 'integer', 'decimal'],
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
      return <Hash size={12} style={{ color: chartColor(0) }} />
    case 'categorical':
    case 'text':
      return <Tag size={12} style={{ color: chartColor(3) }} />
    case 'date':
      return <Calendar size={12} style={{ color: chartColor(4) }} />
    case 'boolean':
      return <ToggleLeft size={12} style={{ color: chartColor(5) }} />
    default:
      return <Hash size={12} style={{ color: CHART_TOKENS.text.muted }} />
  }
}

// ─── Rendered chart ───────────────────────────────────────────────────────────

function RenderChart({
  chartType,
  rows,
  columns,
  config,
  height = 380,
}: {
  chartType: ChartType
  rows: DataRow[]
  columns: ColumnSchema[]
  config: ChartConfig
  height?: number
}) {
  const props = { data: rows, columns, config, height }
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
    case 'radar': return <RadarChart {...props} />
    case 'bubble': return <BubbleChart {...props} />
    case 'treemap': return <TreemapChart {...props} />
    case 'funnel': return <FunnelChart {...props} />
    case 'dot': return <DotPlot {...props} />
    default:
      return (
        <div
          className="flex items-center justify-center h-64 text-sm rounded-xl"
          style={{ color: CHART_TOKENS.text.muted, background: '#f0f0f0', border: `1px solid ${CHART_TOKENS.border}` }}
        >
          Chart type &quot;{chartType}&quot; not yet supported in explorer
        </div>
      )
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChartBuilder({ rows, columns, datasetId, versionId, onBack, onSave, onInsertIntoDocument, initialChartType, initialConfig, leftPanel, noHeader }: ChartBuilderProps) {
  const [chartType, setChartType] = useState<ChartType>(initialChartType ?? 'bar')
  const [config, setConfig] = useState<ChartConfig>(initialConfig ?? {})
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorConfig, setEditorConfig] = useState<ChartEditorConfig>(() => getDefaultConfig(initialChartType ?? 'bar', { height_px: 380 }))
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
    if (suggestion) {
      setChartType(suggestion.chartType)
      setEditorConfig(c => getDefaultConfig(suggestion.chartType, { height_px: c.height_px }))
    }
  }

  // ── Variable panel section ──────────────────────────────────────────────────

  function VariableSection({ label, cols }: { label: string; cols: ColumnSchema[] }) {
    if (cols.length === 0) return null
    const key = label.toLowerCase()
    const isOpen = expandedGroups[key] ?? true
    return (
      <div>
        <button
          className="flex items-center gap-1 w-full text-left px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors"
          style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}
          onClick={() => toggleGroup(key)}
        >
          <ChevronDown size={9} className={`transition-transform ${isOpen ? '' : '-rotate-90'}`} />
          {label}
          <span className="ml-auto font-normal normal-case tracking-normal">{cols.length}</span>
        </button>
        {isOpen && (
          <div className="pl-2 pr-1 pb-1">
            {cols.map(col => (
              <div
                key={col.name}
                className="flex items-center gap-1.5 py-0.5 px-1 rounded-md text-[11px] cursor-default select-none transition-colors"
                style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}
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

  const panelBg = '#ffffff'
  const panelBorder = CHART_TOKENS.border
  const labelStyle = { color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }
  const sectionHeadStyle = {
    color: CHART_TOKENS.text.muted,
    fontFamily: 'Manrope, sans-serif',
    fontSize: '9px',
    letterSpacing: '0.16em',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#f7f9fb' }}>
      {/* Header */}
      {!noHeader && <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ background: '#ffffff', borderBottom: `1px solid ${panelBorder}` }}
      >
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5" style={{ color: CHART_TOKENS.text.secondary }}>
            <ArrowLeft size={14} />
            Back
          </Button>
        )}
        <span className="font-bold text-sm" style={{ color: CHART_TOKENS.text.primary, fontFamily: 'Manrope, sans-serif' }}>
          Dataset Explorer
        </span>
        <div className="flex items-center gap-2">
          {onInsertIntoDocument && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs font-bold"
              style={{
                background: '#f0f0f0',
                border: `1px solid ${panelBorder}`,
                color: CHART_TOKENS.text.secondary,
              }}
              onClick={() => onInsertIntoDocument(chartType, config)}
            >
              <FileText size={13} />
              Insert into Document
            </Button>
          )}
          <button
            onClick={() => setEditorOpen(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150"
            style={
              editorOpen
                ? { color: chartColor(0), background: chartColorDim(0), border: `1px solid ${chartColorMid(0)}` }
                : { color: CHART_TOKENS.text.secondary, background: '#f0f0f0', border: `1px solid ${panelBorder}` }
            }
            title={editorOpen ? 'Close style editor' : 'Edit chart style'}
          >
            <SlidersHorizontal size={13} />
            <span style={{ fontFamily: 'Manrope, sans-serif' }}>{editorOpen ? 'Done' : 'Edit Style'}</span>
          </button>
          <Button
            size="sm"
            className="gap-1.5 text-xs font-bold"
            style={{ background: chartColor(0), color: '#ffffff' }}
            onClick={() => onSave?.(chartType, config)}
            disabled={!onSave}
          >
            <Save size={13} />
            Save Chart
          </Button>
        </div>
      </div>}

      {/* Body: 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Variables or custom panel ─────────────────────────── */}
        {leftPanel !== undefined ? (
          leftPanel
        ) : (
          <div className="w-48 flex flex-col shrink-0" style={{ background: '#ffffff', borderRight: `1px solid ${panelBorder}` }}>
            <div className="px-3 py-2.5" style={{ ...sectionHeadStyle, borderBottom: `1px solid ${panelBorder}` }}>
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
        )}

        {/* ── Center: Chart canvas ─────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#f7f9fb' }}>
          {/* Chart type pill bar */}
          <div
            className="flex items-center gap-1 px-3 py-2 overflow-x-auto shrink-0"
            style={{ background: '#ffffff', borderBottom: `1px solid ${panelBorder}` }}
          >
            {CHART_TYPES.map(ct => (
              <button
                key={ct.id}
                onClick={() => {
                  setChartType(ct.id)
                  setEditorConfig(c => getDefaultConfig(ct.id, { height_px: c.height_px }))
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap transition-all duration-150 font-medium"
                style={
                  chartType === ct.id
                    ? { background: chartColorDim(0), color: chartColor(0), border: `1px solid ${chartColorMid(0)}`, fontFamily: 'Manrope, sans-serif' }
                    : { background: 'transparent', color: CHART_TOKENS.text.muted, border: '1px solid transparent', fontFamily: 'Manrope, sans-serif' }
                }
              >
                {ct.icon}
                {ct.label}
              </button>
            ))}
          </div>

          {/* Suggestion banner */}
          {suggestion && suggestion.chartType !== chartType && (
            <div
              className="flex items-center gap-2 px-3 py-2 text-xs shrink-0"
              style={{
                background: chartColorDim(1),
                borderBottom: `1px solid ${chartColorMid(1)}`,
                color: chartColor(1),
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              <Lightbulb size={12} />
              <span className="flex-1">{suggestion.reason}</span>
              <button onClick={handleSuggest} className="underline underline-offset-2 font-bold hover:no-underline">
                Switch
              </button>
            </div>
          )}

          {/* Chart */}
          <div className="flex-1 overflow-auto p-5">
            {config.title && (
              <div className="text-center text-sm font-bold mb-3" style={{ color: CHART_TOKENS.text.primary, fontFamily: 'Manrope, sans-serif' }}>
                {config.title}
              </div>
            )}
            <RenderChart
              chartType={chartType}
              rows={rows}
              columns={columns}
              config={config}
              height={editorConfig.height_px}
            />
          </div>
        </div>

        {/* ── Style Editor Panel ───────────────────────────────────────── */}
        {editorOpen && (
          <div
            className="w-[272px] flex-shrink-0 flex flex-col overflow-hidden"
            style={{
              background: '#f3f4f6',
              borderLeft: `1px solid ${panelBorder}`,
            }}
          >
            <ChartEditor
              config={editorConfig}
              onChange={update => setEditorConfig(c => ({ ...c, ...update }))}
              chartType={chartType}
              datasetLabels={[]}
              datasetId={datasetId}
              versionId={versionId}
              chartTitle={config.title ?? chartType}
              chartData={undefined}
              onDownload={() => {}}
            />
          </div>
        )}

        {/* ── Right: Config ────────────────────────────────────────────── */}
        <div className="w-56 flex flex-col shrink-0" style={{ background: '#ffffff', borderLeft: `1px solid ${panelBorder}` }}>
          <div className="px-3 py-2.5" style={{ ...sectionHeadStyle, borderBottom: `1px solid ${panelBorder}` }}>
            Configuration
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-4" style={labelStyle}>
              {/* X Axis */}
              {currentChartDef.requiresX || chartType !== 'heatmap' ? (
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>X Axis</Label>
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
                  <Label className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>
                    Y Axis {!currentChartDef.requiresY && <span style={{ opacity: 0.5 }}>(optional)</span>}
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
                  <Label className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>Value (optional)</Label>
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
                  <Label className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>Color / Series</Label>
                  <ColumnSelect
                    value={config.color}
                    onChange={v => patchConfig({ color: v })}
                    placeholder="None"
                    allowNone={true}
                  />
                </div>
              )}

              {/* Size (bubble only) */}
              {chartType === 'bubble' && (
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>Size <span style={{ opacity: 0.5 }}>(optional)</span></Label>
                  <ColumnSelect
                    value={config.size}
                    onChange={v => patchConfig({ size: v })}
                    placeholder="Uniform"
                    allowNone={true}
                    filterTypes={['number', 'integer', 'decimal']}
                  />
                </div>
              )}

              <Separator />

              {/* Aggregation */}
              {currentChartDef.supportsAgg && (
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>Aggregation</Label>
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
                  <Label className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>Sort</Label>
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
                  <Label className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>Bin Count</Label>
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
                <Label className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>Options</Label>

                {/* Checkbox helper */}
                {[
                  { show: chartType === 'bar', label: 'Show values', checked: config.show_values ?? false, onChange: (v: boolean) => patchConfig({ show_values: v }) },
                  { show: chartType === 'scatter' || chartType === 'line', label: 'Trend line', checked: config.trend_line ?? false, onChange: (v: boolean) => patchConfig({ trend_line: v }) },
                  { show: ['bar','line','area','scatter','bubble'].includes(chartType), label: 'Log scale Y', checked: config.log_scale_y ?? false, onChange: (v: boolean) => patchConfig({ log_scale_y: v }) },
                  { show: chartType === 'scatter' || chartType === 'bubble', label: 'Log scale X', checked: config.log_scale_x ?? false, onChange: (v: boolean) => patchConfig({ log_scale_x: v }) },
                  { show: chartType === 'histogram', label: 'Distribution curve', checked: (config.chart_specific as Record<string,unknown> | undefined)?.show_density as boolean ?? false, onChange: (v: boolean) => patchConfig({ chart_specific: { ...(config.chart_specific as object), show_density: v } }) },
                  { show: chartType === 'box', label: 'Show data points', checked: (config.chart_specific as Record<string,unknown> | undefined)?.show_points as boolean ?? false, onChange: (v: boolean) => patchConfig({ chart_specific: { ...(config.chart_specific as object), show_points: v } }) },
                  { show: chartType === 'box', label: 'Show mean (◇)', checked: (config.chart_specific as Record<string,unknown> | undefined)?.show_mean as boolean ?? false, onChange: (v: boolean) => patchConfig({ chart_specific: { ...(config.chart_specific as object), show_mean: v } }) },
                ].filter(o => o.show).map(({ label, checked, onChange: onCh }) => (
                  <label key={label} className="flex items-center gap-2 text-[11px] cursor-pointer" style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => onCh(e.target.checked)}
                      className="rounded"
                      style={{ accentColor: chartColor(0) }}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <Separator />

              {/* Appearance */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>Appearance</Label>
                <div className="space-y-1">
                  <Label className="text-[10px]" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif', opacity: 0.7 }}>Color palette</Label>
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
                <Label className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>Labels</Label>
                <div className="space-y-1.5">
                  {[
                    { placeholder: 'Chart title…', value: config.title ?? '', key: 'title' as const },
                    { placeholder: 'X axis label…', value: config.x_label ?? '', key: 'x_label' as const },
                    { placeholder: 'Y axis label…', value: config.y_label ?? '', key: 'y_label' as const },
                  ].map(({ placeholder, value, key }) => (
                    <input
                      key={key}
                      type="text"
                      placeholder={placeholder}
                      value={value}
                      onChange={e => patchConfig({ [key]: e.target.value || undefined })}
                      className="w-full h-7 px-2.5 text-[11px] rounded-lg outline-none transition-all"
                      style={{
                        background: '#f0f0f0',
                        border: `1px solid ${CHART_TOKENS.border}`,
                        color: CHART_TOKENS.text.primary,
                        fontFamily: 'Manrope, sans-serif',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
