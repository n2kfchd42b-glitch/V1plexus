/**
 * Comprehensive audit types for immutable ledger
 */

export type AuditAction =
  // Dataset operations
  | 'dataset.imported'
  | 'dataset.version.created'
  | 'dataset.version.committed'
  | 'dataset.branch.created'
  | 'dataset.branch.merged'
  | 'dataset.rows.dropped'
  | 'dataset.column.recoded'
  | 'dataset.imputation.mice'
  | 'dataset.duplicates.resolved'
  | 'dataset.exploration.created'
  | 'dataset.approved'
  | 'dataset.approval.requested'
  | 'dataset.approval.rejected'
  | 'dataset.approval.revision_requested'
  // Analysis operations
  | 'analysis.run.started'
  | 'analysis.run.completed'
  | 'analysis.run.failed'
  | 'analysis.assumption.acknowledged'
  // Document operations
  | 'document.created'
  | 'document.edited'
  | 'document.generated'
  | 'document.exported'
  | 'document.submitted'
  // Project operations
  | 'project.created'
  | 'project.member.added'
  | 'project.member.removed'
  // Auth operations
  | 'auth.login'
  | 'auth.logout'
  | 'auth.password.changed'

export type ResourceType =
  | 'dataset'
  | 'dataset_version'
  | 'dataset_branch'
  | 'dataset_exploration'
  | 'analysis_run'
  | 'document'
  | 'project'
  | 'profile'

export type JustificationCategory =
  | 'equipment_failure'
  | 'enumerator_error'
  | 'exclusion_criteria'
  | 'protocol_amendment'
  | 'data_entry_error'
  | 'missing_data_handling'
  | 'duplicate_resolution'
  | 'merge_operation'
  | 'other'

export interface AuditDetails {
  // Human readable summary
  // shown in the Audit Trail UI
  summary: string

  // Researcher-provided justification
  // Required for data mutation operations
  justification?: string

  // Category for mutation operations
  justification_category?: JustificationCategory

  // Structured operation data
  // Varies by action type
  operation?: Record<string, unknown>

  // For dataset operations:
  version_before?: number
  version_after?: number
  rows_before?: number
  rows_after?: number
  columns_affected?: string[]

  // For analysis operations:
  analysis_type?: string
  dataset_version_id?: string

  // For approval operations:
  approved_by?: string
  approval_note?: string

  // File integrity
  file_hash?: string

  // Any additional context
  [key: string]: unknown
}

export interface AuditEntryInput {
  actor_id: string
  action: AuditAction
  resource_type: ResourceType
  resource_id: string
  project_id?: string
  institution_id?: string
  ip_address?: string
  details: AuditDetails
}

export interface AuditEntry {
  id: string
  timestamp: string
  actor_id: string | null
  action: AuditAction
  resource_type: ResourceType
  resource_id: string
  project_id: string | null
  institution_id: string | null
  details: AuditDetails
  ip_address: string | null
  prev_hash: string | null
  entry_hash: string

  // Joined fields (not in DB, added by API)
  actor_name?: string
  actor_initials?: string
}

export interface ChainViolation {
  entry_id: string
  timestamp: string
  issue: 'hash_mismatch' | 'chain_broken' | 'missing_prev_hash'
  detail: string
}

export interface ChainVerificationResult {
  verified: boolean
  total_entries: number
  valid_entries: number
  chain_intact: boolean
  first_entry: AuditEntry | null
  last_entry: AuditEntry | null
  violations: ChainViolation[]
}

export interface CertificateTimelineEntry {
  step: number
  timestamp: string
  action: string
  actor_name: string
  summary: string
  justification?: string
  justification_category?: string
  version_transition?: string
  rows_transition?: string
  entry_hash: string
}

export interface CertificateAnalysisEntry {
  run_id: string
  analysis_type: string
  conducted_at: string
  conducted_by: string
  dataset_version: number
}

export interface DataLineageCertificate {
  certificate_id: string
  generated_at: string
  generated_by: string
  dataset: {
    id: string
    name: string
    source: string
    project_name: string
  }
  integrity: {
    raw_import_hash: string
    current_version_hash: string
    chain_verified: boolean
    total_audit_entries: number
  }
  timeline: CertificateTimelineEntry[]
  final_dataset: {
    version_number: number
    row_count: number
    column_count: number
    file_hash: string
    complete_cases: number
    analysis_ready: boolean
  }
  analyses_conducted: CertificateAnalysisEntry[]
  certificate_hash: string
}
