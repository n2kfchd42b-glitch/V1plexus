import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getScope } from '@/lib/admin/scope'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * PATCH /api/department/[id]/roster/[entry_id]
 *
 * Invalidate a roster entry — soft-removal that prevents future claims but
 * preserves the audit trail. Already-claimed entries are blocked: those went
 * through claim_roster_seat and are tied to an enrollment; clearing them
 * requires unlinking the student first.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entry_id: string }> },
) {
  const { id, entry_id } = await params
  const supabase = await createClient()
  const scope = await getScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (scope.departmentIds !== 'all' && !scope.departmentIds.includes(id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { action?: string } = {}
  try { body = await request.json() } catch { /* allow empty body */ }
  if (body.action && body.action !== 'invalidate') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }

  const svc = createServiceClient()

  // Confirm the entry belongs to a programme in this dept (don't trust the
  // denormalised department_id alone).
  const { data: entry } = await svc
    .from('institution_roster_entries')
    .select(`
      id, matriculation_number, status, institution_id, programme_id,
      programme:institution_programmes(id, name, department_id)
    `)
    .eq('id', entry_id)
    .maybeSingle()
  if (!entry || entry.institution_id !== scope.institutionId) {
    return NextResponse.json({ error: 'Roster entry not found' }, { status: 404 })
  }
  const prog = entry.programme as unknown as { id: string; name: string; department_id: string | null } | null
  if (!prog || prog.department_id !== id) {
    return NextResponse.json({ error: 'Roster entry is not in this department' }, { status: 400 })
  }
  if (entry.status === 'claimed') {
    return NextResponse.json({
      error: 'This seat has already been claimed by a student. Unlink them from the institution before invalidating.',
    }, { status: 409 })
  }
  if (entry.status === 'invalidated') {
    return NextResponse.json({ success: true, noop: true })
  }

  const { error: updateErr } = await svc
    .from('institution_roster_entries')
    .update({ status: 'invalidated' })
    .eq('id', entry_id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  void writeAuditEntry({
    actor_id: scope.userId,
    action: 'institution.admin.updated',
    resource_type: 'institution',
    resource_id: scope.institutionId,
    institution_id: scope.institutionId,
    details: {
      summary: `Invalidated roster seat ${entry.matriculation_number} (${prog.name})`,
      department_id: id,
      programme_id: prog.id,
      roster_entry_id: entry_id,
    },
  })

  return NextResponse.json({ success: true })
}
