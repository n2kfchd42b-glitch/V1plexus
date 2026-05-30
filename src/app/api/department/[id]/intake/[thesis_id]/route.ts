import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getScope } from '@/lib/admin/scope'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * POST /api/department/[id]/intake/[thesis_id]
 *
 * Schedule a final defense for a submitted thesis. Creates a row in
 * thesis_defenses and flips thesis_metadata.defense_status to
 * 'final_scheduled'. The thesis then drops off the intake list.
 *
 * Committee invitations are handled in a later PR; this endpoint sets the
 * date + location + meeting link + notes only.
 */

const schema = z.object({
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  scheduled_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().or(z.literal('')),
  location:       z.string().trim().max(300).optional().or(z.literal('')),
  meeting_link:   z.string().trim().url().max(500).optional().or(z.literal('')),
  notes:          z.string().trim().max(2000).optional().or(z.literal('')),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; thesis_id: string }> },
) {
  const { id, thesis_id } = await params
  const supabase = await createClient()
  const scope = await getScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (scope.departmentIds !== 'all' && !scope.departmentIds.includes(id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const svc = createServiceClient()

  const { data: thesis } = await svc
    .from('thesis_metadata')
    .select('id, project_id, thesis_title, lifecycle_state, defense_status')
    .eq('id', thesis_id)
    .maybeSingle()
  if (!thesis) return NextResponse.json({ error: 'Thesis not found' }, { status: 404 })
  if (thesis.lifecycle_state !== 'submitted') {
    return NextResponse.json({ error: 'Thesis is not in submitted state' }, { status: 409 })
  }
  if (thesis.defense_status !== 'not_scheduled') {
    return NextResponse.json({ error: 'A defense is already scheduled' }, { status: 409 })
  }

  // Verify scope: the project owner must be supervised in this dept.
  const { data: project } = await svc
    .from('projects')
    .select('id, owner_id, title')
    .eq('id', thesis.project_id)
    .maybeSingle()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const { data: deptAssignment } = await svc
    .from('supervisor_assignments')
    .select('id')
    .eq('department_id', id)
    .eq('student_id', project.owner_id)
    .in('status', ['active', 'ended'])
    .limit(1)
    .maybeSingle()
  if (!deptAssignment) {
    return NextResponse.json({ error: 'Thesis is not from this department' }, { status: 403 })
  }

  const { data: defense, error: insertErr } = await svc
    .from('thesis_defenses')
    .insert({
      project_id: thesis.project_id,
      defense_type: 'final',
      scheduled_date: parsed.data.scheduled_date,
      scheduled_time: parsed.data.scheduled_time || null,
      location: parsed.data.location || null,
      meeting_link: parsed.data.meeting_link || null,
      notes: parsed.data.notes || null,
    })
    .select('id, scheduled_date')
    .single()
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  const { error: updateErr } = await svc
    .from('thesis_metadata')
    .update({ defense_status: 'final_scheduled' })
    .eq('id', thesis_id)
  if (updateErr) {
    // Rollback the defense row to keep state consistent.
    await svc.from('thesis_defenses').delete().eq('id', defense.id)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  void writeAuditEntry({
    actor_id: scope.userId,
    action: 'institution.admin.updated',
    resource_type: 'thesis_defense',
    resource_id: defense.id,
    institution_id: scope.institutionId,
    details: {
      summary: `Scheduled final defense for "${thesis.thesis_title ?? project.title}" on ${parsed.data.scheduled_date}`,
      department_id: id,
      thesis_id,
      defense_id: defense.id,
      scheduled_date: parsed.data.scheduled_date,
    },
  })

  return NextResponse.json({ success: true, defense_id: defense.id })
}
