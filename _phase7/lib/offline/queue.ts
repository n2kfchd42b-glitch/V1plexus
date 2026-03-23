import { getOfflineDB, type OfflineQueueItem } from './db'
import { createClient } from '@/lib/supabase/client'

export async function enqueueOfflineMutation(
  action: 'insert' | 'update' | 'delete',
  table: string,
  payload: Record<string, unknown>
): Promise<void> {
  const db = getOfflineDB()
  const item: OfflineQueueItem = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    action,
    table,
    payload,
    status: 'pending',
  }
  await db.offline_queue.add(item)
}

export async function syncOfflineQueue(): Promise<{
  synced: number
  failed: number
}> {
  const db = getOfflineDB()
  const supabase = createClient()
  let synced = 0
  let failed = 0

  const pending = await db.offline_queue
    .where('status')
    .equals('pending')
    .sortBy('timestamp')

  for (const mutation of pending) {
    try {
      if (mutation.action === 'insert') {
        const { error } = await supabase.from(mutation.table).insert(mutation.payload)
        if (error) throw error
      } else if (mutation.action === 'update') {
        const { id, ...rest } = mutation.payload
        const { error } = await supabase.from(mutation.table).update(rest).eq('id', id)
        if (error) throw error
      } else if (mutation.action === 'delete') {
        const { error } = await supabase.from(mutation.table).delete().eq('id', mutation.payload.id)
        if (error) throw error
      }
      await db.offline_queue.update(mutation.id, { status: 'synced' })
      synced++
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      await db.offline_queue.update(mutation.id, { status: 'failed', error: msg })
      failed++
    }
  }

  return { synced, failed }
}

export async function getPendingCount(): Promise<number> {
  const db = getOfflineDB()
  return db.offline_queue.where('status').equals('pending').count()
}

export async function getQueueItems(): Promise<OfflineQueueItem[]> {
  const db = getOfflineDB()
  return db.offline_queue.orderBy('timestamp').reverse().toArray()
}

export async function clearSyncedItems(): Promise<void> {
  const db = getOfflineDB()
  await db.offline_queue.where('status').equals('synced').delete()
}
