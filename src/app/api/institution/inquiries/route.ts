import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstitutionAdminContext } from '@/lib/admin/institutionAdmin'
import { escapeLikePattern } from '@/lib/utils'

/**
 * GET /api/institution/inquiries
 * Visibility for institution admins into the inquiries submitted by colleagues
 * at their organisation. Match is by case-insensitive institution_name — that
 * field is free text on the public form, so this is best-effort.
 */
export async function GET() {
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()

  const { data: institution } = await svc
    .from('institutions')
    .select('name')
    .eq('id', ctx.institutionId)
    .maybeSingle()

  const name = institution?.name?.trim()
  if (!name) return NextResponse.json({ inquiries: [] })

  const { data, error } = await svc
    .from('institution_inquiries')
    .select('id, contact_name, contact_email, contact_role, institution_name, country, estimated_seats, message, status, created_at, responded_at')
    .ilike('institution_name', escapeLikePattern(name))
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ inquiries: data ?? [] })
}
