'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { parseFile } from '@/lib/data/parser'
import { uploadDataset } from '@/lib/data/storage'
import { useAuth } from '@/hooks/useAuth'
import { logAudit } from '@/lib/audit'
import type { ParsedDataset, ColumnType } from '@/types/database'

// Type badge colors
const TYPE_COLORS: Record<ColumnType | string, string> = {
  integer: 'bg-blue-100 text-blue-800',
  decimal: 'bg-blue-100 text-blue-800',
  number: 'bg-blue-100 text-blue-800',
  text: 'bg-gray-100 text-gray-800',
  categorical: 'bg-purple-100 text-purple-800',
  date: 'bg-green-100 text-green-800',
  boolean: 'bg-orange-100 text-orange-800',
}

interface DatasetUploadProps {
  projectId: string
  onSuccess: (datasetId: string) => void
  onCancel: () => void
}

export function DatasetUpload({ projectId, onSuccess, onCancel }: DatasetUploadProps) {
  const { user } = useAuth()
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedDataset | null>(null)
  const [parsing, setParsing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (f: File) => {
    setError(null)
    setFile(f)
    setName(f.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '))
    setParsing(true)
    try {
      const data = await parseFile(f)
      setParsed(data)
    } catch (e) {
      setError(`Failed to parse file: ${e instanceof Error ? e.message : 'Unknown error'}`)
      setFile(null)
    } finally {
      setParsing(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleUpload = async () => {
    if (!file || !parsed || !user) return
    setUploading(true)
    setError(null)
    try {
      const { datasetId } = await uploadDataset({
        file,
        projectId,
        name: name || file.name,
        description: description || undefined,
        uploadedBy: user.id,
        parsedData: parsed,
      })
      logAudit('upload', 'dataset', datasetId, {
        name: name || file.name,
        rows: parsed.row_count,
        columns: parsed.column_count,
        file_name: file.name,
        file_size_mb: parseFloat((file.size / 1024 / 1024).toFixed(2)),
      }, projectId)
      onSuccess(datasetId)
    } catch (e) {
      setError(`Upload failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".csv,.tsv,.txt,.xlsx,.xls"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-700">Drop your dataset here</p>
          <p className="text-sm text-gray-500 mt-1">or click to browse</p>
          <p className="text-xs text-gray-400 mt-3">CSV, TSV, Excel (.xlsx, .xls) · Max 100MB</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* File info bar */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
            <FileText className="h-5 w-5 text-blue-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            {parsing ? (
              <Loader2 className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
            ) : parsed ? (
              <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
            ) : null}
            <button onClick={() => { setFile(null); setParsed(null); setError(null) }} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          {parsing && (
            <div className="text-center py-4 text-sm text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
              Parsing file...
            </div>
          )}

          {parsed && !parsing && (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{parsed.row_count.toLocaleString()}</p>
                  <p className="text-xs text-blue-600 mt-1">Rows</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-purple-700">{parsed.column_count}</p>
                  <p className="text-xs text-purple-600 mt-1">Columns</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">
                    {parsed.columns.filter(c => ['integer','decimal','number'].includes(c.type)).length}
                  </p>
                  <p className="text-xs text-green-600 mt-1">Numeric</p>
                </div>
              </div>

              {/* Name & description */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="ds-name">Dataset Name</Label>
                  <Input
                    id="ds-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Dataset name..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="ds-desc">Description (optional)</Label>
                  <Textarea
                    id="ds-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of this dataset..."
                    rows={2}
                    className="mt-1 resize-none"
                  />
                </div>
              </div>

              {/* Column preview */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Detected Columns</p>
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Column Name</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Type</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Nulls</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Unique</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {parsed.columns.map(col => (
                          <tr key={col.name} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-mono text-xs text-gray-900">{col.name}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[col.type] ?? 'bg-gray-100 text-gray-800'}`}>
                                {col.type}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-600">{col.null_count}</td>
                            <td className="px-3 py-2 text-gray-600">{col.unique_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} disabled={uploading}>Cancel</Button>
        <Button
          onClick={handleUpload}
          disabled={!parsed || !name || uploading || parsing}
        >
          {uploading ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading...</>
          ) : (
            <><Database className="h-4 w-4 mr-2" />Upload Dataset</>
          )}
        </Button>
      </div>
    </div>
  )
}
