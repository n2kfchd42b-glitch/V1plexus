// Offline-aware write helpers.
// Online: write to Supabase immediately, then update IndexedDB.
// Offline: write to IndexedDB immediately, enqueue for Supabase sync.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getDB, now } from './db'
import { enqueueWrite } from './syncQueue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SC = SupabaseClient<any>

export type WriteResult = {
  success: boolean
  queued: boolean
  error: string | null
}

// ─── Document saves ───────────────────────────────────────────────────────────

export async function saveDocumentOffline(
  supabase: SC,
  documentId: string,
  updates: {
    content?: Record<string, unknown>
    title?: string
    status?: string
    current_version?: number
    word_count?: number
  }
): Promise<WriteResult> {
  const db = getDB()

  // Optimistic local update — always write locally first so the UI stays responsive
  try {
    await db.documents.update(documentId, {
      ...updates,
      updated_at: now(),
      _local_draft: true,
    })
  } catch {
    // Document may not be in cache yet; sync will handle it
  }

  if (navigator.onLine) {
    try {
      const { error } = await supabase
        .from('documents')
        .update(updates)
        .eq('id', documentId)

      if (error) throw error

      await db.documents.update(documentId, {
        _local_draft: false,
        _synced_at: now(),
      })

      return { success: true, queued: false, error: null }
    } catch (err) {
      // Supabase write failed — queue it
      await enqueueWrite('documents', 'update', documentId, {
        id: documentId,
        ...updates,
      } as Record<string, unknown>)
      return { success: true, queued: true, error: null }
    }
  }

  // Offline — queue the write
  await enqueueWrite('documents', 'update', documentId, {
    id: documentId,
    ...updates,
  } as Record<string, unknown>)

  return { success: true, queued: true, error: null }
}

// ─── Project updates ──────────────────────────────────────────────────────────

export async function updateProjectOffline(
  supabase: SC,
  projectId: string,
  updates: {
    title?: string
    description?: string | null
    status?: string
  }
): Promise<WriteResult> {
  const db = getDB()

  // Optimistic local update
  try {
    await db.projects.update(projectId, {
      ...updates,
      updated_at: now(),
    })
  } catch {
    // Not in cache yet
  }

  if (navigator.onLine) {
    try {
      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)

      if (error) throw error

      await db.projects.update(projectId, { _synced_at: now() })
      return { success: true, queued: false, error: null }
    } catch (err) {
      await enqueueWrite('projects', 'update', projectId, {
        id: projectId,
        ...updates,
      } as Record<string, unknown>)
      return { success: true, queued: true, error: null }
    }
  }

  await enqueueWrite('projects', 'update', projectId, {
    id: projectId,
    ...updates,
  } as Record<string, unknown>)

  return { success: true, queued: true, error: null }
}
