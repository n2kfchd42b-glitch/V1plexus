"use client"

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { Upload, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { parseFile, computeFileHash } from '@/lib/fileParser'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

const ACCEPTED_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/x-spss-sav',
]
const ACCEPTED_EXT = ['.csv', '.xls', '.xlsx', '.sav']
const MAX_SIZE = 50 * 1024 * 1024 // 50MB

interface DatasetUploadProps {
  projectId: string
  profile: Profile
  onUploaded: () => void
  onCancel: () => void
}

export function DatasetUpload({ projectId, profile, onUploaded, onCancel }: DatasetUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  function handleFile(f: File) {
    setError(null)
    if (f.size > MAX_SIZE) {
      setError('File too large. Maximum size is 50MB.')
      return
    }
    const ext = '.' + f.name.split('.').pop()?.toLowerCase()
    if (!ACCEPTED_EXT.includes(ext) && !ACCEPTED_TYPES.includes(f.type)) {
      setError('Unsupported file type. Please upload CSV, Excel (.xlsx/.xls), or SPSS (.sav) files.')
      return
    }
    setFile(f)
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''))
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  async function handleUpload() {
    if (!file || !name.trim()) return
    setUploading(true)
    setProgress(10)
    setError(null)

    try {
      // Parse file
      setProgress(20)
      const [parsed, hash] = await Promise.all([
        parseFile(file),
        computeFileHash(file),
      ])
      setProgress(50)

      // Upload to Supabase Storage
      const filePath = `${projectId}/${Date.now()}_${file.name}`
      const { error: storageErr } = await supabase.storage
        .from('datasets')
        .upload(filePath, file, { contentType: file.type || 'application/octet-stream' })

      if (storageErr) throw new Error(storageErr.message)
      setProgress(80)

      // Insert dataset record
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'csv'
      const sourceMap: Record<string, string> = {
        csv: 'csv', xlsx: 'excel', xls: 'excel', sav: 'spss',
      }
      const { error: dbErr } = await supabase.from('datasets').insert({
        project_id: projectId,
        name: name.trim(),
        source: sourceMap[ext] ?? 'upload',
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        file_hash: hash,
        mime_type: file.type,
        row_count: parsed.rowCount,
        column_count: parsed.headers.length,
        schema_info: parsed.schema,
        uploaded_by: profile.id,
      })

      if (dbErr) throw new Error(dbErr.message)
      setProgress(100)
      onUploaded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50',
          file && 'border-green-500 bg-green-50/50'
        )}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !file && inputRef.current?.click()}
      >
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <div className="text-left">
              <p className="font-medium text-sm text-green-700">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground"
              onClick={e => { e.stopPropagation(); setFile(null); setName('') }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium">Drop file here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">CSV, Excel (.xlsx/.xls), SPSS (.sav) · Max 50MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_EXT.join(',')}
          onChange={onInputChange}
        />
      </div>

      {/* Dataset name */}
      <div>
        <Label>Dataset Name</Label>
        <Input
          placeholder="e.g. Survey Wave 2 Data"
          value={name}
          onChange={e => setName(e.target.value)}
          className="mt-1"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Progress bar */}
      {uploading && (
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={uploading}>Cancel</Button>
        <Button
          onClick={handleUpload}
          disabled={!file || !name.trim() || uploading}
        >
          {uploading ? `Uploading… ${progress}%` : 'Upload Dataset'}
        </Button>
      </div>
    </div>
  )
}
