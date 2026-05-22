'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
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

export function BrandLogo({ collapsed = false, href }: BrandLogoProps) {
  const [dest, setDest] = useState<string>(href ?? '/')

  useEffect(() => {
    if (href) { setDest(href); return }
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setDest(data.user ? '/dashboard' : '/')
    })
  }, [href])

  return (
    <Link href={dest} className="flex items-center group select-none shrink-0">
      <Image
        src="/logo.jpg"
        alt="Plexus Research Lab"
        width={collapsed ? 32 : 80}
        height={collapsed ? 32 : 80}
        style={{ width: collapsed ? 32 : 80, height: collapsed ? 32 : 80, objectFit: 'contain' }}
        className="flex-shrink-0"
        priority
      />
    </Link>
  )
}
