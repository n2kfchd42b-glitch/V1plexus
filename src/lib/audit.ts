import { createClient } from '@/lib/supabase/client'
import { writeAuditEntry, type AuditWriteResult } from '@/lib/audit/auditLogger'
import type { AuditAction, AuditDetails, ResourceType } from '@/types/audit'

/**
 * Thin browser-side convenience wrapper around `writeAuditEntry`.
 * Returns a result; callers may surface `success: false` to the user.
 * Failed writes are automatically queued for retry (see auditLogger.ts).
 *
 * For critical unload-time audits (close-tab on delete/approve), prefer
 * `logAuditBeacon` — it uses `navigator.sendBeacon` so the request survives
 * page navigation.
 */
export async function logAudit(
  action: AuditAction | string,
  resourceType: ResourceType | string,
  resourceId: string,
  details?: Record<string, unknown>,
  projectId?: string,
  institutionId?: string,
  options?: { idempotency_key?: string },
): Promise<AuditWriteResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'unauthenticated' }

  const normalizedDetails: AuditDetails = {
    summary: (details?.summary as string | undefined) ?? action,
    ...(details ?? {}),
  }

  return writeAuditEntry(
    {
      actor_id: user.id,
      action: action as AuditAction,
      resource_type: resourceType as ResourceType,
      resource_id: resourceId,
      project_id: projectId,
      institution_id: institutionId,
      details: normalizedDetails,
    },
    undefined,
    { idempotency_key: options?.idempotency_key },
  )
}

/**
 * Fire-and-forget audit write guaranteed to survive page navigation.
 * Use for actions that navigate immediately after (delete + route.push, etc.).
 * Uses `navigator.sendBeacon` — returns synchronously, no result available.
 */
export function logAuditBeacon(
  actorId: string,
  action: AuditAction | string,
  resourceType: ResourceType | string,
  resourceId: string,
  details?: Record<string, unknown>,
  projectId?: string,
  institutionId?: string,
  options?: { idempotency_key?: string },
): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return false
  }
  const body = JSON.stringify({
    actor_id: actorId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    project_id: projectId ?? null,
    institution_id: institutionId ?? null,
    details: {
      summary: (details?.summary as string | undefined) ?? action,
      ...(details ?? {}),
    },
    idempotency_key: options?.idempotency_key ?? crypto.randomUUID(),
  })
  const blob = new Blob([body], { type: 'application/json' })
  return navigator.sendBeacon('/api/audit', blob)
}
