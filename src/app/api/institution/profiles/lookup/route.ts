import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getScope } from '@/lib/admin/scope'
import { EMAIL_REGEX } from '@/lib/utils'

/**
 * GET /api/institution/profiles/lookup?email=...
 *
 * Exact-email lookup against the global profiles table. Used by the
 * "Add department head" flow to detect when an invitee is already on Plexus
 * — in which case we can promote them directly without an email round-trip.
 *
 * Privacy guardrails:
 *   - Caller must be in the admin layer (institution admin OR dept head)
 *   - Match is *exact equality* (case-insensitive). No partial / prefix /
 *     name search — admins can't enumerate the user base by typing letters.
 *   - Returns minimal fields only.
 *
 * Response:
 *   { profile: { id, full_name, email, avatar_url, title, institution_id }
 *     | null,
 *     same_institution: boolean }
 */

const querySchema = z.object({
  email: z.string().trim().toLowerCase().regex(EMAIL_REGEX, 'Invalid email'),
})

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const scope = await getScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(request.url)
  const parsed = querySchema.safeParse({ email: url.searchParams.get('email') ?? '' })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const svc = createServiceClient()

  // ilike with NO wildcards = exact match, case-insensitive.
  const { data, error } = await svc
    .from('profiles')
    .select('id, full_name, email, avatar_url, title, institution_id')
    .ilike('email', parsed.data.email)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ profile: null, same_institution: false })

  return NextResponse.json({
    profile: data,
    same_institution: data.institution_id === scope.institutionId,
  })
}
