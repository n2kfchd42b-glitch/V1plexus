import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNotification } from '@/lib/notifications/notificationService'
import { z } from 'zod'

const PatchSchema = z.object({
  assignment_id: z.string().uuid(),
  action: z.enum(['accept', 'decline']),
})

const AssignSchema = z.object({
  student_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  role: z.enum(['primary', 'co_supervisor']).default('primary'),
  department_id: z.string().uuid().optional(),
})

// POST /api/supervisor/assignments — assign a supervisor to a student
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = AssignSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('supervisor_assignments')
    .insert({
      supervisor_id: user.id,
      student_id: parsed.data.student_id,
      workspace_id: parsed.data.workspace_id,
      department_id: parsed.data.department_id ?? null,
      role: parsed.data.role,
      assigned_by: user.id,
      status: 'active',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/supervisor/assignments — supervisor accepts or declines a pending request
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { assignment_id, action } = parsed.data

  const { data: existing } = await supabase
    .from('supervisor_assignments')
    .select('id, status, student_id')
    .eq('id', assignment_id)
    .eq('supervisor_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Pending request not found' }, { status: 404 })

  const update = action === 'accept'
    ? { status: 'active' as const }
    : { status: 'ended' as const, ended_at: new Date().toISOString() }

  const { error } = await supabase
    .from('supervisor_assignments')
    .update(update)
    .eq('id', assignment_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the student of the decision (non-blocking)
  const serviceClient = createServiceClient()
  const [{ data: supervisorProfile }, { data: studentProfile }] = await Promise.all([
    serviceClient.from('profiles').select('full_name').eq('id', user.id).single(),
    serviceClient.from('profiles').select('full_name, email').eq('id', existing.student_id).single(),
  ])
  const supervisorName = supervisorProfile?.full_name ?? 'Your supervisor'

  await sendNotification(
    existing.student_id,
    action === 'accept' ? 'supervision_accepted' : 'supervision_declined',
    action === 'accept'
      ? `${supervisorName} accepted your supervision request`
      : `${supervisorName} declined your supervision request`,
    action === 'accept'
      ? 'You now have an active supervisor on Plexus.'
      : 'Your supervision request was not accepted. You can find another supervisor.',
    '/student/supervisor',
    { resource_type: 'supervisor_assignment', resource_id: assignment_id },
    serviceClient,
    studentProfile?.email ?? undefined,
  )

  return NextResponse.json({ success: true })
}

// DELETE /api/supervisor/assignments?assignment_id= — end an assignment
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assignment_id = new URL(req.url).searchParams.get('assignment_id')
  if (!assignment_id) return NextResponse.json({ error: 'assignment_id required' }, { status: 400 })

  const { error } = await supabase
    .from('supervisor_assignments')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', assignment_id)
    .eq('supervisor_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
