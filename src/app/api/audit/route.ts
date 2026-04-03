/**
 * API route for audit entries
 * GET /api/audit  — query with filters
 * POST /api/audit — write a new entry (server-side, bypasses RLS)
 *
 * Client-side components must POST here instead of inserting directly.
 * The server client uses the service role key which is never restricted
 * by the authenticated INSERT policy.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getActorInfo } from '@/lib/audit/auditLogger'
import type { AuditEntry, AuditEntryInput } from '@/types/audit'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const input: AuditEntryInput = await request.json()

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (input.actor_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Use service role client for all audit_logs operations — bypasses RLS INSERT policy
    const serviceSupabase = createServiceClient()

    // Fetch previous hash for chain integrity
    const { data: lastEntry } = await serviceSupabase
      .from('audit_logs')
      .select('entry_hash')
      .eq('resource_type', input.resource_type)
      .eq('resource_id', input.resource_id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()

    const prevHash = lastEntry?.entry_hash ?? null
    const timestamp = new Date().toISOString()

    // Compute SHA-256 hash chain
    const details = input.details ?? {}
    const detailsJson = JSON.stringify(details, Object.keys(details).sort())
    const canonical = [
      timestamp, input.actor_id, input.action,
      input.resource_type, input.resource_id,
      input.project_id ?? '', detailsJson,
      prevHash ?? 'GENESIS',
    ].join('|')

    const hashBuffer = await crypto.subtle.digest(
      'SHA-256', new TextEncoder().encode(canonical)
    )
    const entryHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0')).join('')

    const { data, error: insertError } = await serviceSupabase
      .from('audit_logs')
      .insert({
        timestamp,
        actor_id: input.actor_id,
        action: input.action,
        resource_type: input.resource_type,
        resource_id: input.resource_id,
        project_id: input.project_id ?? null,
        institution_id: input.institution_id ?? null,
        details,
        ip_address: null,
        prev_hash: prevHash,
        entry_hash: entryHash,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[POST /api/audit]', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, entry_id: data.id })
  } catch (err) {
    console.error('[POST /api/audit]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user for RLS
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('project_id')
    const resourceType = searchParams.get('resource_type')
    const action = searchParams.get('action')
    const actorId = searchParams.get('actor_id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('audit_logs')
      .select(
        '*, actor:actor_id(full_name)',
        { count: 'exact' }
      )
      .order('timestamp', { ascending: false })

    // Apply filters
    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    if (resourceType) {
      query = query.eq('resource_type', resourceType)
    }

    if (action) {
      query = query.eq('action', action)
    }

    if (actorId) {
      query = query.eq('actor_id', actorId)
    }

    if (dateFrom) {
      query = query.gte('timestamp', dateFrom)
    }

    if (dateTo) {
      query = query.lte('timestamp', dateTo + 'T23:59:59Z')
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    // Execute query
    const { data, error, count } = await query

    if (error) {
      console.error('Audit query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch audit entries' },
        { status: 500 }
      )
    }

    // Enrich entries with actor names
    const entries: AuditEntry[] = (data || []).map((entry: any) => ({
      ...entry,
      actor_name: entry.actor?.full_name ?? 'Unknown',
    }))

    return NextResponse.json({
      entries,
      total: count || 0,
      page,
      has_more: offset + limit < (count || 0),
    })
  } catch (error) {
    console.error('Audit API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
