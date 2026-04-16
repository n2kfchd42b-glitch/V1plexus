export type ChartWidth = 'full' | 'three-quarter' | 'half' | 'custom'
export type LegendPosition = 'top' | 'bottom' | 'left' | 'right'

export interface ChartEditorConfig {
  width: ChartWidth
  custom_width_px: number | null
  height_px: number
  dataset_colors: string[]
  background_opacity: number
  x_axis_label: string
  y_axis_label: string
  show_axis_labels: boolean
  chart_title: string
  show_title: boolean
  show_legend: boolean
  legend_position: LegendPosition
  show_grid: boolean
  grid_color: string
  show_data_labels: boolean
  export_dpi: 150 | 300
}

export const DEFAULT_CHART_EDITOR_CONFIG: ChartEditorConfig = {
  width: 'full',
  custom_width_px: null,
  height_px: 160,
  dataset_colors: ['#3fb8b0', '#d4a853', '#e05c7a', '#8b7cf8', '#6cb68c', '#e8944a'],
  background_opacity: 0.45,
  x_axis_label: '',
  y_axis_label: '',
  show_axis_labels: false,
  chart_title: '',
  show_title: false,
  show_legend: true,
  legend_position: 'bottom',
  show_grid: true,
  grid_color: 'rgba(0,24,72,0.06)',
  show_data_labels: false,
  export_dpi: 300,
}

const COLOR_OVERRIDES: Record<string, string[]> = {
  km_curve:    ['#3fb8b0', '#d4a853', '#e05c7a', '#8b7cf8'],
  roc_curve:   ['#3fb8b0', '#8b949e'],
  forest_or:   ['#3fb8b0', '#e05c7a'],
  forest_hr:   ['#3fb8b0', '#e05c7a'],
  forest_irr:  ['#3fb8b0', '#e05c7a'],
  forest_meta: ['#3fb8b0', '#d4a853'],
  histogram:   ['#3fb8b0'],
  epi_curve:   ['#e05c7a', '#d4a853', '#8b7cf8'],
}

export function getDefaultConfig(chartType: string, saved?: Record<string, unknown>): ChartEditorConfig {
  const base: ChartEditorConfig = {
    ...DEFAULT_CHART_EDITOR_CONFIG,
    dataset_colors: COLOR_OVERRIDES[chartType] ?? DEFAULT_CHART_EDITOR_CONFIG.dataset_colors,
  }
  if (!saved) return base
  return { ...base, ...(saved as Partial<ChartEditorConfig>) }
}

// Chart types that show Background Opacity slider
export const CHART_TYPES_WITH_FILL = new Set([
  'bar', 'histogram', 'time_series', 'roc_curve', 'power_curve', 'epi_curve', 'scree_plot',
])

// Chart types that have axes (show axis label config)
export const CHART_TYPES_WITH_AXES = new Set([
  'histogram', 'bar', 'grouped_bar', 'scatter_regression', 'residual_plot',
  'roc_curve', 'km_curve', 'time_series', 'scree_plot', 'cluster_scatter',
  'power_curve', 'epi_curve', 'acf_plot', 'boxplot_2group', 'boxplot_groups',
  'funnel_plot',
])
