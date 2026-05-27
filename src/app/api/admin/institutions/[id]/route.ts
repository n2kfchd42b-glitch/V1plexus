import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isPlatformAdmin } from '@/lib/admin/platformAdmin'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

const DOMAIN_REGEX = /^[a-z0-9.-]+\.[a-z]{2,}$/

const patchSchema = z.object({
  auto_link_domains: z.array(z.string().trim().toLowerCase().max(253).regex(DOMAIN_REGEX, 'Invalid domain')).max(20).optional(),
  active: z.boolean().optional(),
})

/**
 * Platform-admin tool: update fields on a provisioned institution.
 * Today this is only used to edit the auto_link_domains allow-list and
 * toggle active state from the /admin/institutions UI.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isPlatformAdmin(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (parsed.data.auto_link_domains !== undefined) {
    update.auto_link_domains = parsed.data.auto_link_domains
  }
  if (parsed.data.active !== undefined) {
    update.active = parsed.data.active
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No updatable fields supplied' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('institutions')
    .update(update)
    .eq('id', id)
    .select('id, name, auto_link_domains, active')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  void writeAuditEntry({
    actor_id: user.id,
    action: 'institution.admin.updated',
    resource_type: 'institution',
    resource_id: id,
    institution_id: id,
    details: {
      summary: `Updated ${Object.keys(update).join(', ')} on ${data.name}`,
      fields: update,
    },
  })

  return NextResponse.json({ success: true, institution: data })
}
