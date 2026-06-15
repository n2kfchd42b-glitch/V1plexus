/**
 * API route for audit entries.
 * GET  /api/audit  — query with filters (RLS-enforced per project/actor rules)
 * POST /api/audit  — write a new entry via `append_audit_entry` RPC
 *
 * The RPC takes a per-chain advisory lock, validates the tail hasn't moved,
 * enforces monotonic timestamps + sequence numbers, and honours
 * `idempotency_key` for safe client-side retries.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { computeChainHashes } from '@/lib/audit/auditLogger'
import type { AuditEntry, AuditEntryInput } from '@/types/audit'
import { NextRequest, NextResponse } from 'next/server'

interface AuditPostBody extends AuditEntryInput {
  idempotency_key?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: AuditPostBody = await request.json()

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    if (body.actor_id !== session.user.id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    if (!body.action || !body.resource_type || !body.resource_id) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
    }

    const service = createServiceClient()
    const timestamp = new Date().toISOString()
    const details = body.details ?? { summary: body.action }
    const idempotencyKey = body.idempotency_key ?? crypto.randomUUID()

    // Retry-once loop: tails are re-read on each attempt so that a
    // serialization_failure (advisory-lock conflict) can be retried with
    // fresh prev-hashes. Same idempotency_key prevents double-writes if the
    // first attempt committed before the exception was raised.
    let attempt = 0
    let lastError: unknown = null
    while (attempt < 2) {
      const resourceTailPromise = service
        .from('audit_logs')
        .select('entry_hash')
        .eq('resource_type', body.resource_type)
        .eq('resource_id', body.resource_id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle()

      const projectTailPromise = body.project_id
        ? service
            .from('audit_logs')
            .select('project_chain_entry_hash')
            .eq('project_id', body.project_id)
            .not('project_chain_entry_hash', 'is', null)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null })

      const [{ data: lastResource }, { data: lastProject }] = await Promise.all([
        resourceTailPromise,
        projectTailPromise,
      ])

      const resourcePrev: string | null = lastResource?.entry_hash ?? null
      const projectPrev: string | null = lastProject?.project_chain_entry_hash ?? null

      const { resourceEntryHash, projectEntryHash } = await computeChainHashes(
        { ...body, details },
        timestamp,
        resourcePrev,
        projectPrev,
      )

      const { data, error } = await service.rpc('append_audit_entry', {
        p_actor_id: body.actor_id,
        p_action: body.action,
        p_resource_type: body.resource_type,
        p_resource_id: body.resource_id,
        p_project_id: body.project_id ?? null,
        p_institution_id: body.institution_id ?? null,
        p_details: details,
        p_ip_address: body.ip_address ?? null,
        p_timestamp: timestamp,
        p_expected_resource_prev_hash: resourcePrev,
        p_resource_entry_hash: resourceEntryHash,
        p_expected_project_prev_hash: projectPrev,
        p_project_entry_hash: projectEntryHash,
        p_idempotency_key: idempotencyKey,
        p_canonical_version: 1,
      })

      if (!error) {
        const row = Array.isArray(data) ? data[0] : data
        return NextResponse.json({
          success: true,
          entry_id: row.id,
          sequence_number: row.sequence_number,
          idempotent_replay: row.idempotent_replay,
        })
      }

      lastError = error
      const code = (error as { code?: string }).code
      const isRetryable = code === '40001' /* serialization_failure */ || code === '55P03' /* lock_not_available */
      if (!isRetryable || attempt >= 1) break
      attempt++
    }

    const e = lastError as { message?: string; code?: string; details?: string; hint?: string } | null
    console.error('[POST /api/audit] append_audit_entry failed:', {
      message: e?.message,
      code: e?.code,
      details: e?.details,
      hint: e?.hint,
      raw: JSON.stringify(lastError),
    })
    return NextResponse.json({ error: 'audit_write_failed' }, { status: 500 })
  } catch (err) {
    console.error('[POST /api/audit]', err)
    return NextResponse.json({ error: 'audit_write_failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const sp = request.nextUrl.searchParams
    const projectId    = sp.get('project_id')
    const resourceType = sp.get('resource_type')
    const resourceId   = sp.get('resource_id')
    const action       = sp.get('action')
    const actionPrefix = sp.get('action_prefix')
    const actorId      = sp.get('actor_id')
    const dateFrom     = sp.get('date_from')
    const dateTo       = sp.get('date_to')
    const search       = sp.get('search')?.trim() || null
    const page         = Math.max(1, parseInt(sp.get('page') || '1', 10))
    const limit        = Math.min(200, Math.max(1, parseInt(sp.get('limit') || '50', 10)))
    const offset       = (page - 1) * limit

    let query = supabase
      .from('audit_logs')
      // No PostgREST embed on actor_id — there's no FK relationship from
      // audit_logs.actor_id in the schema cache, so `actor:actor_id(full_name)`
      // 500s (PGRST200). Actor names are resolved via a profiles lookup below.
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })

    if (projectId)              query = query.eq('project_id', projectId)
    if (resourceType)           query = query.eq('resource_type', resourceType)
    if (resourceId)             query = query.eq('resource_id', resourceId)
    if (action)                 query = query.eq('action', action)
    if (actionPrefix)           query = query.like('action', `${actionPrefix}%`)
    if (actorId)                query = query.eq('actor_id', actorId)
    if (dateFrom)               query = query.gte('timestamp', dateFrom)
    // dateTo is treated as an inclusive date boundary; if a bare date (YYYY-MM-DD)
    // is supplied, cap it at end-of-day UTC. If a full ISO string is given, use as-is.
    if (dateTo) {
      const upperBound = /^\d{4}-\d{2}-\d{2}$/.test(dateTo)
        ? dateTo + 'T23:59:59.999Z'
        : dateTo
      query = query.lte('timestamp', upperBound)
    }
    if (search)                 query = query.ilike('details->>summary', `%${search}%`)

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) {
      console.error('Audit query error:', error)
      return NextResponse.json({ error: 'query_failed' }, { status: 500 })
    }

    // Resolve actor display names in one follow-up query (no FK embed available).
    const actorIds = [...new Set((data || []).map(e => (e as { actor_id?: string }).actor_id).filter(Boolean) as string[])]
    const actorNames = new Map<string, string>()
    if (actorIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', actorIds)
      for (const p of profs ?? []) actorNames.set(p.id, p.full_name ?? '')
    }

    const entries: AuditEntry[] = (data || []).map((entry: Record<string, unknown>) => {
      const fullName = actorNames.get(entry.actor_id as string) || 'Unknown'
      const initials = fullName === 'Unknown' ? 'U'
        : fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
      return {
        ...(entry as unknown as AuditEntry),
        actor_name: fullName,
        actor_initials: initials,
      }
    })

    return NextResponse.json({
      entries,
      total: count || 0,
      page,
      has_more: offset + limit < (count || 0),
    })
  } catch (err) {
    console.error('[GET /api/audit]', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
