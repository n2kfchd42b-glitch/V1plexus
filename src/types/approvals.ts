export type ApprovalRequestStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'revision_requested'

export type ReviewAction =
  | 'submitted'
  | 'viewed'
  | 'approved'
  | 'rejected'
  | 'revision_requested'
  | 'resubmitted'

export type ApprovalStatus =
  | 'approved'
  | 'pending'
  | 'in_review'
  | 'rejected'
  | 'revision_requested'
  | 'not_requested'
  | 'not_required'

export interface ApprovalRequest {
  id: string
  dataset_id: string
  version_id: string
  project_id: string
  requested_by: string
  assigned_supervisor: string | null
  status: ApprovalRequestStatus
  request_message: string | null
  reviewer_note: string | null
  requested_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  approved_version_hash: string | null
  expires_at: string | null
  created_at: string
  updated_at: string

  // Joined
  researcher_name?: string
  researcher_initials?: string
  supervisor_name?: string
  supervisor_initials?: string
  dataset_name?: string
  version_number?: number
  project_name?: string
}

export interface ReviewHistoryEntry {
  id: string
  request_id: string
  reviewer_id: string
  action: ReviewAction
  note: string | null
  audit_entry_id: string | null
  created_at: string

  // Joined
  reviewer_name?: string
  reviewer_initials?: string
}

export interface SupervisorQueueItem {
  request_id: string
  dataset_name: string
  version_number: number
  project_name: string
  researcher_name: string
  researcher_initials: string
  requested_at: string
  request_message: string | null
  status: ApprovalRequestStatus
  row_count: number
  column_count: number
  operations_count: number
  has_imputation: boolean
  has_duplicate_resolution: boolean
  audit_entry_count: number
  hours_since_submission: number
}

export interface ApprovalCheck {
  status: ApprovalStatus
  request?: {
    id: string
    requested_at: string
    reviewed_at: string | null
    reviewer_note: string | null
    approved_version_hash: string | null
  }
  can_analyze: boolean
  reason?: string
}
