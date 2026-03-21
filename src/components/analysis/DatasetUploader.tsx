"use client"

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, FileText, X, Check } from 'lucide-react'
import { parseCSVData, detectColumnTypes } from '@/lib/analysis/engine'
import type { DataRow } from '@/lib/analysis/engine'
import type { DatasetColumn } from '@/types/database'

interface Props {
  onData: (data: DataRow[], columns: DatasetColumn[], name: string) => void
  data?: DataRow[]
  fileName?: string
}

export function DatasetUploader({ onData, data, fileName }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const processFile = (file: File) => {
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) { setError('Empty file'); return }
      try {
        const rows = parseCSVData(text)
        if (rows.length === 0) { setError('No data found in file'); return }
        const types = detectColumnTypes(rows)
        const columns: DatasetColumn[] = Object.keys(rows[0] ?? {}).map(name => ({
          name,
          type: types[name] ?? 'text',
          unique_values: new Set(rows.map(r => String(r[name] ?? '')).filter(v => v)).size,
          missing: rows.filter(r => r[name] === null || r[name] === undefined || r[name] === '').length
        }))
        onData(rows, columns, file.name)
      } catch (err) {
        setError('Failed to parse CSV file. Please check the format.')
      }
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      processFile(file)
    } else {
      setError('Please upload a CSV file')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  if (data && data.length > 0) {
    return (
      <div className="rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-green-600" />
          <div>
            <p className="text-sm font-medium">{fileName}</p>
            <p className="text-xs text-muted-foreground">{data.length.toLocaleString()} rows loaded</p>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5 mr-1" />
          Replace
        </Button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
      </div>
    )
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
      onClick={() => fileRef.current?.click()}
    >
      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
      <p className="text-sm font-medium">Drop CSV file here or click to browse</p>
      <p className="text-xs text-muted-foreground mt-1">Supports comma-separated values (.csv)</p>
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
    </div>
  )
}
