"use client"

import { useState } from 'react'
import { SlidersHorizontal, Download, Save, BookOpen, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { ChartEditorConfig, LegendPosition } from '@/lib/chartEditorConfig'
import { CHART_TYPES_WITH_FILL, CHART_TYPES_WITH_AXES } from '@/lib/chartEditorConfig'

// ── Sub-components ───────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-8 h-[18px] rounded-full transition-colors duration-150 flex-shrink-0 ${
        checked ? 'bg-[#003d9b]' : 'bg-[#D4D4D8]'
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full shadow-sm transition-all duration-150 ${
          checked ? 'left-[18px]' : 'left-[2px]'
        }`}
      />
    </button>
  )
}

function SectionHeader({
  label,
  expanded,
  onToggle,
}: {
  label: string
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-between w-full py-0.5 group"
    >
      <span className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-[0.12em] font-manrope">
        {label}
      </span>
      {expanded ? (
        <ChevronDown className="h-3 w-3 text-[#A1A1AA]" />
      ) : (
        <ChevronRight className="h-3 w-3 text-[#A1A1AA]" />
      )}
    </button>
  )
}

// ── Main Component ───────────────────────────────────────────

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

  const toggleSection = (key: SectionKey) =>
    setSections(s => ({ ...s, [key]: !s[key] }))

  const showFill = CHART_TYPES_WITH_FILL.has(chartType)
  const showAxes = CHART_TYPES_WITH_AXES.has(chartType)

  const widthOptions: { value: ChartEditorConfig['width']; label: string }[] = [
    { value: 'full', label: 'Full' },
    { value: 'three-quarter', label: '3/4' },
    { value: 'half', label: '1/2' },
    { value: 'custom', label: 'Custom' },
  ]

  const legendPositions: { value: LegendPosition; label: string }[] = [
    { value: 'top', label: 'Top' },
    { value: 'bottom', label: 'Bot' },
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
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
    if (!datasetId) {
      toast.error('No dataset linked to this analysis')
      return
    }
    setIsSavingExp(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const title =
        config.show_title && config.chart_title
          ? config.chart_title
          : analysisTitle ?? chartTitle ?? 'Chart'
      const { error } = await supabase.from('dataset_explorations').insert({
        dataset_id: datasetId,
        version_id: versionId ?? null,
        title,
        chart_type: chartType,
        config: {
          chart_data: chartData,
          editor_config: config,
        },
        thumbnail_path: null,
        created_by: user?.id ?? null,
      })
      if (error) throw error
      toast.success('Chart saved to Dataset Explorations')
    } catch {
      toast.error('Failed to save exploration')
    } finally {
      setIsSavingExp(false)
    }
  }

  const pillActive =
    'text-white text-[10px] font-bold rounded-md transition-all'
  const pillInactive =
    'bg-white text-[#52525B] text-[10px] font-bold rounded-md hover:bg-[#eceef0] transition-all'
  const primaryGradient = { background: 'linear-gradient(135deg, #003d9b 0%, #0052cc 100%)' }

  const inputCls =
    'w-full text-xs bg-white border border-[rgba(195,198,214,0.5)] rounded-md px-3 py-2 outline-none focus:border-[#003d9b] focus:shadow-[0_0_0_2px_rgba(0,61,155,0.08)] placeholder-[#A1A1AA] text-[#18181B]'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Panel Header */}
      <div className="px-5 pt-5 pb-4 border-b border-[rgba(195,198,214,0.25)] flex-shrink-0">
        <div className="flex items-center gap-2 mb-0.5">
          <SlidersHorizontal className="h-[15px] w-[15px] text-[#003d9b] flex-shrink-0" />
          <h4 className="font-manrope font-bold text-[13px] text-[#18181B]">Editor Settings</h4>
        </div>
        <p className="text-[11px] text-[#A1A1AA] pl-[23px]">Customize visual parameters</p>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">

        {/* ── DIMENSIONS ─────────────────────────────────────────── */}
        <div className="space-y-3">
          <SectionHeader
            label="Dimensions"
            expanded={sections.dimensions}
            onToggle={() => toggleSection('dimensions')}
          />
          {sections.dimensions && (
            <div className="space-y-4">
              {/* Height slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-[#52525B]">Height</label>
                  <span className="font-mono text-[10px] text-[#003d9b] bg-[#dde1ff] px-1.5 py-0.5 rounded-[4px]">
                    {config.height_px}px
                  </span>
                </div>
                <input
                  type="range"
                  min={200}
                  max={600}
                  step={20}
                  value={config.height_px}
                  onChange={e => onChange({ height_px: Number(e.target.value) })}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #0052cc ${((config.height_px - 200) / 400) * 100}%, #dde1ff ${((config.height_px - 200) / 400) * 100}%)`,
                  }}
                />
              </div>

              {/* Width selector */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-[#52525B]">Width Control</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {widthOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onChange({ width: opt.value })}
                      className={config.width === opt.value ? `px-2 py-1.5 ${pillActive}` : `px-2 py-1.5 ${pillInactive}`}
                      style={config.width === opt.value ? primaryGradient : {}}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {config.width === 'custom' && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      min={200}
                      max={1200}
                      value={config.custom_width_px ?? 800}
                      onChange={e => onChange({ custom_width_px: Number(e.target.value) })}
                      className="w-20 font-mono text-[11px] bg-white border border-[rgba(195,198,214,0.5)] rounded-md px-2 py-1.5 outline-none focus:border-[#003d9b]"
                    />
                    <span className="text-[11px] text-[#A1A1AA]">px (200–1200)</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── COLORS ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          <SectionHeader
            label="Colors"
            expanded={sections.colors}
            onToggle={() => toggleSection('colors')}
          />
          {sections.colors && (
            <div className="space-y-3">
              <label className="text-[11px] font-semibold text-[#52525B]">Series Colors</label>
              {config.dataset_colors.map((color, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  {/* Color swatch + native picker */}
                  <div
                    className="relative w-7 h-7 rounded-full border-2 border-white flex-shrink-0 cursor-pointer overflow-hidden"
                    style={{
                      background: color,
                      boxShadow: '0 0 0 1px rgba(195,198,214,0.6)',
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
                    className="w-[72px] font-mono text-[10px] bg-white border border-[rgba(195,198,214,0.5)] rounded-md px-2 py-1 outline-none focus:border-[#003d9b]"
                  />
                  {/* Series label */}
                  <span className="text-[10px] text-[#A1A1AA] truncate flex-1 min-w-0">
                    {datasetLabels[i] ?? `Series ${i + 1}`}
                  </span>
                </div>
              ))}

              {/* Fill opacity (bar / area charts only) */}
              {showFill && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-[#52525B]">Fill Opacity</label>
                    <span className="font-mono text-[10px] text-[#52525B]">
                      {Math.round(config.background_opacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(config.background_opacity * 100)}
                    onChange={e => onChange({ background_opacity: Number(e.target.value) / 100 })}
                    className="w-full h-1 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #0052cc ${config.background_opacity * 100}%, #dde1ff ${config.background_opacity * 100}%)`,
                    }}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() =>
                  onChange({
                    dataset_colors: ['#003d9b', '#0052cc', '#16a34a', '#b45309', '#7c3aed', '#0891b2'],
                    background_opacity: 0.15,
                  })
                }
                className="text-[11px] text-[#A1A1AA] hover:text-[#52525B] transition-colors"
              >
                Reset to defaults
              </button>
            </div>
          )}
        </div>

        {/* ── AXIS LABELS ─────────────────────────────────────────── */}
        {showAxes && (
          <div className="space-y-3">
            <SectionHeader
              label="Axis Labels"
              expanded={sections.axes}
              onToggle={() => toggleSection('axes')}
            />
            {sections.axes && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#52525B]">Show axis labels</span>
                  <Toggle
                    checked={config.show_axis_labels}
                    onChange={v => onChange({ show_axis_labels: v })}
                  />
                </div>
                {config.show_axis_labels && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={config.x_axis_label}
                      onChange={e => onChange({ x_axis_label: e.target.value })}
                      placeholder="X-axis label..."
                      className={inputCls}
                    />
                    <input
                      type="text"
                      value={config.y_axis_label}
                      onChange={e => onChange({ y_axis_label: e.target.value })}
                      placeholder="Y-axis label..."
                      className={inputCls}
                    />
                    <p className="text-[10px] text-[#A1A1AA] italic">
                      Labels use Inter 12px (journal standard)
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TITLE ───────────────────────────────────────────────── */}
        <div className="space-y-3">
          <SectionHeader
            label="Title"
            expanded={sections.title}
            onToggle={() => toggleSection('title')}
          />
          {sections.title && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#52525B]">Show chart title</span>
                <Toggle
                  checked={config.show_title}
                  onChange={v => onChange({ show_title: v })}
                />
              </div>
              {config.show_title && (
                <input
                  type="text"
                  value={config.chart_title}
                  onChange={e => onChange({ chart_title: e.target.value })}
                  placeholder="Chart title..."
                  className={inputCls}
                />
              )}
            </div>
          )}
        </div>

        {/* ── LEGEND & GRID ────────────────────────────────────────── */}
        <div className="space-y-3">
          <SectionHeader
            label="Legend & Grid"
            expanded={sections.legend}
            onToggle={() => toggleSection('legend')}
          />
          {sections.legend && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#52525B]">Show legend</span>
                <Toggle
                  checked={config.show_legend}
                  onChange={v => onChange({ show_legend: v })}
                />
              </div>

              {config.show_legend && (
                <div className="flex gap-1 pt-0.5">
                  {legendPositions.map(pos => (
                    <button
                      key={pos.value}
                      type="button"
                      onClick={() => onChange({ legend_position: pos.value })}
                      className={
                        config.legend_position === pos.value
                          ? `flex-1 px-1.5 py-1.5 ${pillActive}`
                          : `flex-1 px-1.5 py-1.5 ${pillInactive}`
                      }
                      style={config.legend_position === pos.value ? primaryGradient : {}}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[11px] font-semibold text-[#52525B]">Show grid lines</span>
                <Toggle
                  checked={config.show_grid}
                  onChange={v => onChange({ show_grid: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#52525B]">Data labels</span>
                <Toggle
                  checked={config.show_data_labels}
                  onChange={v => onChange({ show_data_labels: v })}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── EXPORT SETTINGS ─────────────────────────────────────── */}
        <div className="space-y-3">
          <SectionHeader
            label="Export Settings"
            expanded={sections.export}
            onToggle={() => toggleSection('export')}
          />
          {sections.export && (
            <div className="space-y-3">
              <label className="text-[11px] font-bold text-[#52525B]">Export resolution</label>
              <div className="flex gap-1.5">
                {([150, 300] as const).map(dpi => (
                  <button
                    key={dpi}
                    type="button"
                    onClick={() => onChange({ export_dpi: dpi })}
                    className={
                      config.export_dpi === dpi
                        ? `flex-1 px-2 py-1.5 ${pillActive}`
                        : `flex-1 px-2 py-1.5 ${pillInactive}`
                    }
                    style={config.export_dpi === dpi ? primaryGradient : {}}
                  >
                    {dpi === 150 ? 'Screen' : 'Publication'}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#A1A1AA] italic">
                300 DPI recommended for journal submission
              </p>
              <button
                type="button"
                onClick={onDownload}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-[rgba(195,198,214,0.5)] rounded-md text-[11px] font-bold text-[#52525B] hover:bg-[#f2f4f6] transition-all"
                style={{ boxShadow: '0 4px 12px rgba(0,24,72,0.04)' }}
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
        className="px-5 py-4 space-y-2 flex-shrink-0 border-t border-[rgba(195,198,214,0.25)]"
        style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)' }}
      >
        {datasetId && (
          <button
            type="button"
            onClick={handleSaveExplorations}
            disabled={isSavingExp}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-[11px] font-bold text-[#003d9b] bg-[#dde1ff] rounded-md hover:bg-[#c8d0f5] transition-all disabled:opacity-60"
          >
            <BookOpen className="h-3.5 w-3.5" />
            {isSavingExp ? 'Saving...' : 'Save to Explorations'}
          </button>
        )}
        {runId && (
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 py-2 text-[11px] font-medium text-[#52525B] hover:text-[#18181B] transition-all disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Saving...' : 'Save chart settings'}
          </button>
        )}
      </div>
    </div>
  )
}
