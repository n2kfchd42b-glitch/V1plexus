import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstitutionAdminContext } from '@/lib/admin/institutionAdmin'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

const patchSchema = z.object({
  year: z.number().int().min(1900).max(2200).optional(),
  label: z.string().trim().max(80).nullable().optional(),
  start_date: z.string().date().nullable().optional(),
  expected_completion: z.string().date().nullable().optional(),
})

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
  // Verify the cohort belongs to a programme in caller's institution.
  const { data: cohort } = await svc
    .from('institution_cohorts')
    .select('id, year, label, programme:institution_programmes(id, institution_id, name)')
    .eq('id', id)
    .maybeSingle()
  const prog = cohort?.programme as { id: string; institution_id: string; name: string } | undefined
  if (!cohort || !prog || prog.institution_id !== ctx.institutionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const update: Record<string, unknown> = {}
  for (const k of ['year','label','start_date','expected_completion'] as const) {
    if (parsed.data[k] !== undefined) update[k] = parsed.data[k]
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No updatable fields supplied' }, { status: 400 })
  }

  const { data, error } = await svc
    .from('institution_cohorts')
    .update(update)
    .eq('id', id)
    .select('id, year, label')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A cohort with that year and label already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  void writeAuditEntry({
    actor_id: ctx.userId,
    action: 'institution.cohort.updated',
    resource_type: 'institution_cohort',
    resource_id: id,
    institution_id: ctx.institutionId,
    details: {
      summary: `Updated ${Object.keys(update).join(', ')} on ${prog.name} ${cohort.year}${cohort.label ? ` (${cohort.label})` : ''}`,
      fields: update,
    },
  })

  return NextResponse.json({ success: true, cohort: data })
}
