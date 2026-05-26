import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * Institution-level thesis policy editor.
 *
 * Read: any member of the institution (RLS already enforces this).
 * Write: admin or coordinator only — checked here at the API layer.
 *
 * The DB trigger auto-increments policy_version on every UPDATE, so we
 * don't compute it client-side. The audit entry captures the new version
 * and a diff against the prior row.
 */

const PolicySchema = z.object({
  require_ethics_gate:       z.boolean().optional(),
  allow_co_supervisors:      z.boolean().optional(),
  max_co_supervisors:        z.number().int().min(0).max(10).optional(),
  require_oral_defense:      z.boolean().optional(),
  require_proposal_defense:  z.boolean().optional(),
  min_chapters:              z.number().int().min(1).max(50).optional(),
  default_chapter_titles:    z.array(z.string()).optional(),
  reminder_offsets_days:     z.array(z.number().int().min(1).max(365)).max(5).optional(),
  escalation_delay_hours:    z.number().int().min(1).max(720).optional(),
})

async function getCallerContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' as const, status: 401, user: null, profile: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, institution_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.institution_id) {
    return { error: 'No institution' as const, status: 404, user, profile: null }
  }
  return { error: null, status: 200, user, profile }
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getCallerContext(supabase)
  if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { profile } = ctx

  // Lazily create a permissive default if missing
  const { data: existing } = await supabase
    .from('institution_thesis_policy')
    .select('*')
    .eq('institution_id', profile!.institution_id!)
    .maybeSingle()

  if (existing) return NextResponse.json(existing)

  const { data: created, error } = await supabase
    .from('institution_thesis_policy')
    .insert({ institution_id: profile!.institution_id! })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  void writeAuditEntry({
    actor_id: ctx.user!.id,
    action: 'thesis.policy.created',
    resource_type: 'institution_thesis_policy',
    resource_id: created.institution_id,
    institution_id: created.institution_id,
    details: { summary: 'Initialised thesis policy with permissive defaults' },
  })

  return NextResponse.json(created)
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getCallerContext(supabase)
  if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { profile, user } = ctx

  if (profile!.role !== 'admin' && profile!.role !== 'coordinator') {
    return NextResponse.json(
      { error: 'Only admins or coordinators can edit the thesis policy' },
      { status: 403 },
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = PolicySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data: before } = await supabase
    .from('institution_thesis_policy')
    .select('*')
    .eq('institution_id', profile!.institution_id!)
    .maybeSingle()

  const { data: updated, error } = await supabase
    .from('institution_thesis_policy')
    .upsert({
      institution_id: profile!.institution_id!,
      ...parsed.data,
      updated_by: user!.id,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const diff: Record<string, { from: unknown; to: unknown }> = {}
  if (before) {
    for (const key of Object.keys(parsed.data) as Array<keyof typeof parsed.data>) {
      const next = parsed.data[key]
      const prev = (before as Record<string, unknown>)[key]
      if (JSON.stringify(next) !== JSON.stringify(prev)) {
        diff[key] = { from: prev, to: next }
      }
    }
  }

  void writeAuditEntry({
    actor_id: user!.id,
    action: 'thesis.policy.updated',
    resource_type: 'institution_thesis_policy',
    resource_id: updated.institution_id,
    institution_id: updated.institution_id,
    details: {
      summary: `Thesis policy updated to v${updated.policy_version}`,
      operation: { new_version: updated.policy_version, changes: diff },
    },
  })

  return NextResponse.json(updated)
}
