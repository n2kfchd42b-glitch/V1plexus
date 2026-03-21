'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface ProjectTabBarProps {
  projectId: string
}

const tabs = [
  { href: 'overview', label: 'Overview' },
  { href: 'team', label: 'Team' },
  { href: 'settings', label: 'Settings' },
]

export function ProjectTabBar({ projectId }: ProjectTabBarProps) {
  const pathname = usePathname()

  return (
    <div className="border-b border-[#E2E8F0] bg-white px-6">
      <nav className="flex gap-1" aria-label="Project tabs">
        {tabs.map(({ href, label }) => {
          const fullHref = `/projects/${projectId}/${href}`
          const isActive = pathname === fullHref || pathname.startsWith(fullHref)
          return (
            <Link
              key={href}
              href={fullHref}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                isActive
                  ? 'border-[#2E75B6] text-[#2E75B6]'
                  : 'border-transparent text-[#718096] hover:text-[#1A202C] hover:border-[#E2E8F0]'
              )}
            >
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
