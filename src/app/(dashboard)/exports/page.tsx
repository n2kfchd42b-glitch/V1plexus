"use client"

import { Download } from 'lucide-react'

export default function ExportsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-[var(--text-secondary)]" />
          <h1 className="text-xl font-semibold font-manrope tracking-tight text-[var(--text-primary)]">Export History</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Documents you export download directly to your device.
        </p>
      </div>

      <div className="empty-state">
        <Download className="empty-state-icon" />
        <p className="empty-state-title">No export history yet</p>
        <p className="empty-state-description">
          Export any document using the Export button in the document editor. Files download directly to your device.
        </p>
      </div>
    </div>
  )
}
