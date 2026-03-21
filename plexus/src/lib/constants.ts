import type { ProjectPhase, ProjectStatus, MilestoneStatus, MemberRole, SystemRole } from '@/types/app'

export const PROJECT_PHASES: { value: ProjectPhase; label: string }[] = [
  { value: 'concept', label: 'Concept' },
  { value: 'protocol', label: 'Protocol' },
  { value: 'ethics_review', label: 'Ethics Review' },
  { value: 'data_collection', label: 'Data Collection' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'writing', label: 'Writing' },
  { value: 'publication', label: 'Publication' },
  { value: 'archived', label: 'Archived' },
]

export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
]

export const MILESTONE_STATUSES: { value: MilestoneStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
]

export const MEMBER_ROLES: { value: MemberRole; label: string; description: string }[] = [
  { value: 'pi', label: 'Principal Investigator', description: 'Full project ownership and oversight' },
  { value: 'supervisor', label: 'Supervisor', description: 'Mentorship and review responsibilities' },
  { value: 'researcher', label: 'Researcher', description: 'Active research contributor' },
  { value: 'collaborator', label: 'Collaborator', description: 'External collaborator with limited access' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
]

export const SYSTEM_ROLES: { value: SystemRole; label: string }[] = [
  { value: 'institution_admin', label: 'Institution Admin' },
  { value: 'department_head', label: 'Department Head' },
  { value: 'principal_investigator', label: 'Principal Investigator' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'external_reviewer', label: 'External Reviewer' },
]

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  active: 'bg-green-100 text-green-800',
  paused: 'bg-amber-100 text-amber-800',
  completed: 'bg-blue-100 text-blue-800',
  archived: 'bg-gray-100 text-gray-600',
}

export const MILESTONE_STATUS_COLORS: Record<MilestoneStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
}

export const PHASE_COLORS: Record<ProjectPhase, string> = {
  concept: 'bg-slate-100 text-slate-700',
  protocol: 'bg-blue-100 text-blue-700',
  ethics_review: 'bg-purple-100 text-purple-700',
  data_collection: 'bg-cyan-100 text-cyan-700',
  analysis: 'bg-indigo-100 text-indigo-700',
  writing: 'bg-amber-100 text-amber-700',
  publication: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-600',
}

export const ACTIVE_PHASES: ProjectPhase[] = [
  'concept', 'protocol', 'ethics_review', 'data_collection', 'analysis', 'writing', 'publication',
]

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/projects', label: 'Projects', icon: 'FolderOpen' },
  { href: '/institution', label: 'Institution', icon: 'Building2' },
] as const
