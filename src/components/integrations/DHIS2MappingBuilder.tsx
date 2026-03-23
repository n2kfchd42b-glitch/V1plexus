'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2, ArrowRight, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { IntegrationConnection } from '@/types/database'

interface DataElement {
  id: string
  displayName: string
  valueType: string
}

interface OrgUnit {
  id: string
  displayName: string
  level: number
}

interface MappingRow {
  local_column: string
  dhis2_data_element_id: string
  dhis2_data_element_name: string
  aggregation: 'sum' | 'count' | 'average' | 'min' | 'max'
}

interface DHIS2MappingBuilderProps {
  connection: IntegrationConnection
  datasetColumns: string[]
  onMappingChanged?: () => void
}

const AGG_OPTIONS = ['sum', 'count', 'average', 'min', 'max'] as const

export function DHIS2MappingBuilder({ connection, datasetColumns, onMappingChanged }: DHIS2MappingBuilderProps) {
  const supabase = createClient()
  const [dataElements, setDataElements] = useState<DataElement[]>([])
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([])
  const [loadingDE, setLoadingDE] = useState(false)
  const [mappings, setMappings] = useState<MappingRow[]>([])
  const [orgUnitColumn, setOrgUnitColumn] = useState('')
  const [periodColumn, setPeriodColumn] = useState('')
  const [saving, setSaving] = useState(false)

  const cfg = connection.config as Record<string, string>

  const fetchDHIS2Resources = useCallback(async () => {
    setLoadingDE(true)
    try {
      const authHeader = cfg.auth_method === 'pat'
        ? `ApiToken ${cfg.pat_encrypted}`
        : `Basic ${btoa(`${cfg.username}:${cfg.password_encrypted}`)}`

      const [deRes, ouRes] = await Promise.all([
        fetch(`${cfg.server_url}/api/dataElements.json?paging=false&fields=id,displayName,valueType`, {
          headers: { Authorization: authHeader },
        }),
        fetch(`${cfg.server_url}/api/organisationUnits.json?paging=false&fields=id,displayName,level&level=3`, {
          headers: { Authorization: authHeader },
        }),
      ])

      if (deRes.ok) {
        const d = await deRes.json()
        setDataElements((d.dataElements ?? []).slice(0, 500))
      }
      if (ouRes.ok) {
        const d = await ouRes.json()
        setOrgUnits(d.organisationUnits ?? [])
      }
    } catch {
      toast.error('Could not fetch DHIS2 resources — check connection')
    } finally {
      setLoadingDE(false)
    }
  }, [cfg])

  useEffect(() => { fetchDHIS2Resources() }, [fetchDHIS2Resources])

  // Load existing mappings
  useEffect(() => {
    supabase
      .from('integration_field_mappings')
      .select('*')
      .eq('connection_id', connection.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setMappings(data.map(m => ({
            local_column: m.local_column,
            dhis2_data_element_id: (m.transform as Record<string, string>)?.data_element_id ?? '',
            dhis2_data_element_name: (m.transform as Record<string, string>)?.data_element_name ?? '',
            aggregation: ((m.transform as Record<string, string>)?.aggregation ?? 'sum') as MappingRow['aggregation'],
          })))
          const savedOrgUnit = data.find(m => m.remote_field === '__org_unit__')
          if (savedOrgUnit) setOrgUnitColumn(savedOrgUnit.local_column)
          const savedPeriod = data.find(m => m.remote_field === '__period__')
          if (savedPeriod) setPeriodColumn(savedPeriod.local_column)
        }
      })
  }, [connection.id, supabase])

  const addMapping = () => {
    setMappings(prev => [...prev, { local_column: '', dhis2_data_element_id: '', dhis2_data_element_name: '', aggregation: 'sum' }])
  }

  const removeMapping = (i: number) => {
    setMappings(prev => prev.filter((_, idx) => idx !== i))
  }

  const updateMapping = (i: number, key: keyof MappingRow, value: string) => {
    setMappings(prev => {
      const next = [...prev]
      if (key === 'dhis2_data_element_id') {
        const de = dataElements.find(d => d.id === value)
        next[i] = { ...next[i], dhis2_data_element_id: value, dhis2_data_element_name: de?.displayName ?? '' }
      } else {
        next[i] = { ...next[i], [key]: value }
      }
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Delete existing and re-insert
      await supabase
        .from('integration_field_mappings')
        .delete()
        .eq('connection_id', connection.id)

      const rows = [
        ...mappings
          .filter(m => m.local_column && m.dhis2_data_element_id)
          .map(m => ({
            connection_id: connection.id,
            remote_field: m.dhis2_data_element_id,
            local_column: m.local_column,
            transform: {
              data_element_id: m.dhis2_data_element_id,
              data_element_name: m.dhis2_data_element_name,
              aggregation: m.aggregation,
            },
          })),
        ...(orgUnitColumn ? [{ connection_id: connection.id, remote_field: '__org_unit__', local_column: orgUnitColumn, transform: null }] : []),
        ...(periodColumn ? [{ connection_id: connection.id, remote_field: '__period__', local_column: periodColumn, transform: null }] : []),
      ]

      if (rows.length > 0) {
        const { error } = await supabase.from('integration_field_mappings').insert(rows)
        if (error) throw error
      }

      toast.success('Mapping saved')
      onMappingChanged?.()
    } catch {
      toast.error('Failed to save mapping')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">DHIS2 Data Element Mapping</h4>
          <p className="text-xs text-gray-500 mt-0.5">Map PLEXUS dataset columns to DHIS2 data elements</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDHIS2Resources} disabled={loadingDE} className="text-xs h-7">
          {loadingDE ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </div>

      {loadingDE ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-4 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading DHIS2 data elements…
        </div>
      ) : (
        <>
          {/* Organisation unit + period configuration */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-1 block">Organisation Unit Column</Label>
              <select
                value={orgUnitColumn}
                onChange={e => setOrgUnitColumn(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white"
              >
                <option value="">— select column —</option>
                {datasetColumns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-1 block">Period Column</Label>
              <select
                value={periodColumn}
                onChange={e => setPeriodColumn(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white"
              >
                <option value="">— select column —</option>
                {datasetColumns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Data element mappings */}
          <div className="space-y-2">
            {mappings.map((m, i) => (
              <div key={i} className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg bg-white">
                <select
                  value={m.local_column}
                  onChange={e => updateMapping(i, 'local_column', e.target.value)}
                  className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5"
                >
                  <option value="">PLEXUS column</option>
                  {datasetColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                <select
                  value={m.dhis2_data_element_id}
                  onChange={e => updateMapping(i, 'dhis2_data_element_id', e.target.value)}
                  className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5"
                >
                  <option value="">DHIS2 data element</option>
                  {dataElements.map(d => <option key={d.id} value={d.id}>{d.displayName}</option>)}
                </select>
                <select
                  value={m.aggregation}
                  onChange={e => updateMapping(i, 'aggregation', e.target.value as MappingRow['aggregation'])}
                  className="text-xs border border-gray-200 rounded px-2 py-1.5 w-24"
                >
                  {AGG_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <button
                  onClick={() => removeMapping(i)}
                  className="text-gray-400 hover:text-red-500 flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <button
              onClick={addMapping}
              className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors"
            >
              <Plus className="h-4 w-4" />Add mapping
            </button>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="bg-green-700 hover:bg-green-800 text-white">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : 'Save Mapping'}
            </Button>
          </div>
        </>
      )}

      {orgUnits.length > 0 && (
        <div className="text-xs text-gray-400 mt-2">
          {orgUnits.length} organisation units available · {dataElements.length} data elements loaded
        </div>
      )}
    </div>
  )
}
