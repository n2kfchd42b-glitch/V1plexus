/**
 * Central audit logger service.
 * All audit entries go through this service.
 *
 * Responsibilities:
 *   - Compute the SHA-256 hash-chain segment for the entry (resource + project chain)
 *   - Delegate the actual insert to the `append_audit_entry` RPC, which takes a
 *     per-chain advisory lock, validates the prev-hash tail hasn't moved,
 *     assigns a monotonic `sequence_number`, and honours `idempotency_key`
 *   - Provide a sessionStorage-backed retry queue for transient client failures
 *
 * Failures never throw — audit is a side-effect, not a correctness dependency —
 * but the return value now surfaces success/error so callers CAN react.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuditEntryInput } from '@/types/audit'

export interface AuditWriteResult {
  success: boolean
  entry_id?: string
  sequence_number?: number
  idempotent_replay?: boolean
  error?: string
}

const RETRY_QUEUE_KEY = 'plexus.audit.retry_queue_v1'
const RETRY_QUEUE_MAX = 50

interface QueuedEntry {
  input: AuditEntryInput
  idempotency_key: string
  queued_at: string
}

// ── Hash helpers ────────────────────────────────────────────────────────────

async function sha256Hex(canonical: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function canonicalDetails(details: Record<string, unknown>): string {
  return JSON.stringify(details, Object.keys(details).sort())
}

function buildResourceCanonical(
  timestamp: string,
  actorId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  projectId: string | undefined,
  details: Record<string, unknown>,
  prevHash: string | null,
): string {
  return [
    timestamp, actorId, action, resourceType, resourceId,
    projectId ?? '', canonicalDetails(details), prevHash ?? 'GENESIS',
  ].join('|')
}

function buildProjectCanonical(
  timestamp: string,
  actorId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details: Record<string, unknown>,
  projectPrevHash: string | null,
): string {
  return [
    'PROJECT', timestamp, actorId, action, resourceType, resourceId,
    canonicalDetails(details), projectPrevHash ?? 'PROJECT_GENESIS',
  ].join('|')
}

// ── Retry queue (sessionStorage, browser only) ──────────────────────────────

function readQueue(): QueuedEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(RETRY_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as QueuedEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(queue: QueuedEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    const trimmed = queue.slice(-RETRY_QUEUE_MAX)
    window.sessionStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(trimmed))
  } catch {
    // sessionStorage may be unavailable (e.g. privacy mode) — drop silently.
  }
}

function enqueueForRetry(input: AuditEntryInput, idempotency_key: string): void {
  const queue = readQueue()
  // Dedupe by idempotency_key
  const existing = queue.findIndex((q) => q.idempotency_key === idempotency_key)
  const entry: QueuedEntry = { input, idempotency_key, queued_at: new Date().toISOString() }
  if (existing >= 0) queue[existing] = entry
  else queue.push(entry)
  writeQueue(queue)
}

export async function flushAuditRetryQueue(): Promise<{ flushed: number; remaining: number }> {
  if (typeof window === 'undefined') return { flushed: 0, remaining: 0 }
  const queue = readQueue()
  if (queue.length === 0) return { flushed: 0, remaining: 0 }

  const remaining: QueuedEntry[] = []
  let flushed = 0
  for (const item of queue) {
    const res = await postToApi(item.input, item.idempotency_key)
    if (res.success) flushed++
    else remaining.push(item)
  }
  writeQueue(remaining)
  return { flushed, remaining: remaining.length }
}

// ── API transport ───────────────────────────────────────────────────────────

async function postToApi(
  input: AuditEntryInput,
  idempotency_key: string,
): Promise<AuditWriteResult> {
  try {
    const res = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, idempotency_key }),
      keepalive: true,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { success: false, error: body.error ?? `HTTP ${res.status}` }
    }
    const data = await res.json()
    return {
      success: true,
      entry_id: data.entry_id,
      sequence_number: data.sequence_number,
      idempotent_replay: data.idempotent_replay,
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'network_error' }
  }
}

/**
 * Write an audit entry. Safe from both browser and server contexts.
 * Client-side path: POSTs to /api/audit (with keepalive for nav-robustness) and
 * queues failed writes in sessionStorage for later flush.
 * Server-side path: calls the `append_audit_entry` RPC directly via service role.
 */
export async function writeAuditEntry(
  input: AuditEntryInput,
  // Kept for API-compatibility with existing call sites; not used on the
  // server path (service role client is constructed internally).
  _supabaseClient?: SupabaseClient,
  options?: { idempotency_key?: string },
): Promise<AuditWriteResult> {
  const idempotency_key = options?.idempotency_key ?? crypto.randomUUID()

  // ── Browser path ──
  if (typeof window !== 'undefined') {
    // Opportunistically flush any previously-failed writes before the new one.
    void flushAuditRetryQueue()

    const res = await postToApi(input, idempotency_key)
    if (!res.success) {
      enqueueForRetry(input, idempotency_key)
      console.error('Audit write failed (queued for retry):', res.error, 'Input:', input)
    }
    return res
  }

  // ── Server path ──
  try {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const service = createServiceClient()

    const timestamp = new Date().toISOString()
    const details = input.details ?? {}

    // Fetch tails (informational — the RPC re-validates under lock).
    const { data: lastResource } = await service
      .from('audit_logs')
      .select('entry_hash')
      .eq('resource_type', input.resource_type)
      .eq('resource_id', input.resource_id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()
    const resourcePrev = lastResource?.entry_hash ?? null

    const resourceCanonical = buildResourceCanonical(
      timestamp, input.actor_id, input.action,
      input.resource_type, input.resource_id, input.project_id,
      details, resourcePrev,
    )
    const resourceHash = await sha256Hex(resourceCanonical)

    let projectPrev: string | null = null
    let projectHash: string | null = null
    if (input.project_id) {
      const { data: lastProject } = await service
        .from('audit_logs')
        .select('project_chain_entry_hash')
        .eq('project_id', input.project_id)
        .not('project_chain_entry_hash', 'is', null)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle()
      projectPrev = lastProject?.project_chain_entry_hash ?? null
      const projectCanonical = buildProjectCanonical(
        timestamp, input.actor_id, input.action,
        input.resource_type, input.resource_id,
        details, projectPrev,
      )
      projectHash = await sha256Hex(projectCanonical)
    }

    const { data, error } = await service.rpc('append_audit_entry', {
      p_actor_id: input.actor_id,
      p_action: input.action,
      p_resource_type: input.resource_type,
      p_resource_id: input.resource_id,
      p_project_id: input.project_id ?? null,
      p_institution_id: input.institution_id ?? null,
      p_details: details,
      p_ip_address: input.ip_address ?? null,
      p_timestamp: timestamp,
      p_expected_resource_prev_hash: resourcePrev,
      p_resource_entry_hash: resourceHash,
      p_expected_project_prev_hash: projectPrev,
      p_project_entry_hash: projectHash,
      p_idempotency_key: idempotency_key,
    })

    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    return {
      success: true,
      entry_id: row.id,
      sequence_number: row.sequence_number,
      idempotent_replay: row.idempotent_replay,
    }
  } catch (err) {
    console.error('Audit write failed:', err, 'Input:', input)
    return { success: false, error: err instanceof Error ? err.message : 'write_failed' }
  }
}

/**
 * Compute the server-side canonical hashes a caller must pre-compute to
 * invoke `append_audit_entry`. Shared between /api/audit POST and the
 * server-side `writeAuditEntry` path so the canonical format stays identical.
 */
export async function computeChainHashes(
  input: AuditEntryInput,
  timestamp: string,
  resourcePrevHash: string | null,
  projectPrevHash: string | null,
): Promise<{ resourceEntryHash: string; projectEntryHash: string | null }> {
  const details = input.details ?? {}
  const resourceHash = await sha256Hex(
    buildResourceCanonical(
      timestamp, input.actor_id, input.action,
      input.resource_type, input.resource_id, input.project_id,
      details, resourcePrevHash,
    ),
  )
  let projectHash: string | null = null
  if (input.project_id) {
    projectHash = await sha256Hex(
      buildProjectCanonical(
        timestamp, input.actor_id, input.action,
        input.resource_type, input.resource_id,
        details, projectPrevHash,
      ),
    )
  }
  return { resourceEntryHash: resourceHash, projectEntryHash: projectHash }
}

// ── Actor info (unchanged) ──────────────────────────────────────────────────

export async function getActorInfo(
  actorId: string | null,
  supabaseClient: SupabaseClient,
): Promise<{ name: string; initials: string }> {
  if (!actorId) return { name: 'Unknown', initials: 'U' }
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('full_name')
      .eq('id', actorId)
      .single()
    if (error || !data) return { name: 'Unknown', initials: 'U' }
    const name = data.full_name ?? 'Unknown'
    const initials = name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    return { name, initials }
  } catch {
    return { name: 'Unknown', initials: 'U' }
  }
}
