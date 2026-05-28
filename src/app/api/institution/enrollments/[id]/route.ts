import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstitutionAdminContext } from '@/lib/admin/institutionAdmin'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

const patchSchema = z.object({
  programme_id: z.string().uuid().nullable().optional(),
  cohort_id: z.string().uuid().nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
  matriculation_number: z.string().trim().max(100).nullable().optional(),
  status: z.enum(['active', 'on_leave', 'graduated', 'withdrawn']).optional(),
  end_date: z.string().date().nullable().optional(),
})

async function loadEnrollment(svc: ReturnType<typeof createServiceClient>, id: string, institutionId: string) {
  const { data } = await svc
    .from('institution_enrollments')
    .select(`
      id, user_id, institution_id, programme_id, status,
      user:profiles!institution_enrollments_user_id_fkey(id, full_name, email)
    `)
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
  const existing = await loadEnrollment(svc, id, ctx.institutionId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Belongs-to checks for any moved foreign keys.
  if (parsed.data.programme_id) {
    const { data: prog } = await svc.from('institution_programmes').select('id').eq('id', parsed.data.programme_id).eq('institution_id', ctx.institutionId).maybeSingle()
    if (!prog) return NextResponse.json({ error: 'Programme not in your institution' }, { status: 400 })
  }
  if (parsed.data.cohort_id) {
    const targetProgramme = parsed.data.programme_id ?? existing.programme_id
    if (!targetProgramme) return NextResponse.json({ error: 'cohort_id requires programme_id' }, { status: 400 })
    const { data: cohort } = await svc.from('institution_cohorts').select('id').eq('id', parsed.data.cohort_id).eq('programme_id', targetProgramme).maybeSingle()
    if (!cohort) return NextResponse.json({ error: 'Cohort does not belong to that programme' }, { status: 400 })
  }
  if (parsed.data.department_id) {
    const { data: dept } = await svc.from('departments').select('id').eq('id', parsed.data.department_id).eq('institution_id', ctx.institutionId).maybeSingle()
    if (!dept) return NextResponse.json({ error: 'Department not in your institution' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  for (const k of ['programme_id','cohort_id','department_id','matriculation_number','status','end_date'] as const) {
    if (parsed.data[k] !== undefined) update[k] = parsed.data[k]
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No updatable fields supplied' }, { status: 400 })
  }

  const { error } = await svc.from('institution_enrollments').update(update).eq('id', id)
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'User already has an active enrollment in that programme' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const targetUser = existing.user as unknown as { full_name: string | null; email: string } | null
  const wasWithdrawal = parsed.data.status === 'withdrawn' && existing.status !== 'withdrawn'

  void writeAuditEntry({
    actor_id: ctx.userId,
    action: wasWithdrawal ? 'institution.enrollment.withdrawn' : 'institution.enrollment.updated',
    resource_type: 'institution_enrollment',
    resource_id: id,
    institution_id: ctx.institutionId,
    details: {
      summary: wasWithdrawal
        ? `Withdrew ${targetUser?.full_name ?? targetUser?.email ?? 'user'} from enrollment`
        : `Updated ${Object.keys(update).join(', ')} for ${targetUser?.full_name ?? targetUser?.email ?? 'user'}`,
      target_user_id: existing.user_id,
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
  const existing = await loadEnrollment(svc, id, ctx.institutionId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Soft-withdraw rather than physically delete; preserves history.
  const { error } = await svc
    .from('institution_enrollments')
    .update({ status: 'withdrawn', end_date: new Date().toISOString().slice(0, 10) })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const targetUser = existing.user as unknown as { full_name: string | null; email: string } | null
  void writeAuditEntry({
    actor_id: ctx.userId,
    action: 'institution.enrollment.withdrawn',
    resource_type: 'institution_enrollment',
    resource_id: id,
    institution_id: ctx.institutionId,
    details: {
      summary: `Withdrew ${targetUser?.full_name ?? targetUser?.email ?? 'user'} from enrollment`,
      target_user_id: existing.user_id,
    },
  })

  return NextResponse.json({ success: true })
}
