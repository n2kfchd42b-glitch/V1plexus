export type UserRole = 'researcher' | 'supervisor' | 'admin'
export type DatasetSource = 'upload' | 'kobo' | 'redcap' | 'csv' | 'excel' | 'spss'
export type AnalysisEngine = 'r' | 'python'
export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
export type OutputType = 'table' | 'figure' | 'log' | 'summary' | 'file'
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

export interface ColumnSchema {
  name: string
  type: 'string' | 'number' | 'date' | 'boolean' | 'unknown'
  null_count: number
  unique_count: number
  total_count: number
  min?: number | string
  max?: number | string
  sample_values: (string | number | boolean | null)[]
export type ColumnType = 'numeric' | 'categorical' | 'date' | 'text' | 'binary'

export interface DatasetColumn {
  name: string
  type: ColumnType
  unique_values?: number
  missing?: number
  sample_values?: (string | number)[]
}

export interface Dataset {
  id: string
  project_id: string
  name: string
  description: string | null
  source: DatasetSource
  file_path: string
  file_name: string
  file_size: number | null
  file_hash: string | null
  mime_type: string | null
  row_count: number | null
  column_count: number | null
  schema_info: ColumnSchema[] | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  uploader?: Profile
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
  file_path: string | null
  file_name: string | null
  file_size: number | null
  row_count: number | null
  columns: DatasetColumn[]
  sample_data: Record<string, unknown>[] | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface DatasetVersion {
  id: string
  dataset_id: string
  version_number: number
  file_path: string | null
  row_count: number | null
  columns: DatasetColumn[]
  change_summary: string | null
  created_by: string
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

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed'

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
  expiry_date: string | null
  protocol_number: string | null
  created_by: string
  created_at: string
  updated_at: string
}
