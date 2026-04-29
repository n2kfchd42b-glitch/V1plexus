import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const svc = createServiceClient()
    const uid = user.id

    // ── 1. Leaf tables with user_id ──────────────────────────────────────────
    await svc.from('notifications').delete().eq('user_id', uid)
    await svc.from('workspace_memberships').delete().eq('user_id', uid)
    await svc.from('project_members').delete().eq('user_id', uid)
    await svc.from('credential_uploads').delete().eq('user_id', uid)
    await svc.from('audit_logs').delete().eq('user_id', uid)
    await svc.from('supervisor_assignments').delete().eq('supervisor_id', uid)
    await svc.from('supervisor_assignments').delete().eq('student_id', uid)
    await svc.from('review_requests').delete().eq('assigned_to', uid)
    await svc.from('review_requests').delete().eq('requested_by', uid)
    await svc.from('portfolio_certificates').delete().eq('user_id', uid)
    await svc.from('portfolio_publications').delete().eq('user_id', uid)

    // ── 2. Projects owned by user (cascade to documents, datasets, runs, etc.) ──
    const { data: ownedProjects } = await svc
      .from('projects')
      .select('id')
      .eq('owner_id', uid)

    if (ownedProjects && ownedProjects.length > 0) {
      const projectIds = ownedProjects.map((p: { id: string }) => p.id)
      // Remove other users' memberships in the user's projects first
      await svc.from('project_members').delete().in('project_id', projectIds)
      await svc.from('projects').delete().eq('owner_id', uid)
    }

    // ── 3. Workspaces owned by user ──────────────────────────────────────────
    const { data: ownedWorkspaces } = await svc
      .from('workspaces')
      .select('id')
      .eq('owner_id', uid)

    if (ownedWorkspaces && ownedWorkspaces.length > 0) {
      const wsIds = ownedWorkspaces.map((w: { id: string }) => w.id)
      await svc.from('workspace_memberships').delete().in('workspace_id', wsIds)
      await svc.from('workspace_invitations').delete().in('workspace_id', wsIds)
      await svc.from('workspaces').delete().eq('owner_id', uid)
    }

    // ── 4. Profile ───────────────────────────────────────────────────────────
    await svc.from('profiles').delete().eq('id', uid)

    // ── 5. Auth user ─────────────────────────────────────────────────────────
    const { error: deleteError } = await svc.auth.admin.deleteUser(uid)

    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError.message)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete account error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
