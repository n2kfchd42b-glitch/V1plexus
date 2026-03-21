"use client"

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X, Plus } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { DatasetColumn, ColumnType } from '@/types/database'

interface MultiVariableSelectorProps {
  label: string
  value: string[]
  onChange: (vals: string[]) => void
  columns: DatasetColumn[]
  allowedTypes?: ColumnType[]
  maxSelections?: number
  required?: boolean
}

const typeColors: Partial<Record<ColumnType, string>> = {
  numeric: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  number: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  integer: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  decimal: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  categorical: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  date: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  text: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  string: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  binary: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  boolean: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
}

const typeLabels: Partial<Record<ColumnType, string>> = {
  numeric: 'Num',
  number: 'Num',
  integer: 'Int',
  decimal: 'Dec',
  categorical: 'Cat',
  date: 'Date',
  text: 'Text',
  string: 'Str',
  binary: 'Bin',
  boolean: 'Bool',
  unknown: '?',
}

export function MultiVariableSelector({ label, value, onChange, columns, allowedTypes, maxSelections, required }: MultiVariableSelectorProps) {
  const [addingVar, setAddingVar] = useState('')

  const filtered = (allowedTypes ? columns.filter(c => allowedTypes.includes(c.type)) : columns)
    .filter(c => !value.includes(c.name))

  const handleAdd = (colName: string) => {
    if (!colName || value.includes(colName)) return
    if (maxSelections && value.length >= maxSelections) return
    onChange([...value, colName])
    setAddingVar('')
  }

  const handleRemove = (colName: string) => {
    onChange(value.filter(v => v !== colName))
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {value.map(v => {
            const col = columns.find(c => c.name === v)
            return (
              <Badge key={v} variant="secondary" className="text-xs pr-1 gap-1">
                {col && (
                  <span className={`text-[9px] font-medium px-0.5 rounded ${typeColors[col.type]}`}>
                    {typeLabels[col.type]}
                  </span>
                )}
                {v}
                <button
                  onClick={() => handleRemove(v)}
                  className="ml-0.5 hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          })}
        </div>
      )}

      {(!maxSelections || value.length < maxSelections) && (
        <Select value={addingVar} onValueChange={handleAdd}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Add variable…" />
          </SelectTrigger>
          <SelectContent>
            {filtered.length === 0 ? (
              <SelectItem value="__none" disabled>No more variables available</SelectItem>
            ) : (
              filtered.map(col => (
                <SelectItem key={col.name} value={col.name}>
                  <span className="flex items-center gap-2">
                    <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${typeColors[col.type]}`}>
                      {typeLabels[col.type]}
                    </span>
                    {col.name}
                  </span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      )}

      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">No variables selected</p>
      )}
    </div>
  )
}
