/**
 * Analysis Integrity types for Phase 4
 */

export type AssumptionStatus = 'passed' | 'violated' | 'warning' | 'not_applicable'
export type AssumptionSeverity = 'critical' | 'moderate' | 'minor'
export type RunRecommendation = 'proceed' | 'proceed_with_caution' | 'consider_alternatives'

export interface AssumptionCheck {
  assumption_name: string
  description: string
  status: AssumptionStatus
  severity: AssumptionSeverity
  test_used: string | null
  statistic: number | null
  p_value: number | null
  finding: string
  implication: string
  suggested_action: string | null
  alternative_tests: string[]
  variable_affected: string | null
}

export interface AssumptionCheckResult {
  check_id: string
  analysis_type: string
  checks: AssumptionCheck[]
  all_passed: boolean
  run_recommendation: RunRecommendation
  critical_violations: number
  moderate_violations: number
  minor_violations: number
  not_applicable_count: number
  requires_acknowledgement: boolean
}

export interface AssumptionCheckRecord {
  id: string
  analysis_run_id: string | null
  dataset_id: string
  version_id: string
  project_id: string
  analysis_type: string
  requested_by: string
  checks: AssumptionCheck[]
  all_passed: boolean
  acknowledged: boolean
  acknowledged_at: string | null
  acknowledged_by: string | null
  acknowledgement_audit_id: string | null
  analysis_proceeded: boolean
  created_at: string
  updated_at: string
}

export type AcknowledgementNotes = Record<string, string>

export type ReentrySessionStatus =
  | 'pending'
  | 'reentry_submitted'
  | 'comparing'
  | 'discrepancies_found'
  | 'resolved'
  | 'validated'

export interface ReentrySession {
  id: string
  dataset_id: string
  project_id: string
  original_version_id: string
  reentry_version_id: string | null
  initiated_by: string
  reentry_assigned_to: string | null
  status: ReentrySessionStatus
  columns_to_validate: string[] | null
  participant_id_column: string
  comparison_result: ComparisonResult | null
  verified_version_id: string | null
  overall_agreement_pct: number | null
  created_at: string
  updated_at: string
}

export interface ComparisonResult {
  compared_at: string
  total_participants_original: number
  total_participants_reentry: number
  matched_participants: number
  only_in_original: number
  only_in_reentry: number
  columns_validated: string[]
  total_cells_compared: number
  total_discrepancies: number
  overall_agreement_pct: number
  per_column_agreement: Record<
    string,
    {
      agreement_pct: number
      discrepancy_count: number
    }
  >
  perfect_match_count: number
  discrepant_participant_count: number
}

export type DiscrepancyStatus =
  | 'pending'
  | 'resolved_original'
  | 'resolved_reentry'
  | 'resolved_manual'
  | 'flagged_for_investigation'

export interface Discrepancy {
  id: string
  session_id: string
  participant_id: string
  column_name: string
  original_value: string | null
  reentry_value: string | null
  status: DiscrepancyStatus
  resolved_value: string | null
  resolved_by: string | null
  resolved_at: string | null
  resolution_note: string | null
  created_at: string
}

export type ResolutionInput = {
  discrepancy_id: string
  status: Exclude<DiscrepancyStatus, 'pending'>
  resolved_value: string
  resolution_note?: string
}
