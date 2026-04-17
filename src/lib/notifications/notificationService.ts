import type { SupabaseClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/data'

/**
 * Send a notification to a user.
 * Never throws — notification failures are non-blocking.
 */
export async function sendNotification(
  user_id: string,
  type: string,
  title: string,
  body: string,
  link: string,
  metadata: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<void> {
  try {
    await createNotification(supabase, {
      user_id,
      type,
      title,
      body,
      resource_type: metadata.resource_type as string | undefined ?? null,
      resource_id: metadata.resource_id as string | undefined ?? null,
      link,
      metadata,
      is_read: false,
    })
  } catch (err) {
    console.error('Notification failed:', err)
  }
}

/**
 * Notify all active supervisor members of a workspace.
 * Used when assigned_supervisor is null (any supervisor can review).
 */
export async function notifyWorkspaceSupervisors(
  workspace_id: string,
  type: string,
  title: string,
  body: string,
  link: string,
  metadata: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<void> {
  try {
    const { data: supervisors } = await supabase
      .from('workspace_memberships')
      .select('user_id')
      .eq('workspace_id', workspace_id)
      .eq('role', 'supervisor')
      .eq('status', 'active')

    if (!supervisors?.length) return

    await Promise.all(
      supervisors.map((s) =>
        sendNotification(s.user_id, type, title, body, link, metadata, supabase)
      )
    )
  } catch (err) {
    console.error('Supervisor notification failed:', err)
  }
}
