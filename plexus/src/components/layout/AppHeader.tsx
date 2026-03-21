'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from './Breadcrumbs'

interface AppHeaderProps {
  onMenuClick?: () => void
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  return (
    <header className="h-14 border-b border-[#E2E8F0] bg-white flex items-center gap-4 px-4 shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>
      <Breadcrumbs />
    </header>
  )
}
