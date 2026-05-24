import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — return supervisor assignments for this student + their access status on this project
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params

  // Verify caller owns this project
  const { data: project } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .single()

  if (!project || project.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get all supervisors assigned to this student — include pending so the
  // student can see in-flight requests waiting for acceptance.
  const [{ data: assignments }, { data: emailInvites }] = await Promise.all([
    supabase
      .from('supervisor_assignments')
      .select('id, supervisor_id, role, status, supervisor:profiles!supervisor_id(id, full_name, email)')
      .eq('student_id', user.id)
      .in('status', ['active', 'pending']),
    // Email invites the student sent to people not yet on Plexus.
    // No supervisor_assignment row exists for these until acceptance.
    supabase
      .from('workspace_invitations')
      .select('id, email, status')
      .eq('invited_by', user.id)
      .eq('role', 'supervisor')
      .eq('status', 'pending'),
  ])

  const supervisorIds = (assignments ?? []).map(a => a.supervisor_id)

  // Check which assigned supervisors already have access to this project
  const { data: existingMembers } = supervisorIds.length > 0
    ? await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId)
        .in('user_id', supervisorIds)
    : { data: [] as { user_id: string }[] }

  const accessSet = new Set((existingMembers ?? []).map(m => m.user_id))

  const assignmentRows = (assignments ?? []).map(a => ({
    assignmentId: a.id,
    supervisorId: a.supervisor_id,
    role: a.role as 'primary' | 'co_supervisor',
    status: a.status as 'active' | 'pending',
    kind: 'assignment' as const,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    name: (a.supervisor as any)?.full_name ?? (a.supervisor as any)?.email ?? 'Supervisor',
    hasAccess: accessSet.has(a.supervisor_id),
  }))

  const inviteRows = (emailInvites ?? []).map(i => ({
    assignmentId: i.id,
    supervisorId: null,
    role: 'primary' as const,
    status: 'pending' as const,
    kind: 'email_invite' as const,
    name: i.email,
    hasAccess: false,
  }))

  return NextResponse.json([...assignmentRows, ...inviteRows])
}

// POST — grant a supervisor access to this project
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const { supervisorId } = await req.json()

  if (!supervisorId) return NextResponse.json({ error: 'supervisorId required' }, { status: 400 })

  // Verify caller owns this project
  const { data: project } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .single()

  if (!project || project.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Verify the target is an active supervisor of this student
  const { data: assignment } = await supabase
    .from('supervisor_assignments')
    .select('id')
    .eq('student_id', user.id)
    .eq('supervisor_id', supervisorId)
    .eq('status', 'active')
    .maybeSingle()

  if (!assignment) {
    return NextResponse.json({ error: 'This person is not your assigned supervisor' }, { status: 403 })
  }

  const { error } = await supabase
    .from('project_members')
    .insert({ project_id: projectId, user_id: supervisorId, role: 'viewer' })

  if (error && error.code !== '23505') { // ignore duplicate
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// PATCH — update a supervisor's role on their assignment
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const { assignmentId, role } = await req.json()

  if (!assignmentId || !role) return NextResponse.json({ error: 'assignmentId and role required' }, { status: 400 })
  if (role !== 'primary' && role !== 'co_supervisor') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Verify caller owns this project
  const { data: project } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .single()

  if (!project || project.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Only allow updating assignments belonging to this student
  const { error } = await supabase
    .from('supervisor_assignments')
    .update({ role })
    .eq('id', assignmentId)
    .eq('student_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// DELETE — revoke a supervisor's access to this project
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const { supervisorId } = await req.json()

  if (!supervisorId) return NextResponse.json({ error: 'supervisorId required' }, { status: 400 })

  // Verify caller owns this project
  const { data: project } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .single()

  if (!project || project.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', supervisorId)

  return NextResponse.json({ ok: true })
}
