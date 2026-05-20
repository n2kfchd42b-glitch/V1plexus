import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNotification } from '@/lib/notifications/notificationService'
import { z } from 'zod'

const CreateSchema = z.object({
  student_id:   z.string().uuid(),
  project_id:   z.string().uuid(),
  title:        z.string().optional(),
  summary:      z.string().min(10),
  action_items: z.array(z.string()).optional(),
})

// GET /api/supervision/records?projectId=X&studentId=Y
// Students fetch their own records; supervisors fetch their students' records.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  const studentId = searchParams.get('studentId')

  // Scope: caller can only see records where they are the student OR the supervisor
  let query = supabase
    .from('supervision_records')
    .select(`*, supervisor:profiles!supervisor_id(id, full_name)`)
    .or(`student_id.eq.${user.id},supervisor_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (projectId) query = query.eq('project_id', projectId)
  // If a specific studentId is requested, honour it (supervisor viewing a student's records)
  if (studentId && studentId !== user.id) query = query.eq('student_id', studentId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/supervision/records
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Verify supervisor relationship
  const { data: assignment } = await supabase
    .from('supervisor_assignments')
    .select('id')
    .eq('supervisor_id', user.id)
    .eq('student_id', parsed.data.student_id)
    .eq('status', 'active')
    .maybeSingle()

  if (!assignment) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('supervision_records')
    .insert({
      supervisor_id: user.id,
      student_id:    parsed.data.student_id,
      project_id:    parsed.data.project_id,
      title:         parsed.data.title ?? 'Supervision Session',
      summary:       parsed.data.summary,
      action_items:  parsed.data.action_items ?? [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the student — use service client so the insert bypasses RLS
  const { data: supervisor } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()
  const supervisorName = supervisor?.full_name ?? 'Your supervisor'
  const sessionTitle   = parsed.data.title ?? 'Supervision Session'

  await sendNotification(
    parsed.data.student_id,
    'supervision_session',
    `${supervisorName} wrote a session record`,
    sessionTitle,
    `/projects/${parsed.data.project_id}`,
    { resource_type: 'supervision_record', resource_id: data.id },
    createServiceClient(),
  )

  return NextResponse.json(data, { status: 201 })
}
