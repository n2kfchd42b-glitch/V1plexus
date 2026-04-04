/**
 * Verification token utilities for Phase 5
 */

export function generateVerificationToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const randomValues = crypto.getRandomValues(new Uint8Array(20))
  const random = Array.from(randomValues, (b) => chars[b % chars.length]).join('')
  return `PLX-VRF-${random}`
}
