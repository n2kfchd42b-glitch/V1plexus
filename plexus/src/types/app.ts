import type { Tables } from './database'

export type Profile = Tables<'profiles'>
export type Institution = Tables<'institutions'>
export type Department = Tables<'departments'>
export type UserRole = Tables<'user_roles'>
export type Project = Tables<'projects'>
export type ProjectMember = Tables<'project_members'>
export type ProjectMilestone = Tables<'project_milestones'>

export type ProjectStatus = Project['status']
export type ProjectPhase = Project['phase']
export type MilestoneStatus = ProjectMilestone['status']
export type MemberRole = ProjectMember['role']
export type SystemRole = UserRole['role']

export type ProjectWithOwner = Project & {
  owner: Profile
  member_count?: number
}

export type ProjectMemberWithProfile = ProjectMember & {
  profile: Profile
}

export type DepartmentWithCounts = Department & {
  project_count?: number
  member_count?: number
}

export type ProfileWithRoles = Profile & {
  roles?: UserRole[]
}
