// Offline-aware wrappers around lib/data/ functions.
// Pattern: online → call Supabase, store result in IndexedDB, return data.
//          offline → read IndexedDB, return cached data with stale flag.
// Never throws — returns structured OfflineResult<T> on all paths.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getAllProjects,
  getProject,
  getActiveProjectDatasets,
  getArchivedProjectDatasets,
  getDataset,
  getVersionsByDatasetIds,
  getDatasetBranches,
  getDatasetExplorations,
  getProjectAnalysisRuns,
  getCompletedProjectAnalysisRuns,
  getProjectDocuments,
  getDocument,
  getProfile,
  getDatasetProjectIds,
  getAnalysisRunProjectIds,
} from '@/lib/data'
import { getDB, now, isStale } from './db'
import type {
  LocalProject,
  LocalDataset,
  LocalDatasetVersion,
  LocalDatasetBranch,
  LocalDatasetExploration,
  LocalAnalysisRun,
  LocalDocument,
  LocalProfile,
} from './db'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SC = SupabaseClient<any>

// ─── Return type ─────────────────────────────────────────────────────────────

export type OfflineResult<T> = {
  data: T | null
  error: string | null
  source: 'network' | 'cache' | 'error'
  stale?: boolean
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function getProjectsOffline(
  supabase: SC
): Promise<OfflineResult<LocalProject[]>> {
  const db = getDB()

  if (navigator.onLine) {
    try {
      const projectsResult = await getAllProjects(supabase)
      if (projectsResult.status === 'error') {
        throw new Error(projectsResult.error ?? 'Failed to fetch projects')
      }

      const rows = projectsResult.data
      if (!rows.length) return { data: [], error: null, source: 'network' }

      const ids = rows.map(p => p.id)
      const [datasetsResult, runsResult] = await Promise.all([
        getDatasetProjectIds(supabase, ids),
        getAnalysisRunProjectIds(supabase, ids),
      ])

      const datasetCountMap: Record<string, number> = {}
      const runCountMap: Record<string, number> = {}
      for (const d of datasetsResult.data) datasetCountMap[d.project_id] = (datasetCountMap[d.project_id] ?? 0) + 1
      for (const r of runsResult.data) runCountMap[r.project_id] = (runCountMap[r.project_id] ?? 0) + 1

      const locals: LocalProject[] = rows.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        owner_id: p.owner_id,
        status: p.status,
        created_at: p.created_at,
        updated_at: p.updated_at,
        dataset_count: datasetCountMap[p.id] ?? 0,
        run_count: runCountMap[p.id] ?? 0,
        _synced_at: now(),
      }))

      await db.projects.bulkPut(locals)
      return { data: locals, error: null, source: 'network' }
    } catch {
      // Network failed — fall through to cache
    }
  }

  try {
    const cached = await db.projects.toArray()
    if (!cached.length) return { data: null, error: 'Projects not available offline', source: 'error' }
    return {
      data: cached,
      error: null,
      source: 'cache',
      stale: cached.some(p => isStale(p._synced_at)),
    }
  } catch {
    return { data: null, error: 'Local storage error', source: 'error' }
  }
}

export async function getProjectOffline(
  supabase: SC,
  id: string
): Promise<OfflineResult<LocalProject>> {
  const db = getDB()

  if (navigator.onLine) {
    try {
      const result = await getProject(supabase, id)
      if (result.status === 'error' || !result.data) throw new Error(result.error ?? 'Not found')

      const p = result.data
      const [datasetsResult, runsResult] = await Promise.all([
        getDatasetProjectIds(supabase, [id]),
        getAnalysisRunProjectIds(supabase, [id]),
      ])

      const local: LocalProject = {
        id: p.id,
        title: p.title,
        description: p.description,
        owner_id: p.owner_id,
        status: p.status,
        created_at: p.created_at,
        updated_at: p.updated_at,
        dataset_count: datasetsResult.data.length,
        run_count: runsResult.data.length,
        _synced_at: now(),
      }

      await db.projects.put(local)
      return { data: local, error: null, source: 'network' }
    } catch {
      // Fall through to cache
    }
  }

  try {
    const cached = await db.projects.get(id)
    if (!cached) return { data: null, error: 'Project not available offline', source: 'error' }
    return { data: cached, error: null, source: 'cache', stale: isStale(cached._synced_at) }
  } catch {
    return { data: null, error: 'Local storage error', source: 'error' }
  }
}

// ─── Datasets ─────────────────────────────────────────────────────────────────

export async function getActiveProjectDatasetsOffline(
  supabase: SC,
  projectId: string
): Promise<OfflineResult<LocalDataset[]>> {
  const db = getDB()

  if (navigator.onLine) {
    try {
      const result = await getActiveProjectDatasets(supabase, projectId)
      if (result.status === 'error') throw new Error(result.error ?? 'Failed')

      const locals: LocalDataset[] = (result.data ?? []).map(d => ({
        id: d.id,
        project_id: d.project_id,
        name: d.name,
        description: d.description,
        source: d.source,
        parent_id: d.parent_id,
        uploaded_by: d.uploaded_by,
        created_at: d.created_at,
        updated_at: d.updated_at,
        deleted_at: d.deleted_at,
        archived_at: d.archived_at,
        _synced_at: now(),
      }))

      await db.datasets.bulkPut(locals)
      return { data: locals, error: null, source: 'network' }
    } catch {
      // Fall through
    }
  }

  try {
    const cached = await db.datasets
      .where('project_id').equals(projectId)
      .filter(d => !d.deleted_at && !d.archived_at)
      .toArray()
    return {
      data: cached,
      error: null,
      source: 'cache',
      stale: cached.some(d => isStale(d._synced_at)),
    }
  } catch {
    return { data: [], error: 'Local storage error', source: 'error' }
  }
}

export async function getArchivedProjectDatasetsOffline(
  supabase: SC,
  projectId: string
): Promise<OfflineResult<LocalDataset[]>> {
  const db = getDB()

  if (navigator.onLine) {
    try {
      const result = await getArchivedProjectDatasets(supabase, projectId)
      if (result.status === 'error') throw new Error(result.error ?? 'Failed')

      const locals: LocalDataset[] = (result.data ?? []).map(d => ({
        id: d.id,
        project_id: d.project_id,
        name: d.name,
        description: d.description,
        source: d.source,
        parent_id: d.parent_id,
        uploaded_by: d.uploaded_by,
        created_at: d.created_at,
        updated_at: d.updated_at,
        deleted_at: d.deleted_at,
        archived_at: d.archived_at,
        _synced_at: now(),
      }))

      await db.datasets.bulkPut(locals)
      return { data: locals, error: null, source: 'network' }
    } catch {
      // Fall through
    }
  }

  try {
    const cached = await db.datasets
      .where('project_id').equals(projectId)
      .filter(d => !d.deleted_at && !!d.archived_at)
      .toArray()
    return {
      data: cached,
      error: null,
      source: 'cache',
      stale: cached.some(d => isStale(d._synced_at)),
    }
  } catch {
    return { data: [], error: 'Local storage error', source: 'error' }
  }
}

export async function getDatasetOffline(
  supabase: SC,
  id: string
): Promise<OfflineResult<LocalDataset>> {
  const db = getDB()

  if (navigator.onLine) {
    try {
      const result = await getDataset(supabase, id)
      if (result.status === 'error' || !result.data) throw new Error(result.error ?? 'Not found')

      const d = result.data
      const local: LocalDataset = {
        id: d.id,
        project_id: d.project_id,
        name: d.name,
        description: d.description,
        source: d.source,
        parent_id: d.parent_id,
        uploaded_by: d.uploaded_by,
        created_at: d.created_at,
        updated_at: d.updated_at,
        deleted_at: d.deleted_at,
        archived_at: d.archived_at,
        _synced_at: now(),
      }

      await db.datasets.put(local)
      return { data: local, error: null, source: 'network' }
    } catch {
      // Fall through
    }
  }

  try {
    const cached = await db.datasets.get(id)
    if (!cached) return { data: null, error: 'Dataset not available offline', source: 'error' }
    return { data: cached, error: null, source: 'cache', stale: isStale(cached._synced_at) }
  } catch {
    return { data: null, error: 'Local storage error', source: 'error' }
  }
}

// ─── Dataset versions ─────────────────────────────────────────────────────────

export async function getVersionsByDatasetIdsOffline(
  supabase: SC,
  datasetIds: string[]
): Promise<OfflineResult<LocalDatasetVersion[]>> {
  const db = getDB()

  if (navigator.onLine) {
    try {
      const result = await getVersionsByDatasetIds(supabase, datasetIds)
      if (result.status === 'error') throw new Error(result.error ?? 'Failed')

      const locals: LocalDatasetVersion[] = (result.data ?? []).map(v => ({
        id: v.id,
        dataset_id: v.dataset_id,
        version_number: v.version_number,
        parent_version: v.parent_version,
        commit_message: v.commit_message,
        file_path: v.file_path,
        file_hash: v.file_hash,
        file_size: v.file_size,
        row_count: v.row_count,
        column_count: v.column_count,
        schema_info: (v.schema_info as unknown as Record<string, unknown>[]) ?? [],
        operations: (v.operations as unknown as Record<string, unknown>[]) ?? [],
        created_by: v.created_by,
        created_at: v.created_at,
        _synced_at: now(),
      }))

      await db.dataset_versions.bulkPut(locals)
      return { data: locals, error: null, source: 'network' }
    } catch {
      // Fall through
    }
  }

  try {
    const cached = await db.dataset_versions
      .where('dataset_id').anyOf(datasetIds)
      .toArray()
    return {
      data: cached,
      error: null,
      source: 'cache',
      stale: cached.some(v => isStale(v._synced_at)),
    }
  } catch {
    return { data: [], error: 'Local storage error', source: 'error' }
  }
}

// ─── Dataset branches ─────────────────────────────────────────────────────────

export async function getDatasetBranchesOffline(
  supabase: SC,
  datasetId: string
): Promise<OfflineResult<LocalDatasetBranch[]>> {
  const db = getDB()

  if (navigator.onLine) {
    try {
      const result = await getDatasetBranches(supabase, datasetId)
      if (result.status === 'error') throw new Error(result.error ?? 'Failed')

      const locals: LocalDatasetBranch[] = (result.data ?? []).map(b => ({
        id: b.id,
        dataset_id: b.dataset_id,
        name: b.name,
        head_version: b.head_version,
        is_default: b.is_default,
        created_by: b.created_by,
        created_at: b.created_at,
        updated_at: b.updated_at,
        _synced_at: now(),
      }))

      await db.dataset_branches.bulkPut(locals)
      return { data: locals, error: null, source: 'network' }
    } catch {
      // Fall through
    }
  }

  try {
    const cached = await db.dataset_branches.where('dataset_id').equals(datasetId).toArray()
    return { data: cached, error: null, source: 'cache', stale: cached.some(b => isStale(b._synced_at)) }
  } catch {
    return { data: [], error: 'Local storage error', source: 'error' }
  }
}

// ─── Dataset explorations ─────────────────────────────────────────────────────

export async function getDatasetExplorationsOffline(
  supabase: SC,
  datasetId: string
): Promise<OfflineResult<LocalDatasetExploration[]>> {
  const db = getDB()

  if (navigator.onLine) {
    try {
      const result = await getDatasetExplorations(supabase, datasetId)
      if (result.status === 'error') throw new Error(result.error ?? 'Failed')

      const locals: LocalDatasetExploration[] = (result.data ?? []).map(e => ({
        id: e.id,
        dataset_id: e.dataset_id,
        version_id: e.version_id,
        title: e.title,
        chart_type: e.chart_type,
        config: e.config as Record<string, unknown>,
        thumbnail_path: e.thumbnail_path,
        created_by: e.created_by,
        created_at: e.created_at,
        updated_at: e.updated_at,
        _synced_at: now(),
      }))

      await db.dataset_explorations.bulkPut(locals)
      return { data: locals, error: null, source: 'network' }
    } catch {
      // Fall through
    }
  }

  try {
    const cached = await db.dataset_explorations.where('dataset_id').equals(datasetId).toArray()
    return { data: cached, error: null, source: 'cache', stale: cached.some(e => isStale(e._synced_at)) }
  } catch {
    return { data: [], error: 'Local storage error', source: 'error' }
  }
}

// ─── Analysis runs ────────────────────────────────────────────────────────────

export async function getProjectAnalysisRunsOffline(
  supabase: SC,
  projectId: string
): Promise<OfflineResult<LocalAnalysisRun[]>> {
  const db = getDB()

  if (navigator.onLine) {
    try {
      const result = await getProjectAnalysisRuns(supabase, projectId)
      if (result.status === 'error') throw new Error(result.error ?? 'Failed')

      const locals: LocalAnalysisRun[] = (result.data ?? []).map(r => ({
        id: r.id,
        project_id: r.project_id,
        dataset_id: r.dataset_id,
        version_id: r.version_id,
        analysis_type: r.analysis_type,
        title: r.title,
        config: r.config,
        results: r.results,
        chart_config: r.chart_config,
        status: r.status,
        error_message: r.error_message,
        created_by: r.created_by,
        created_at: r.created_at,
        updated_at: r.updated_at,
        _synced_at: now(),
      }))

      await db.analysis_runs.bulkPut(locals)
      return { data: locals, error: null, source: 'network' }
    } catch {
      // Fall through
    }
  }

  try {
    const cached = await db.analysis_runs.where('project_id').equals(projectId).toArray()
    return { data: cached, error: null, source: 'cache', stale: cached.some(r => isStale(r._synced_at)) }
  } catch {
    return { data: [], error: 'Local storage error', source: 'error' }
  }
}

export async function getCompletedProjectAnalysisRunsOffline(
  supabase: SC,
  projectId: string
): Promise<OfflineResult<LocalAnalysisRun[]>> {
  const db = getDB()

  if (navigator.onLine) {
    try {
      const result = await getCompletedProjectAnalysisRuns(supabase, projectId)
      if (result.status === 'error') throw new Error(result.error ?? 'Failed')

      const locals: LocalAnalysisRun[] = (result.data ?? []).map(r => ({
        id: r.id,
        project_id: r.project_id,
        dataset_id: r.dataset_id,
        version_id: r.version_id,
        analysis_type: r.analysis_type,
        title: r.title,
        config: r.config,
        results: r.results,
        chart_config: r.chart_config,
        status: r.status,
        error_message: r.error_message,
        created_by: r.created_by,
        created_at: r.created_at,
        updated_at: r.updated_at,
        _synced_at: now(),
      }))

      await db.analysis_runs.bulkPut(locals)
      return { data: locals, error: null, source: 'network' }
    } catch {
      // Fall through
    }
  }

  try {
    const cached = await db.analysis_runs
      .where('project_id').equals(projectId)
      .filter(r => r.status === 'completed')
      .toArray()
    return { data: cached, error: null, source: 'cache', stale: cached.some(r => isStale(r._synced_at)) }
  } catch {
    return { data: [], error: 'Local storage error', source: 'error' }
  }
}

// ─── Documents ────────────────────────────────────────────────────────────────

// getProjectDocuments only selects id+title — store that minimal shape.
// Full document content is cached separately via getDocumentOffline.
export async function getProjectDocumentsOffline(
  supabase: SC,
  projectId: string
): Promise<OfflineResult<{ id: string; title: string }[]>> {
  const db = getDB()

  if (navigator.onLine) {
    try {
      const result = await getProjectDocuments(supabase, projectId)
      if (result.status === 'error') throw new Error(result.error ?? 'Failed')

      // Update title in any documents already cached for this project
      const stubs = result.data ?? []
      for (const stub of stubs) {
        const existing = await db.documents.get(stub.id)
        if (existing) {
          await db.documents.update(stub.id, { title: stub.title, _synced_at: now() })
        }
      }

      return { data: stubs, error: null, source: 'network' }
    } catch {
      // Fall through
    }
  }

  try {
    const cached = await db.documents.where('project_id').equals(projectId).toArray()
    return {
      data: cached.map(d => ({ id: d.id, title: d.title })),
      error: null,
      source: 'cache',
      stale: cached.some(d => isStale(d._synced_at, 24 * 60)),
    }
  } catch {
    return { data: [], error: 'Local storage error', source: 'error' }
  }
}

export async function getDocumentOffline(
  supabase: SC,
  id: string
): Promise<OfflineResult<LocalDocument>> {
  const db = getDB()

  if (navigator.onLine) {
    try {
      const result = await getDocument(supabase, id)
      if (result.status === 'error' || !result.data) throw new Error(result.error ?? 'Not found')

      const d = result.data
      const local: LocalDocument = {
        id: d.id,
        project_id: d.project_id,
        title: d.title,
        content: d.content,
        status: d.status,
        document_type: d.document_type,
        current_version: d.current_version,
        created_by: d.created_by,
        created_at: d.created_at,
        updated_at: d.updated_at,
        _local_draft: false,
        _synced_at: now(),
      }

      await db.documents.put(local)
      return { data: local, error: null, source: 'network' }
    } catch {
      // Fall through
    }
  }

  try {
    const cached = await db.documents.get(id)
    if (!cached) return { data: null, error: 'Document not available offline', source: 'error' }
    return { data: cached, error: null, source: 'cache', stale: isStale(cached._synced_at, 24 * 60) }
  } catch {
    return { data: null, error: 'Local storage error', source: 'error' }
  }
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export async function getProfileOffline(
  supabase: SC,
  id: string
): Promise<OfflineResult<LocalProfile>> {
  const db = getDB()

  if (navigator.onLine) {
    try {
      const result = await getProfile(supabase, id)
      if (result.status === 'error' || !result.data) throw new Error(result.error ?? 'Not found')

      const p = result.data
      const local: LocalProfile = {
        id: p.id,
        full_name: p.full_name,
        role: p.role,
        avatar_url: p.avatar_url ?? null,
        _synced_at: now(),
      }

      await db.profiles.put(local)
      return { data: local, error: null, source: 'network' }
    } catch {
      // Fall through
    }
  }

  try {
    const cached = await db.profiles.get(id)
    if (!cached) return { data: null, error: 'Profile not available offline', source: 'error' }
    return { data: cached, error: null, source: 'cache', stale: isStale(cached._synced_at) }
  } catch {
    return { data: null, error: 'Local storage error', source: 'error' }
  }
}
