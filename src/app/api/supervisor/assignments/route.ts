import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

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
