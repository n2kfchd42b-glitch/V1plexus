'use client'

/**
 * BrandLogo — smart nav logo used across every layout.
 * - Mark: "PX" on a deep-blue gradient tile
 * - Wordmark: "PLEXUS" (no "Research")
 * - Link destination: /dashboard when authenticated, / otherwise
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface BrandLogoProps {
  /** 'dark' = sidebar on dark bg, 'light' = sidebar on white bg, 'standalone' = auth/portfolio pages */
  variant?: 'dark' | 'light' | 'standalone'
  collapsed?: boolean
  /** Override the smart link destination */
  href?: string
  /** Optional sublabel shown below the wordmark (e.g. "Research Lab") */
  subtitle?: string
}

export function BrandLogo({ variant = 'light', collapsed = false, href, subtitle }: BrandLogoProps) {
  const [dest, setDest] = useState<string>(href ?? '/')

  useEffect(() => {
    if (href) { setDest(href); return }
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setDest(data.user ? '/dashboard' : '/')
    })
  }, [href])

  const wordmarkColor =
    variant === 'dark' ? 'text-white' :
    variant === 'light' ? 'text-[#003D9B]' :
    'text-[#003D9B]'

  return (
    <Link href={dest} className="flex items-center gap-2.5 group select-none shrink-0">
      {/* PX mark */}
      <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-[#003D9B] flex-shrink-0 shadow-md shadow-[#003D9B]/30 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1e40af] to-[#003D9B]" />
        <span className="relative z-10 text-white font-black text-[11px] tracking-tight leading-none">PX</span>
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-blue-300/20 rounded-tl-lg" />
      </div>

      {/* Wordmark — hidden when sidebar is collapsed */}
      {!collapsed && (
        <div className="flex flex-col gap-0">
          <span className={`text-[15px] font-bold tracking-tight font-manrope leading-none ${wordmarkColor} group-hover:opacity-80 transition-opacity`}>
            PLEXUS
          </span>
          {subtitle && (
            <span className={`text-[9px] uppercase tracking-[0.10em] leading-none mt-0.5 ${
              variant === 'dark' ? 'text-[var(--text-sidebar-icon)]' : 'text-[var(--text-tertiary)]'
            }`}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}
