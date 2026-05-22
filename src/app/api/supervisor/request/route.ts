import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNotification } from '@/lib/notifications/notificationService'
import { z } from 'zod'

const RequestSchema = z.object({
  supervisor_id: z.string().uuid(),
})

// POST /api/supervisor/request — student requests a supervisor (student-initiated)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { supervisor_id } = parsed.data

  if (supervisor_id === user.id) {
    return NextResponse.json({ error: 'You cannot supervise yourself' }, { status: 400 })
  }

  // Check for an existing pending or active assignment
  const { data: existing } = await supabase
    .from('supervisor_assignments')
    .select('id, status')
    .eq('student_id', user.id)
    .eq('supervisor_id', supervisor_id)
    .in('status', ['pending', 'active'])
    .maybeSingle()

  if (existing) {
    const msg = existing.status === 'active'
      ? 'This person is already your supervisor'
      : 'A request is already pending with this supervisor'
    return NextResponse.json({ error: msg }, { status: 409 })
  }

  // Use the student's personal workspace as the assignment workspace
  const { data: membership } = await supabase
    .from('workspace_memberships')
    .select('workspace_id, workspace:workspaces(type)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'No active workspace found. Complete setup first.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('supervisor_assignments')
    .insert({
      supervisor_id,
      student_id: user.id,
      workspace_id: membership.workspace_id,
      department_id: null,
      role: 'primary',
      assigned_by: user.id,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the supervisor (non-blocking)
  const serviceClient = createServiceClient()
  const [{ data: studentProfile }, { data: supervisorProfile }] = await Promise.all([
    serviceClient.from('profiles').select('full_name').eq('id', user.id).single(),
    serviceClient.from('profiles').select('full_name, email').eq('id', supervisor_id).single(),
  ])
  const studentName = studentProfile?.full_name ?? 'A student'

  await sendNotification(
    supervisor_id,
    'supervision_requested',
    'New supervision request',
    `${studentName} has requested your supervision on Plexus.`,
    '/supervisor/dashboard',
    { resource_type: 'supervisor_assignment', resource_id: data.id },
    serviceClient,
    supervisorProfile?.email ?? undefined,
  )

  return NextResponse.json(data, { status: 201 })
}

// GET /api/supervisor/request — supervisor lists pending requests from students
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('supervisor_assignments')
    .select(`
      *,
      student:profiles!student_id(id, full_name, email, avatar_url, title)
    `)
    .eq('supervisor_id', user.id)
    .eq('status', 'pending')
    .order('assigned_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
