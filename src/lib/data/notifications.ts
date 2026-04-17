/*
 * NOTIFICATIONS DATA ACCESS
 *
 * Replaces direct supabase.from('notifications') calls found in:
 *
 *   src/lib/notifications/notificationService.ts
 *     - insert notification (lines 17-27)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Notification, NotificationType } from '@/types/database'
import { DataResult, ok, err } from './types'

type NotificationInsert = {
  user_id: string
  type: NotificationType | string
  title: string
  body: string
  resource_type: string | null
  resource_id: string | null
  link: string
  metadata?: Record<string, unknown>
  is_read: boolean
}

// Replaces:
//   notificationService.ts — send notification
//   supabase.from('notifications').insert({ user_id, type, title, body, resource_type, resource_id, link, metadata, is_read })
export async function createNotification(
  supabase: SupabaseClient,
  input: NotificationInsert
): Promise<DataResult<null>> {
  const { error } = await supabase
    .from('notifications')
    .insert(input)
  if (error) return err(error.message)
  return ok(null)
}
