import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/supervisor/students — returns all students assigned to the current supervisor
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: assignments, error } = await supabase
    .from('supervisor_assignments')
    .select(`
      *,
      student:profiles!student_id(
        id, full_name, avatar_url, email, title, department_id
      )
    `)
    .eq('supervisor_id', user.id)
    .eq('status', 'active')
    .order('assigned_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // For each student, fetch their milestone summary
  const studentIds = assignments.map(a => a.student_id)
  if (studentIds.length === 0) return NextResponse.json([])

  const { data: milestones } = await supabase
    .from('student_milestones')
    .select('student_id, status')
    .in('student_id', studentIds)

  const summaryByStudent = studentIds.reduce<Record<string, {
    total: number; approved: number; pending_review: number; overdue: number
  }>>((acc, sid) => {
    const sm = milestones?.filter(m => m.student_id === sid) ?? []
    acc[sid] = {
      total: sm.length,
      approved: sm.filter(m => m.status === 'approved').length,
      pending_review: sm.filter(m => ['submitted', 'under_review'].includes(m.status)).length,
      overdue: 0,
    }
    return acc
  }, {})

  const result = assignments.map(a => ({
    ...a,
    milestone_summary: summaryByStudent[a.student_id] ?? { total: 0, approved: 0, pending_review: 0, overdue: 0 },
  }))

  return NextResponse.json(result)
}
