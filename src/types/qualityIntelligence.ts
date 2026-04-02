/**
 * Quality Intelligence types
 */

export type QualityFlagSeverity = 'critical' | 'warning' | 'info'
export type QualityFlagCategory = 'completeness' | 'uniqueness' | 'validity' | 'consistency' | 'structural'
export type ReadinessStatus = 'ready' | 'caution' | 'not_ready'
export type EnumeratorFlagStatus = 'clean' | 'review' | 'investigate'

export interface QualityFlag {
  severity: QualityFlagSeverity
  category: QualityFlagCategory
  variable: string | null
  message: string
  detail: string
  auto_resolved: boolean
}

export interface DimensionScore {
  score: number
  max_score: number
  findings: string[]
  methodology: string
}

export interface QualityDimensions {
  completeness: DimensionScore
  uniqueness: DimensionScore
  validity: DimensionScore
  consistency: DimensionScore
  structural_integrity: DimensionScore
}

export interface EnumeratorMetric {
  enumerator_id: string
  record_count: number
  record_pct: number
  overall_missingness_rate: number
  high_missingness_columns: {
    column: string
    missing_rate: number
  }[]
  outlier_rate: number
  response_pattern_score: number
  avg_completion_time_mins: number | null
  fast_completion_flag: boolean
  flag_status: EnumeratorFlagStatus
  flag_reasons: string[]
}

export interface QualityReport {
  id: string
  dataset_id: string
  version_id: string
  computed_at: string
  computed_by: string | null
  overall_score: number
  dimensions: QualityDimensions
  flags: QualityFlag[]
  enumerator_metrics: Record<string, EnumeratorMetric> | null
  readiness_status: ReadinessStatus
  readiness_summary: string
  algorithm_version: string
}

export interface Inconsistency {
  variable: string
  type: 'implausible_change' | 'category_mismatch' | 'missing_in_wave'
  severity: 'critical' | 'warning'
  count: number
  message: string
  examples: {
    participant_id: string
    wave_a_value: unknown
    wave_b_value: unknown
    difference?: unknown
  }[]
}

export interface DistributionShift {
  test: string
  statistic: number
  p_value: number
  significant: boolean
  interpretation: string
}

export interface WaveConsistencyReport {
  id: string
  project_id: string
  wave_a_version_id: string
  wave_b_version_id: string
  participant_id_column: string
  computed_at: string
  participants_wave_a: number
  participants_wave_b: number
  matched_participants: number
  only_in_wave_a: number
  only_in_wave_b: number
  inconsistencies: Inconsistency[]
  distribution_shifts: Record<string, DistributionShift>
  consistency_score: number
  computed_by: string | null
}
