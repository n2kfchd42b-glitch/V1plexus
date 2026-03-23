'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart2, ClipboardList, MessageCircle, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FieldBottomNavProps {
  projectId: string
}

export function FieldBottomNav({ projectId }: FieldBottomNavProps) {
  const pathname = usePathname()

  const tabs = [
    { href: `/field/${projectId}`,          label: 'Data',    icon: BarChart2 },
    { href: `/field/${projectId}/quality`,   label: 'Quality', icon: ClipboardList },
    { href: `/field/${projectId}/chat`,      label: 'Chat',    icon: MessageCircle },
    { href: `/field/${projectId}/map`,       label: 'Map',     icon: User },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 flex">
      {tabs.map(tab => {
        const Icon = tab.icon
        const active = pathname === tab.href || (tab.href !== `/field/${projectId}` && pathname.startsWith(tab.href))
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center py-3 text-[11px] font-medium transition-colors min-h-[56px]',
              active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            )}
          >
            <Icon className={cn('h-5 w-5 mb-0.5', active ? 'text-blue-600' : 'text-gray-400')} />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
