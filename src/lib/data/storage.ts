import { createClient } from '@/lib/supabase/client'
import type { DataRow, ColumnSchema, ParsedDataset, CleaningOperation } from '@/types/database'
import { rowsToCSV as _rowsToCSV, hashFile } from './parser'

const DATASETS_BUCKET = 'datasets'

// ─── Upload a raw file to storage ─────────────────────────────────────────────

export async function uploadDatasetFile(
  file: File,
  projectId: string,
  datasetId: string,
  versionNumber: number
): Promise<{ path: string; hash: string; size: number }> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'csv'
  const path = `${projectId}/${datasetId}/v${versionNumber}/original.${ext}`

  const { error } = await supabase.storage
    .from(DATASETS_BUCKET)
    .upload(path, file, { upsert: true })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  const hash = await hashFile(file)
  return { path, hash, size: file.size }
}

// ─── Store parsed rows as JSON ─────────────────────────────────────────────────

export async function storeVersionData(
  rows: DataRow[],
  columns: ColumnSchema[],
  projectId: string,
  datasetId: string,
  versionNumber: number
): Promise<{ path: string; hash: string; size: number }> {
  const supabase = createClient()
  const path = `${projectId}/${datasetId}/v${versionNumber}/data.json`
  const json = JSON.stringify({ rows, columns })
  const blob = new Blob([json], { type: 'application/json' })

  const { error } = await supabase.storage
    .from(DATASETS_BUCKET)
    .upload(path, blob, { upsert: true, contentType: 'application/json' })

  if (error) throw new Error(`Store failed: ${error.message}`)

  const buffer = await blob.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return { path, hash, size: blob.size }
}

// ─── Download version data ────────────────────────────────────────────────────

export async function loadVersionData(filePath: string): Promise<ParsedDataset> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from(DATASETS_BUCKET)
    .download(filePath)

  if (error) throw new Error(`Download failed: ${error.message}`)

  const text = await data.text()

  // Try JSON format first (stored parsed data)
  try {
    const parsed = JSON.parse(text) as { rows: DataRow[]; columns: ColumnSchema[] }
    return {
      rows: parsed.rows,
      columns: parsed.columns,
      row_count: parsed.rows.length,
      column_count: parsed.columns.length,
    }
  } catch {
    // Fall back to parsing as CSV
    const { parseCSV } = await import('./parser')
    const file = new File([text], 'data.csv', { type: 'text/csv' })
    return parseCSV(file)
  }
}

// ─── Create a dataset record in the DB ───────────────────────────────────────

export async function createDatasetRecord(params: {
  projectId: string
  name: string
  description?: string
  source?: string
  parentId?: string
  uploadedBy: string
}): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('datasets')
    .insert({
      project_id: params.projectId,
      name: params.name,
      description: params.description ?? null,
      source: params.source ?? 'upload',
      parent_id: params.parentId ?? null,
      uploaded_by: params.uploadedBy,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Create dataset failed: ${error.message}`)
  return data.id
}

// ─── Create a version record ──────────────────────────────────────────────────

export async function createVersionRecord(params: {
  datasetId: string
  versionNumber: number
  parentVersionId?: string
  commitMessage: string
  filePath: string
  fileHash: string
  fileSize?: number
  rowCount: number
  columnCount: number
  schemaInfo: ColumnSchema[]
  operations?: CleaningOperation[]
  createdBy: string
}): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('dataset_versions')
    .insert({
      dataset_id: params.datasetId,
      version_number: params.versionNumber,
      parent_version: params.parentVersionId ?? null,
      commit_message: params.commitMessage,
      file_path: params.filePath,
      file_hash: params.fileHash,
      file_size: params.fileSize ?? null,
      row_count: params.rowCount,
      column_count: params.columnCount,
      schema_info: params.schemaInfo,
      operations: params.operations ?? [],
      created_by: params.createdBy,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Create version failed: ${error.message}`)
  return data.id
}

// ─── Create/update a branch ───────────────────────────────────────────────────

export async function upsertBranch(params: {
  datasetId: string
  name: string
  headVersionId: string
  isDefault?: boolean
  createdBy: string
}): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('dataset_branches')
    .upsert({
      dataset_id: params.datasetId,
      name: params.name,
      head_version: params.headVersionId,
      is_default: params.isDefault ?? false,
      created_by: params.createdBy,
    }, { onConflict: 'dataset_id,name' })
    .select('id')
    .single()

  if (error) throw new Error(`Upsert branch failed: ${error.message}`)
  return data.id
}

// ─── Full upload flow: file → parsed data → storage → DB records ──────────────

export async function uploadDataset(params: {
  file: File
  projectId: string
  name: string
  description?: string
  uploadedBy: string
  parsedData: ParsedDataset
}): Promise<{ datasetId: string; versionId: string; fileHash: string }> {
  const { file, projectId, name, description, uploadedBy, parsedData } = params

  // 1. Create dataset record
  const datasetId = await createDatasetRecord({
    projectId,
    name,
    description,
    source: 'upload',
    uploadedBy,
  })

  // 2. Upload original file (originalPath unused; data.json is the canonical path)
  const { hash, size } = await uploadDatasetFile(file, projectId, datasetId, 1)

  // 3. Store parsed JSON (for fast loading)
  await storeVersionData(parsedData.rows, parsedData.columns, projectId, datasetId, 1)

  // 4. Create version record
  const versionId = await createVersionRecord({
    datasetId,
    versionNumber: 1,
    commitMessage: 'Initial upload',
    filePath: `${projectId}/${datasetId}/v1/data.json`,
    fileHash: hash,
    fileSize: size,
    rowCount: parsedData.row_count,
    columnCount: parsedData.column_count,
    schemaInfo: parsedData.columns,
    operations: [],
    createdBy: uploadedBy,
  })

  // 5. Create main branch
  await upsertBranch({
    datasetId,
    name: 'main',
    headVersionId: versionId,
    isDefault: true,
    createdBy: uploadedBy,
  })

  return { datasetId, versionId, fileHash: hash }
}

// ─── Save a cleaned version ───────────────────────────────────────────────────

export async function saveCleanedVersion(params: {
  datasetId: string
  projectId: string
  parentVersionId: string
  parentVersionNumber: number
  branchName: string
  commitMessage: string
  rows: DataRow[]
  columns: ColumnSchema[]
  operations: CleaningOperation[]
  createdBy: string
}): Promise<{ versionId: string }> {
  const versionNumber = params.parentVersionNumber + 1

  // Store data
  const { path, hash, size } = await storeVersionData(
    params.rows,
    params.columns,
    params.projectId,
    params.datasetId,
    versionNumber
  )

  // Create version record
  const versionId = await createVersionRecord({
    datasetId: params.datasetId,
    versionNumber,
    parentVersionId: params.parentVersionId,
    commitMessage: params.commitMessage,
    filePath: path,
    fileHash: hash,
    fileSize: size,
    rowCount: params.rows.length,
    columnCount: params.columns.length,
    schemaInfo: params.columns,
    operations: params.operations,
    createdBy: params.createdBy,
  })

  // Update branch head
  await upsertBranch({
    datasetId: params.datasetId,
    name: params.branchName,
    headVersionId: versionId,
    createdBy: params.createdBy,
  })

  return { versionId }
}

// ─── Export helpers ───────────────────────────────────────────────────────────

export function downloadAsCSV(rows: DataRow[], columns: ColumnSchema[], filename: string): void {
  const csv = _rowsToCSV(rows, columns.map(c => c.name))
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadAsJSON(rows: DataRow[], filename: string): void {
  const json = JSON.stringify(rows, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
