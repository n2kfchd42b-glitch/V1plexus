import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getScope } from '@/lib/admin/scope'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * POST /api/department/[id]/defenses/[defense_id]
 *
 * Record the outcome of a scheduled final defense and transition the thesis
 * lifecycle. Closes the loop started by /intake → /defenses scheduling.
 *
 * Transitions:
 *   pass                    → defense_status='passed',                  lifecycle='approved'
 *   pass_with_corrections   → defense_status='passed_with_corrections', lifecycle='approved'
 *   revise_resubmit         → defense_status='revise_resubmit',         lifecycle='submitted'
 *   fail                    → defense_status='failed',                  lifecycle='archived'
 */

const schema = z.object({
  outcome:              z.enum(['pass', 'pass_with_corrections', 'revise_resubmit', 'fail']),
  corrections_deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  notes:                z.string().trim().max(2000).optional().or(z.literal('')),
})

const TRANSITIONS = {
  pass:                  { defense_status: 'passed' as const,                  lifecycle_state: 'approved'  as const },
  pass_with_corrections: { defense_status: 'passed_with_corrections' as const, lifecycle_state: 'approved'  as const },
  revise_resubmit:       { defense_status: 'revise_resubmit' as const,         lifecycle_state: 'submitted' as const },
  fail:                  { defense_status: 'failed' as const,                  lifecycle_state: 'archived'  as const },
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; defense_id: string }> },
) {
  const { id, defense_id } = await params
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

  // Load defense + thesis + project (for scope verification + audit)
  const { data: defense } = await svc
    .from('thesis_defenses')
    .select('id, project_id, defense_type, outcome, scheduled_date')
    .eq('id', defense_id)
    .maybeSingle()
  if (!defense) return NextResponse.json({ error: 'Defense not found' }, { status: 404 })
  if (defense.defense_type !== 'final') {
    return NextResponse.json({ error: 'Only final defenses are recorded here' }, { status: 409 })
  }
  if (defense.outcome !== null) {
    return NextResponse.json({ error: 'An outcome has already been recorded for this defense' }, { status: 409 })
  }

  const { data: project } = await svc
    .from('projects')
    .select('id, owner_id, title')
    .eq('id', defense.project_id)
    .maybeSingle()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Scope: project owner must be supervised in this dept
  const { data: deptAssignment } = await svc
    .from('supervisor_assignments')
    .select('id')
    .eq('department_id', id)
    .eq('student_id', project.owner_id)
    .in('status', ['active', 'ended'])
    .limit(1)
    .maybeSingle()
  if (!deptAssignment) {
    return NextResponse.json({ error: 'Defense is not from this department' }, { status: 403 })
  }

  const { data: thesis } = await svc
    .from('thesis_metadata')
    .select('id, thesis_title, defense_status, lifecycle_state')
    .eq('project_id', defense.project_id)
    .maybeSingle()
  if (!thesis) return NextResponse.json({ error: 'Thesis metadata not found' }, { status: 404 })

  const transition = TRANSITIONS[parsed.data.outcome]
  const correctionsDeadlineOK = parsed.data.outcome === 'pass_with_corrections' || parsed.data.outcome === 'revise_resubmit'

  // Update defense row
  const { error: defErr } = await svc
    .from('thesis_defenses')
    .update({
      outcome: parsed.data.outcome,
      corrections_deadline: correctionsDeadlineOK ? (parsed.data.corrections_deadline || null) : null,
      notes: parsed.data.notes || null,
    })
    .eq('id', defense_id)
  if (defErr) return NextResponse.json({ error: defErr.message }, { status: 500 })

  // Transition thesis_metadata
  const { error: metaErr } = await svc
    .from('thesis_metadata')
    .update({
      defense_status: transition.defense_status,
      lifecycle_state: transition.lifecycle_state,
    })
    .eq('id', thesis.id)
  if (metaErr) {
    // Best-effort rollback so the two rows don't disagree.
    await svc.from('thesis_defenses').update({ outcome: null, corrections_deadline: null }).eq('id', defense_id)
    return NextResponse.json({ error: metaErr.message }, { status: 500 })
  }

  void writeAuditEntry({
    actor_id: scope.userId,
    action: 'institution.admin.updated',
    resource_type: 'thesis_defense',
    resource_id: defense_id,
    institution_id: scope.institutionId,
    details: {
      summary: `Recorded ${parsed.data.outcome.replace(/_/g, ' ')} for "${thesis.thesis_title ?? project.title}"`,
      department_id: id,
      thesis_id: thesis.id,
      defense_id,
      outcome: parsed.data.outcome,
      lifecycle_state: transition.lifecycle_state,
    },
  })

  return NextResponse.json({
    success: true,
    outcome: parsed.data.outcome,
    lifecycle_state: transition.lifecycle_state,
  })
}
