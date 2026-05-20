import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/supervision/inbox — all unresolved annotations for the current supervisor's students
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get all students assigned to this supervisor
  const { data: assignments } = await supabase
    .from('supervisor_assignments')
    .select('student_id, student:profiles!student_id(id, full_name, email)')
    .eq('supervisor_id', user.id)
    .eq('status', 'active')

  if (!assignments || assignments.length === 0) return NextResponse.json([])

  const studentIds = assignments.map(a => a.student_id)

  const { data, error } = await supabase
    .from('supervision_annotations')
    .select(`
      id, content, anchor, anchor_label, artifact_type, artifact_id,
      project_id, is_resolved, created_at,
      student:profiles!student_id(id, full_name, email)
    `)
    .in('student_id', studentIds)
    .eq('supervisor_id', user.id)
    .eq('is_resolved', false)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
