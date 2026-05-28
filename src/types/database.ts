export type UserRole = 'researcher' | 'pi' | 'coordinator' | 'admin'
export type WorkspaceType = 'personal' | 'institutional'
export type WorkspaceMemberRole = 'owner' | 'admin' | 'department_head' | 'supervisor' | 'pi' | 'researcher' | 'student' | 'collaborator' | 'viewer'
export type WorkspaceMemberStatus = 'invited' | 'active' | 'suspended' | 'left'
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired'
export type ProjectInviteRole = 'co_pi' | 'researcher' | 'collaborator' | 'reviewer' | 'viewer'
export type SupervisorAssignmentStatus = 'pending' | 'active' | 'ended' | 'transferred'
export type SupervisorRole = 'primary' | 'co_supervisor'
export type MilestoneStatus = 'pending' | 'submitted' | 'under_review' | 'revision_requested' | 'approved'
export type MilestoneDecision = 'approved' | 'revision_requested'
export type DatasetSource = 'upload' | 'kobo' | 'redcap' | 'csv' | 'excel' | 'spss' | 'merge' | 'append' | 'clean' | 'branch'
export type AnalysisEngine = 'r' | 'python'
export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
export type OutputType = 'table' | 'figure' | 'log' | 'summary' | 'file'
export type ProjectStatus = 'draft' | 'active' | 'on_hold' | 'completed' | 'archived'
export type ProjectType = 'research' | 'thesis'
export type ThesisDegreeType = 'msc' | 'mphil' | 'phd' | 'drph' | 'md' | 'bachelor' | 'other'
export type ThesisDefenseStatus = 'not_scheduled' | 'proposal_scheduled' | 'proposal_completed' | 'final_scheduled' | 'final_completed' | 'passed' | 'passed_with_corrections' | 'revise_resubmit' | 'failed'
export type ThesisChapterStatus = 'not_started' | 'drafting' | 'submitted_for_review' | 'revision_requested' | 'approved' | 'locked'
export type ThesisLifecycleState = 'matched' | 'proposal_draft' | 'proposal_review' | 'active' | 'chapter_review' | 'submitted' | 'approved' | 'archived'
export type ThesisActorRole = 'student' | 'primary_supervisor' | 'coordinator' | 'admin' | 'system'
export type ChapterSubmissionDecision = 'approved' | 'revision_requested'
export type DeadlineKind = 'chapter_due' | 'milestone_due' | 'thesis_completion' | 'proposal_due' | 'defense_due' | 'custom'
export type NotificationDigestFrequency = 'instant' | 'daily' | 'weekly' | 'off'
export type ProjectPhase = 'design' | 'data_collection' | 'analysis' | 'writing' | 'submitted' | 'published'
export type InstitutionType = 'university' | 'hospital' | 'research_institute' | 'ngo' | 'government' | 'other'
export type ProjectMemberRole = 'owner' | 'pi' | 'member' | 'viewer'
export type DocumentStatus = 'draft' | 'in_review' | 'revision_requested' | 'approved'
export type DocumentType = 'general' | 'protocol' | 'consent_form' | 'ethics_application' | 'report'
export type ReviewStatus = 'pending' | 'in_review' | 'feedback_given' | 'revision_submitted' | 'approved' | 'rejected'
export type ReviewPriority = 'low' | 'normal' | 'high' | 'urgent'
export type GateStatus = 'pending' | 'approved' | 'blocked'
export type NotificationType = 'review_request' | 'review_complete' | 'ethics_expiry' | 'comment' | 'gate_approved' | 'invitation_received'

export type VerificationTier = 'SELF_ATTESTED' | 'DOMAIN_VERIFIED' | 'OFFICIALLY_REGISTERED'

export interface Institution {
  id: string
  name: string
  type: InstitutionType | null
  country: string | null
  city: string | null
  website: string | null
  email: string | null
  phone: string | null
  logo_url: string | null
  short_name: string | null
  email_domain: string | null
  verification_tier: VerificationTier | null
  active: boolean | null
  auto_link_domains: string[]
  provisioned_at: string | null
  provisioned_by: string | null
  provisioning_notes: string | null
  slug: string
  brand_color: string | null
  motto: string | null
  public_bio: string | null
  members_public_default: boolean
  created_at: string
  updated_at: string
}

export interface InstitutionBrandingSnapshot {
  id: string
  slug: string
  name: string
  short_name: string | null
  logo_url: string | null
  brand_color: string | null
  motto: string | null
  verification_tier: VerificationTier | null
  snapshotted_at: string
}

export type InstitutionInquiryStatus = 'new' | 'responded' | 'converted' | 'declined'

export type InstitutionLinkRequestStatus = 'pending' | 'approved' | 'declined' | 'cancelled'

export interface InstitutionLinkRequest {
  id: string
  user_id: string
  institution_id: string
  status: InstitutionLinkRequestStatus
  message: string | null
  auto_approved: boolean
  decided_by: string | null
  decided_at: string | null
  decline_reason: string | null
  created_at: string
  updated_at: string
  user?: Profile
  institution?: Institution
}

export interface InstitutionInquiry {
  id: string
  contact_name: string
  contact_email: string
  contact_role: string | null
  institution_name: string
  country: string | null
  estimated_seats: number | null
  message: string | null
  status: InstitutionInquiryStatus
  converted_institution_id: string | null
  responded_at: string | null
  responded_by: string | null
  created_at: string
  updated_at: string
}

export interface Department {
  id: string
  institution_id: string
  name: string
  description: string | null
  head_id: string | null
  created_at: string
  updated_at: string
  institution?: Institution
  head?: Profile
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  title: string | null
  bio: string | null
  orcid_id: string | null
  phone: string | null
  website: string | null
  subscription_tier: string
  institution_id: string | null
  department_id: string | null
  onboarding_completed: boolean
  workspace_setup_completed: boolean
  city: string | null
  country: string | null
  lat: number | null
  lng: number | null
  show_on_globe: boolean
  available_to_supervise: boolean
  supervision_areas: string[]
  supervision_bio: string | null
  supervision_max_students: number | null
  public_affiliation_visible: boolean
  last_seen_at: string | null
  created_at: string
  updated_at: string
  institution?: Institution
  department?: Department
}

export interface Workspace {
  id: string
  type: WorkspaceType
  name: string
  slug: string
  owner_id: string | null
  institution_id: string | null
  avatar_url: string | null
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
  institution?: Institution
  owner?: Profile
}

export interface WorkspaceMembership {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceMemberRole
  department_id: string | null
  supervisor_id: string | null
  joined_at: string
  invited_by: string | null
  status: WorkspaceMemberStatus
  workspace?: Workspace
  user?: Profile
  department?: Department
  supervisor?: Profile
}

export interface WorkspaceInvitation {
  id: string
  workspace_id: string
  email: string
  role: WorkspaceMemberRole
  department_id: string | null
  supervisor_id: string | null
  message: string | null
  token: string
  invited_by: string
  status: InvitationStatus
  expires_at: string
  created_at: string
  workspace?: Workspace
}

export interface ProjectInvitation {
  id: string
  project_id: string
  email: string
  role: ProjectInviteRole
  message: string | null
  token: string
  invited_by: string
  status: InvitationStatus
  expires_at: string
  created_at: string
  project?: Project
}

export interface SupervisorAssignment {
  id: string
  workspace_id: string
  department_id: string
  supervisor_id: string
  student_id: string
  assigned_by: string | null
  role: SupervisorRole
  status: SupervisorAssignmentStatus
  assigned_at: string
  ended_at: string | null
  supervisor?: Profile
  student?: Profile
  department?: Department
}

export interface MilestoneTemplate {
  id: string
  workspace_id: string
  department_id: string | null
  created_by: string
  title: string
  description: string | null
  order_index: number
  requires_document: boolean
  created_at: string
  updated_at: string
  creator?: Profile
}

export interface StudentMilestone {
  id: string
  workspace_id: string
  student_id: string
  supervisor_id: string
  template_id: string | null
  phase: string | null
  project_id: string | null
  title: string
  description: string | null
  order_index: number
  status: MilestoneStatus
  due_date: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  student?: Profile
  supervisor?: Profile
  approver?: Profile
  latest_submission?: MilestoneSubmission
}

export interface MilestoneSubmission {
  id: string
  milestone_id: string
  student_id: string
  round: number
  note: string | null
  document_id:     string | null
  dataset_id:      string | null
  analysis_run_id: string | null
  submitted_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  decision: MilestoneDecision | null
  feedback: string | null
  student?: Profile
  reviewer?: Profile
}

export interface Project {
  id: string
  title: string
  description: string | null
  methodology: string | null
  research_objectives: string | null
  status: ProjectStatus
  phase: ProjectPhase | null
  project_type: ProjectType
  owner_id: string
  workspace_id: string | null
  institution_id: string | null
  department_id: string | null
  start_date: string | null
  end_date: string | null
  share_token: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  owner?: Profile
  workspace?: Workspace
  thesis_metadata?: ThesisMetadata | null
}

export interface ThesisMetadata {
  id: string
  project_id: string
  degree_type: ThesisDegreeType
  program_name: string
  department: string | null
  institution_id: string | null
  supervisor_id: string | null
  enrollment_date: string | null
  expected_completion: string | null
  thesis_title: string | null
  defense_status: ThesisDefenseStatus
  lifecycle_state: ThesisLifecycleState
  policy_version_snapshot: number | null
  policy_snapshot: ThesisPolicySnapshot | null
  institution_id_at_submission: string | null
  institution_branding_snapshot: InstitutionBrandingSnapshot | null
  created_at: string
  updated_at: string
  supervisor?: { full_name: string | null; email: string | null } | null
}

export type ThesisCommitteeRole = 'chair' | 'co_chair' | 'member' | 'external_examiner' | 'advisor'
export type ThesisCommitteeStatus = 'invited' | 'confirmed' | 'declined' | 'removed'

export interface ThesisCommittee {
  id: string
  project_id: string
  user_id: string | null
  external_name: string | null
  external_email: string | null
  external_institution: string | null
  role: ThesisCommitteeRole
  status: ThesisCommitteeStatus
  invited_at: string
  confirmed_at: string | null
  invited_by: string | null
  created_at: string
  profile?: { full_name: string | null; email: string | null } | null
}

export interface ThesisChapter {
  id: string
  project_id: string
  document_id: string | null
  chapter_number: number
  title: string
  status: ThesisChapterStatus
  target_date: string | null
  submitted_at: string | null
  approved_at: string | null
  approved_by: string | null
  sort_order: number | null
  revision_round: number
  current_review_id: string | null
  created_at: string
  updated_at: string
  approver?: { full_name: string | null } | null
}

export interface ThesisChapterSubmission {
  id: string
  chapter_id: string
  project_id: string
  student_id: string
  round: number
  document_id: string | null
  document_version_number: number | null
  note: string | null
  review_request_id: string | null
  submitted_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  decision: ChapterSubmissionDecision | null
  feedback: string | null
}

export interface AllowedThesisTransition {
  from_state: ThesisLifecycleState
  to_state: ThesisLifecycleState
  required_role: ThesisActorRole
  requires_ethics_gate: boolean
  requires_all_chapters_approved: boolean
  requires_defense_pass: boolean
  description: string | null
}

// ── Institution programmes / cohorts / roster / enrollments ────────────────
// Phase 1+2 of the premium institution loop. profiles.institution_id remains
// the canonical "linked" flag; enrollments add programme/cohort context.

export type DegreeLevel = 'bachelor' | 'master' | 'phd' | 'postdoc' | 'staff' | 'other'

export type RosterIntendedRole =
  | 'researcher' | 'student' | 'supervisor' | 'admin' | 'coordinator' | 'viewer'

export type RosterEntryStatus = 'unclaimed' | 'claimed' | 'invalidated'

export type EnrollmentStatus = 'active' | 'on_leave' | 'graduated' | 'withdrawn'

export interface InstitutionProgramme {
  id: string
  institution_id: string
  department_id: string | null
  name: string
  short_code: string | null
  degree_level: DegreeLevel
  duration_months: number | null
  description: string | null
  active: boolean
  created_at: string
  updated_at: string
  department?: Department | null
}

export interface InstitutionCohort {
  id: string
  programme_id: string
  year: number
  label: string | null
  start_date: string | null
  expected_completion: string | null
  created_at: string
  updated_at: string
  programme?: InstitutionProgramme | null
}

export interface InstitutionRosterEntry {
  id: string
  institution_id: string
  matriculation_number: string
  programme_id: string | null
  cohort_id: string | null
  department_id: string | null
  intended_role: RosterIntendedRole
  full_name_hint: string | null
  email_hint: string | null
  notes: string | null
  status: RosterEntryStatus
  claimed_by: string | null
  claimed_at: string | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
  programme?: InstitutionProgramme | null
  cohort?: InstitutionCohort | null
  department?: Department | null
  claimed_user?: Profile | null
}

export interface InstitutionEnrollment {
  id: string
  user_id: string
  institution_id: string
  programme_id: string | null
  cohort_id: string | null
  department_id: string | null
  matriculation_number: string | null
  roster_entry_id: string | null
  status: EnrollmentStatus
  enrolled_at: string
  end_date: string | null
  created_at: string
  updated_at: string
  user?: Profile | null
  programme?: InstitutionProgramme | null
  cohort?: InstitutionCohort | null
  department?: Department | null
}

/**
 * Per-institution thesis workflow policy. The DB-side trigger
 * `bump_thesis_policy_version` auto-increments policy_version on every
 * UPDATE; theses snapshot this row at creation (see
 * ThesisMetadata.policy_snapshot).
 */
export interface InstitutionThesisPolicy {
  institution_id: string
  policy_version: number
  require_ethics_gate: boolean
  allow_co_supervisors: boolean
  max_co_supervisors: number
  require_oral_defense: boolean
  require_proposal_defense: boolean
  min_chapters: number
  default_chapter_titles: string[]
  reminder_offsets_days: number[]
  escalation_delay_hours: number
  created_at: string
  updated_at: string
  updated_by: string | null
}

/**
 * Snapshot frozen onto thesis_metadata at creation. Mirrors
 * InstitutionThesisPolicy minus mutable audit columns.
 */
export type ThesisPolicySnapshot = Omit<
  InstitutionThesisPolicy,
  'created_at' | 'updated_at' | 'updated_by'
>

export interface Deadline {
  id: string
  project_id: string
  kind: DeadlineKind
  source_type: string | null
  source_id: string | null
  target_at: string
  owner_id: string
  title: string
  satisfied_at: string | null
  satisfied_by: string | null
  created_at: string
  updated_at: string
}

export interface DeadlineReminder {
  id: string
  deadline_id: string
  offset_label: string
  recipient_id: string
  sent_at: string
}

export interface NotificationPreferences {
  user_id: string
  digest_frequency: NotificationDigestFrequency
  quiet_hours_start: number | null
  quiet_hours_end: number | null
  timezone: string
  created_at: string
  updated_at: string
}

/**
 * Read-only view: profiles JOIN active supervisor_assignments count.
 * slots_open / slots_total are NULL when no cap is declared.
 */
export interface SupervisorCapacityRow {
  supervisor_id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  title: string | null
  research_discipline: string | null
  supervision_areas: string[] | null
  supervision_bio: string | null
  slots_total: number | null
  slots_used: number
  slots_open: number | null
  accepting_now: boolean
  available_to_supervise: boolean
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: ProjectMemberRole
  joined_at: string
  user?: Profile
}

export interface Document {
  id: string
  project_id: string
  title: string
  content: Record<string, unknown> | null
  content_text: string | null
  status: DocumentStatus
  document_type: DocumentType
  current_version: number
  created_by: string
  created_at: string
  updated_at: string
  creator?: Profile
  project?: Project
}

export interface DocumentVersion {
  id: string
  document_id: string
  version_number: number
  content: Record<string, unknown> | null
  content_text: string | null
  created_by: string
  change_summary: string | null
  created_at: string
  creator?: Profile
}

export interface DocumentComment {
  id: string
  document_id: string
  author_id: string
  content: string
  anchor_from: number | null
  anchor_to: number | null
  anchor_text: string | null
  is_resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  parent_id: string | null
  created_at: string
  updated_at: string
  author?: Profile
  replies?: DocumentComment[]
}

export interface ReviewRequest {
  id: string
  document_id: string
  document_version: number
  requested_by: string
  assigned_to: string
  priority: ReviewPriority
  status: ReviewStatus
  feedback_text: string | null
  due_date: string | null
  requested_at: string
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  document?: Document
  requester?: Profile
  reviewer?: Profile
  review_comments?: ReviewComment[]
}

export interface ReviewComment {
  id: string
  review_id: string
  author_id: string
  content: string
  section_key: string | null
  anchor_start: number | null
  anchor_end: number | null
  is_resolved: boolean
  resolved_by: string | null
  parent_id: string | null
  created_at: string
  updated_at: string
  author?: Profile
  replies?: ReviewComment[]
}

export interface ApprovalGate {
  id: string
  project_id: string
  gate_type: string
  title: string
  description: string | null
  status: GateStatus
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  approver?: Profile
}

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string | null
  type: NotificationType
  resource_type: string | null
  resource_id: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export interface DatasetColumn {
  name: string
  type: ColumnType
  unique_values?: number
  missing?: number
  sample_values?: (string | number)[]
}


export interface AnalysisJob {
  id: string
  project_id: string
  dataset_id: string | null
  title: string | null
  engine: AnalysisEngine
  script_content: string | null
  status: AnalysisStatus
  started_at: string | null
  completed_at: string | null
  duration_ms: number | null
  error_log: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  dataset?: Dataset
  creator?: Profile
  outputs?: AnalysisOutput[]
}

export interface AnalysisOutput {
  id: string
  job_id: string
  output_type: OutputType
  title: string | null
  content: { headers: string[]; rows: (string | number | null)[][] } | Record<string, unknown> | null
  file_path: string | null
  file_name: string | null
  metadata: Record<string, unknown>
  sort_order: number
  created_at: string
}

export type AnalysisType =
  | 'descriptive'
  | 'frequency'
  | 'chi_square'
  | 't_test'
  | 'anova'
  | 'correlation'
  | 'simple_regression'
  | 'multiple_regression'
  | 'logistic_regression'
  | 'multinomial_regression'
  | 'ordinal_regression'
  | 'poisson_regression'
  | 'negbinomial_regression'
  | 'kaplan_meier'
  | 'cox_regression'
  | 'time_series'
  | 'pca'
  | 'factor_analysis'
  | 'cluster_analysis'
  | 'meta_analysis'
  | 'spatial_analysis'
  | 'outbreak_investigation'
  | 'sample_size'
  | 'psm'

export interface AnalysisRun {
  id: string
  project_id: string
  dataset_id: string | null
  version_id: string | null
  analysis_type: AnalysisType
  title: string | null
  config: Record<string, unknown>
  results: Record<string, unknown> | null
  chart_config: Record<string, unknown> | null
  status: AnalysisStatus
  error_message: string | null
  interpretation: string | null
  user_reasoning: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  dataset?: Dataset
}

export interface EthicsApplication {
  id: string
  project_id: string
  title: string
  description: string | null
  status: string
  submitted_at: string | null
  approved_at: string | null
  expires_at: string | null
  protocol_number: string | null
  created_by: string
  created_at: string
  updated_at: string
}

// ════════════════════════════════════════
// PHASE 4A: DATA INFRASTRUCTURE TYPES
// ════════════════════════════════════════

export type ColumnType =
  | 'numeric' | 'integer' | 'decimal' | 'number'
  | 'categorical' | 'text' | 'string'
  | 'date'
  | 'binary' | 'boolean'
  | 'unknown'
export type ChartType =
  | 'bar' | 'line' | 'scatter' | 'histogram' | 'box' | 'pie' | 'area'
  | 'violin' | 'heatmap' | 'bubble' | 'treemap' | 'donut' | 'radar'
  | 'scatter_matrix' | 'mosaic' | 'dumbbell' | 'ridge' | 'waffle'
  | 'funnel' | 'forest' | 'kaplan_meier' | 'roc' | 'epi_curve'
  | 'choropleth' | 'dot' | 'sparkline' | 'qqplot' | 'correlogram'

export type JoinType = 'left' | 'inner' | 'full_outer'

export interface ColumnSchema {
  name: string
  type: ColumnType
  null_count: number
  unique_count: number
  min?: number | string | null
  max?: number | string | null
  mean?: number | null
  median?: number | null
  mode?: string | number | null
  sample_values: (string | number | boolean | null)[]
  value_counts?: Record<string, number>
}

export type CleaningOperation =
  | { type: 'rename_column'; column: string; new_name: string }
  | { type: 'retype_column'; column: string; new_type: ColumnType }
  | { type: 'delete_column'; column: string }
  | { type: 'reorder_columns'; order: string[] }
  | { type: 'drop_missing'; columns: string[] }
  | { type: 'fill_missing'; column: string; strategy: 'value' | 'mean' | 'median' | 'mode' | 'forward_fill' | 'backward_fill'; value?: string | number }
  | { type: 'filter_rows'; column: string; operator: FilterOperator; value: string | number | boolean | null; keep: boolean }
  | { type: 'remove_duplicates'; columns: string[] }
  | { type: 'sort_rows'; column: string; direction: 'asc' | 'desc' }
  | { type: 'computed_column'; name: string; formula: string; column_type: ColumnType }
  | { type: 'recode_values'; column: string; mapping: Record<string, string | number | null>; output_column?: string }
  | { type: 'bin_numeric'; column: string; new_column: string; bins: Array<{ min: number | null; max: number | null; label: string }> }
  | { type: 'standardize_text'; column: string; operations: Array<'trim' | 'lowercase' | 'uppercase' | 'titlecase' | 'remove_special'> }
  | { type: 'split_column'; column: string; delimiter: string; new_columns: string[]; keep_original: boolean }
  | { type: 'replace_column'; column: string; new_column?: string; replace_value: string | number | null }

export type FilterOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'is_null' | 'is_not_null'

export interface Dataset {
  id: string
  project_id: string
  name: string
  description: string | null
  source: DatasetSource
  parent_id: string | null
  file_path?: string | null
  file_name?: string | null
  file_size?: number | null
  row_count?: number | null
  column_count?: number | null
  schema_info?: ColumnSchema[] | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  archived_at: string | null
  uploader?: Profile
  latest_version?: DatasetVersion
}

export interface DatasetVersion {
  id: string
  dataset_id: string
  version_number: number
  parent_version: string | null
  commit_message: string
  file_path: string
  file_hash: string
  file_size: number | null
  row_count: number
  column_count: number
  schema_info: ColumnSchema[]
  operations: CleaningOperation[]
  created_by: string | null
  created_at: string
  creator?: Profile
}

export interface DatasetBranch {
  id: string
  dataset_id: string
  name: string
  head_version: string
  is_default: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  head?: DatasetVersion
}

export interface DatasetExploration {
  id: string
  dataset_id: string
  version_id: string | null
  title: string
  chart_type: ChartType
  config: ChartConfig
  thumbnail_path: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  creator?: Profile
}

export interface ChartConfig {
  x_axis?: string
  y_axis?: string
  color?: string
  size?: string
  facet?: string
  aggregation?: 'count' | 'sum' | 'mean' | 'median' | 'min' | 'max'
  sort?: 'ascending' | 'descending' | 'none'
  show_values?: boolean
  trend_line?: boolean
  log_scale_x?: boolean
  log_scale_y?: boolean
  palette?: string
  title?: string
  x_label?: string
  y_label?: string
  filters?: Array<{ column: string; operator: FilterOperator; value: string | number | boolean | null }>
  bin_count?: number
  chart_specific?: Record<string, unknown>
}

// Parsed row data (in-memory representation)
export type DataRow = Record<string, string | number | boolean | null>

export interface ParsedDataset {
  rows: DataRow[]
  columns: ColumnSchema[]
  row_count: number
  column_count: number
}

export interface AuditLog {
  id: string
  timestamp: string
  actor_id: string | null
  action: string
  resource_type: string
  resource_id: string
  project_id: string | null
  institution_id: string | null
  details: Record<string, unknown>
  ip_address: string | null
  prev_hash: string | null
  entry_hash: string
  actor?: Profile
}

export interface AIUsageLog {
  id: string
  user_id: string
  action: string
  document_id: string | null
  input_tokens: number | null
  output_tokens: number | null
  model: string | null
  created_at: string
}

export type AIAction = 'suggest' | 'generate_section' | 'format_table' | 'grammar_check'

export interface GrammarSuggestion {
  original: string
  suggestion: string
  type: 'grammar' | 'clarity' | 'style'
  explanation: string
}

// ─────────────────────────────────────────────
// Phase 7: Field Operations
// ─────────────────────────────────────────────

export type IntegrationProvider = 'kobotoolbox' | 'redcap' | 'odk_central' | 'surveycto' | 'commcare' | 'dhis2' | 'zotero' | 'mendeley'
export type SyncDirection = 'pull' | 'push' | 'bidirectional'
export type IntegrationStatus = 'active' | 'paused' | 'error' | 'disconnected'
export type SyncFrequency = 'realtime' | 'hourly' | 'daily' | 'manual'
export type SyncType = 'full' | 'incremental' | 'manual' | 'webhook'
export type QualityRuleType = 'range' | 'required' | 'format' | 'unique' | 'logical' | 'cross_field' | 'outlier' | 'completeness' | 'consistency'
export type QualitySeverity = 'error' | 'warning' | 'info'
export type QualityResultStatus = 'active' | 'resolved' | 'ignored' | 'expected'

export interface IntegrationConnection {
  id: string
  project_id: string
  provider: IntegrationProvider
  config: Record<string, unknown>
  status: IntegrationStatus
  last_sync_at: string | null
  last_sync_status: string | null
  sync_frequency: SyncFrequency
  total_synced: number
  error_log: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Phase 10 additions
  display_name: string | null
  provider_project_id: string | null
  provider_project_name: string | null
  column_mapping: Record<string, string> | null
  sync_direction: SyncDirection | null
  webhook_url: string | null
  webhook_secret: string | null
}

export interface IntegrationFieldMapping {
  id: string
  connection_id: string
  remote_field: string
  local_column: string
  transform: Record<string, unknown> | null
  created_at: string
}

export interface DHIS2PushLog {
  id: string
  connection_id: string
  push_type: 'data_values' | 'events' | 'tracked_entities'
  period: string | null
  org_unit: string | null
  data_values_count: number
  status: 'pending' | 'dry_run' | 'success' | 'failed' | 'partial'
  import_summary: Record<string, unknown> | null
  validation_issues: Array<Record<string, unknown>>
  started_at: string
  completed_at: string | null
  created_by: string | null
}

export interface ZoteroSyncState {
  id: string
  connection_id: string
  library_version: number
  last_synced_at: string | null
  item_count: number
}

export interface SyncLog {
  id: string
  connection_id: string
  sync_type: SyncType
  records_fetched: number
  records_new: number
  records_updated: number
  records_skipped: number
  quality_issues: number
  dataset_version_id: string | null
  status: string
  error_message: string | null
  started_at: string
  completed_at: string | null
  duration_ms: number | null
}

export interface DataQualityRule {
  id: string
  dataset_id: string
  name: string
  rule_type: QualityRuleType
  column_name: string | null
  config: Record<string, unknown>
  severity: QualitySeverity
  is_active: boolean
  auto_generated: boolean
  created_by: string | null
  created_at: string
}

export interface DataQualityResult {
  id: string
  dataset_id: string
  version_id: string
  rule_id: string
  violations_count: number
  total_checked: number
  sample_violations: Array<Record<string, unknown>>
  status: QualityResultStatus
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  rule?: DataQualityRule
}

export interface DataQualityScore {
  id: string
  dataset_id: string
  version_id: string
  overall_score: number
  completeness: number | null
  validity: number | null
  uniqueness: number | null
  consistency: number | null
  errors_count: number
  warnings_count: number
  created_at: string
}

export interface ProjectMessage {
  id: string
  project_id: string
  sender_id: string
  content: string
  created_at: string
  sender?: Profile
}

export interface PushSubscription {
  id: string
  user_id: string
  endpoint: string
  keys: Record<string, string>
  created_at: string
}

// Offline queue for mutations while offline
export type OfflineMutationStatus = 'pending' | 'synced' | 'failed' | 'conflict'

export interface OfflineMutation {
  id: string
  timestamp: number
  action: 'insert' | 'update' | 'delete'
  table: string
  payload: Record<string, unknown>
  status: OfflineMutationStatus
  error?: string
}

// ════════════════════════════════════════
// PHASE 11: INSTITUTIONAL INTELLIGENCE
// ════════════════════════════════════════

export type GrantFunderType = 'bilateral' | 'multilateral' | 'foundation' | 'government' | 'private' | 'university' | 'other'
export type GrantStatus = 'applied' | 'active' | 'completed' | 'closed' | 'rejected'
export type GrantReportType = 'progress' | 'annual' | 'final' | 'financial' | 'custom'
export type GrantReportStatus = 'pending' | 'draft' | 'submitted' | 'accepted'
export type KBResourceType = 'protocol' | 'manuscript' | 'dataset' | 'analysis_config' | 'thesis' | 'template' | 'sop' | 'report'

export interface ReportingScheduleItem {
  title: string
  due_date: string
  status: 'pending' | 'submitted'
  submitted_at?: string
}

export interface Grant {
  id: string
  institution_id: string
  title: string
  funder_name: string
  funder_type: GrantFunderType | null
  grant_number: string | null
  amount: number | null
  currency: string
  start_date: string | null
  end_date: string | null
  status: GrantStatus
  reporting_schedule: ReportingScheduleItem[]
  pi_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  pi?: Profile
  grant_projects?: GrantProject[]
  grant_reports?: GrantReport[]
}

export interface GrantProject {
  id: string
  grant_id: string
  project_id: string
  budget_allocated: number | null
}

export interface GrantReport {
  id: string
  grant_id: string
  title: string
  report_type: GrantReportType
  due_date: string | null
  submitted_at: string | null
  document_id: string | null
  status: GrantReportStatus
  created_at: string
  updated_at: string
}

export interface KnowledgeBaseEntry {
  id: string
  institution_id: string
  project_id: string | null
  resource_type: KBResourceType
  resource_id: string
  title: string
  description: string | null
  keywords: string[]
  disease_area: string[]
  methodology: string[]
  geographic_scope: string[]
  authors: { name: string; id?: string }[]
  is_template: boolean
  archived_at: string
  created_at: string
}

export interface ResearchMetricsCounts {
  total: number
  active?: number
  completed?: number
  archived?: number
  this_quarter?: number
  in_review?: number
  published_with_doi?: number
  shared_on_network?: number
}

export interface ResearchMetricsBlob {
  projects: { total: number; active: number; completed: number; archived: number }
  publications: { total: number; this_quarter: number; in_review: number }
  datasets: { total: number; published_with_doi: number; shared_on_network: number }
  analyses: { total: number; this_quarter: number }
  researchers: { total: number; active_this_quarter: number }
  theses: { active: number; completed_this_year: number; on_track: number; behind: number; at_risk: number }
  grants: { active: number; total_funding: number; reports_due_soon: number }
  ethics: { approved: number; pending: number; expired: number }
  collaboration: { cross_dept_projects: number; external_collaborators: number }
  top_disease_areas: { name: string; count: number }[]
  top_methodologies: { name: string; count: number }[]
  geographic_reach: { name: string; count: number }[]
}

export interface ResearchMetrics {
  id: string
  institution_id: string
  department_id: string | null
  period: string
  metrics: ResearchMetricsBlob
  computed_at: string
}
