'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { QualityRuleType, QualitySeverity, DataQualityRule } from '@/types/database'

const RULE_TYPES: { value: QualityRuleType; label: string }[] = [
  { value: 'range', label: 'Range check' },
  { value: 'required', label: 'Required (no nulls)' },
  { value: 'unique', label: 'Unique values' },
  { value: 'outlier', label: 'Outlier detection' },
  { value: 'format', label: 'Format / pattern' },
  { value: 'cross_field', label: 'Cross-field relationship' },
  { value: 'completeness', label: 'Completeness' },
]

interface QualityRuleEditorProps {
  datasetId: string
  columns: string[]
  existingRule?: DataQualityRule
  onSaved: () => void
  onCancel: () => void
}

export function QualityRuleEditor({ datasetId, columns, existingRule, onSaved, onCancel }: QualityRuleEditorProps) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(existingRule?.name ?? '')
  const [ruleType, setRuleType] = useState<QualityRuleType>(existingRule?.rule_type ?? 'range')
  const [columnName, setColumnName] = useState(existingRule?.column_name ?? '')
  const [severity, setSeverity] = useState<QualitySeverity>(existingRule?.severity ?? 'warning')
  const [min, setMin] = useState(String((existingRule?.config?.min as number) ?? ''))
  const [max, setMax] = useState(String((existingRule?.config?.max as number) ?? ''))
  const [pattern, setPattern] = useState((existingRule?.config?.pattern as string) ?? '')
  const [sdThreshold, setSdThreshold] = useState(String((existingRule?.config?.sd_threshold as number) ?? 3))
  const [col2, setCol2] = useState((existingRule?.config?.column2 as string) ?? '')
  const [operator, setOperator] = useState((existingRule?.config?.operator as string) ?? 'gte')

  const buildConfig = (): Record<string, unknown> => {
    switch (ruleType) {
      case 'range': return { min: min !== '' ? Number(min) : undefined, max: max !== '' ? Number(max) : undefined }
      case 'outlier': return { sd_threshold: Number(sdThreshold) }
      case 'format': return { pattern }
      case 'cross_field': return { column1: columnName, column2: col2, operator }
      default: return {}
    }
  }

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Enter a rule name'); return }
    if (ruleType !== 'cross_field' && !columnName) { toast.error('Select a column'); return }

    setSaving(true)
    try {
      const payload = {
        dataset_id: datasetId,
        name: name.trim(),
        rule_type: ruleType,
        column_name: columnName || null,
        config: buildConfig(),
        severity,
        is_active: true,
        auto_generated: false,
      }

      if (existingRule) {
        const { error } = await supabase.from('data_quality_rules').update(payload).eq('id', existingRule.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('data_quality_rules').insert(payload)
        if (error) throw error
      }

      toast.success(existingRule ? 'Rule updated' : 'Rule created')
      onSaved()
    } catch {
      toast.error('Failed to save rule')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium text-gray-700 mb-1 block">Rule name</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. age_months: valid range" className="text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-1 block">Rule type</Label>
          <select
            value={ruleType}
            onChange={e => setRuleType(e.target.value as QualityRuleType)}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-1 block">Severity</Label>
          <select
            value={severity}
            onChange={e => setSeverity(e.target.value as QualitySeverity)}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="error">Error</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      {ruleType !== 'cross_field' && (
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-1 block">Column</Label>
          <select
            value={columnName}
            onChange={e => setColumnName(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select column…</option>
            {columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {ruleType === 'range' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">Min value</Label>
            <Input type="number" value={min} onChange={e => setMin(e.target.value)} placeholder="No minimum" className="text-sm" />
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">Max value</Label>
            <Input type="number" value={max} onChange={e => setMax(e.target.value)} placeholder="No maximum" className="text-sm" />
          </div>
        </div>
      )}

      {ruleType === 'outlier' && (
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-1 block">Standard deviation threshold</Label>
          <Input type="number" value={sdThreshold} onChange={e => setSdThreshold(e.target.value)} className="text-sm w-32" />
        </div>
      )}

      {ruleType === 'format' && (
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-1 block">Regex pattern</Label>
          <Input value={pattern} onChange={e => setPattern(e.target.value)} placeholder="e.g. ^\d{4}-\d{2}-\d{2}$" className="text-sm font-mono" />
        </div>
      )}

      {ruleType === 'cross_field' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1 block">Column 1</Label>
              <select value={columnName} onChange={e => setColumnName(e.target.value)} className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-white">
                <option value="">Select…</option>
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1 block">Column 2</Label>
              <select value={col2} onChange={e => setCol2(e.target.value)} className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-white">
                <option value="">Select…</option>
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">Relationship (Col1 must be…)</Label>
            <select value={operator} onChange={e => setOperator(e.target.value)} className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-white">
              <option value="gte">≥ (greater than or equal) Col2</option>
              <option value="lte">≤ (less than or equal) Col2</option>
              <option value="gt">&gt; (greater than) Col2</option>
              <option value="lt">&lt; (less than) Col2</option>
            </select>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? 'Saving…' : existingRule ? 'Update Rule' : 'Create Rule'}
        </Button>
      </div>
    </div>
  )
}
