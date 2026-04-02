/**
 * Share & Verify Section
 * Allows researchers to embed integrity badges and share portfolio
 */

'use client'

import React, { useState } from 'react'
import { generateBadgeEmbedCode } from '@/lib/portfolio/badgeSvg'
import type { BadgeLevel } from '@/types/portfolio'

interface ShareSectionProps {
  username: string
  badgeLevel: BadgeLevel
  isOwner: boolean
}

export function ShareSection({
  username,
  badgeLevel,
  isOwner,
}: ShareSectionProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://plexus.health'
  const profileUrl = `${baseUrl}/profile/${username}`

  const compactCode = generateBadgeEmbedCode(badgeLevel, username, 'compact')
  const horizontalCode = generateBadgeEmbedCode(
    badgeLevel,
    username,
    'horizontal'
  )

  const handleCopy = (text: string, variant: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(variant)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div className="mt-16 border-t border-surface-container pt-16">
      <h2 className="text-2xl font-bold tracking-tight text-on-surface mb-8">
        Share & Verify
      </h2>

      {/* Profile URL */}
      <div className="mb-12">
        <p className="text-sm font-semibold text-on-surface mb-3">
          Your research profile
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-surface-container rounded text-xs font-mono text-on-surface-variant">
            {profileUrl}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(profileUrl)
              setCopiedCode('url')
              setTimeout(() => setCopiedCode(null), 2000)
            }}
            className={`px-3 py-2 rounded text-xs font-semibold transition-all ${
              copiedCode === 'url'
                ? 'bg-green-100 text-green-700'
                : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
            }`}
          >
            {copiedCode === 'url' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Embeddable Badges */}
      <div className="mb-12">
        <p className="text-sm font-semibold text-on-surface mb-6">
          Embeddable integrity badges
        </p>

        <div className="grid gap-10">
          {/* Compact Badge */}
          <div>
            <p className="text-xs text-on-surface-variant font-semibold uppercase mb-3">
              Compact Badge (88×31px)
            </p>
            <p className="text-xs text-on-surface-variant mb-3">
              Perfect for email signatures and sidebars
            </p>

            {/* Preview */}
            <div className="mb-4 p-4 bg-surface-container-low rounded-lg flex items-center justify-center min-h-[60px]">
              <img
                src={`${profileUrl}/badge/compact`}
                alt="PLEXUS Verified Badge"
                style={{
                  height: '31px',
                  width: '88px',
                }}
              />
            </div>

            {/* Embed Code */}
            <div className="relative bg-surface-container rounded-lg overflow-hidden border border-surface-container-high">
              <pre className="p-3 text-xs font-mono text-on-surface-variant overflow-x-auto max-h-24">
                <code>{compactCode}</code>
              </pre>
              <button
                onClick={() => handleCopy(compactCode, 'compact')}
                className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold transition-all ${
                  copiedCode === 'compact'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-primary text-white hover:bg-primary-dark'
                }`}
              >
                {copiedCode === 'compact' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Horizontal Badge */}
          <div>
            <p className="text-xs text-on-surface-variant font-semibold uppercase mb-3">
              Horizontal Badge (200×48px)
            </p>
            <p className="text-xs text-on-surface-variant mb-3">
              Perfect for website footers and biographies
            </p>

            {/* Preview */}
            <div className="mb-4 p-4 bg-surface-container-low rounded-lg flex items-center justify-center min-h-[80px]">
              <img
                src={`${profileUrl}/badge/horizontal`}
                alt="PLEXUS Verified Badge"
                style={{
                  height: '48px',
                  width: '200px',
                }}
              />
            </div>

            {/* Embed Code */}
            <div className="relative bg-surface-container rounded-lg overflow-hidden border border-surface-container-high">
              <pre className="p-3 text-xs font-mono text-on-surface-variant overflow-x-auto max-h-24">
                <code>{horizontalCode}</code>
              </pre>
              <button
                onClick={() => handleCopy(horizontalCode, 'horizontal')}
                className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold transition-all ${
                  copiedCode === 'horizontal'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-primary text-white hover:bg-primary-dark'
                }`}
              >
                {copiedCode === 'horizontal' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Verification Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-blue-900 mb-2">
          About this badge
        </p>
        <p className="text-sm text-blue-800 leading-relaxed">
          This integrity badge represents your research quality score computed
          from published datasets, supervised analyses, and verified methodologies
          on the PLEXUS platform. Badges link to your public research profile
          where institutions and collaborators can verify your research practices.
        </p>
      </div>
    </div>
  )
}
