'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button asChild>
        <Link href="/projects/new">
          <Plus className="h-4 w-4" />
          New project
        </Link>
      </Button>
    </div>
  )
}
