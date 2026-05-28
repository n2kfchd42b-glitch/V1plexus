import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstitutionAdminContext } from '@/lib/admin/institutionAdmin'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/

// Logo URLs must point into our own Supabase `institution-logos` bucket.
// Anything else (e.g. an attacker host) is rejected. Matches the public-URL
// shape Supabase emits: <NEXT_PUBLIC_SUPABASE_URL>/storage/v1/object/public/institution-logos/<institution_id>/<file>
function isInstitutionLogoUrl(url: string, institutionId: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return false
  try {
    const parsed = new URL(url)
    const baseParsed = new URL(base)
    if (parsed.origin !== baseParsed.origin) return false
    return parsed.pathname.startsWith(
      `/storage/v1/object/public/institution-logos/${institutionId}/`,
    )
  } catch {
    return false
  }
}

const brandingSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(SLUG_REGEX, 'Slug must be 2–60 lowercase letters, digits, or dashes.').optional(),
  brand_color: z.string().trim().regex(HEX_COLOR_REGEX, 'Brand colour must be a #rrggbb hex.').nullable().optional(),
  motto: z.string().trim().max(280).nullable().optional(),
  public_bio: z.string().trim().max(4000).nullable().optional(),
  logo_url: z.string().trim().url().nullable().optional(),
})

const FIELDS: ReadonlyArray<keyof z.infer<typeof brandingSchema>> = [
  'slug', 'brand_color', 'motto', 'public_bio', 'logo_url',
]

/**
 * GET — fetch the institution's branding payload for the admin editor.
 * PATCH — update one or more branding fields. Each change is audited;
 *         slug uniqueness is enforced by the DB index.
 */
export async function GET() {
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('institutions')
    .select('id, name, slug, logo_url, brand_color, motto, public_bio, verification_tier, short_name, country')
    .eq('id', ctx.institutionId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Institution not found' }, { status: 404 })
  return NextResponse.json({ institution: data })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const ctx = await getInstitutionAdminContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = brandingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  for (const f of FIELDS) {
    if (parsed.data[f] !== undefined) update[f] = parsed.data[f]
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No updatable fields supplied' }, { status: 400 })
  }

  // logo_url must point to *this* institution's prefix inside our public
  // logos bucket. Without this gate an admin could PATCH an arbitrary
  // external URL (or another institution's logo path) and we'd render it.
  if (typeof update.logo_url === 'string' && !isInstitutionLogoUrl(update.logo_url, ctx.institutionId)) {
    return NextResponse.json(
      { error: 'logo_url must be an institution-logos bucket URL for your institution' },
      { status: 400 },
    )
  }

  const svc = createServiceClient()

  // If logo_url is in this patch, capture the previous one so we can prune
  // the old file from storage after the update succeeds. Avoids the slow
  // accumulation of dead `logo-<ts>.<ext>` objects under the institution's
  // prefix every time the logo is replaced or removed.
  let priorLogoUrl: string | null = null
  if ('logo_url' in update) {
    const { data: prior } = await svc
      .from('institutions')
      .select('logo_url')
      .eq('id', ctx.institutionId)
      .maybeSingle()
    priorLogoUrl = (prior?.logo_url as string | null) ?? null
  }

  // Slug uniqueness is enforced by ux_institutions_slug; surface a friendly
  // 409 instead of the raw 23505.
  if (typeof update.slug === 'string') {
    const { data: clash } = await svc
      .from('institutions')
      .select('id')
      .eq('slug', update.slug)
      .neq('id', ctx.institutionId)
      .maybeSingle()
    if (clash) {
      return NextResponse.json({ error: 'That slug is already taken.' }, { status: 409 })
    }
  }

  const { data, error } = await svc
    .from('institutions')
    .update(update)
    .eq('id', ctx.institutionId)
    .select('id, name, slug, logo_url, brand_color, motto, public_bio, verification_tier')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That slug is already taken.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Prune the previous logo file from storage now that the row points
  // somewhere else (either a new file or null). Best-effort: log and move
  // on if it fails — orphaned objects are recoverable later via a sweep.
  if ('logo_url' in update && priorLogoUrl && priorLogoUrl !== update.logo_url) {
    const path = extractLogoPath(priorLogoUrl, ctx.institutionId)
    if (path) {
      const { error: rmErr } = await svc.storage.from('institution-logos').remove([path])
      if (rmErr) {
        console.warn('[INSTITUTION_BRANDING] Failed to remove prior logo:', rmErr.message, path)
      }
    }
  }

  void writeAuditEntry({
    actor_id: ctx.userId,
    action: 'institution.branding.updated',
    resource_type: 'institution',
    resource_id: ctx.institutionId,
    institution_id: ctx.institutionId,
    details: {
      summary: `Updated branding fields: ${Object.keys(update).join(', ')}`,
      fields: update,
    },
  })

  return NextResponse.json({ success: true, institution: data })
}

// Parse `<institution_id>/<filename>` out of the public Supabase URL. Returns
// null when the URL doesn't belong to the expected bucket prefix for this
// institution — the caller skips deletion in that case.
function extractLogoPath(url: string, institutionId: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  try {
    const parsed = new URL(url)
    const baseParsed = new URL(base)
    if (parsed.origin !== baseParsed.origin) return null
    const prefix = `/storage/v1/object/public/institution-logos/`
    if (!parsed.pathname.startsWith(prefix)) return null
    const relative = parsed.pathname.slice(prefix.length)
    if (!relative.startsWith(`${institutionId}/`)) return null
    return relative
  } catch {
    return null
  }
}
