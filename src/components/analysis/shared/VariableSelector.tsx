"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { DatasetColumn, ColumnType } from '@/types/database'

interface VariableSelectorProps {
  label: string
  value: string
  onChange: (val: string) => void
  columns: DatasetColumn[]
  allowedTypes?: ColumnType[]
  placeholder?: string
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

export function VariableSelector({ label, value, onChange, columns, allowedTypes, placeholder, required }: VariableSelectorProps) {
  const filtered = allowedTypes
    ? columns.filter(c => allowedTypes.includes(c.type))
    : columns

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder={placeholder ?? 'Select variable…'} />
        </SelectTrigger>
        <SelectContent>
          {filtered.length === 0 ? (
            <SelectItem value="__none" disabled>No matching variables</SelectItem>
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
      {allowedTypes && filtered.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No {allowedTypes.join('/')} variables in dataset
        </p>
      )}
    </div>
  )
}
