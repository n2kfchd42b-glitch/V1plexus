'use client'

import { Sheet, SheetContent } from '@/components/ui/sheet'
import { AppSidebar } from './AppSidebar'

interface MobileNavProps {
  open: boolean
  onClose: () => void
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="p-0 w-60">
        <div className="h-full">
          <AppSidebar />
        </div>
      </SheetContent>
    </Sheet>
  )
}
