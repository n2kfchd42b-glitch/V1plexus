import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const VALID_PHASES = ['concept', 'protocol', 'ethics', 'data', 'analysis', 'writing', 'publication'] as const

const CreateMilestoneSchema = z.object({
  student_id:   z.string().uuid(),
  workspace_id: z.string().uuid(),
  project_id:   z.string().uuid().nullable().optional(),
  phase:        z.enum(VALID_PHASES).nullable().optional(),
  title:        z.string().min(1),
  description:  z.string().optional(),
  order_index:  z.number().int().default(0),
  due_date:     z.string().nullable().optional(),
  template_id:  z.string().uuid().nullable().optional(),
})

// GET /api/milestones?student_id=&workspace_id=
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const student_id = searchParams.get('student_id')
  const workspace_id = searchParams.get('workspace_id')

  let query = supabase
    .from('student_milestones')
    .select(`
      *,
      student:profiles!student_id(id, full_name, avatar_url, email),
      supervisor:profiles!supervisor_id(id, full_name, avatar_url, email),
      latest_submission:milestone_submissions(*)
    `)
    .order('order_index', { ascending: true })

  const project_id = searchParams.get('project_id')
  const phase      = searchParams.get('phase')
  const status     = searchParams.get('status')

  if (student_id)   query = query.eq('student_id', student_id)
  if (workspace_id) query = query.eq('workspace_id', workspace_id)
  if (project_id)   query = query.eq('project_id', project_id)
  if (phase)        query = query.eq('phase', phase)
  if (status === 'pending') query = query.neq('status', 'approved')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

// POST /api/milestones — supervisor creates a milestone for a student
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateMilestoneSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('student_milestones')
    .insert({
      ...parsed.data,
      supervisor_id: user.id,
      phase:      parsed.data.phase      ?? null,
      project_id: parsed.data.project_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
