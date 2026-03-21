'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Plus, Undo2, RotateCcw, Save, ChevronDown, Loader2, GitCommit,
  Check, X, Trash2, ArrowUpDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DatasetTable } from '@/components/data/DatasetTable'
import { applyOperations } from '@/lib/data/operations'
import { saveCleanedVersion } from '@/lib/data/storage'
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
  drop_missing: 'Drop Missing Rows',
  fill_missing: 'Fill Missing Values',
  filter_rows: 'Filter Rows',
  remove_duplicates: 'Remove Duplicates',
  sort_rows: 'Sort Rows',
  computed_column: 'Computed Column',
  recode_values: 'Recode Values',
  bin_numeric: 'Bin Numeric',
  standardize_text: 'Standardize Text',
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
    case 'recode_values': return `Recode "${op.column}" values`
    case 'bin_numeric': return `Bin "${op.column}" → "${op.new_column}"`
    case 'standardize_text': return `Standardize "${op.column}"`
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
  const [operations, setOperations] = useState<CleaningOperation[]>([])
  const [addOpType, setAddOpType] = useState<string | null>(null)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Apply all operations to get current state
  const { rows: currentRows, columns: currentColumns } = useMemo(() => {
    if (operations.length === 0) return { rows: initialRows, columns: initialColumns }
    return applyOperations(initialRows, initialColumns, operations)
  }, [initialRows, initialColumns, operations])

  // Sample for preview (first 500 rows for performance)
  const previewRows = useMemo(() => currentRows.slice(0, 500), [currentRows])

  const addOperation = useCallback((op: CleaningOperation) => {
    setOperations(prev => [...prev, op])
    setAddOpType(null)
  }, [])

  const removeOperation = useCallback((index: number) => {
    setOperations(prev => prev.filter((_, i) => i !== index))
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
          <Button variant="outline" size="sm" onClick={() => setOperations(prev => prev.slice(0, -1))} disabled={operations.length === 0}>
            <Undo2 className="h-3.5 w-3.5 mr-1" />
            Undo
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOperations([])} disabled={operations.length === 0}>
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
  onAdd: (op: CleaningOperation) => void
  onClose: () => void
}

function OperationFormDialog({ type, columns, onAdd, onClose }: OperationFormDialogProps) {
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
          {/* Column selector (most operations need a column) */}
          {['rename_column', 'retype_column', 'delete_column', 'fill_missing', 'filter_rows', 'sort_rows', 'computed_column', 'standardize_text'].includes(type) && type !== 'computed_column' && (
            <div>
              <Label>Column</Label>
              <Select value={col} onValueChange={setCol}>
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
                  <Input value={value} onChange={e => setValue(e.target.value)} placeholder="0" className="mt-1" />
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
                  <Input value={value} onChange={e => setValue(e.target.value)} placeholder="value to compare" className="mt-1" />
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
