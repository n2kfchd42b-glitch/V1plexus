/**
 * Research Output types for Phase 5
 */

export type ChecklistGuideline = 'STROBE' | 'CONSORT' | 'PRISMA' | 'TRIPOD' | 'ARRIVE' | 'CHEERS'
export type ChecklistItemStatus = 'auto_populated' | 'manually_completed' | 'not_applicable' | 'incomplete'
export type AutoPopulatedConfidence = 'high' | 'medium' | 'low'
export type PackageStatus = 'generating' | 'ready' | 'failed'
export type VerificationResourceType = 'dataset_lineage' | 'analysis_run' | 'output_package' | 'approval'
export type VerificationAccessLevel = 'summary' | 'full'

export interface ChecklistItem {
  item_id: string
  section: string
  item_number: string
  requirement: string
  explanation: string
  status: ChecklistItemStatus
  response: string | null
  source: string | null
  page_reference: string | null
  verified: boolean
  auto_populated_confidence: AutoPopulatedConfidence | null
}

export interface ReportingChecklist {
  id: string
  project_id: string
  dataset_id: string
  version_id: string
  guideline: ChecklistGuideline
  study_design: string | null
  items: Record<string, ChecklistItem>
  total_items: number
  auto_populated: number
  manually_completed: number
  not_applicable: number
  incomplete: number
  submission_ready: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface OutputPackage {
  id: string
  project_id: string
  dataset_id: string
  version_id: string
  manifest: Record<string, unknown>
  package_hash: string | null
  storage_path: string | null
  status: PackageStatus
  generated_by: string
  generated_at: string
  expires_at: string | null
}

export interface VerificationToken {
  id: string
  resource_type: VerificationResourceType
  resource_id: string
  project_id: string
  token: string
  access_level: VerificationAccessLevel
  restricted_to_email: string | null
  created_by: string
  created_at: string
  expires_at: string
  view_count: number
  last_viewed_at: string | null
  revoked_at: string | null
}

export interface MethodsSections {
  data_collection: string
  data_quality: string
  data_management: string
  analytic_sample: string
  statistical_methods: string
}

export interface MethodsStatement {
  sections: MethodsSections
  full_text: string
  word_count: number
}

export interface VerificationData {
  dataset_name?: string
  version?: string
  import_date?: string
  final_n?: number
  operation_count?: number
  chain_verified?: boolean
  dqi_score?: number | string
  approved?: boolean
  certificate_hash_prefix?: string
}

export interface VerificationResponse {
  valid: boolean
  token?: string
  resource_type?: string
  access_level?: string
  expires_at?: string
  view_count?: number
  data?: VerificationData
  reason?: string
}

export interface PackageComponent {
  id: string
  label: string
  description: string
  icon: string
  available: boolean
}

export const PACKAGE_COMPONENTS: PackageComponent[] = [
  {
    id: 'certificate',
    label: 'Data Lineage Certificate',
    description: 'Cryptographically verified data provenance record',
    icon: 'award',
    available: true,
  },
  {
    id: 'checklist',
    label: 'Reporting Checklist',
    description: 'STROBE/CONSORT/PRISMA/TRIPOD completed checklist',
    icon: 'clipboard-check',
    available: true,
  },
  {
    id: 'quality_report',
    label: 'Data Quality Report',
    description: 'PLEXUS DQI assessment with scores and flags',
    icon: 'bar-chart',
    available: true,
  },
  {
    id: 'methods',
    label: 'Methods Statement',
    description: 'Auto-generated methods text for manuscript',
    icon: 'file-text',
    available: true,
  },
  {
    id: 'audit_summary',
    label: 'Audit Trail Summary',
    description: 'Complete tamper-evident operation log',
    icon: 'shield',
    available: true,
  },
  {
    id: 'verification',
    label: 'Verification Info',
    description: 'PLX-VRF token for third-party verification',
    icon: 'link',
    available: true,
  },
  {
    id: 'approval',
    label: 'Supervisor Approval',
    description: 'Signed supervisor approval record',
    icon: 'user-check',
    available: true,
  },
  {
    id: 'reentry',
    label: 'Re-entry Validation',
    description: 'Double-entry data validation report',
    icon: 'refresh-cw',
    available: true,
  },
]
