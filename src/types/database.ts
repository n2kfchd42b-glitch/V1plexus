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
