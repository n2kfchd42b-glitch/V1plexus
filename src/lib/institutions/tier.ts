/**
 * Single source of truth for institution verification-tier labels and copy.
 *
 * Previously these strings lived in 5 separate files (public page, overview
 * page, branding editor, admin tool, verify page); a tier rename or new
 * tier addition meant touching each one. Anyone displaying tier info now
 * imports from here.
 */

import type { VerificationTier } from '@/types/database'

export interface TierInfo {
  /** Short human label, e.g. "Self-attested". */
  label: string
  /** Sentence-form copy explaining what the tier means. */
  subline: string
  /** Palette token used by the public-page badge. */
  tone: 'gray' | 'blue' | 'green'
}

export const TIER_INFO: Record<VerificationTier, TierInfo> = {
  SELF_ATTESTED: {
    label: 'Self-attested',
    subline: 'Institution is registered on Plexus by its own admin.',
    tone: 'gray',
  },
  DOMAIN_VERIFIED: {
    label: 'Domain verified',
    subline: "Plexus has verified control of the institution's email domain.",
    tone: 'blue',
  },
  OFFICIALLY_REGISTERED: {
    label: 'Officially registered',
    subline: 'Plexus has confirmed registration with a recognised authority.',
    tone: 'green',
  },
}

/** All tier values in display order — used by the admin tier dropdown. */
export const TIER_ORDER: VerificationTier[] = [
  'SELF_ATTESTED',
  'DOMAIN_VERIFIED',
  'OFFICIALLY_REGISTERED',
]

export function tierLabel(tier: VerificationTier | string | null | undefined): string {
  if (!tier) return TIER_INFO.SELF_ATTESTED.label
  return TIER_INFO[tier as VerificationTier]?.label ?? String(tier)
}

export function tierInfo(tier: VerificationTier | string | null | undefined): TierInfo {
  return TIER_INFO[(tier ?? 'SELF_ATTESTED') as VerificationTier] ?? TIER_INFO.SELF_ATTESTED
}
