/**
 * Platform admin gate — distinct from per-institution admins.
 *
 * A "platform admin" is the operator of the Plexus deployment (Seth today).
 * They can provision new institutions and view institutional inquiries.
 *
 * The allowlist is configured via the PLATFORM_ADMIN_USER_IDS env var
 * (comma-separated auth.users UUIDs). Empty / unset means no one qualifies.
 */

let cachedRaw: string | undefined
let cachedSet: Set<string> = new Set()

function getAllowlist(): Set<string> {
  const raw = process.env.PLATFORM_ADMIN_USER_IDS
  if (raw === cachedRaw) return cachedSet
  cachedRaw = raw
  cachedSet = raw
    ? new Set(raw.split(',').map((id) => id.trim()).filter((id) => id.length > 0))
    : new Set()
  return cachedSet
}

export function isPlatformAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false
  return getAllowlist().has(userId)
}

export function getInquiryNotifyEmail(): string | null {
  return process.env.INSTITUTION_INQUIRY_NOTIFY_EMAIL?.trim() || null
}
