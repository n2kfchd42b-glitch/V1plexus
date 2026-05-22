"use client"

import { useState } from 'react'
import { SlidersHorizontal, Download, Save, BookOpen, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { createDatasetExploration } from '@/lib/data'
import { logAudit } from '@/lib/audit'
import type { ChartEditorConfig, LegendPosition } from '@/lib/chartEditorConfig'
import { CHART_TYPES_WITH_FILL, CHART_TYPES_WITH_AXES } from '@/lib/chartEditorConfig'
import { CHART_TOKENS, chartColor, chartColorMid, chartColorDim } from '@/lib/charts/design-tokens'

// ── Toggle ────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative inline-flex w-8 h-[18px] rounded-full transition-colors duration-150 flex-shrink-0"
      style={{ background: checked ? chartColor(0) : '#f0f0f0' }}
      role="switch"
      aria-checked={checked}
    >
      <span
        className="absolute top-[2px] w-[14px] h-[14px] rounded-full shadow-sm transition-all duration-150"
        style={{
          background: '#ffffff',
          left: checked ? '18px' : '2px',
        }}
      />
    </button>
  )
}

// ── Section Header ────────────────────────────────────────────
function SectionHeader({ label, expanded, onToggle }: { label: string; expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-between w-full py-0.5 group"
    >
      <span
        className="text-[9px] font-bold uppercase tracking-[0.16em]"
        style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}
      >
        {label}
      </span>
      {expanded
        ? <ChevronDown className="h-3 w-3" style={{ color: CHART_TOKENS.text.muted }} />
        : <ChevronRight className="h-3 w-3" style={{ color: CHART_TOKENS.text.muted }} />
      }
    </button>
  )
}

// ── Pill button helpers ────────────────────────────────────────
function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 px-2 py-1.5 rounded-md text-[10px] font-bold transition-all duration-150"
      style={
        active
          ? {
              background: chartColorDim(0),
              color: chartColor(0),
              border: `1px solid ${chartColorMid(0)}`,
            }
          : {
              background: '#f0f0f0',
              color: CHART_TOKENS.text.secondary,
              border: `1px solid ${CHART_TOKENS.border}`,
            }
      }
    >
      {children}
    </button>
  )
}

// ── Main Component Props ──────────────────────────────────────
interface ChartEditorProps {
  config: ChartEditorConfig
  onChange: (update: Partial<ChartEditorConfig>) => void
  chartType: string
  datasetLabels: string[]
  runId?: string
  datasetId?: string | null
  versionId?: string | null
  chartTitle?: string
  analysisTitle?: string
  chartData?: unknown
  onDownload: () => void
}

type SectionKey = 'dimensions' | 'colors' | 'axes' | 'title' | 'legend' | 'export'

export function ChartEditor({
  config,
  onChange,
  chartType,
  datasetLabels,
  runId,
  datasetId,
  versionId,
  chartTitle,
  analysisTitle,
  chartData,
  onDownload,
}: ChartEditorProps) {
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    dimensions: true,
    colors: true,
    axes: true,
    title: false,
    legend: true,
    export: false,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingExp, setIsSavingExp] = useState(false)

  const toggleSection = (key: SectionKey) => setSections(s => ({ ...s, [key]: !s[key] }))

  const showFill = CHART_TYPES_WITH_FILL.has(chartType)
  const showAxes = CHART_TYPES_WITH_AXES.has(chartType)

  const widthOptions: { value: ChartEditorConfig['width']; label: string }[] = [
    { value: 'full',          label: 'Full' },
    { value: 'three-quarter', label: '3/4'  },
    { value: 'half',          label: '1/2'  },
    { value: 'custom',        label: 'Custom'},
  ]

  const legendPositions: { value: LegendPosition; label: string }[] = [
    { value: 'top',    label: 'Top'  },
    { value: 'bottom', label: 'Bot'  },
    { value: 'left',   label: 'Left' },
    { value: 'right',  label: 'Right'},
  ]

  async function handleSaveConfig() {
    if (!runId) return
    setIsSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('analysis_runs')
        .update({ chart_config: config as unknown as Record<string, unknown> })
        .eq('id', runId)
      if (error) throw error
      toast.success('Settings saved', { duration: 1500 })
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveExplorations() {
    if (!datasetId) { toast.error('No dataset linked to this analysis'); return }
    setIsSavingExp(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const title =
        config.show_title && config.chart_title
          ? config.chart_title
          : analysisTitle ?? chartTitle ?? 'Chart'
      const result = await createDatasetExploration(supabase, {
        dataset_id:     datasetId,
        version_id:     versionId ?? null,
        title,
        chart_type:     chartType as import('@/types/database').ChartType,
        config:         { chart_data: chartData, editor_config: config },
        thumbnail_path: null,
        created_by:     user?.id ?? null,
      })
      if (result.status === 'error') throw new Error(result.error ?? 'Failed to save')

      if (user && result.data) {
        logAudit(
          'dataset.exploration.created',
          'dataset_exploration',
          result.data.id,
          {
            summary: `Created chart "${title}" from analysis`,
            operation: {
              title,
              chart_type: chartType,
              dataset_id: datasetId ?? null,
              version_id: versionId ?? null,
              run_id: runId ?? null,
            },
          },
        )
      }

      toast.success('Chart saved to Dataset Explorations')
    } catch {
      toast.error('Failed to save exploration')
    } finally {
      setIsSavingExp(false)
    }
  }

  // Shared input style
  const inputCls = "w-full text-[11px] rounded-lg px-3 py-2 outline-none transition-all duration-150 placeholder-opacity-40"
  const inputStyle = {
    background: '#f0f0f0',
    border: `1px solid ${CHART_TOKENS.border}`,
    color: CHART_TOKENS.text.primary,
    fontFamily: 'Manrope, sans-serif',
  }
  const inputFocusStyle = {
    border: `1px solid ${chartColorMid(0)}`,
    boxShadow: `0 0 0 2px ${chartColorDim(0)}`,
  }

  function StyledInput({ value, onChange: onCh, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    const [focused, setFocused] = useState(false)
    return (
      <input
        type="text"
        value={value}
        onChange={e => onCh(e.target.value)}
        placeholder={placeholder}
        className={inputCls}
        style={{ ...inputStyle, ...(focused ? inputFocusStyle : {}) }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    )
  }

  // Slider track
  function sliderTrack(pct: number) {
    return `linear-gradient(to right, ${chartColor(0)} ${pct}%, ${'#f0f0f0'} ${pct}%)`
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="px-5 pt-5 pb-4 flex-shrink-0"
        style={{ borderBottom: `1px solid ${CHART_TOKENS.border}` }}
      >
        <div className="flex items-center gap-2 mb-0.5">
          <SlidersHorizontal className="h-[15px] w-[15px] flex-shrink-0" style={{ color: chartColor(0) }} />
          <h4
            className="font-bold text-[13px]"
            style={{ color: CHART_TOKENS.text.primary, fontFamily: 'Manrope, sans-serif' }}
          >
            Editor Settings
          </h4>
        </div>
        <p className="text-[10px] pl-[23px]" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>
          Customize visual parameters
        </p>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">

        {/* ── DIMENSIONS ─────────────────────────────────────── */}
        <div className="space-y-3">
          <SectionHeader label="Dimensions" expanded={sections.dimensions} onToggle={() => toggleSection('dimensions')} />
          {sections.dimensions && (
            <div className="space-y-4">
              {/* Height */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold" style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}>Height</label>
                  <span
                    className="text-[10px] font-bold rounded-md px-1.5 py-0.5"
                    style={{ color: chartColor(0), background: chartColorDim(0), fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {config.height_px}px
                  </span>
                </div>
                <input
                  type="range" min={200} max={600} step={20}
                  value={config.height_px}
                  onChange={e => onChange({ height_px: Number(e.target.value) })}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{ background: sliderTrack(((config.height_px - 200) / 400) * 100) }}
                />
              </div>

              {/* Width */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold" style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}>Width</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {widthOptions.map(opt => (
                    <Pill key={opt.value} active={config.width === opt.value} onClick={() => onChange({ width: opt.value })}>
                      {opt.label}
                    </Pill>
                  ))}
                </div>
                {config.width === 'custom' && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number" min={200} max={1200}
                      value={config.custom_width_px ?? 800}
                      onChange={e => onChange({ custom_width_px: Number(e.target.value) })}
                      className="w-20 rounded-md px-2 py-1.5 text-[11px] outline-none"
                      style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
                    />
                    <span className="text-[10px]" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>px (200–1200)</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── COLORS ─────────────────────────────────────────── */}
        <div className="space-y-3">
          <SectionHeader label="Colors" expanded={sections.colors} onToggle={() => toggleSection('colors')} />
          {sections.colors && (
            <div className="space-y-3">
              <label className="text-[11px] font-semibold" style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}>Series Colors</label>
              {config.dataset_colors.map((color, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  {/* Color swatch */}
                  <div
                    className="relative w-7 h-7 rounded-full flex-shrink-0 cursor-pointer overflow-hidden"
                    style={{
                      background: color,
                      boxShadow: `0 0 0 2px ${'#f3f4f6'}, 0 0 0 3px ${color}40`,
                    }}
                  >
                    <input
                      type="color"
                      value={color}
                      onChange={e => {
                        const next = [...config.dataset_colors]
                        next[i] = e.target.value
                        onChange({ dataset_colors: next })
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      title="Pick color"
                    />
                  </div>
                  {/* Hex input */}
                  <input
                    type="text"
                    value={color}
                    maxLength={7}
                    onChange={e => {
                      if (/^#?[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                        const next = [...config.dataset_colors]
                        next[i] = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
                        onChange({ dataset_colors: next })
                      }
                    }}
                    className="w-[72px] rounded-md px-2 py-1 text-[10px] outline-none"
                    style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
                  />
                  {/* Series label */}
                  <span className="text-[10px] truncate flex-1 min-w-0" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>
                    {datasetLabels[i] ?? `Series ${i + 1}`}
                  </span>
                </div>
              ))}

              {/* Fill opacity (bar / area charts only) */}
              {showFill && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold" style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}>Fill Opacity</label>
                    <span className="text-[10px]" style={{ color: CHART_TOKENS.text.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                      {Math.round(config.background_opacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range" min={0} max={100} step={5}
                    value={Math.round(config.background_opacity * 100)}
                    onChange={e => onChange({ background_opacity: Number(e.target.value) / 100 })}
                    className="w-full h-1 rounded-full appearance-none cursor-pointer"
                    style={{ background: sliderTrack(config.background_opacity * 100) }}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => onChange({
                  dataset_colors: ['#3fb8b0', '#d4a853', '#e05c7a', '#8b7cf8', '#6cb68c', '#e8944a'],
                  background_opacity: 0.45,
                })}
                className="text-[10px] transition-colors"
                style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}
              >
                Reset to Empirical Canvas defaults
              </button>
            </div>
          )}
        </div>

        {/* ── AXIS LABELS ─────────────────────────────────────── */}
        {showAxes && (
          <div className="space-y-3">
            <SectionHeader label="Axis Labels" expanded={sections.axes} onToggle={() => toggleSection('axes')} />
            {sections.axes && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold" style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}>Show axis labels</span>
                  <Toggle checked={config.show_axis_labels} onChange={v => onChange({ show_axis_labels: v })} />
                </div>
                {config.show_axis_labels && (
                  <div className="space-y-2">
                    <StyledInput
                      value={config.x_axis_label}
                      onChange={v => onChange({ x_axis_label: v })}
                      placeholder="X-axis label…"
                    />
                    <StyledInput
                      value={config.y_axis_label}
                      onChange={v => onChange({ y_axis_label: v })}
                      placeholder="Y-axis label…"
                    />
                    <p className="text-[10px] italic" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>
                      Manrope 11px · journal-ready
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TITLE ───────────────────────────────────────────── */}
        <div className="space-y-3">
          <SectionHeader label="Title" expanded={sections.title} onToggle={() => toggleSection('title')} />
          {sections.title && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold" style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}>Show chart title</span>
                <Toggle checked={config.show_title} onChange={v => onChange({ show_title: v })} />
              </div>
              {config.show_title && (
                <StyledInput
                  value={config.chart_title}
                  onChange={v => onChange({ chart_title: v })}
                  placeholder="Chart title…"
                />
              )}
            </div>
          )}
        </div>

        {/* ── LEGEND & GRID ────────────────────────────────────── */}
        <div className="space-y-3">
          <SectionHeader label="Legend & Grid" expanded={sections.legend} onToggle={() => toggleSection('legend')} />
          {sections.legend && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold" style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}>Show legend</span>
                <Toggle checked={config.show_legend} onChange={v => onChange({ show_legend: v })} />
              </div>

              {config.show_legend && (
                <div className="flex gap-1 pt-0.5">
                  {legendPositions.map(pos => (
                    <Pill
                      key={pos.value}
                      active={config.legend_position === pos.value}
                      onClick={() => onChange({ legend_position: pos.value })}
                    >
                      {pos.label}
                    </Pill>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[11px] font-semibold" style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}>Show grid lines</span>
                <Toggle checked={config.show_grid} onChange={v => onChange({ show_grid: v })} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold" style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}>Data labels</span>
                <Toggle checked={config.show_data_labels} onChange={v => onChange({ show_data_labels: v })} />
              </div>
            </div>
          )}
        </div>

        {/* ── EXPORT ──────────────────────────────────────────── */}
        <div className="space-y-3">
          <SectionHeader label="Export Settings" expanded={sections.export} onToggle={() => toggleSection('export')} />
          {sections.export && (
            <div className="space-y-3">
              <label className="text-[11px] font-semibold" style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}>Resolution</label>
              <div className="flex gap-1.5">
                {([150, 300] as const).map(dpi => (
                  <Pill key={dpi} active={config.export_dpi === dpi} onClick={() => onChange({ export_dpi: dpi })}>
                    {dpi === 150 ? 'Screen' : 'Publication'}
                  </Pill>
                ))}
              </div>
              <p className="text-[10px] italic" style={{ color: CHART_TOKENS.text.muted, fontFamily: 'Manrope, sans-serif' }}>
                300 DPI recommended for journal submission
              </p>
              <button
                type="button"
                onClick={onDownload}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-[11px] font-bold transition-all duration-150"
                style={{
                  background: '#f0f0f0',
                  border: `1px solid ${CHART_TOKENS.border}`,
                  color: CHART_TOKENS.text.secondary,
                  fontFamily: 'Manrope, sans-serif',
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Download Chart
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div
        className="px-5 py-4 space-y-2 flex-shrink-0"
        style={{
          borderTop: `1px solid ${CHART_TOKENS.border}`,
          background: '#f3f4f6',
        }}
      >
        {datasetId && (
          <button
            type="button"
            onClick={handleSaveExplorations}
            disabled={isSavingExp}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[11px] font-bold transition-all duration-150 disabled:opacity-50"
            style={{
              background: chartColorDim(0),
              border: `1px solid ${chartColorMid(0)}`,
              color: chartColor(0),
              fontFamily: 'Manrope, sans-serif',
            }}
          >
            <BookOpen className="h-3.5 w-3.5" />
            {isSavingExp ? 'Saving…' : 'Save to Explorations'}
          </button>
        )}
        {runId && (
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-medium transition-all duration-150 disabled:opacity-50"
            style={{ color: CHART_TOKENS.text.secondary, fontFamily: 'Manrope, sans-serif' }}
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Saving…' : 'Save chart settings'}
          </button>
        )}
      </div>
    </div>
  )
}
