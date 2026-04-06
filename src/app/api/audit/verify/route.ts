/**
 * API route for verifying audit chain integrity
 * GET /api/audit/verify
 */

import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import type { ChainVerificationResult, ChainViolation } from '@/types/audit'
import { NextRequest, NextResponse } from 'next/server'

function computeHash(canonicalString: string): string {
  return createHash('sha256').update(canonicalString).digest('hex')
}

function buildCanonicalString(
  timestamp: string,
  actorId: string | null,
  action: string,
  resourceType: string,
  resourceId: string,
  projectId: string | null,
  details: Record<string, unknown>,
  prevHash: string | null
): string {
  const detailsJson = JSON.stringify(details, Object.keys(details).sort())

  return [
    timestamp,
    actorId || '',
    action,
    resourceType,
    resourceId,
    projectId || '',
    detailsJson,
    prevHash || 'GENESIS',
  ].join('|')
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
    const resourceType = searchParams.get('resource_type')
    const resourceId = searchParams.get('resource_id')
    const projectId = searchParams.get('project_id')

    const ENTRY_LIMIT = 10_000

    // Build query based on scope
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: true })
      .limit(ENTRY_LIMIT)

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    if (resourceType && resourceId) {
      query = query.eq('resource_type', resourceType).eq('resource_id', resourceId)
    }

    // Fetch entries in scope (capped at ENTRY_LIMIT to prevent timeouts)
    const { data: entries, error } = await query

    if (error) {
      console.error('Verification query error:', error)
      return NextResponse.json(
        { error: 'Failed to verify chain' },
        { status: 500 }
      )
    }

    if (!entries || entries.length === 0) {
      const result: ChainVerificationResult = {
        verified: true,
        total_entries: 0,
        valid_entries: 0,
        chain_intact: true,
        first_entry: null,
        last_entry: null,
        violations: [],
      }
      return NextResponse.json(result)
    }

    // Verify chain
    const violations: ChainViolation[] = []
    let validCount = 0

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]

      // Recompute the canonical string
      const canonical = buildCanonicalString(
        entry.timestamp,
        entry.actor_id,
        entry.action,
        entry.resource_type,
        entry.resource_id,
        entry.project_id,
        entry.details || {},
        i === 0 ? null : entries[i - 1].entry_hash
      )

      // Recompute the expected hash
      const expectedHash = computeHash(canonical)

      // Check if hash matches
      if (expectedHash !== entry.entry_hash) {
        violations.push({
          entry_id: entry.id,
          timestamp: entry.timestamp,
          issue: 'hash_mismatch',
          detail: `Hash mismatch: expected ${expectedHash}, got ${entry.entry_hash}`,
        })
        continue
      }

      // Check if prev_hash matches previous entry
      if (i === 0) {
        // First entry should have null prev_hash
        if (entry.prev_hash !== null) {
          violations.push({
            entry_id: entry.id,
            timestamp: entry.timestamp,
            issue: 'chain_broken',
            detail: 'First entry should have null prev_hash',
          })
          continue
        }
      } else {
        // Later entries should have prev_hash matching previous entry's hash
        if (entry.prev_hash !== entries[i - 1].entry_hash) {
          violations.push({
            entry_id: entry.id,
            timestamp: entry.timestamp,
            issue: 'chain_broken',
            detail: `Chain broken: prev_hash does not match previous entry hash`,
          })
          continue
        }
      }

      validCount++
    }

    const truncated = entries.length === ENTRY_LIMIT

    const result: ChainVerificationResult = {
      verified: violations.length === 0 && !truncated,
      total_entries: entries.length,
      valid_entries: validCount,
      chain_intact: violations.every((v) => v.issue !== 'chain_broken'),
      ...(truncated && { truncated: true, truncated_at: ENTRY_LIMIT }),
      first_entry: entries[0]
        ? {
            id: entries[0].id,
            timestamp: entries[0].timestamp,
            actor_id: entries[0].actor_id,
            action: entries[0].action,
            resource_type: entries[0].resource_type,
            resource_id: entries[0].resource_id,
            project_id: entries[0].project_id,
            institution_id: entries[0].institution_id,
            details: entries[0].details,
            ip_address: entries[0].ip_address,
            prev_hash: entries[0].prev_hash,
            entry_hash: entries[0].entry_hash,
          }
        : null,
      last_entry: entries[entries.length - 1]
        ? {
            id: entries[entries.length - 1].id,
            timestamp: entries[entries.length - 1].timestamp,
            actor_id: entries[entries.length - 1].actor_id,
            action: entries[entries.length - 1].action,
            resource_type: entries[entries.length - 1].resource_type,
            resource_id: entries[entries.length - 1].resource_id,
            project_id: entries[entries.length - 1].project_id,
            institution_id: entries[entries.length - 1].institution_id,
            details: entries[entries.length - 1].details,
            ip_address: entries[entries.length - 1].ip_address,
            prev_hash: entries[entries.length - 1].prev_hash,
            entry_hash: entries[entries.length - 1].entry_hash,
          }
        : null,
      violations,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
