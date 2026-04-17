import Dexie, { type Table } from 'dexie'

// ─── Local table types ────────────────────────────────────────────────────────
// These mirror the shapes returned by lib/data/ functions.
// JSONB fields (config, results, schema_info, etc.) use Record<string,unknown>
// to avoid deep type imports; Dexie stores them as-is.

export type LocalProject = {
  id: string                          // PK
  title: string
  description: string | null
  owner_id: string
  status: string
  created_at: string
  updated_at: string
  // Counts are computed client-side and stored alongside the project row
  dataset_count: number
  run_count: number
  _synced_at: string
}

export type LocalDataset = {
  id: string                          // PK
  project_id: string                  // Index
  name: string
  description: string | null
  source: string
  parent_id: string | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  archived_at: string | null
  _synced_at: string
}

export type LocalDatasetVersion = {
  id: string                          // PK
  dataset_id: string                  // Index
  version_number: number
  parent_version: string | null
  commit_message: string
  file_path: string
  file_hash: string
  file_size: number | null
  row_count: number
  column_count: number
  schema_info: Record<string, unknown>[]
  operations: Record<string, unknown>[]
  created_by: string | null
  created_at: string
  _synced_at: string
}

export type LocalDatasetBranch = {
  id: string                          // PK
  dataset_id: string                  // Index
  name: string
  head_version: string
  is_default: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  _synced_at: string
}

export type LocalDatasetExploration = {
  id: string                          // PK
  dataset_id: string                  // Index
  version_id: string | null
  title: string
  chart_type: string
  config: Record<string, unknown>
  thumbnail_path: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  _synced_at: string
}

export type LocalAnalysisRun = {
  id: string                          // PK
  project_id: string                  // Index
  dataset_id: string | null           // Index
  version_id: string | null
  analysis_type: string
  title: string | null
  config: Record<string, unknown>
  results: Record<string, unknown> | null
  chart_config: Record<string, unknown> | null
  status: string
  error_message: string | null
  created_by: string
  created_at: string
  updated_at: string
  _synced_at: string
}

export type LocalDocument = {
  id: string                          // PK
  project_id: string                  // Index
  title: string
  content: Record<string, unknown> | null
  status: string
  document_type: string
  current_version: number
  created_by: string
  created_at: string
  updated_at: string
  _local_draft: boolean               // true = edited offline, not yet synced
  _synced_at: string
}

export type LocalProfile = {
  id: string                          // PK
  full_name: string | null
  role: string | null
  avatar_url: string | null
  _synced_at: string
}

// ─── Analysis job queue ───────────────────────────────────────────────────────
// Holds analyses queued while offline or while the network request failed.
// Jobs are dispatched in order when connectivity returns.

export type AnalysisJob = {
  id: string                          // PK (client-generated UUID)
  project_id: string                  // Index
  dataset_id: string
  version_id: string
  analysis_type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any
  status: 'queued' | 'dispatching' | 'running' | 'completed' | 'failed'
  run_id: string | null
  error: string | null
  queued_at: string
  dispatched_at: string | null
  completed_at: string | null
  created_by: string | null
}

// ─── Sync queue ───────────────────────────────────────────────────────────────

export type SyncQueueItem = {
  id?: number                         // auto-increment PK
  table_name: string
  operation: 'insert' | 'update' | 'delete' | 'upsert'
  record_id: string
  payload: Record<string, unknown>
  created_at: string
  attempts: number
  last_error: string | null
  status: 'pending' | 'processing' | 'failed'
}

// ─── Database class ───────────────────────────────────────────────────────────

export class PlexusOfflineDB extends Dexie {
  projects!: Table<LocalProject>
  datasets!: Table<LocalDataset>
  dataset_versions!: Table<LocalDatasetVersion>
  dataset_branches!: Table<LocalDatasetBranch>
  dataset_explorations!: Table<LocalDatasetExploration>
  analysis_runs!: Table<LocalAnalysisRun>
  analysis_jobs!: Table<AnalysisJob>
  documents!: Table<LocalDocument>
  profiles!: Table<LocalProfile>
  sync_queue!: Table<SyncQueueItem>

  constructor() {
    super('plexus_offline')

    this.version(1).stores({
      projects:             'id, owner_id, status, updated_at',
      datasets:             'id, project_id, archived_at, updated_at',
      dataset_versions:     'id, dataset_id, version_number',
      dataset_branches:     'id, dataset_id, is_default',
      dataset_explorations: 'id, dataset_id, version_id',
      analysis_runs:        'id, project_id, dataset_id, status',
      documents:            'id, project_id, status, _local_draft',
      profiles:             'id',
      sync_queue:           '++id, table_name, status, created_at',
    })

    this.version(2).stores({
      projects:             'id, owner_id, status, updated_at',
      datasets:             'id, project_id, archived_at, updated_at',
      dataset_versions:     'id, dataset_id, version_number',
      dataset_branches:     'id, dataset_id, is_default',
      dataset_explorations: 'id, dataset_id, version_id',
      analysis_runs:        'id, project_id, dataset_id, status',
      analysis_jobs:        'id, project_id, status, queued_at',
      documents:            'id, project_id, status, _local_draft',
      profiles:             'id',
      sync_queue:           '++id, table_name, status, created_at',
    })
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _db: PlexusOfflineDB | null = null

export function getDB(): PlexusOfflineDB {
  if (typeof window === 'undefined') {
    throw new Error('getDB() called in server context. Use only in client components.')
  }
  if (!_db) _db = new PlexusOfflineDB()
  return _db
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function now(): string {
  return new Date().toISOString()
}

export function isStale(synced_at: string, maxAgeMinutes = 60): boolean {
  return Date.now() - new Date(synced_at).getTime() > maxAgeMinutes * 60_000
}
