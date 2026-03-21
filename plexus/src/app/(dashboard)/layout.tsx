'use client'

import { useState } from 'react'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { AppHeader } from '@/components/layout/AppHeader'
import { MobileNav } from '@/components/layout/MobileNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F8FA]">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <AppSidebar />
      </div>

      {/* Mobile nav */}
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-screen-xl mx-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
