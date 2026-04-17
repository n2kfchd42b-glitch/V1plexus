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
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    if (body.actor_id !== user.id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    if (!body.action || !body.resource_type || !body.resource_id) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
    }

    const service = createServiceClient()
    const timestamp = new Date().toISOString()
    const details = body.details ?? { summary: body.action }

    // Read tails (informational — RPC re-validates under advisory lock)
    const { data: lastResource } = await service
      .from('audit_logs')
      .select('entry_hash')
      .eq('resource_type', body.resource_type)
      .eq('resource_id', body.resource_id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()
    const resourcePrev: string | null = lastResource?.entry_hash ?? null

    let projectPrev: string | null = null
    if (body.project_id) {
      const { data: lastProject } = await service
        .from('audit_logs')
        .select('project_chain_entry_hash')
        .eq('project_id', body.project_id)
        .not('project_chain_entry_hash', 'is', null)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle()
      projectPrev = lastProject?.project_chain_entry_hash ?? null
    }

    const { resourceEntryHash, projectEntryHash } = await computeChainHashes(
      { ...body, details },
      timestamp,
      resourcePrev,
      projectPrev,
    )

    const idempotencyKey = body.idempotency_key ?? crypto.randomUUID()

    // Retry-once loop: if the advisory lock serialized us behind another
    // writer, our pre-read tail may be stale → RPC raises serialization_failure.
    // Refresh tails and retry exactly once. Idempotency_key prevents dupes.
    let attempt = 0
    let lastError: unknown = null
    while (attempt < 2) {
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
      // Only retry on our explicit conflict error from the RPC
      const code = (error as { code?: string }).code
      if (code !== '40001' /* serialization_failure */ || attempt >= 1) break
      attempt++
      // Re-read tails before retry
      const refresh = await service
        .from('audit_logs')
        .select('entry_hash')
        .eq('resource_type', body.resource_type)
        .eq('resource_id', body.resource_id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle()
      const newResourcePrev = refresh.data?.entry_hash ?? null
      if (newResourcePrev === resourcePrev) break
      // If tail moved, bail — client must retry with fresh state (idempotency_key guards)
      break
    }

    const e = lastError as { message?: string; code?: string; details?: string; hint?: string } | null
    console.error('[POST /api/audit] append_audit_entry failed:', {
      message: e?.message,
      code: e?.code,
      details: e?.details,
      hint: e?.hint,
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
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const sp = request.nextUrl.searchParams
    const projectId    = sp.get('project_id')
    const resourceType = sp.get('resource_type')
    const action       = sp.get('action')
    const actorId      = sp.get('actor_id')
    const dateFrom     = sp.get('date_from')
    const dateTo       = sp.get('date_to')
    const page         = Math.max(1, parseInt(sp.get('page') || '1', 10))
    const limit        = Math.min(200, Math.max(1, parseInt(sp.get('limit') || '50', 10)))
    const offset       = (page - 1) * limit

    let query = supabase
      .from('audit_logs')
      .select('*, actor:actor_id(full_name)', { count: 'exact' })
      .order('timestamp', { ascending: false })

    if (projectId)    query = query.eq('project_id', projectId)
    if (resourceType) query = query.eq('resource_type', resourceType)
    if (action)       query = query.eq('action', action)
    if (actorId)      query = query.eq('actor_id', actorId)
    if (dateFrom)     query = query.gte('timestamp', dateFrom)
    if (dateTo)       query = query.lte('timestamp', dateTo + 'T23:59:59Z')

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) {
      console.error('Audit query error:', error)
      return NextResponse.json({ error: 'query_failed' }, { status: 500 })
    }

    const entries: AuditEntry[] = (data || []).map((entry: Record<string, unknown>) => ({
      ...(entry as unknown as AuditEntry),
      actor_name: (entry.actor as { full_name?: string } | null)?.full_name ?? 'Unknown',
    }))

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
