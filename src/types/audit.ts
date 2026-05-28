/**
 * Comprehensive audit types for immutable ledger
 */

export type AuditAction =
  // Dataset operations
  | 'dataset.imported'
  | 'dataset.deleted'
  | 'dataset.archived'
  | 'dataset.unarchived'
  | 'dataset.version.created'
  | 'dataset.version.committed'
  | 'dataset.branch.created'
  | 'dataset.branch.merged'
  | 'dataset.rows.dropped'
  | 'dataset.column.recoded'
  | 'dataset.imputation.mice'
  | 'dataset.duplicates.resolved'
  | 'dataset.reentry.validated'
  | 'dataset.reentry.initiated'
  | 'dataset.reentry.discrepancy.resolved'
  | 'dataset.exploration.created'
  | 'dataset.approved'
  | 'dataset.approval.requested'
  | 'dataset.approval.rejected'
  | 'dataset.approval.revision_requested'
  | 'dataset.verification.token_created'
  // Analysis operations
  | 'analysis.run.saved'
  | 'analysis.run.deleted'
  | 'analysis.run.started'
  | 'analysis.run.completed'
  | 'analysis.run.failed'
  | 'analysis.assumption.acknowledged'
  | 'analysis.reasoning_added'
  // Output operations
  | 'output.checklist.generated'
  | 'output.methods.generated'
  | 'output.package.generated'
  // Document operations
  | 'document.created'
  | 'document.deleted'
  | 'document.edited'
  | 'document.generated'
  | 'document.exported'
  | 'document.submitted'
  | 'document.approved'
  | 'document.revision_requested'
  | 'document.rejected'
  | 'document.version_saved'
  | 'document.version_restored'
  // Project operations
  | 'project.created'
  | 'project.updated'
  | 'project.archived'
  | 'project.deleted'
  | 'project.member.added'
  | 'project.member.removed'
  | 'project.member.invited'
  | 'project.share_link.generated'
  | 'project.share_link.revoked'
  | 'progress.note'
  // Profile & portfolio operations
  | 'profile.updated'
  | 'portfolio.certificate.added'
  | 'portfolio.publication.added'
  // Milestone operations
  | 'milestone.submitted'
  | 'milestone.approved'
  | 'milestone.revision_requested'
  // Supervision operations
  | 'supervision.annotation.created'
  | 'supervision.session.created'
  // Supervisor assignment operations
  | 'supervisor.assignment.created'
  | 'supervisor.assignment.accepted'
  | 'supervisor.assignment.declined'
  | 'supervisor.assignment.ended'
  | 'supervisor.assignment.cancelled'
  | 'supervisor.capacity.changed'
  // Thesis lifecycle operations
  | 'thesis.state.transitioned'
  | 'thesis.state.force_transitioned'
  | 'thesis.policy.created'
  | 'thesis.policy.updated'
  | 'thesis.chapter.submitted'
  | 'thesis.chapter.decided'
  | 'thesis.defense.scheduled'
  | 'thesis.defense.outcome_recorded'
  | 'thesis.deadline.reminder_sent'
  | 'thesis.deadline.escalated'
  // Causal analysis operations
  | 'causal.dag.created'
  | 'causal.dag.confirmed'
  // Auth operations
  | 'auth.login'
  | 'auth.logout'
  | 'auth.password.changed'
  | 'auth.account.deleted'
  // Institution linking operations
  | 'institution.link.requested'
  | 'institution.link.auto_approved'
  | 'institution.link.approved'
  | 'institution.link.declined'
  // Institution provisioning (platform-admin operations)
  | 'institution.provisioned'
  | 'institution.inquiry.converted'
  | 'institution.admin.updated'
  // Institution programmes / cohorts / roster / enrollments
  | 'institution.programme.created'
  | 'institution.programme.updated'
  | 'institution.programme.deactivated'
  | 'institution.cohort.created'
  | 'institution.cohort.updated'
  | 'institution.roster.uploaded'
  | 'institution.roster.entry.updated'
  | 'institution.roster.entry.deleted'
  | 'institution.roster.entry.invalidated'
  | 'institution.enrollment.created'
  | 'institution.enrollment.updated'
  | 'institution.enrollment.withdrawn'
  | 'institution.roster.claimed'

export type ResourceType =
  | 'dataset'
  | 'dataset_version'
  | 'dataset_branch'
  | 'dataset_exploration'
  | 'dataset_lineage'
  | 'dataset_approval_request'
  | 'analysis_run'
  | 'document'
  | 'project'
  | 'profile'
  | 'portfolio_certificate'
  | 'portfolio_publication'
  | 'milestone'
  | 'supervision_annotation'
  | 'supervision_record'
  | 'supervisor_assignment'
  | 'thesis_metadata'
  | 'thesis_chapter'
  | 'thesis_chapter_submission'
  | 'thesis_defense'
  | 'institution_thesis_policy'
  | 'thesis_deadline'
  | 'causal_dag'
  | 'institution'
  | 'institution_programme'
  | 'institution_cohort'
  | 'institution_roster_entry'
  | 'institution_enrollment'

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
