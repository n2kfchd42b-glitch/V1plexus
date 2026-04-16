/**
 * API route for verifying audit chain integrity.
 * GET /api/audit/verify
 *
 * Scoping:
 *   ?project_id=X                    → verify project-scoped chain
 *   ?resource_type=Y&resource_id=Z   → verify resource-scoped chain
 *   ?project_id=X&resource_type=Y&resource_id=Z → resource chain within project
 *
 * Verification walks the chain in batches (keyset-paginated) so arbitrarily
 * long chains can be fully verified without silent truncation. Each entry is
 * checked for:
 *   - hash_mismatch       (recomputed hash differs from stored)
 *   - chain_broken        (prev_hash does not reference the last verified tail)
 *   - sequence_gap        (project chain: sequence numbers must be contiguous)
 *   - timestamp_regression (monotonic ordering)
 */

import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import type { ChainVerificationResult, ChainViolation } from '@/types/audit'
import { NextRequest, NextResponse } from 'next/server'

const BATCH_SIZE = 5_000

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

function buildResourceCanonical(
  timestamp: string,
  actorId: string | null,
  action: string,
  resourceType: string,
  resourceId: string,
  projectId: string | null,
  details: Record<string, unknown>,
  prevHash: string | null,
): string {
  const detailsJson = JSON.stringify(details, Object.keys(details).sort())
  return [
    timestamp, actorId || '', action, resourceType, resourceId,
    projectId || '', detailsJson, prevHash || 'GENESIS',
  ].join('|')
}

function buildProjectCanonical(
  timestamp: string,
  actorId: string | null,
  action: string,
  resourceType: string,
  resourceId: string,
  details: Record<string, unknown>,
  projectChainPrevHash: string | null,
): string {
  const detailsJson = JSON.stringify(details, Object.keys(details).sort())
  return [
    'PROJECT', timestamp, actorId || '', action, resourceType, resourceId,
    detailsJson, projectChainPrevHash || 'PROJECT_GENESIS',
  ].join('|')
}

interface AuditRow {
  id: string
  timestamp: string
  actor_id: string | null
  action: string
  resource_type: string
  resource_id: string
  project_id: string | null
  institution_id: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  prev_hash: string | null
  entry_hash: string
  project_chain_prev_hash: string | null
  project_chain_entry_hash: string | null
  sequence_number: number | null
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const sp = request.nextUrl.searchParams
    const resourceType = sp.get('resource_type')
    const resourceId   = sp.get('resource_id')
    const projectId    = sp.get('project_id')

    const useProjectChain = !!projectId && !(resourceType && resourceId)

    const violations: ChainViolation[] = []
    let firstEntry: AuditRow | null = null
    let lastEntry: AuditRow | null = null
    let total = 0
    let valid = 0
    let prevTailHash: string | null = null
    let prevSequence: number | null = null
    let prevTimestamp: string | null = null

    // Keyset pagination cursor: (timestamp, id) strictly increasing.
    let cursorTimestamp: string | null = null
    let cursorId: string | null = null

    while (true) {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: true })
        .order('id', { ascending: true })
        .limit(BATCH_SIZE)

      if (useProjectChain) {
        query = query.eq('project_id', projectId!).not('project_chain_entry_hash', 'is', null)
      } else {
        if (projectId)                    query = query.eq('project_id', projectId)
        if (resourceType && resourceId)   query = query.eq('resource_type', resourceType).eq('resource_id', resourceId)
      }

      if (cursorTimestamp && cursorId) {
        // (timestamp, id) > (cursor) — emulate via `or` on tuple
        query = query.or(
          `timestamp.gt.${cursorTimestamp},and(timestamp.eq.${cursorTimestamp},id.gt.${cursorId})`,
        )
      }

      const { data, error } = await query
      if (error) {
        console.error('Verification query error:', error)
        return NextResponse.json({ error: 'verification_query_failed' }, { status: 500 })
      }

      const batch = (data ?? []) as AuditRow[]
      if (batch.length === 0) break

      for (const entry of batch) {
        total++
        if (!firstEntry) firstEntry = entry
        lastEntry = entry

        // Re-normalize timestamp: PG returns "...+00:00" with microseconds,
        // but the hash was computed from new Date().toISOString() with ms + "Z".
        const normalizedTs = new Date(entry.timestamp).toISOString()
        const details = entry.details ?? {}

        if (useProjectChain) {
          const expectedHash = sha256(
            buildProjectCanonical(
              normalizedTs, entry.actor_id, entry.action,
              entry.resource_type, entry.resource_id,
              details, prevTailHash,
            ),
          )
          if (expectedHash !== entry.project_chain_entry_hash) {
            violations.push({
              entry_id: entry.id,
              timestamp: entry.timestamp,
              issue: 'hash_mismatch',
              detail: `Project chain hash mismatch at sequence ${entry.sequence_number ?? '?'}`,
            })
          } else if (entry.project_chain_prev_hash !== prevTailHash) {
            violations.push({
              entry_id: entry.id,
              timestamp: entry.timestamp,
              issue: 'chain_broken',
              detail: 'project_chain_prev_hash does not match previous verified tail',
            })
          } else {
            valid++
          }
          prevTailHash = entry.project_chain_entry_hash
        } else {
          const expectedHash = sha256(
            buildResourceCanonical(
              normalizedTs, entry.actor_id, entry.action,
              entry.resource_type, entry.resource_id, entry.project_id,
              details, prevTailHash,
            ),
          )
          if (expectedHash !== entry.entry_hash) {
            violations.push({
              entry_id: entry.id,
              timestamp: entry.timestamp,
              issue: 'hash_mismatch',
              detail: `Hash mismatch: expected ${expectedHash}, got ${entry.entry_hash}`,
            })
          } else if (entry.prev_hash !== prevTailHash) {
            violations.push({
              entry_id: entry.id,
              timestamp: entry.timestamp,
              issue: 'chain_broken',
              detail: 'prev_hash does not match previous verified tail',
            })
          } else {
            valid++
          }
          prevTailHash = entry.entry_hash
        }

        // Sequence continuity (project scope only — resource chain has no sequence)
        if (useProjectChain && entry.sequence_number != null) {
          if (prevSequence != null && entry.sequence_number !== prevSequence + 1) {
            violations.push({
              entry_id: entry.id,
              timestamp: entry.timestamp,
              issue: 'chain_broken',
              detail: `sequence gap: expected ${prevSequence + 1}, got ${entry.sequence_number}`,
            })
          }
          prevSequence = entry.sequence_number
        }

        // Monotonic timestamp
        if (prevTimestamp && entry.timestamp < prevTimestamp) {
          violations.push({
            entry_id: entry.id,
            timestamp: entry.timestamp,
            issue: 'chain_broken',
            detail: `timestamp regression: ${entry.timestamp} < ${prevTimestamp}`,
          })
        }
        prevTimestamp = entry.timestamp
      }

      if (batch.length < BATCH_SIZE) break
      const tail = batch[batch.length - 1]
      cursorTimestamp = tail.timestamp
      cursorId = tail.id
    }

    const result: ChainVerificationResult = {
      verified: violations.length === 0,
      total_entries: total,
      valid_entries: valid,
      chain_intact: violations.every((v) => v.issue !== 'chain_broken'),
      first_entry: firstEntry ? toEntryDTO(firstEntry) : null,
      last_entry:  lastEntry  ? toEntryDTO(lastEntry)  : null,
      violations,
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('Verification error:', err)
    return NextResponse.json({ error: 'verification_failed' }, { status: 500 })
  }
}

function toEntryDTO(e: AuditRow) {
  return {
    id: e.id,
    timestamp: e.timestamp,
    actor_id: e.actor_id,
    action: e.action as never,
    resource_type: e.resource_type as never,
    resource_id: e.resource_id,
    project_id: e.project_id,
    institution_id: e.institution_id,
    details: (e.details ?? {}) as never,
    ip_address: e.ip_address,
    prev_hash: e.prev_hash,
    entry_hash: e.entry_hash,
  }
}
