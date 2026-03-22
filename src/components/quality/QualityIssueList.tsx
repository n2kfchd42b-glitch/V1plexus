'use client'

import { AlertTriangle, Info, XCircle, Eye, Wrench, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { DataQualityResult } from '@/types/database'

interface QualityIssueListProps {
  results: DataQualityResult[]
  projectId: string
  datasetId: string
  onUpdated: () => void
}

export function QualityIssueList({ results, projectId, datasetId, onUpdated }: QualityIssueListProps) {
  const router = useRouter()
  const supabase = createClient()

  const active = results.filter(r => r.status === 'active' && r.violations_count > 0)

  if (active.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600 py-4">
        <CheckCircle2 className="h-4 w-4" />
        No active quality issues.
      </div>
    )
  }

  const severityIcon = (severity: string) =>
    severity === 'error' ? <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" /> :
    severity === 'warning' ? <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" /> :
    <Info className="h-4 w-4 text-blue-400 flex-shrink-0" />

  const handleMarkExpected = async (resultId: string) => {
    const { error } = await supabase
      .from('data_quality_results')
      .update({ status: 'expected' })
      .eq('id', resultId)
    if (error) { toast.error('Failed to update'); return }
    toast.success('Marked as expected')
    onUpdated()
  }

  const handleFixInCleaning = (result: DataQualityResult) => {
    // Navigate to cleaning workbench — the column filter can be set via URL param
    const col = result.rule?.column_name ?? ''
    router.push(`/projects/${projectId}/data/${datasetId}/clean?column=${col}`)
  }

  return (
    <div className="space-y-2">
      {active.map(result => {
        const rule = result.rule
        const severity = rule?.severity ?? 'warning'
        return (
          <div key={result.id} className="border border-gray-200 rounded-lg p-3 bg-white hover:border-gray-300 transition-colors">
            <div className="flex items-start gap-2">
              {severityIcon(severity)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">
                  <span className={`mr-1.5 text-xs font-semibold uppercase ${severity === 'error' ? 'text-red-600' : severity === 'warning' ? 'text-amber-600' : 'text-blue-500'}`}>
                    [{severity}]
                  </span>
                  {result.violations_count.toLocaleString()} rows: {rule?.name ?? 'Quality issue'}
                </p>
                {result.sample_violations?.[0] && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {(result.sample_violations[0] as { message?: string }).message}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 ml-6">
              <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => {}}>
                <Eye className="h-3 w-3 mr-1" />View rows
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-6 px-2 text-blue-600" onClick={() => handleFixInCleaning(result)}>
                <Wrench className="h-3 w-3 mr-1" />Fix in Cleaning
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-6 px-2 text-gray-500" onClick={() => handleMarkExpected(result.id)}>
                Mark Expected
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
