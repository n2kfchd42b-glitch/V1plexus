'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface ProjectTabBarProps {
  id: string
  datasetCount: number
  runCount: number
}

export function ProjectTabBar({ id, datasetCount, runCount }: ProjectTabBarProps) {
  const pathname = usePathname()

  const tabs = [
    { slug: 'overview',  label: 'Overview', count: null as number | null          },
    { slug: 'data',      label: 'Data',      count: datasetCount                   },
    { slug: 'analysis',  label: 'Analysis',  count: runCount > 0 ? runCount : null },
    { slug: 'documents', label: 'Writing',   count: null                           },
  ]

  return (
    <div
      className="flex-shrink-0 flex px-3 sm:px-6 overflow-x-auto"
      style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)' }}
    >
      {tabs.map(tab => {
        const href   = `/projects/${id}/${tab.slug}`
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link key={tab.slug} href={href}>
            <div className={cn(
              'flex items-center gap-1.5 h-10 px-3.5 border-b-2 -mb-px cursor-pointer whitespace-nowrap transition-colors duration-150',
              'text-[13px] font-medium',
              active
                ? 'text-[var(--text-primary)] border-[var(--accent-primary)] font-semibold'
                : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
            )}>
              {tab.label}
              {tab.count !== null && (
                <span
                  className="data-mono text-[10px] h-4 px-1.5 flex items-center rounded-full"
                  style={{ background: 'var(--bg-inset)', color: 'var(--text-tertiary)' }}
                >
                  {tab.count}
                </span>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
