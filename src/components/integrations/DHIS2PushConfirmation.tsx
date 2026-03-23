'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Send, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { IntegrationConnection } from '@/types/database'

interface DataValue {
  data_element_id: string
  data_element_name: string
  period: string
  org_unit: string
  value: number | string
}

interface ImportCount {
  imported: number
  updated: number
  ignored: number
  deleted: number
}

interface DHIS2PushConfirmationProps {
  connection: IntegrationConnection
  dataValues: DataValue[]
  onPushComplete: () => void
  onCancel: () => void
}

export function DHIS2PushConfirmation({ connection, dataValues, onPushComplete, onCancel }: DHIS2PushConfirmationProps) {
  const supabase = createClient()
  const [dryRunResult, setDryRunResult] = useState<{ counts: ImportCount; conflicts: string[] } | null>(null)
  const [dryRunning, setDryRunning] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [pushResult, setPushResult] = useState<{ success: boolean; counts?: ImportCount; message?: string } | null>(null)

  const cfg = connection.config as Record<string, string>

  const buildHeaders = () => {
    const auth = cfg.auth_method === 'pat'
      ? `ApiToken ${cfg.pat_encrypted}`
      : `Basic ${btoa(`${cfg.username}:${cfg.password_encrypted}`)}`
    return { 'Content-Type': 'application/json', Authorization: auth }
  }

  const buildPayload = (strategy: 'VALIDATE' | 'CREATE_AND_UPDATE') => ({
    dataValues: dataValues.map(dv => ({
      dataElement: dv.data_element_id,
      period: dv.period,
      orgUnit: dv.org_unit,
      value: String(dv.value),
    })),
    importStrategy: strategy,
  })

  const runDryRun = async () => {
    setDryRunning(true)
    setDryRunResult(null)
    try {
      const res = await fetch(`${cfg.server_url}/api/dataValueSets?dryRun=true`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(buildPayload('VALIDATE')),
      })
      const data = await res.json()
      const counts: ImportCount = {
        imported: data.importCount?.imported ?? 0,
        updated: data.importCount?.updated ?? 0,
        ignored: data.importCount?.ignored ?? 0,
        deleted: data.importCount?.deleted ?? 0,
      }
      const conflicts: string[] = (data.conflicts ?? []).map((c: { object?: string; value?: string }) => `${c.object}: ${c.value}`)
      setDryRunResult({ counts, conflicts })
    } catch {
      toast.error('Dry run failed — check DHIS2 connection')
    } finally {
      setDryRunning(false)
    }
  }

  const handlePush = async () => {
    if (!confirm(`Push ${dataValues.length} data values to ${cfg.system_name}? This will update the national health information system.`)) return
    setPushing(true)
    try {
      const res = await fetch(`${cfg.server_url}/api/dataValueSets`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(buildPayload('CREATE_AND_UPDATE')),
      })
      const data = await res.json()

      // Log the push
      await supabase.from('dhis2_push_logs').insert({
        connection_id: connection.id,
        push_type: 'data_values',
        data_values_count: dataValues.length,
        status: res.ok ? 'success' : 'failed',
        import_summary: data,
        completed_at: new Date().toISOString(),
      })

      if (!res.ok) throw new Error(data.message ?? `Server responded with ${res.status}`)

      setPushResult({
        success: true,
        counts: {
          imported: data.importCount?.imported ?? 0,
          updated: data.importCount?.updated ?? 0,
          ignored: data.importCount?.ignored ?? 0,
          deleted: data.importCount?.deleted ?? 0,
        },
      })
      toast.success('Data pushed to DHIS2 successfully')
    } catch (err) {
      setPushResult({ success: false, message: err instanceof Error ? err.message : 'Push failed' })
      toast.error('Push to DHIS2 failed')
    } finally {
      setPushing(false)
    }
  }

  if (pushResult) {
    return (
      <div className="space-y-4">
        <div className={`flex items-center gap-3 p-4 rounded-lg ${pushResult.success ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
          {pushResult.success
            ? <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            : <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          }
          <div>
            <p className={`text-sm font-medium ${pushResult.success ? 'text-green-800' : 'text-red-800'}`}>
              {pushResult.success ? 'Push successful' : 'Push failed'}
            </p>
            {pushResult.counts && (
              <p className="text-xs text-green-600 mt-0.5">
                {pushResult.counts.imported} imported · {pushResult.counts.updated} updated · {pushResult.counts.ignored} ignored
              </p>
            )}
            {pushResult.message && <p className="text-xs text-red-600 mt-0.5">{pushResult.message}</p>}
          </div>
        </div>
        <Button onClick={onPushComplete} className="w-full">Done</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">Push to DHIS2</h4>
        <span className="text-xs text-gray-500">{dataValues.length} values · {cfg.system_name}</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {[...new Set(dataValues.map(d => d.data_element_name))].slice(0, 6).map(name => (
          <div key={name} className="bg-gray-50 rounded p-2 text-gray-600 truncate">{name}</div>
        ))}
      </div>

      {/* Dry run section */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <ShieldCheck className="h-4 w-4 text-blue-500" />
            <span className="font-medium">Validate first (recommended)</span>
          </div>
          <Button variant="outline" size="sm" onClick={runDryRun} disabled={dryRunning} className="text-xs h-7">
            {dryRunning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Run Dry Run
          </Button>
        </div>

        {dryRunResult && (
          <div className="space-y-2">
            <div className="flex gap-3 text-xs">
              <span className="text-emerald-600">✓ {dryRunResult.counts.imported} to import</span>
              <span className="text-blue-600">↺ {dryRunResult.counts.updated} to update</span>
              <span className="text-gray-400">— {dryRunResult.counts.ignored} to ignore</span>
            </div>
            {dryRunResult.conflicts.length > 0 && (
              <div className="space-y-1">
                {dryRunResult.conflicts.slice(0, 3).map((c, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded p-1.5">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                    {c}
                  </div>
                ))}
                {dryRunResult.conflicts.length > 3 && (
                  <p className="text-xs text-gray-400">+{dryRunResult.conflicts.length - 3} more conflicts</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button
          onClick={handlePush}
          disabled={pushing}
          className="flex-1 bg-green-700 hover:bg-green-800 text-white"
        >
          {pushing
            ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Pushing…</>
            : <><Send className="h-4 w-4 mr-2" />Push to DHIS2</>
          }
        </Button>
      </div>
    </div>
  )
}
