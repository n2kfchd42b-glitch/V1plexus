// Write queue for offline mutations.
// Pending items are replayed oldest-first when connectivity returns.
// Max 5 attempts per item; failed items are marked and surfaced in SyncStatusIndicator.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getDB, now } from './db'
import type { SyncQueueItem } from './db'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SC = SupabaseClient<any>

// ─── Enqueue ──────────────────────────────────────────────────────────────────

export async function enqueueWrite(
  table_name: string,
  operation: SyncQueueItem['operation'],
  record_id: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const db = getDB()
    await db.sync_queue.add({
      table_name,
      operation,
      record_id,
      payload,
      created_at: now(),
      attempts: 0,
      last_error: null,
      status: 'pending',
    })
  } catch (err) {
    console.error('Failed to enqueue write:', err)
    // Non-blocking — caller is not informed; data is saved locally regardless
  }
}

// ─── Process queue ────────────────────────────────────────────────────────────

// Track concurrent calls — processSyncQueue is idempotent and safe to call many times
let _processing = false

export async function processSyncQueue(
  supabase: SC
): Promise<{ processed: number; failed: number }> {
  if (!navigator.onLine || _processing) return { processed: 0, failed: 0 }

  _processing = true
  const db = getDB()
  let processed = 0
  let failed = 0

  try {
    // Oldest-first so operations replay in the order they were made
    const pending = await db.sync_queue
      .where('status').equals('pending')
      .sortBy('created_at')

    for (const item of pending) {
      await db.sync_queue.update(item.id!, { status: 'processing' })

      try {
        await executeQueueItem(supabase, item)
        await db.sync_queue.delete(item.id!)
        processed++
      } catch (err) {
        const attempts = item.attempts + 1
        if (attempts >= 5) {
          await db.sync_queue.update(item.id!, {
            status: 'failed',
            attempts,
            last_error: String(err),
          })
          failed++
        } else {
          await db.sync_queue.update(item.id!, {
            status: 'pending',
            attempts,
            last_error: String(err),
          })
        }
      }
    }
  } finally {
    _processing = false
  }

  return { processed, failed }
}

// ─── Execute single item ──────────────────────────────────────────────────────

async function executeQueueItem(supabase: SC, item: SyncQueueItem): Promise<void> {
  const { table_name, operation, payload, record_id } = item

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = supabase.from(table_name as any)

  switch (operation) {
    case 'insert': {
      const { error } = await table.insert(payload as never)
      if (error) throw error
      break
    }
    case 'update': {
      const { error } = await table.update(payload as never).eq('id', record_id)
      if (error) throw error
      break
    }
    case 'upsert': {
      const { error } = await table.upsert(payload as never)
      if (error) throw error
      break
    }
    case 'delete': {
      const { error } = await table.delete().eq('id', record_id)
      if (error) throw error
      break
    }
    default:
      throw new Error(`Unknown operation: ${operation}`)
  }
}

// ─── Queue status ─────────────────────────────────────────────────────────────

export async function getQueueStatus(): Promise<{
  pending: number
  failed: number
  total: number
}> {
  try {
    const db = getDB()
    const [pending, failed] = await Promise.all([
      db.sync_queue.where('status').equals('pending').count(),
      db.sync_queue.where('status').equals('failed').count(),
    ])
    return { pending, failed, total: pending + failed }
  } catch {
    return { pending: 0, failed: 0, total: 0 }
  }
}

export async function getPendingCount(): Promise<number> {
  const { total } = await getQueueStatus()
  return total
}

// ─── Retry failed ─────────────────────────────────────────────────────────────

export async function retryFailed(supabase: SC): Promise<void> {
  try {
    const db = getDB()
    await db.sync_queue
      .where('status').equals('failed')
      .modify({ status: 'pending', attempts: 0, last_error: null })
    await processSyncQueue(supabase)
  } catch (err) {
    console.error('retryFailed error:', err)
  }
}
