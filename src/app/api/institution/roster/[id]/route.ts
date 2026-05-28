import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstitutionAdminContext } from '@/lib/admin/institutionAdmin'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

const INTENDED_ROLES = ['researcher', 'student', 'supervisor', 'admin', 'coordinator', 'viewer'] as const

const patchSchema = z.object({
  matriculation_number: z.string().trim().min(1).max(100).optional(),
  full_name_hint: z.string().trim().max(200).nullable().optional(),
  email_hint: z.string().trim().max(254).nullable().optional(),
  programme_id: z.string().uuid().nullable().optional(),
  cohort_id: z.string().uuid().nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
  intended_role: z.enum(INTENDED_ROLES).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(['unclaimed', 'invalidated']).optional(), // can't manually set to 'claimed'
})

async function loadEntry(svc: ReturnType<typeof createServiceClient>, id: string, institutionId: string) {
  const { data } = await svc
    .from('institution_roster_entries')
    .select('id, institution_id, matriculation_number, status')
    .eq('id', id)
    .eq('institution_id', institutionId)
    .maybeSingle()
  return data
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const svc = createServiceClient()
  const existing = await loadEntry(svc, id, ctx.institutionId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status === 'claimed') {
    return NextResponse.json({ error: 'Cannot edit a claimed entry' }, { status: 409 })
  }

  // Belongs-to validation
  if (parsed.data.programme_id) {
    const { data: prog } = await svc.from('institution_programmes').select('id').eq('id', parsed.data.programme_id).eq('institution_id', ctx.institutionId).maybeSingle()
    if (!prog) return NextResponse.json({ error: 'Programme not in your institution' }, { status: 400 })
  }
  if (parsed.data.cohort_id) {
    if (!parsed.data.programme_id) return NextResponse.json({ error: 'cohort_id requires programme_id' }, { status: 400 })
    const { data: cohort } = await svc.from('institution_cohorts').select('id').eq('id', parsed.data.cohort_id).eq('programme_id', parsed.data.programme_id).maybeSingle()
    if (!cohort) return NextResponse.json({ error: 'Cohort does not belong to programme' }, { status: 400 })
  }
  if (parsed.data.department_id) {
    const { data: dept } = await svc.from('departments').select('id').eq('id', parsed.data.department_id).eq('institution_id', ctx.institutionId).maybeSingle()
    if (!dept) return NextResponse.json({ error: 'Department not in your institution' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  for (const k of ['matriculation_number','full_name_hint','email_hint','programme_id','cohort_id','department_id','intended_role','notes','status'] as const) {
    if (parsed.data[k] !== undefined) update[k] = parsed.data[k]
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No updatable fields supplied' }, { status: 400 })
  }

  const { error } = await svc.from('institution_roster_entries').update(update).eq('id', id)
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A roster entry with that matriculation number already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const action = parsed.data.status === 'invalidated' && existing.status !== 'invalidated'
    ? 'institution.roster.entry.invalidated' as const
    : 'institution.roster.entry.updated' as const
  void writeAuditEntry({
    actor_id: ctx.userId,
    action,
    resource_type: 'institution_roster_entry',
    resource_id: id,
    institution_id: ctx.institutionId,
    details: {
      summary: action === 'institution.roster.entry.invalidated'
        ? `Invalidated roster entry ${existing.matriculation_number}`
        : `Updated ${Object.keys(update).join(', ')} on ${existing.matriculation_number}`,
      fields: update,
    },
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()
  const existing = await loadEntry(svc, id, ctx.institutionId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status === 'claimed') {
    return NextResponse.json({ error: 'Cannot delete a claimed entry; the user is already enrolled' }, { status: 409 })
  }

  const { error } = await svc.from('institution_roster_entries').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  void writeAuditEntry({
    actor_id: ctx.userId,
    action: 'institution.roster.entry.deleted',
    resource_type: 'institution_roster_entry',
    resource_id: id,
    institution_id: ctx.institutionId,
    details: { summary: `Deleted roster entry ${existing.matriculation_number}` },
  })

  return NextResponse.json({ success: true })
}
