'use client'

import { useState, useMemo, useCallback, useReducer, useEffect } from 'react'
import {
  Plus, Undo2, RotateCcw, Save, ChevronDown, Loader2, GitCommit,
  Check, X, Trash2, ArrowUpDown, PlusCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DatasetTable } from '@/components/data/DatasetTable'
import { applyOperation, applyOperations } from '@/lib/data/operations'
import { saveCleanedVersion } from '@/lib/data/storage'
import { auditDatasetVersionCommit } from '@/lib/audit/auditHelpers'
import { useAuth } from '@/hooks/useAuth'
import type {
  DataRow, ColumnSchema, DatasetVersion, CleaningOperation,
  ColumnType, FilterOperator
} from '@/types/database'

// ─── Operation display labels ──────────────────────────────────────────────────

const OP_LABELS: Record<string, string> = {
  rename_column: 'Rename Column',
  retype_column: 'Change Type',
  delete_column: 'Delete Column',
  reorder_columns: 'Reorder Columns',
  drop_missing: 'Drop Missing Rows',
  fill_missing: 'Fill / Impute Missing Values',
  filter_rows: 'Filter Rows',
  remove_duplicates: 'Remove Duplicates',
  sort_rows: 'Sort Rows',
  computed_column: 'Add Computed Column',
  recode_values: 'Recode Values',
  bin_numeric: 'Bin Numeric Column',
  standardize_text: 'Standardize Text',
  split_column: 'Split Column',
  replace_column: 'Replace Column Values',
}

const COLUMN_TYPES: ColumnType[] = ['text', 'number', 'integer', 'decimal', 'date', 'boolean', 'categorical']
const FILTER_OPERATORS: FilterOperator[] = ['=', '!=', '>', '>=', '<', '<=', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_null', 'is_not_null']
const FILL_STRATEGIES = ['value', 'mean', 'median', 'mode', 'forward_fill', 'backward_fill']

// ─── Operation summary text ────────────────────────────────────────────────────

function opSummary(op: CleaningOperation): string {
  switch (op.type) {
    case 'rename_column': return `"${op.column}" → "${op.new_name}"`
    case 'retype_column': return `"${op.column}" → ${op.new_type}`
    case 'delete_column': return `Deleted "${op.column}"`
    case 'drop_missing': return `Drop nulls in: ${op.columns.join(', ')}`
    case 'fill_missing': return `Fill "${op.column}" with ${op.strategy}${op.value !== undefined ? ` (${op.value})` : ''}`
    case 'filter_rows': return `${op.keep ? 'Keep' : 'Remove'} rows where ${op.column} ${op.operator} ${op.value ?? ''}`
    case 'remove_duplicates': return `Remove duplicates by: ${op.columns.join(', ')}`
    case 'sort_rows': return `Sort by "${op.column}" ${op.direction}`
    case 'computed_column': return `New column "${op.name}"`
    case 'recode_values': return op.output_column ? `Recode "${op.column}" → new col "${op.output_column}"` : `Recode "${op.column}" in place`
    case 'bin_numeric': return `Bin "${op.column}" → "${op.new_column}"`
    case 'standardize_text': return `Standardize "${op.column}"`
    case 'reorder_columns': return `Reorder ${op.order.length} columns`
    case 'split_column': return `Split "${op.column}" on "${op.delimiter}" → ${op.new_columns.join(', ')}`
    case 'replace_column': return op.new_column ? `Replace "${op.column}" → new col "${op.new_column}"` : `Replace all values in "${op.column}"`
    default: return 'Operation'
  }
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface CleaningWorkbenchProps {
  datasetId: string
  projectId: string
  version: DatasetVersion
  initialRows: DataRow[]
  initialColumns: ColumnSchema[]
  branchName?: string
  onVersionSaved: (newVersionId: string) => void
}

// ─── Main component ────────────────────────────────────────────────────────────

export function CleaningWorkbench({
  datasetId, projectId, version, initialRows, initialColumns, branchName = 'main', onVersionSaved,
}: CleaningWorkbenchProps) {
  const { user } = useAuth()
  type WorkbenchState = {
    operations: CleaningOperation[]
    currentRows: DataRow[]
    currentColumns: ColumnSchema[]
  }
  type WorkbenchAction =
    | { type: 'ADD'; op: CleaningOperation }
    | { type: 'REMOVE'; index: number }
    | { type: 'RESET' }

  const [state, dispatch] = useReducer(
    (s: WorkbenchState, action: WorkbenchAction): WorkbenchState => {
      switch (action.type) {
        case 'ADD': {
          // Incremental: apply only the new op to current state — O(rows), not O(ops×rows)
          const { rows, columns } = applyOperation(s.currentRows, s.currentColumns, action.op)
          return { operations: [...s.operations, action.op], currentRows: rows, currentColumns: columns }
        }
        case 'REMOVE': {
          const newOps = s.operations.filter((_, i) => i !== action.index)
          if (newOps.length === 0) return { operations: [], currentRows: initialRows, currentColumns: initialColumns }
          const { rows, columns } = applyOperations(initialRows, initialColumns, newOps)
          return { operations: newOps, currentRows: rows, currentColumns: columns }
        }
        case 'RESET':
          return { operations: [], currentRows: initialRows, currentColumns: initialColumns }
      }
    },
    { operations: [], currentRows: initialRows, currentColumns: initialColumns }
  )

  const { operations, currentRows, currentColumns } = state

  const [addOpType, setAddOpType] = useState<string | null>(null)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Sample for preview (first 500 rows for performance)
  const previewRows = useMemo(() => currentRows.slice(0, 500), [currentRows])

  const addOperation = useCallback((op: CleaningOperation) => {
    dispatch({ type: 'ADD', op })
    setAddOpType(null)
  }, [])

  const removeOperation = useCallback((index: number) => {
    dispatch({ type: 'REMOVE', index })
  }, [])

  const handleSave = async () => {
    if (!user || !commitMessage.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      const { versionId } = await saveCleanedVersion({
        datasetId,
        projectId,
        parentVersionId: version.id,
        parentVersionNumber: version.version_number,
        branchName,
        commitMessage: commitMessage.trim(),
        rows: currentRows,
        columns: currentColumns,
        operations,
        createdBy: user.id,
      })
      // Fire audit and portrait non-blocking — version is already committed
      auditDatasetVersionCommit(
        { userId: user.id, projectId },
        {
          versionId,
          versionNumber: version.version_number + 1,
          parentVersionNumber: version.version_number,
          rowsBefore: initialRows.length,
          rowsAfter: currentRows.length,
          commitMessage: commitMessage.trim(),
          fileHash: '',
          justification: commitMessage.trim(),
          operations,
        }
      ).catch(err => console.error('[audit] version commit:', err))

      fetch('/api/analytics/portrait/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetId, projectId, versionId }),
      }).catch(() => {})

      onVersionSaved(versionId)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const rowDelta = currentRows.length - initialRows.length
  const colDelta = currentColumns.length - initialColumns.length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-semibold text-gray-900">Data Cleaning Workbench</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            v{version.version_number} · {currentRows.length.toLocaleString()} rows
            {rowDelta !== 0 && <span className={rowDelta < 0 ? 'text-red-500' : 'text-green-600'}> ({rowDelta > 0 ? '+' : ''}{rowDelta})</span>}
            {' · '}{currentColumns.length} cols
            {colDelta !== 0 && <span className={colDelta > 0 ? 'text-green-600' : 'text-red-500'}> ({colDelta > 0 ? '+' : ''}{colDelta})</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'REMOVE', index: operations.length - 1 })} disabled={operations.length === 0}>
            <Undo2 className="h-3.5 w-3.5 mr-1" />
            Undo
          </Button>
          <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'RESET' })} disabled={operations.length === 0}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
          <Button size="sm" onClick={() => setShowSaveDialog(true)} disabled={operations.length === 0}>
            <Save className="h-3.5 w-3.5 mr-1" />
            Save as New Version
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Operations panel */}
        <div className="w-80 shrink-0 border-r bg-gray-50 flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-white">
            <p className="text-sm font-medium text-gray-700 mb-3">Applied Operations ({operations.length})</p>
            {/* Add operation dropdown */}
            <div className="relative">
              <Select
                value=""
                onValueChange={(val) => setAddOpType(val)}
              >
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span>Add Operation</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OP_LABELS).map(([type, label]) => (
                    <SelectItem key={type} value={type}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {operations.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-400">
                No operations yet. Add one above.
              </div>
            ) : (
              operations.map((op, i) => (
                <div key={i} className="flex items-start gap-2 bg-white border rounded-lg p-3 group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-medium shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-xs font-medium text-gray-700 truncate">{OP_LABELS[op.type]}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-6 truncate">{opSummary(op)}</p>
                  </div>
                  <button
                    onClick={() => removeOperation(i)}
                    className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Live preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b bg-white text-xs text-gray-500 shrink-0">
            Live Preview (showing up to 500 rows)
          </div>
          <div className="flex-1 overflow-hidden">
            <DatasetTable rows={previewRows} columns={currentColumns} />
          </div>
        </div>
      </div>

      {/* Operation form dialogs */}
      {addOpType && (
        <OperationFormDialog
          type={addOpType}
          columns={currentColumns}
          rows={previewRows}
          onAdd={addOperation}
          onClose={() => setAddOpType(null)}
        />
      )}

      {/* Save dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCommit className="h-4 w-4" />
              Save as New Version
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-gray-500">Operations:</span> <span className="font-medium">{operations.length}</span></div>
                <div><span className="text-gray-500">Rows:</span> <span className="font-medium">{currentRows.length.toLocaleString()}</span></div>
                <div><span className="text-gray-500">Parent:</span> <span className="font-medium">v{version.version_number}</span></div>
                <div><span className="text-gray-500">New version:</span> <span className="font-medium">v{version.version_number + 1}</span></div>
              </div>
            </div>
            <div>
              <Label>Commit Message</Label>
              <Textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Describe what you changed, e.g. 'Dropped 42 rows with missing age values'"
                rows={3}
                className="mt-1 resize-none"
              />
            </div>
            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={!commitMessage.trim() || saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : 'Save Version'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Operation form dialog ────────────────────────────────────────────────────

interface OperationFormDialogProps {
  type: string
  columns: ColumnSchema[]
  rows: DataRow[]
  onAdd: (op: CleaningOperation) => void
  onClose: () => void
}

function OperationFormDialog({ type, columns, rows, onAdd, onClose }: OperationFormDialogProps) {
  const colNames = columns.map(c => c.name)
  const [col, setCol] = useState(colNames[0] ?? '')
  const [col2, setCol2] = useState(colNames[0] ?? '')
  const [value, setValue] = useState('')
  const [value2, setValue2] = useState('')
  const [strategy, setStrategy] = useState('value')
  const [newType, setNewType] = useState<ColumnType>('text')
  const [operator, setOperator] = useState<FilterOperator>('=')
  const [keep, setKeep] = useState(true)
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
  const [selectedCols, setSelectedCols] = useState<string[]>(colNames.slice(0, 1))
  const [mappingRows, setMappingRows] = useState<{ from: string; to: string }[]>([{ from: '', to: '' }])
  const [outputCol, setOutputCol] = useState('')
  const [binRows, setBinRows] = useState<{ min: string; max: string; label: string }[]>([{ min: '', max: '', label: '' }])
  const [splitDelimiter, setSplitDelimiter] = useState(',')
  const [splitNewCols, setSplitNewCols] = useState<string[]>(['', ''])
  const [keepOriginal, setKeepOriginal] = useState(true)
  const [replaceValue, setReplaceValue] = useState('')
  const [reorderList, setReorderList] = useState<string[]>(colNames)

  // Unique non-null values for the currently selected column — computed async after mount
  const [uniqueColValues, setUniqueColValues] = useState<string[]>([])
  useEffect(() => {
    const seen = new Set<string>()
    for (const row of rows) {
      const v = row[col]
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        seen.add(String(v))
        if (seen.size >= 300) break
      }
    }
    setUniqueColValues(Array.from(seen).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
  }, [rows, col])

  const handleAdd = () => {
    let op: CleaningOperation | null = null

    switch (type) {
      case 'rename_column':
        if (!value.trim()) return
        op = { type: 'rename_column', column: col, new_name: value.trim() }
        break
      case 'retype_column':
        op = { type: 'retype_column', column: col, new_type: newType }
        break
      case 'delete_column':
        op = { type: 'delete_column', column: col }
        break
      case 'drop_missing':
        op = { type: 'drop_missing', columns: selectedCols.length > 0 ? selectedCols : [col] }
        break
      case 'fill_missing':
        op = {
          type: 'fill_missing',
          column: col,
          strategy: strategy as CleaningOperation extends { type: 'fill_missing' } ? typeof strategy : never,
          value: strategy === 'value' ? value : undefined,
        } as CleaningOperation
        break
      case 'filter_rows':
        op = {
          type: 'filter_rows',
          column: col,
          operator,
          value: operator === 'is_null' || operator === 'is_not_null' ? null : value || null,
          keep,
        }
        break
      case 'remove_duplicates':
        op = { type: 'remove_duplicates', columns: selectedCols.length > 0 ? selectedCols : colNames }
        break
      case 'sort_rows':
        op = { type: 'sort_rows', column: col, direction }
        break
      case 'computed_column':
        if (!value.trim() || !value2.trim()) return
        op = { type: 'computed_column', name: value.trim(), formula: value2.trim(), column_type: newType }
        break
      case 'standardize_text':
        op = { type: 'standardize_text', column: col, operations: ['trim', 'lowercase'] }
        break
      case 'recode_values': {
        const mapping: Record<string, string> = {}
        for (const row of mappingRows) {
          if (row.from.trim() !== '') mapping[row.from.trim()] = row.to.trim()
        }
        if (Object.keys(mapping).length === 0) return
        op = { type: 'recode_values', column: col, mapping, ...(outputCol.trim() ? { output_column: outputCol.trim() } : {}) }
        break
      }
      case 'reorder_columns': {
        if (reorderList.length === 0) return
        op = { type: 'reorder_columns', order: reorderList }
        break
      }
      case 'split_column': {
        if (!splitDelimiter || splitNewCols.filter(c => c.trim()).length < 2) return
        op = { type: 'split_column', column: col, delimiter: splitDelimiter, new_columns: splitNewCols.filter(c => c.trim()), keep_original: keepOriginal }
        break
      }
      case 'replace_column': {
        op = { type: 'replace_column', column: col, replace_value: replaceValue === '' ? null : replaceValue, ...(outputCol.trim() ? { new_column: outputCol.trim() } : {}) }
        break
      }
      case 'bin_numeric': {
        if (!value.trim()) return
        const bins = binRows
          .filter(b => b.label.trim() !== '')
          .map(b => ({
            min: b.min === '' ? null : parseFloat(b.min),
            max: b.max === '' ? null : parseFloat(b.max),
            label: b.label.trim(),
          }))
        if (bins.length === 0) return
        op = { type: 'bin_numeric', column: col, new_column: value.trim(), bins }
        break
      }
      default:
        return
    }

    if (op) onAdd(op)
  }

  const title = OP_LABELS[type] ?? type

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Column selector — rendered inline for recode_values, bin_numeric, reorder_columns, split_column; shared here for others */}
          {['rename_column', 'retype_column', 'delete_column', 'fill_missing', 'filter_rows', 'sort_rows', 'standardize_text', 'replace_column'].includes(type) && (
            <div>
              <Label>Column</Label>
              <Select value={col} onValueChange={v => { setCol(v); setValue('') }}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Operation-specific fields */}
          {type === 'rename_column' && (
            <div>
              <Label>New Name</Label>
              <Input value={value} onChange={e => setValue(e.target.value)} placeholder="new_column_name" className="mt-1" />
            </div>
          )}

          {type === 'retype_column' && (
            <div>
              <Label>New Type</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as ColumnType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLUMN_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === 'drop_missing' && (
            <div>
              <Label>Columns (select which to check for nulls)</Label>
              <div className="mt-2 border rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                {colNames.map(c => (
                  <label key={c} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      checked={selectedCols.includes(c)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedCols(prev => [...prev, c])
                        else setSelectedCols(prev => prev.filter(x => x !== c))
                      }}
                    />
                    {c}
                  </label>
                ))}
              </div>
              {selectedCols.length === 0 && <p className="text-xs text-amber-600 mt-1">Select at least one column</p>}
            </div>
          )}

          {type === 'fill_missing' && (
            <>
              <div>
                <Label>Fill Strategy</Label>
                <Select value={strategy} onValueChange={setStrategy}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FILL_STRATEGIES.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {strategy === 'value' && (
                <div>
                  <Label>Fill Value</Label>
                  <input
                    list="fill-values-list"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    placeholder="Type or pick an existing value…"
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <datalist id="fill-values-list">
                    {uniqueColValues.map(v => <option key={v} value={v} />)}
                  </datalist>
                  <p className="text-xs text-gray-500 mt-1">Suggestions show existing values in this column</p>
                </div>
              )}
            </>
          )}

          {type === 'filter_rows' && (
            <>
              <div>
                <Label>Operator</Label>
                <Select value={operator} onValueChange={(v) => setOperator(v as FilterOperator)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FILTER_OPERATORS.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {operator !== 'is_null' && operator !== 'is_not_null' && (
                <div>
                  <Label>Value</Label>
                  <input
                    list="filter-values-list"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    placeholder="Type or pick a value…"
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <datalist id="filter-values-list">
                    {uniqueColValues.map(v => <option key={v} value={v} />)}
                  </datalist>
                </div>
              )}
              <div>
                <Label>Action</Label>
                <Select value={keep ? 'keep' : 'remove'} onValueChange={(v) => setKeep(v === 'keep')}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">Keep matching rows</SelectItem>
                    <SelectItem value="remove">Remove matching rows</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {type === 'remove_duplicates' && (
            <div>
              <Label>Check Columns (leave all checked for full-row dedup)</Label>
              <div className="mt-2 border rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                {colNames.map(c => (
                  <label key={c} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                    <input
                      type="checkbox"
                      checked={selectedCols.includes(c)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedCols(prev => [...prev, c])
                        else setSelectedCols(prev => prev.filter(x => x !== c))
                      }}
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          )}

          {type === 'sort_rows' && (
            <div>
              <Label>Direction</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as 'asc' | 'desc')}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending (A → Z, 0 → 9)</SelectItem>
                  <SelectItem value="desc">Descending (Z → A, 9 → 0)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {type === 'computed_column' && (
            <>
              <div>
                <Label>New Column Name</Label>
                <Input value={value} onChange={e => setValue(e.target.value)} placeholder="computed_column" className="mt-1" />
              </div>
              <div>
                <Label>Formula</Label>
                <Input value={value2} onChange={e => setValue2(e.target.value)} placeholder="age * 2  or  IF(age < 5, 'under5', 'over5')" className="mt-1" />
                <p className="text-xs text-gray-500 mt-1">Use column names directly. Supports: arithmetic, IF(), CONCAT()</p>
              </div>
              <div>
                <Label>Result Type</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v as ColumnType)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLUMN_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {type === 'standardize_text' && (
            <p className="text-sm text-gray-600">
              Will trim whitespace and convert to lowercase for column: <strong>{col}</strong>
            </p>
          )}

          {type === 'recode_values' && (
            <>
              <div>
                <Label>Column</Label>
                <Select value={col} onValueChange={v => { setCol(v); setMappingRows([{ from: '', to: '' }]) }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {colNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Value Mappings</Label>
                  {uniqueColValues.length > 0 && (
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => setMappingRows(uniqueColValues.map(v => ({ from: v, to: '' })))}
                    >
                      Auto-populate all {uniqueColValues.length} values
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-2">Select an existing value on the left, type the replacement on the right</p>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {mappingRows.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Select
                        value={row.from}
                        onValueChange={v => setMappingRows(prev => prev.map((r, j) => j === i ? { ...r, from: v } : r))}
                      >
                        <SelectTrigger className="h-8 text-sm flex-1">
                          <SelectValue placeholder="Pick value…" />
                        </SelectTrigger>
                        <SelectContent>
                          {uniqueColValues.map(v => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-gray-400 shrink-0">→</span>
                      <Input
                        value={row.to}
                        onChange={e => setMappingRows(prev => prev.map((r, j) => j === i ? { ...r, to: e.target.value } : r))}
                        placeholder="New value"
                        className="h-8 text-sm flex-1"
                      />
                      <button
                        onClick={() => setMappingRows(prev => prev.filter((_, j) => j !== i))}
                        className="text-gray-300 hover:text-red-500 shrink-0"
                        disabled={mappingRows.length === 1}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setMappingRows(prev => [...prev, { from: '', to: '' }])}
                  className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  <PlusCircle className="h-3.5 w-3.5" /> Add row
                </button>
              </div>
              <div>
                <Label>Save result as new column <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Input
                  value={outputCol}
                  onChange={e => setOutputCol(e.target.value)}
                  placeholder="Leave blank to overwrite original"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Fill this to keep the original column untouched and write recoded values into a new column</p>
              </div>
            </>
          )}

          {type === 'reorder_columns' && (
            <div>
              <Label>Drag to reorder — use arrows to move</Label>
              <div className="mt-2 border rounded-lg divide-y max-h-64 overflow-y-auto">
                {reorderList.map((name, i) => (
                  <div key={name} className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-50">
                    <span className="flex-1 text-sm truncate">{name}</span>
                    <button
                      disabled={i === 0}
                      onClick={() => setReorderList(prev => { const a = [...prev]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a })}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-20"
                    >▲</button>
                    <button
                      disabled={i === reorderList.length - 1}
                      onClick={() => setReorderList(prev => { const a = [...prev]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a })}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-20"
                    >▼</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {type === 'split_column' && (
            <>
              <div>
                <Label>Column to split</Label>
                <Select value={col} onValueChange={v => { setCol(v); setValue('') }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {colNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Delimiter</Label>
                <Input value={splitDelimiter} onChange={e => setSplitDelimiter(e.target.value)} placeholder="e.g.  ,  or  ;  or  -" className="mt-1" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>New column names (one per part)</Label>
                  <button className="text-xs text-blue-600 hover:underline" onClick={() => setSplitNewCols(prev => [...prev, ''])}>
                    + Add column
                  </button>
                </div>
                <div className="space-y-2">
                  {splitNewCols.map((name, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input
                        value={name}
                        onChange={e => setSplitNewCols(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                        placeholder={`Part ${i + 1} column name`}
                        className="h-8 text-sm"
                      />
                      {splitNewCols.length > 2 && (
                        <button onClick={() => setSplitNewCols(prev => prev.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={keepOriginal} onChange={e => setKeepOriginal(e.target.checked)} />
                  Keep original column after split
                </label>
              </div>
            </>
          )}

          {type === 'replace_column' && (
            <>
              <div>
                <Label>Replace value</Label>
                <input
                  list="replace-values-list"
                  value={replaceValue}
                  onChange={e => setReplaceValue(e.target.value)}
                  placeholder="Value to write into every row (blank = null)"
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <datalist id="replace-values-list">
                  {uniqueColValues.map(v => <option key={v} value={v} />)}
                </datalist>
                <p className="text-xs text-gray-500 mt-1">Every row in the column will be set to this value</p>
              </div>
              <div>
                <Label>Save as new column <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Input value={outputCol} onChange={e => setOutputCol(e.target.value)} placeholder="Leave blank to overwrite original" className="mt-1" />
              </div>
            </>
          )}

          {type === 'bin_numeric' && (
            <>
              <div>
                <Label>Source Column (numeric)</Label>
                <Select value={col} onValueChange={setCol}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {colNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>New Column Name</Label>
                <Input value={value} onChange={e => setValue(e.target.value)} placeholder="age_group" className="mt-1" />
              </div>
              <div>
                <Label>Bins</Label>
                <p className="text-xs text-gray-500 mb-2">Leave Min or Max blank for open-ended ranges (e.g. blank Min = "less than Max")</p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {binRows.map((row, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Input
                        value={row.min}
                        onChange={e => setBinRows(prev => prev.map((r, j) => j === i ? { ...r, min: e.target.value } : r))}
                        placeholder="Min"
                        className="h-8 text-sm w-20"
                        type="number"
                      />
                      <span className="text-gray-400 text-xs shrink-0">to</span>
                      <Input
                        value={row.max}
                        onChange={e => setBinRows(prev => prev.map((r, j) => j === i ? { ...r, max: e.target.value } : r))}
                        placeholder="Max"
                        className="h-8 text-sm w-20"
                        type="number"
                      />
                      <Input
                        value={row.label}
                        onChange={e => setBinRows(prev => prev.map((r, j) => j === i ? { ...r, label: e.target.value } : r))}
                        placeholder="Label"
                        className="h-8 text-sm flex-1"
                      />
                      <button
                        onClick={() => setBinRows(prev => prev.filter((_, j) => j !== i))}
                        className="text-gray-300 hover:text-red-500 shrink-0"
                        disabled={binRows.length === 1}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setBinRows(prev => [...prev, { min: '', max: '', label: '' }])}
                  className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  <PlusCircle className="h-3.5 w-3.5" /> Add bin
                </button>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd}>
            <Check className="h-4 w-4 mr-1" />
            Add Operation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
