/**
 * API route for verifying audit chain integrity
 * GET /api/audit/verify
 *
 * Scoping:
 *   ?project_id=X                   → verify project-scoped chain (project_chain_entry_hash)
 *   ?resource_type=Y&resource_id=Z  → verify resource-scoped chain (entry_hash)
 *   ?project_id=X&resource_type=Y&resource_id=Z → verify resource-scoped chain within project
 */

import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import type { ChainVerificationResult, ChainViolation } from '@/types/audit'
import { NextRequest, NextResponse } from 'next/server'

function computeHash(canonicalString: string): string {
  return createHash('sha256').update(canonicalString).digest('hex')
}

function buildResourceCanonical(
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

function buildProjectChainCanonical(
  timestamp: string,
  actorId: string | null,
  action: string,
  resourceType: string,
  resourceId: string,
  details: Record<string, unknown>,
  projectChainPrevHash: string | null
): string {
  const detailsJson = JSON.stringify(details, Object.keys(details).sort())
  return [
    'PROJECT',
    timestamp,
    actorId || '',
    action,
    resourceType,
    resourceId,
    detailsJson,
    projectChainPrevHash || 'PROJECT_GENESIS',
  ].join('|')
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const resourceType = searchParams.get('resource_type')
    const resourceId = searchParams.get('resource_id')
    const projectId = searchParams.get('project_id')

    const ENTRY_LIMIT = 10_000

    // When project_id is given without a specific resource, verify the project-scoped
    // chain (project_chain_entry_hash). Resource chains are independent per resource,
    // so sequential comparison across resources would always report false violations.
    const useProjectChain = !!projectId && !(resourceType && resourceId)

    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: true })
      .limit(ENTRY_LIMIT)

    if (useProjectChain) {
      // Only include entries that are part of the project chain
      query = query
        .eq('project_id', projectId)
        .not('project_chain_entry_hash', 'is', null)
    } else {
      if (projectId) query = query.eq('project_id', projectId)
      if (resourceType && resourceId) {
        query = query.eq('resource_type', resourceType).eq('resource_id', resourceId)
      }
    }

    const { data: entries, error } = await query

    if (error) {
      console.error('Verification query error:', error)
      return NextResponse.json({ error: 'Failed to verify chain' }, { status: 500 })
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

    const violations: ChainViolation[] = []
    let validCount = 0

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]

      if (useProjectChain) {
        // Verify project-scoped chain
        // Normalise timestamp: Postgres TIMESTAMPTZ returns "...+00:00" with
        // microseconds, but the hash was computed from new Date().toISOString()
        // which produces "...Z" with milliseconds. Re-parse to align the format.
        const normalizedTimestamp = new Date(entry.timestamp).toISOString()
        const expectedPrevHash = i === 0 ? null : entries[i - 1].project_chain_entry_hash
        const canonical = buildProjectChainCanonical(
          normalizedTimestamp,
          entry.actor_id,
          entry.action,
          entry.resource_type,
          entry.resource_id,
          entry.details || {},
          expectedPrevHash
        )
        const expectedHash = computeHash(canonical)

        if (expectedHash !== entry.project_chain_entry_hash) {
          violations.push({
            entry_id: entry.id,
            timestamp: entry.timestamp,
            issue: 'hash_mismatch',
            detail: `Project chain hash mismatch at entry ${i + 1}`,
          })
          continue
        }

        if (i === 0) {
          if (entry.project_chain_prev_hash !== null) {
            violations.push({
              entry_id: entry.id,
              timestamp: entry.timestamp,
              issue: 'chain_broken',
              detail: 'Genesis entry should have null project_chain_prev_hash',
            })
            continue
          }
        } else {
          if (entry.project_chain_prev_hash !== entries[i - 1].project_chain_entry_hash) {
            violations.push({
              entry_id: entry.id,
              timestamp: entry.timestamp,
              issue: 'chain_broken',
              detail: 'project_chain_prev_hash does not match previous entry',
            })
            continue
          }
        }
      } else {
        // Verify resource-scoped chain (single resource — sequential comparison is valid)
        const normalizedTimestamp = new Date(entry.timestamp).toISOString()
        const expectedPrevHash = i === 0 ? null : entries[i - 1].entry_hash
        const canonical = buildResourceCanonical(
          normalizedTimestamp,
          entry.actor_id,
          entry.action,
          entry.resource_type,
          entry.resource_id,
          entry.project_id,
          entry.details || {},
          expectedPrevHash
        )
        const expectedHash = computeHash(canonical)

        if (expectedHash !== entry.entry_hash) {
          violations.push({
            entry_id: entry.id,
            timestamp: entry.timestamp,
            issue: 'hash_mismatch',
            detail: `Hash mismatch: expected ${expectedHash}, got ${entry.entry_hash}`,
          })
          continue
        }

        if (i === 0) {
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
          if (entry.prev_hash !== entries[i - 1].entry_hash) {
            violations.push({
              entry_id: entry.id,
              timestamp: entry.timestamp,
              issue: 'chain_broken',
              detail: 'Chain broken: prev_hash does not match previous entry hash',
            })
            continue
          }
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
