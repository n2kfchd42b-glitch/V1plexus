/**
 * Researcher Portfolio Types
 * Public-facing research integrity profile system
 */

export type IntegrityLevel = 'verified' | 'established' | 'emerging'
export type BadgeLevel =
  | 'plexus_verified'
  | 'plexus_established'
  | 'plexus_emerging'

export interface IntegrityBadge {
  level: BadgeLevel
  label: string
  description: string
  color: string
  icon: string
}

export interface ResearcherProfile {
  id: string
  username: string | null
  full_name: string
  bio: string | null
  institution: string | null
  role: string | null
  research_areas: string[]
  orcid_id: string | null
  google_scholar_url: string | null
  researchgate_url: string | null
  personal_website: string | null
  portfolio_headline: string | null
  avatar_color: string
  initials: string
  joined_at: string
  portfolio_public: boolean
}

export interface PortfolioStats {
  total_datasets: number
  total_analyses: number
  total_publications: number
  total_certificates: number
  avg_dqi_score: number | null
  datasets_supervisor_approved: number
  analyses_with_assumption_checks: number
  datasets_with_reentry: number
  research_active_since: string
  last_active: string
  total_participants_studied: number
}

export interface IntegrityBreakdown {
  avg_dqi: number
  supervision_rate: number
  assumption_check_rate: number
  chain_verification_rate: number
}

export interface IntegrityRecord {
  integrity_score: number
  integrity_level: IntegrityLevel
  breakdown: IntegrityBreakdown
  badge: IntegrityBadge
}

export interface PortfolioPublication {
  id: string
  profile_id: string
  dataset_id: string | null
  version_id: string | null
  verification_token_id: string | null
  title: string
  journal: string | null
  year: number | null
  doi: string | null
  authors: string[]
  abstract: string | null
  study_type: string | null
  study_population: string | null
  sample_size: number | null
  dqi_score: number | null
  certificate_hash: string | null
  reporting_guideline: string | null
  supervisor_approved: boolean
  assumption_checks_conducted: boolean
  reentry_conducted: boolean
  is_public: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface PortfolioPublicCert {
  id: string
  profile_id: string
  dataset_id: string
  version_id: string
  verification_token_id: string | null
  display_title: string | null
  context_note: string | null
  dqi_score_snapshot: number | null
  supervisor_approved: boolean
  assumption_checks_conducted: boolean
  reentry_conducted: boolean
  chain_verified: boolean
  is_public: boolean
  display_order: number
  created_at: string
  dataset_name?: string
  dataset_source?: string
}

export interface ActivityMonth {
  month: string
  count: number
}

export interface DailyActivity {
  date: string
  count: number
}

export interface AnalysisTypeBreakdown {
  type: string
  count: number
  pct: number
}

export interface ActivitySummary {
  monthly_analyses: ActivityMonth[]
  analysis_types: AnalysisTypeBreakdown[]
  geographic_focus: string[]
  daily_activity: DailyActivity[]
}

export interface PortfolioData {
  profile: ResearcherProfile
  stats: PortfolioStats
  publications: PortfolioPublication[]
  certificates: PortfolioPublicCert[]
  activity: ActivitySummary
  integrity_record: IntegrityRecord
  is_owner: boolean
}

// API Request/Response types
export interface UpdateProfileRequest {
  bio?: string
  institution?: string
  role?: string
  research_areas?: string[]
  orcid_id?: string
  google_scholar_url?: string
  researchgate_url?: string
  personal_website?: string
  portfolio_headline?: string
  portfolio_public?: boolean
  username?: string
}

export interface AddPublicationRequest {
  title: string
  journal?: string
  year?: number
  doi?: string
  authors?: string[]
  abstract?: string
  study_type?: string
  study_population?: string
  sample_size?: number
  dataset_id?: string
  version_id?: string
  reporting_guideline?: string
  is_public?: boolean
}

export interface AddCertificateRequest {
  dataset_id: string
  version_id: string
  display_title?: string
  context_note?: string
  is_public?: boolean
}

export interface CrossRefWork {
  title: string[]
  container_title: string
  published_online?: { date_parts: [[number]] }
  published_print?: { date_parts: [[number]] }
  author: Array<{ given?: string; family: string }>
  abstract?: string
  doi?: string
}

export interface UsernameCheckResponse {
  available: boolean
}
