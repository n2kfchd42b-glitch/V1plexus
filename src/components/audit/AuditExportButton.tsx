"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import type { AuditLog } from '@/types/database'
import { formatDateTime } from '@/lib/utils'

interface AuditExportButtonProps {
  entries: AuditLog[]
  filename?: string
}

export function AuditExportButton({ entries, filename = 'audit-log' }: AuditExportButtonProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = () => {
    setExporting(true)
    try {
      const headers = ['timestamp', 'actor', 'action', 'resource_type', 'resource_id', 'project_id', 'details', 'entry_hash']
      const rows = entries.map(e => [
        formatDateTime(e.timestamp),
        e.actor?.full_name ?? e.actor?.email ?? e.actor_id ?? '',
        e.action,
        e.resource_type,
        e.resource_id,
        e.project_id ?? '',
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
      disabled={exporting || entries.length === 0}
    >
      <Download className="h-3.5 w-3.5" />
      Export CSV
    </Button>
  )
}
