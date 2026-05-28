import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstitutionAdminContext } from '@/lib/admin/institutionAdmin'

/**
 * PATCH /api/institution/inquiries/[id]
 * Institution admin marks one of their inquiries as responded / declined.
 * Closes the long-standing "no path from 'new' to 'resolved' without
 * provisioning" gap that left inquiries permanently displayed as new on the
 * /institution/inquiries page.
 *
 * The match between inquiry and institution is by case-insensitive
 * institution_name (free-text on the public form), so we re-verify here that
 * the inquiry's name matches the caller's institution name before allowing
 * the write.
 */

const patchSchema = z.object({
  status: z.enum(['responded', 'declined']),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  // Get caller's institution name so we can re-verify the inquiry belongs
  // to this institution (same ilike match the list endpoint uses).
  const { data: institution } = await svc
    .from('institutions')
    .select('name')
    .eq('id', ctx.institutionId)
    .maybeSingle()
  const name = institution?.name?.trim()
  if (!name) return NextResponse.json({ error: 'Institution not found' }, { status: 404 })

  const { data: inquiry } = await svc
    .from('institution_inquiries')
    .select('id, institution_name, status, converted_institution_id')
    .eq('id', id)
    .maybeSingle()
  if (!inquiry) return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 })

  // The list endpoint matches by ilike(institution_name, name); enforce the
  // same membership check here using a case-insensitive compare.
  if (inquiry.institution_name?.trim().toLowerCase() !== name.toLowerCase()) {
    return NextResponse.json({ error: 'Inquiry does not belong to your institution' }, { status: 403 })
  }
  if (inquiry.status === 'converted') {
    return NextResponse.json({ error: 'Cannot change a converted inquiry' }, { status: 409 })
  }

  const { error } = await svc
    .from('institution_inquiries')
    .update({
      status: parsed.data.status,
      responded_at: new Date().toISOString(),
      responded_by: ctx.userId,
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, status: parsed.data.status })
}
