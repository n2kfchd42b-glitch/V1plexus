"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import type { AuditLog } from '@/types/database'
import { formatDateTime } from '@/lib/utils'

interface AuditExportButtonProps {
  entries: AuditLog[]
  fetchAll?: () => Promise<AuditLog[]>
  filename?: string
}

export function AuditExportButton({ entries, fetchAll, filename = 'audit-log' }: AuditExportButtonProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      // If fetchAll is provided, export the complete trail; otherwise export
      // only the entries already loaded in the current view.
      const allEntries = fetchAll ? await fetchAll() : entries
      const headers = ['timestamp', 'actor', 'action', 'resource_type', 'resource_id', 'project_id', 'summary', 'details', 'entry_hash']
      const rows = allEntries.map(e => [
        formatDateTime(e.timestamp),
        e.actor?.full_name ?? e.actor?.email ?? e.actor_id ?? '',
        e.action,
        e.resource_type,
        e.resource_id,
        e.project_id ?? '',
        (e.details as Record<string, unknown> | null)?.summary as string ?? '',
        JSON.stringify(e.details),
        e.entry_hash,
      ])

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 text-xs gap-1.5"
      onClick={handleExport}
      disabled={exporting}
    >
      <Download className="h-3.5 w-3.5" />
      Export CSV
    </Button>
  )
}
