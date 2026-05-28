import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * Institution thesis policy editor.
 *
 * Today every institution has exactly one default policy row (programme_id IS NULL).
 * As of PR H, admins can also add per-programme overrides — one row per
 * (institution_id, programme_id) pair. Resolution rules (thesis creation):
 *   programme override (active enrollment) → institution default → none.
 *
 * Endpoints:
 *   GET  /api/institution/thesis-policy             — institution default (lazy-creates if missing)
 *   GET  /api/institution/thesis-policy?programme_id=<uuid> — programme override, 404 if none
 *   PUT  /api/institution/thesis-policy             — upsert institution default
 *   PUT  /api/institution/thesis-policy?programme_id=<uuid> — upsert programme override
 *   GET  /api/institution/thesis-policy/overrides   — list every override row (see ./overrides/route.ts)
 *   DELETE /api/institution/thesis-policy/[programme_id] — drop an override (default cannot be deleted)
 *
 * RLS already restricts reads to institution members. Writes require role
 * admin or coordinator (checked here at the API layer because the table's
 * write policy is also gated by role).
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

const ProgrammeIdSchema = z.string().uuid()

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

function parseProgrammeId(req: NextRequest): { ok: true; programmeId: string | null } | { ok: false; error: string } {
  const raw = req.nextUrl.searchParams.get('programme_id')
  if (!raw) return { ok: true, programmeId: null }
  const parsed = ProgrammeIdSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Invalid programme_id' }
  return { ok: true, programmeId: parsed.data }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getCallerContext(supabase)
  if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { profile } = ctx

  const p = parseProgrammeId(req)
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 })

  // Programme override path — never lazy-create. 404 if the admin hasn't
  // configured one yet so the client can show an "Add override" empty state.
  if (p.programmeId) {
    const { data, error } = await supabase
      .from('institution_thesis_policy')
      .select('*')
      .eq('institution_id', profile!.institution_id!)
      .eq('programme_id', p.programmeId)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data)  return NextResponse.json({ error: 'No override configured for that programme' }, { status: 404 })
    return NextResponse.json(data)
  }

  // Institution default — lazy create if missing (existing behaviour).
  const { data: existing } = await supabase
    .from('institution_thesis_policy')
    .select('*')
    .eq('institution_id', profile!.institution_id!)
    .is('programme_id', null)
    .maybeSingle()

  if (existing) return NextResponse.json(existing)

  const { data: created, error } = await supabase
    .from('institution_thesis_policy')
    .insert({ institution_id: profile!.institution_id!, programme_id: null })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  void writeAuditEntry({
    actor_id: ctx.user!.id,
    action: 'thesis.policy.created',
    resource_type: 'institution_thesis_policy',
    resource_id: created.id,
    institution_id: created.institution_id,
    details: {
      summary: 'Initialised institution default thesis policy with permissive defaults',
      programme_id: null,
    },
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

  const p = parseProgrammeId(req)
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 })

  // Verify the programme actually belongs to this institution before
  // accepting an override write.
  if (p.programmeId) {
    const { data: programme } = await supabase
      .from('institution_programmes')
      .select('id')
      .eq('id', p.programmeId)
      .eq('institution_id', profile!.institution_id!)
      .maybeSingle()
    if (!programme) {
      return NextResponse.json({ error: 'Programme not found for this institution' }, { status: 404 })
    }
  }

  const body = await req.json().catch(() => null)
  const parsed = PolicySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Snapshot the prior row so we can compute a diff for the audit entry.
  const { data: before } = p.programmeId
    ? await supabase
        .from('institution_thesis_policy')
        .select('*')
        .eq('institution_id', profile!.institution_id!)
        .eq('programme_id', p.programmeId)
        .maybeSingle()
    : await supabase
        .from('institution_thesis_policy')
        .select('*')
        .eq('institution_id', profile!.institution_id!)
        .is('programme_id', null)
        .maybeSingle()

  const isNew = !before

  let updated
  if (before) {
    const { data, error } = await supabase
      .from('institution_thesis_policy')
      .update({ ...parsed.data, updated_by: user!.id })
      .eq('id', before.id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    updated = data
  } else {
    const { data, error } = await supabase
      .from('institution_thesis_policy')
      .insert({
        institution_id: profile!.institution_id!,
        programme_id: p.programmeId,
        ...parsed.data,
        updated_by: user!.id,
      })
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    updated = data
  }

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
    action: isNew ? 'thesis.policy.created' : 'thesis.policy.updated',
    resource_type: 'institution_thesis_policy',
    resource_id: updated.id,
    institution_id: updated.institution_id,
    details: {
      summary: isNew
        ? (p.programmeId
            ? `Created programme override (programme ${p.programmeId})`
            : 'Created institution default thesis policy')
        : `Thesis policy updated to v${updated.policy_version}`,
      programme_id: updated.programme_id,
      operation: { new_version: updated.policy_version, changes: diff },
    },
  })

  return NextResponse.json(updated)
}
