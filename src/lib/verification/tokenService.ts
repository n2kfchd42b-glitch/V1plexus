/**
 * Verification token utilities for Phase 5
 */

export function generateVerificationToken(): string {
  const year = new Date().getFullYear()
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const random = Array.from({ length: 5 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
  return `PLX-VRF-${year}-${random}`
}
