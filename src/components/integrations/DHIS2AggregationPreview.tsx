'use client'

import { useState } from 'react'
import { Loader2, BarChart2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { IntegrationConnection } from '@/types/database'

interface AggregatedRow {
  data_element_id: string
  data_element_name: string
  period: string
  org_unit: string
  value: number | string
}

interface DHIS2AggregationPreviewProps {
  connection: IntegrationConnection
  datasetId: string
  onReadyToPush: (preview: AggregatedRow[]) => void
}

export function DHIS2AggregationPreview({ connection, datasetId, onReadyToPush }: DHIS2AggregationPreviewProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<AggregatedRow[] | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  const computePreview = async () => {
    setLoading(true)
    try {
      // Fetch field mappings for this connection
      const { data: mappings } = await supabase
        .from('integration_field_mappings')
        .select('*')
        .eq('connection_id', connection.id)

      if (!mappings || mappings.length === 0) {
        toast.error('No field mappings configured. Set up your data element mapping first.')
        return
      }

      const orgUnitMapping = mappings.find(m => m.remote_field === '__org_unit__')
      const periodMapping = mappings.find(m => m.remote_field === '__period__')
      const dataElementMappings = mappings.filter(m => !['__org_unit__', '__period__'].includes(m.remote_field))

      // Fetch the dataset's latest version data
      const { data: versions } = await supabase
        .from('dataset_versions')
        .select('id, row_count')
        .eq('dataset_id', datasetId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (!versions || versions.length === 0) {
        toast.error('No dataset version found')
        return
      }

      const { data: rows } = await supabase
        .from('dataset_rows')
        .select('data')
        .eq('version_id', versions[0].id)
        .limit(5000)

      if (!rows) throw new Error('Could not fetch dataset rows')

      const newWarnings: string[] = []
      const aggregated: AggregatedRow[] = []

      for (const deMapping of dataElementMappings) {
        const transform = deMapping.transform as Record<string, string>
        const aggregation = transform?.aggregation ?? 'sum'
        const deId = transform?.data_element_id
        const deName = transform?.data_element_name ?? deId

        // Group by org unit + period
        const groups: Record<string, number[]> = {}

        for (const row of rows) {
          const data = row.data as Record<string, unknown>
          const rawValue = data[deMapping.local_column]
          const num = rawValue !== null && rawValue !== undefined && rawValue !== '' ? Number(rawValue) : null
          if (num === null || isNaN(num)) continue

          const orgUnit = orgUnitMapping ? String(data[orgUnitMapping.local_column] ?? 'UNKNOWN') : 'UNKNOWN'
          const period = periodMapping ? String(data[periodMapping.local_column] ?? 'UNKNOWN') : 'UNKNOWN'
          const key = `${orgUnit}__${period}`

          if (!groups[key]) groups[key] = []
          groups[key].push(num)
        }

        for (const [key, values] of Object.entries(groups)) {
          const [orgUnit, period] = key.split('__')
          let aggValue: number

          switch (aggregation) {
            case 'count': aggValue = values.length; break
            case 'average': aggValue = values.reduce((a, b) => a + b, 0) / values.length; break
            case 'min': aggValue = Math.min(...values); break
            case 'max': aggValue = Math.max(...values); break
            default: aggValue = values.reduce((a, b) => a + b, 0)
          }

          aggregated.push({
            data_element_id: deId,
            data_element_name: deName,
            period,
            org_unit: orgUnit,
            value: Math.round(aggValue * 100) / 100,
          })
        }
      }

      if (aggregated.some(r => r.org_unit === 'UNKNOWN')) {
        newWarnings.push('Some rows have missing organisation unit values — they will be grouped under "UNKNOWN"')
      }
      if (aggregated.some(r => r.period === 'UNKNOWN')) {
        newWarnings.push('Some rows have missing period values — they will be grouped under "UNKNOWN"')
      }

      setWarnings(newWarnings)
      setPreview(aggregated)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to compute preview')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">Aggregation Preview</h4>
          <p className="text-xs text-gray-500">Review aggregated values before pushing to DHIS2</p>
        </div>
        <Button variant="outline" size="sm" onClick={computePreview} disabled={loading} className="text-xs h-7">
          {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <BarChart2 className="h-3 w-3 mr-1" />}
          Compute Preview
        </Button>
      </div>

      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded p-2">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              {w}
            </div>
          ))}
        </div>
      )}

      {preview !== null && (
        <>
          {preview.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-6">No data values computed — check your field mappings and dataset</div>
          ) : (
            <div className="overflow-auto max-h-72 border border-gray-200 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium text-gray-600">Data Element</th>
                    <th className="text-left p-2 font-medium text-gray-600">Org Unit</th>
                    <th className="text-left p-2 font-medium text-gray-600">Period</th>
                    <th className="text-right p-2 font-medium text-gray-600">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="p-2 text-gray-700 max-w-[200px] truncate">{r.data_element_name}</td>
                      <td className="p-2 text-gray-500">{r.org_unit}</td>
                      <td className="p-2 text-gray-500">{r.period}</td>
                      <td className="p-2 text-right font-mono font-medium text-gray-800">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{preview.length} data value{preview.length !== 1 ? 's' : ''} ready to push</span>
            <Button
              onClick={() => onReadyToPush(preview)}
              disabled={preview.length === 0}
              className="bg-green-700 hover:bg-green-800 text-white text-xs h-8"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Proceed to Push
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
