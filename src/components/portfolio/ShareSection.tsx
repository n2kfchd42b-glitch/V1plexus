/**
 * Share & Verify Section
 */

'use client'

import React, { useState } from 'react'
import { Copy, Check, Link2 } from 'lucide-react'
import { generateBadgeEmbedCode } from '@/lib/portfolio/badgeSvg'
import type { BadgeLevel } from '@/types/portfolio'

interface ShareSectionProps {
  username: string
  badgeLevel: BadgeLevel
  isOwner: boolean
}

export function ShareSection({ username, badgeLevel, isOwner }: ShareSectionProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://plexus.science'
  const profileUrl = `${baseUrl}/profile/${username}`

  const compactCode = generateBadgeEmbedCode(badgeLevel, username, 'compact')
  const horizontalCode = generateBadgeEmbedCode(badgeLevel, username, 'horizontal')

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  return (
    <section className="mb-8">
      <h2 className="text-base font-bold text-slate-900 mb-4">Share & Verify</h2>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-6">
        {/* Profile URL */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Your research profile
          </p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg min-w-0">
              <Link2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <code className="text-xs font-mono text-slate-600 truncate">{profileUrl}</code>
            </div>
            <button
              onClick={() => copy(profileUrl, 'url')}
              className={`flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors flex-shrink-0 ${
                copiedKey === 'url'
                  ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                  : 'border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              {copiedKey === 'url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey === 'url' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* Embeddable badges */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Embeddable integrity badges
          </p>

          <div className="space-y-5">
            {/* Compact */}
            <BadgeVariant
              label="Compact (88×31px)"
              description="For email signatures and sidebars"
              previewSrc={`${profileUrl}/badge/compact`}
              previewWidth={88}
              previewHeight={31}
              embedCode={compactCode}
              copied={copiedKey === 'compact'}
              onCopy={() => copy(compactCode, 'compact')}
            />

            {/* Horizontal */}
            <BadgeVariant
              label="Horizontal (200×48px)"
              description="For website footers and biographies"
              previewSrc={`${profileUrl}/badge/horizontal`}
              previewWidth={200}
              previewHeight={48}
              embedCode={horizontalCode}
              copied={copiedKey === 'horizontal'}
              onCopy={() => copy(horizontalCode, 'horizontal')}
            />
          </div>
        </div>

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <p className="text-xs font-semibold text-blue-800 mb-1">About this badge</p>
          <p className="text-xs text-blue-700 leading-relaxed">
            Your integrity badge reflects a research quality score computed from published datasets,
            supervised analyses, and verified methodologies on PLEXUS. It links to your public
            profile where institutions and collaborators can verify your research practices.
          </p>
        </div>
      </div>
    </section>
  )
}

function BadgeVariant({
  label, description, previewSrc, previewWidth, previewHeight, embedCode, copied, onCopy,
}: {
  label: string
  description: string
  previewSrc: string
  previewWidth: number
  previewHeight: number
  embedCode: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-700 mb-0.5">{label}</p>
      <p className="text-xs text-slate-400 mb-3">{description}</p>
      {/* Preview */}
      <div className="flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg py-4 mb-3">
        <img
          src={previewSrc}
          alt="PLEXUS badge preview"
          width={previewWidth}
          height={previewHeight}
          style={{ width: previewWidth, height: previewHeight }}
        />
      </div>
      {/* Code block */}
      <div className="relative">
        <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-600 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
          <code>{embedCode}</code>
        </pre>
        <button
          onClick={onCopy}
          className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md border transition-colors ${
            copied
              ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
              : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
          }`}
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
