/**
 * API route for querying audit entries with filters
 * GET /api/audit
 */

import { createClient } from '@/lib/supabase/server'
import { getActorInfo } from '@/lib/audit/auditLogger'
import type { AuditEntry } from '@/types/audit'
import { NextRequest, NextResponse } from 'next/server'

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
