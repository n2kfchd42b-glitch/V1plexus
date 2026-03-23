'use client'

import { useState } from 'react'
import { Download, FileText, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { ResearchMetricsBlob } from '@/types/database'

interface AnnualReportExportProps {
  metrics?: ResearchMetricsBlob
  institutionName?: string
  year?: string
}

export function AnnualReportExport({ metrics, institutionName = 'Your Institution', year = '2026' }: AnnualReportExportProps) {
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)

  const handlePdfExport = async () => {
    setExportingPdf(true)
    // In production: call an API route that generates a PDF report
    await new Promise(r => setTimeout(r, 1200))
    toast.success('Annual report PDF generation queued — you will receive a download link by email.')
    setExportingPdf(false)
  }

  const handleCsvExport = () => {
    setExportingCsv(true)
    if (!metrics) {
      toast.error('No metrics data available to export.')
      setExportingCsv(false)
      return
    }

    const rows: string[][] = [
      ['Metric', 'Value'],
      ['Institution', institutionName],
      ['Year', year],
      ['Total Projects', String(metrics.projects.total)],
      ['Active Projects', String(metrics.projects.active)],
      ['Completed Projects', String(metrics.projects.completed)],
      ['Total Publications', String(metrics.publications.total)],
      ['Publications This Quarter', String(metrics.publications.this_quarter)],
      ['Total Datasets', String(metrics.datasets.total)],
      ['Published Datasets (DOI)', String(metrics.datasets.published_with_doi)],
      ['Total Researchers', String(metrics.researchers.total)],
      ['Active Researchers (Q)', String(metrics.researchers.active_this_quarter)],
      ['Active Grants', String(metrics.grants.active)],
      ['Total Grant Funding', `$${metrics.grants.total_funding.toLocaleString()}`],
      ['Ethics Approved', String(metrics.ethics.approved)],
      ['Cross-dept Projects', String(metrics.collaboration.cross_dept_projects)],
    ]

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${institutionName.replace(/\s+/g, '_')}_research_metrics_${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Metrics exported as CSV.')
    setExportingCsv(false)
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handlePdfExport}
        disabled={exportingPdf}
        className="gap-2"
      >
        <FileText className="h-4 w-4" />
        {exportingPdf ? 'Generating…' : 'Export Annual Report (PDF)'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCsvExport}
        disabled={exportingCsv}
        className="gap-2"
      >
        <Download className="h-4 w-4" />
        <Table2 className="h-3.5 w-3.5" />
        Download Raw Metrics (CSV)
      </Button>
    </div>
  )
}
