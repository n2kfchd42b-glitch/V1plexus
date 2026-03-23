export type UserRole = 'researcher' | 'pi' | 'coordinator' | 'admin'
export type WorkspaceType = 'personal' | 'institutional'
export type WorkspaceMemberRole = 'owner' | 'admin' | 'department_head' | 'supervisor' | 'pi' | 'researcher' | 'student' | 'collaborator' | 'viewer'
export type WorkspaceMemberStatus = 'invited' | 'active' | 'suspended' | 'left'
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired'
export type ProjectInviteRole = 'co_pi' | 'researcher' | 'collaborator' | 'reviewer' | 'viewer'
export type SupervisorAssignmentStatus = 'active' | 'ended' | 'transferred'
export type DatasetSource = 'upload' | 'kobo' | 'redcap' | 'csv' | 'excel' | 'spss' | 'merge' | 'append' | 'clean' | 'branch'
export type AnalysisEngine = 'r' | 'python'
export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
export type OutputType = 'table' | 'figure' | 'log' | 'summary' | 'file'
export type ProjectStatus = 'draft' | 'active' | 'on_hold' | 'completed' | 'archived'
export type ProjectPhase = 'design' | 'data_collection' | 'analysis' | 'writing' | 'submitted' | 'published'
export type InstitutionType = 'university' | 'hospital' | 'research_institute' | 'ngo' | 'government' | 'other'
export type ProjectMemberRole = 'owner' | 'pi' | 'member' | 'viewer'
export type DocumentStatus = 'draft' | 'in_review' | 'revision_requested' | 'approved'
export type DocumentType = 'general' | 'protocol' | 'consent_form' | 'ethics_application' | 'report'
export type ReviewStatus = 'pending' | 'in_review' | 'feedback_given' | 'revision_submitted' | 'approved' | 'rejected'
export type ReviewPriority = 'low' | 'normal' | 'high' | 'urgent'
export type GateStatus = 'pending' | 'approved' | 'blocked'
export type NotificationType = 'review_request' | 'review_complete' | 'ethics_expiry' | 'comment' | 'gate_approved'

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
  status: SupervisorAssignmentStatus
  assigned_at: string
  ended_at: string | null
  supervisor?: Profile
  student?: Profile
  department?: Department
}

export interface Project {
  id: string
  title: string
  description: string | null
  methodology: string | null
  research_objectives: string | null
  status: ProjectStatus
  phase: ProjectPhase | null
  owner_id: string
  workspace_id: string | null
  institution_id: string | null
  department_id: string | null
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  owner?: Profile
  workspace?: Workspace
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
  created_by: string
  created_at: string
  updated_at: string
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
