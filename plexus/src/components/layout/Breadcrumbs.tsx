'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  new: 'New Project',
  overview: 'Overview',
  team: 'Team',
  settings: 'Settings',
  institution: 'Institution',
  departments: 'Departments',
  members: 'Members',
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  const crumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/')
    const isLast = index === segments.length - 1
    // Check if segment looks like a UUID
    const isId = /^[0-9a-f-]{36}$/.test(segment)
    const label = isId ? 'Project' : (SEGMENT_LABELS[segment] ?? segment)

    return { href, label, isLast }
  })

  if (crumbs.length === 0) return null

  return (
    <nav className="flex items-center text-sm" aria-label="Breadcrumb">
      <Link href="/dashboard" className="text-[#718096] hover:text-[#1A202C] transition-colors">
        <Home className="h-4 w-4" />
        <span className="sr-only">Home</span>
      </Link>
      {crumbs.map(({ href, label, isLast }) => (
        <span key={href} className="flex items-center">
          <ChevronRight className="h-4 w-4 text-[#A0AEC0] mx-1" />
          {isLast ? (
            <span className="font-medium text-[#1A202C]">{label}</span>
          ) : (
            <Link
              href={href}
              className={cn('text-[#718096] hover:text-[#1A202C] transition-colors')}
            >
              {label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
