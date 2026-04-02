/**
 * Central audit logger service
 * All audit entries go through this service
 * Implements SHA-256 hash chaining for immutable ledger
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuditEntryInput } from '@/types/audit'

/**
 * Compute SHA-256 hash using Web Crypto API (works in both browser and Node.js 18+)
 */
async function computeHash(canonicalString: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(canonicalString)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Build canonical string for hashing
 * Format: [timestamp]|[actor_id]|[action]|[resource_type]|[resource_id]|[project_id]|[details JSON sorted]|[prev_hash or GENESIS]
 */
function buildCanonicalString(
  timestamp: string,
  actorId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  projectId: string | undefined,
  details: Record<string, unknown>,
  prevHash: string | null
): string {
  const detailsJson = JSON.stringify(details, Object.keys(details).sort())

  return [
    timestamp,
    actorId,
    action,
    resourceType,
    resourceId,
    projectId ?? '',
    detailsJson,
    prevHash ?? 'GENESIS',
  ].join('|')
}

/**
 * Write an audit entry to the ledger
 * Returns success status and entry ID if successful
 * Failures are logged but never thrown - audit failures must not crash operations
 */
export async function writeAuditEntry(
  input: AuditEntryInput,
  supabaseClient: SupabaseClient
): Promise<{
  success: boolean
  entry_id?: string
  error?: string
}> {
  try {
    // When called from browser-side code, route through the server API so the
    // server Supabase client (service role) performs the insert — this bypasses
    // the RLS policy that only allows service_role direct inserts.
    const isBrowser = typeof window !== 'undefined'
    if (isBrowser) {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      return await res.json()
    }

    // Server-side path: insert directly with the provided client (already service role)
    const { data: lastEntry, error: fetchError } = await supabaseClient
      .from('audit_logs')
      .select('entry_hash')
      .eq('resource_type', input.resource_type)
      .eq('resource_id', input.resource_id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError) throw fetchError

    const prevHash = lastEntry?.entry_hash ?? null
    const timestamp = new Date().toISOString()

    const canonical = buildCanonicalString(
      timestamp,
      input.actor_id,
      input.action,
      input.resource_type,
      input.resource_id,
      input.project_id,
      input.details,
      prevHash
    )

    const entryHash = await computeHash(canonical)

    const { data, error: insertError } = await supabaseClient
      .from('audit_logs')
      .insert({
        timestamp,
        actor_id: input.actor_id,
        action: input.action,
        resource_type: input.resource_type,
        resource_id: input.resource_id,
        project_id: input.project_id ?? null,
        institution_id: input.institution_id ?? null,
        details: input.details,
        ip_address: input.ip_address ?? null,
        prev_hash: prevHash,
        entry_hash: entryHash,
      })
      .select('id')
      .single()

    if (insertError) throw insertError

    return { success: true, entry_id: data.id }
  } catch (err) {
    // Audit failures must NEVER crash the calling operation
    console.error('Audit write failed:', err, 'Input:', input)
    return { success: false, error: String(err) }
  }
}

/**
 * Get actor name and initials from actor_id
 */
export async function getActorInfo(
  actorId: string | null,
  supabaseClient: SupabaseClient
): Promise<{ name: string; initials: string }> {
  if (!actorId) {
    return { name: 'Unknown', initials: 'U' }
  }

  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('full_name')
      .eq('id', actorId)
      .single()

    if (error || !data) {
      return { name: 'Unknown', initials: 'U' }
    }

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
