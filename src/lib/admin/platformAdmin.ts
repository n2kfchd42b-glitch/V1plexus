/**
 * Platform admin gate — distinct from per-institution admins.
 *
 * A "platform admin" is the operator of the Plexus deployment (Seth today).
 * They can provision new institutions and view institutional inquiries.
 *
 * The allowlist is configured via the PLATFORM_ADMIN_USER_IDS env var
 * (comma-separated auth.users UUIDs). Empty / unset means no one qualifies.
 */

function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set()
  return new Set(
    raw
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
  )
}

export function isPlatformAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false
  return parseAllowlist(process.env.PLATFORM_ADMIN_USER_IDS).has(userId)
}

export function getInquiryNotifyEmail(): string | null {
  return process.env.INSTITUTION_INQUIRY_NOTIFY_EMAIL?.trim() || null
}
