/**
 * Checks whether a user has access to a project as owner or member.
 * Project owners live in projects.owner_id, not project_members.
 * Use this instead of a bare project_members check in API routes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function hasProjectAccess(supabase: any, projectId: string, userId: string): Promise<boolean> {
  const { data: project } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .single()

  if (project?.owner_id === userId) return true

  const { data: member } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single()

  return !!member
}
