"use client"

import { Download } from 'lucide-react'
import { ExportHistoryPanel } from '@/components/export/ExportHistoryPanel'

export default function ExportsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Export History</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          All documents you have exported — re-download any file within 1 hour of generation.
        </p>
      </div>

      <ExportHistoryPanel />
    </div>
  )
}
