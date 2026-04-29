/**
 * Portfolio Badge SVG Generator
 * Creates embeddable SVG badges for researcher integrity verification
 */

import type { BadgeLevel } from '@/types/portfolio'

interface BadgeConfig {
  level: BadgeLevel
  label: string
  description: string
  color: string
  icon: string
}

const badgeConfigs: Record<BadgeLevel, BadgeConfig> = {
  plexus_verified: {
    level: 'plexus_verified',
    label: 'PLEXUS Verified',
    description: 'Research integrity verified by PLEXUS platform',
    color: '#003d9b',
    icon: '✓',
  },
  plexus_established: {
    level: 'plexus_established',
    label: 'PLEXUS Established',
    description: 'Research integrity established through PLEXUS platform',
    color: '#0d9488',
    icon: '✓',
  },
  plexus_emerging: {
    level: 'plexus_emerging',
    label: 'PLEXUS Emerging',
    description: 'Research integrity tracking beginning on PLEXUS platform',
    color: '#737685',
    icon: '◉',
  },
}

/**
 * Generate SVG badge for embedding in websites/emails
 * Size: 88px × 31px (standard badge dimensions)
 */
export function generateBadgeSVG(level: BadgeLevel, username: string): string {
  const config = badgeConfigs[level]
  if (!config) return ''

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://plexus.science'
  const profileUrl = `${baseUrl}/profile/${username}`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 31" width="88" height="31" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <!-- Background -->
  <rect width="88" height="31" fill="white" rx="4"/>
  <rect width="88" height="31" fill="none" stroke="${config.color}" stroke-width="1" rx="4"/>
  
  <!-- Icon circle -->
  <circle cx="10" cy="15.5" r="6" fill="${config.color}"/>
  <text x="10" y="19" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="Georgia, serif">
    ${config.icon}
  </text>
  
  <!-- Label text -->
  <text x="20" y="19" fill="${config.color}" font-size="10" font-weight="600" letter-spacing="0.5">
    ${config.label}
  </text>
  
  <!-- Link underlay (transparent but clickable) -->
  <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" style="cursor: pointer;">
    <rect width="88" height="31" fill="transparent" rx="4"/>
  </a>
</svg>`
}

/**
 * Generate horizontal badge variant (wider, for website sidebars)
 * Size: 200px × 48px
 */
export function generateHorizontalBadgeSVG(
  level: BadgeLevel,
  username: string
): string {
  const config = badgeConfigs[level]
  if (!config) return ''

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://plexus.science'
  const profileUrl = `${baseUrl}/profile/${username}`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 48" width="200" height="48" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <!-- Background -->
  <rect width="200" height="48" fill="white" rx="6"/>
  <rect width="200" height="48" fill="none" stroke="${config.color}" stroke-width="1.5" rx="6"/>
  
  <!-- Icon circle -->
  <circle cx="24" cy="24" r="10" fill="${config.color}"/>
  <text x="24" y="31" text-anchor="middle" fill="white" font-size="16" font-weight="bold" font-family="Georgia, serif">
    ${config.icon}
  </text>
  
  <!-- Label -->
  <text x="42" y="20" fill="${config.color}" font-size="12" font-weight="700" letter-spacing="0.5">
    ${config.label.toUpperCase()}
  </text>
  
  <!-- Description -->
  <text x="42" y="35" fill="#737685" font-size="9" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
    Research integrity verified
  </text>
  
  <!-- Link underlay -->
  <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" style="cursor: pointer;">
    <rect width="200" height="48" fill="transparent" rx="6"/>
  </a>
</svg>`
}

/**
 * Generate embed code for the badge
 */
export function generateBadgeEmbedCode(
  level: BadgeLevel,
  username: string,
  variant: 'compact' | 'horizontal' = 'compact'
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://plexus.science'
  const badgeUrl = `${baseUrl}/profile/${username}/badge/${variant}`

  if (variant === 'horizontal') {
    return `<!-- PLEXUS Research Integrity Badge -->
<a href="${baseUrl}/profile/${username}" target="_blank" rel="noopener noreferrer" style="display: inline-block; text-decoration: none;">
  <img src="${badgeUrl}" alt="PLEXUS Verified Researcher" style="border: none; display: block;" />
</a>`
  }

  return `<!-- PLEXUS Research Integrity Badge -->
<a href="${baseUrl}/profile/${username}" target="_blank" rel="noopener noreferrer" style="display: inline-block; text-decoration: none;">
  <img src="${badgeUrl}" alt="PLEXUS Verified Researcher" style="border: none; height: 31px; width: 88px;" />
</a>`
}
