export type UserRole = 'researcher' | 'supervisor' | 'admin'
export type ProjectStatus = 'draft' | 'active' | 'completed' | 'archived'
export type DocumentStatus = 'draft' | 'in_review' | 'revision_requested' | 'approved'
export type DocumentType = 'general' | 'protocol' | 'consent_form' | 'ethics_application' | 'report'
export type ReviewStatus = 'pending' | 'in_review' | 'feedback_given' | 'revision_submitted' | 'approved' | 'rejected'
export type ReviewPriority = 'low' | 'normal' | 'high' | 'urgent'
export type GateStatus = 'pending' | 'approved' | 'blocked'
export type NotificationType = 'review_request' | 'review_complete' | 'ethics_expiry' | 'comment' | 'gate_approved'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  title: string
  description: string | null
  status: ProjectStatus
  owner_id: string
  created_at: string
  updated_at: string
  owner?: Profile
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: 'member' | 'supervisor' | 'admin'
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

export interface EthicsApplication {
  id: string
  project_id: string
  title: string
  description: string | null
  status: string
  submitted_at: string | null
  approved_at: string | null
  expiry_date: string | null
  protocol_number: string | null
  created_by: string
  created_at: string
  updated_at: string
}

// ════════════════════════════════════════
// PHASE 4A: DATA INFRASTRUCTURE TYPES
// ════════════════════════════════════════

export type DatasetSource = 'upload' | 'kobo' | 'redcap' | 'merge' | 'append' | 'clean' | 'branch'
export type ColumnType = 'text' | 'number' | 'integer' | 'decimal' | 'date' | 'boolean' | 'categorical'
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
  | { type: 'recode_values'; column: string; mapping: Record<string, string | number | null> }
  | { type: 'bin_numeric'; column: string; new_column: string; bins: Array<{ min: number | null; max: number | null; label: string }> }
  | { type: 'standardize_text'; column: string; operations: Array<'trim' | 'lowercase' | 'uppercase' | 'titlecase' | 'remove_special'> }

export type FilterOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'is_null' | 'is_not_null'

export interface Dataset {
  id: string
  project_id: string
  name: string
  description: string | null
  source: DatasetSource
  parent_id: string | null
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
