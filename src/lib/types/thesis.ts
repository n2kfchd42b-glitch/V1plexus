// ============================================================
// Phase 8: Thesis & Student Management Types
// ============================================================

export type DegreeType = "msc" | "mphil" | "phd" | "drph" | "md" | "other";

export type DefenseStatus =
  | "not_scheduled"
  | "proposal_scheduled"
  | "proposal_completed"
  | "final_scheduled"
  | "final_completed"
  | "passed"
  | "passed_with_corrections"
  | "revise_resubmit"
  | "failed";

export type CommitteeRole = "chair" | "co_chair" | "member" | "external_examiner" | "advisor";
export type CommitteeStatus = "invited" | "confirmed" | "declined" | "removed";

export type ChapterStatus =
  | "not_started"
  | "drafting"
  | "submitted_for_review"
  | "revision_requested"
  | "approved"
  | "locked";

export type DefenseType = "proposal" | "final";
export type DefenseOutcome = "pass" | "pass_with_corrections" | "revise_resubmit" | "fail";

// ---- Database row types ----

export interface ThesisMetadata {
  id: string;
  project_id: string;
  degree_type: DegreeType;
  program_name: string;
  enrollment_date: string | null;
  expected_completion: string | null;
  actual_completion: string | null;
  thesis_title: string | null;
  defense_status: DefenseStatus;
  created_at: string;
  updated_at: string;
}

export interface ThesisCommittee {
  id: string;
  project_id: string;
  user_id: string | null;
  external_name: string | null;
  external_email: string | null;
  external_institution: string | null;
  role: CommitteeRole;
  status: CommitteeStatus;
  invited_at: string;
  confirmed_at: string | null;
  invited_by: string | null;
  created_at: string;
  // Joined from profiles
  profile?: {
    full_name: string | null;
    email: string | null;
    institution_id: string | null;
  };
}

export interface ThesisChapter {
  id: string;
  project_id: string;
  document_id: string | null;
  chapter_number: number;
  title: string;
  status: ChapterStatus;
  target_date: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  // Joined from profiles
  approver?: {
    full_name: string | null;
  };
}

export interface ThesisDefense {
  id: string;
  project_id: string;
  defense_type: DefenseType;
  scheduled_date: string | null;
  scheduled_time: string | null;
  location: string | null;
  meeting_link: string | null;
  outcome: DefenseOutcome | null;
  corrections_deadline: string | null;
  corrections_completed_at: string | null;
  examiner_reports: ExaminerReport[];
  notes: string | null;
  format_check_completed_at: string | null;
  final_submission_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExaminerReport {
  examiner_id: string;
  report_file_path: string;
  submitted_at: string;
}

export interface FormatRule {
  id: string;
  institution_id: string;
  name: string;
  rules: FormatRulesSpec;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormatRulesSpec {
  font_family?: string;
  font_size_body?: number;
  font_size_h1?: number;
  font_size_h2?: number;
  line_spacing?: number;
  margin_top?: number;
  margin_bottom?: number;
  margin_left?: number;
  margin_right?: number;
  page_number_format?: "arabic" | "roman" | "mixed";
  reference_style?: string;
  [key: string]: unknown;
}

export interface GuestAccessToken {
  id: string;
  committee_id: string;
  token: string;
  email: string;
  permissions: string[];
  expires_at: string;
  last_used_at: string | null;
  created_at: string;
}

// ---- UI / view types ----

export interface ThesisProgressStats {
  total_chapters: number;
  approved_chapters: number;
  in_progress_chapters: number;
  not_started_chapters: number;
  overdue_chapters: number;
  overall_percent: number;
  estimated_completion: string | null;
  months_ahead_behind: number; // positive = ahead, negative = behind
}

export interface EarlyWarning {
  type: "overdue" | "at_risk" | "pace" | "info";
  chapter_id?: string;
  chapter_title?: string;
  message: string;
  days_behind?: number;
}

export interface GanttEntry {
  id: string;
  label: string;
  start_date: string | null;
  target_date: string | null;
  actual_end: string | null;
  status: ChapterStatus | "defense";
}

export interface FormatViolation {
  id: string;
  severity: "error" | "warn" | "info";
  location: string;
  field: string;
  actual: string;
  expected: string;
  auto_fixable: boolean;
}

export interface CoordinatorThesisRow {
  project_id: string;
  student_name: string;
  thesis_title: string | null;
  degree_type: DegreeType;
  supervisor_name: string | null;
  progress_percent: number;
  status_label: "on_track" | "behind" | "at_risk" | "near_completion";
  current_chapter: string | null;
  expected_completion: string | null;
  defense_status: DefenseStatus;
  alert_message?: string;
}

export const DEGREE_LABELS: Record<DegreeType, string> = {
  msc: "MSc",
  mphil: "MPhil",
  phd: "PhD",
  drph: "DrPH",
  md: "MD",
  other: "Other",
};

export const DEFAULT_CHAPTERS_BY_DEGREE: Record<DegreeType, string[]> = {
  phd: ["Introduction", "Literature Review", "Theoretical Framework", "Methodology", "Results", "Discussion", "Conclusion"],
  drph: ["Introduction", "Literature Review", "Conceptual Framework", "Methodology", "Results", "Discussion", "Policy Implications", "Conclusion"],
  msc: ["Introduction", "Literature Review", "Methodology", "Results", "Discussion", "Conclusion"],
  mphil: ["Introduction", "Literature Review", "Methodology", "Results", "Discussion", "Conclusion"],
  md: ["Introduction", "Literature Review", "Methodology", "Results", "Discussion", "Conclusion"],
  other: ["Introduction", "Literature Review", "Methodology", "Results", "Discussion", "Conclusion"],
};

export const CHAPTER_STATUS_CONFIG: Record<
  ChapterStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  not_started: { label: "Not Started",          color: "text-gray-500",   bg: "bg-gray-100",   border: "border-gray-200" },
  drafting:    { label: "Drafting",              color: "text-blue-600",   bg: "bg-blue-50",    border: "border-blue-200" },
  submitted_for_review: { label: "Under Review", color: "text-purple-600", bg: "bg-purple-50",  border: "border-purple-200" },
  revision_requested:   { label: "Revision Requested", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  approved:    { label: "Approved",              color: "text-green-600",  bg: "bg-green-50",   border: "border-green-200" },
  locked:      { label: "Locked",                color: "text-gray-600",   bg: "bg-gray-100",   border: "border-gray-300" },
};

export const DEFENSE_STATUS_CONFIG: Record<DefenseStatus, { label: string; color: string }> = {
  not_scheduled:        { label: "Not Scheduled",          color: "text-gray-500"  },
  proposal_scheduled:   { label: "Proposal Scheduled",     color: "text-blue-600"  },
  proposal_completed:   { label: "Proposal Completed",     color: "text-blue-700"  },
  final_scheduled:      { label: "Final Defense Scheduled", color: "text-purple-600" },
  final_completed:      { label: "Final Defense Held",     color: "text-purple-700" },
  passed:               { label: "Passed",                 color: "text-green-600" },
  passed_with_corrections: { label: "Passed with Corrections", color: "text-amber-600" },
  revise_resubmit:      { label: "Revise & Resubmit",      color: "text-orange-600" },
  failed:               { label: "Failed",                 color: "text-red-600"   },
};
