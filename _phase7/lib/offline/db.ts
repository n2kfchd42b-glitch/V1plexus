import Dexie, { type Table } from 'dexie'

export interface OfflineProject {
  id: string
  title: string
  description: string | null
  phase: string | null
  status: string
  owner_id: string
  updated_at: string
}

export interface OfflineDocument {
  id: string
  project_id: string
  title: string
  doc_type: string
  content: unknown
  status: string
  updated_at: string
}

export interface OfflineDataset {
  id: string
  project_id: string
  name: string
  description: string | null
  source: string
  row_count: number
  column_count: number
  updated_at: string
}

export interface OfflineDatasetCache {
  id: string
  dataset_id: string
  version_id: string
  data: unknown[]
}

export interface OfflineMilestone {
  id: string
  project_id: string
  title: string
  status: string
  due_date: string | null
}

export interface OfflineNotification {
  id: string
  title: string
  body: string | null
  type: string
  is_read: boolean
  created_at: string
}

export interface OfflineQueueItem {
  id: string
  timestamp: number
  action: 'insert' | 'update' | 'delete'
  table: string
  payload: Record<string, unknown>
  status: 'pending' | 'synced' | 'failed' | 'conflict'
  error?: string
}

export interface SyncMetadata {
  table_name: string
  last_synced_at: string
}

class PlexusOfflineDB extends Dexie {
  projects!: Table<OfflineProject>
  documents!: Table<OfflineDocument>
  datasets!: Table<OfflineDataset>
  dataset_cache!: Table<OfflineDatasetCache>
  milestones!: Table<OfflineMilestone>
  notifications!: Table<OfflineNotification>
  offline_queue!: Table<OfflineQueueItem>
  sync_metadata!: Table<SyncMetadata>

  constructor() {
    super('plexus_offline')
    this.version(1).stores({
      projects: 'id, status, owner_id, updated_at',
      documents: 'id, project_id, doc_type, status, updated_at',
      datasets: 'id, project_id, source, updated_at',
      dataset_cache: 'id, dataset_id, version_id',
      milestones: 'id, project_id, status',
      notifications: 'id, type, is_read, created_at',
      offline_queue: 'id, timestamp, status, table',
      sync_metadata: 'table_name',
    })
  }
}

let _db: PlexusOfflineDB | null = null

export function getOfflineDB(): PlexusOfflineDB {
  if (!_db) {
    _db = new PlexusOfflineDB()
  }
  return _db
}
