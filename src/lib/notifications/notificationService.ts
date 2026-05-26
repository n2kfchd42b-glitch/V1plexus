import type { SupabaseClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/data'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://plexus.science'

function buildNotificationEmail(title: string, body: string, link: string): string {
  const fullLink = link.startsWith('http') ? link : `${appUrl}${link}`
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#111827;">
      <div style="margin-bottom:32px;">
        <span style="font-size:22px;font-weight:700;color:#4338CA;">PLEXUS</span>
      </div>
      <h1 style="font-size:20px;font-weight:700;margin:0 0 10px;">${title}</h1>
      <p style="font-size:15px;color:#374151;margin:0 0 24px;">${body}</p>
      <a href="${fullLink}"
        style="display:inline-block;padding:12px 28px;background:#4338CA;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">
        View on Plexus
      </a>
      <p style="margin-top:28px;font-size:12px;color:#9CA3AF;">
        Or paste this link in your browser:<br/>
        <a href="${fullLink}" style="color:#6B7280;word-break:break-all;">${fullLink}</a>
      </p>
      <hr style="border:none;border-top:1px solid #E5E7EB;margin:32px 0 20px;" />
      <p style="font-size:11px;color:#9CA3AF;margin:0;">
        Plexus Research Platform &mdash; You received this because you are involved in this research activity.
      </p>
    </div>
  `
}

/**
 * Read the user's notification preferences. Missing row = default
 * (instant email + in-app), matching the behaviour before the
 * preferences table existed.
 *
 * Returned `digest_frequency`:
 *   instant — send email immediately (default)
 *   off     — in-app only, never email
 *   daily   — currently treated as 'instant' (digest flush job is a
 *             future PR). Documented so the field round-trips correctly
 *             once the flush exists.
 *   weekly  — same as 'daily' for now
 */
async function readDigestFrequency(
  supabase: SupabaseClient,
  user_id: string,
): Promise<'instant' | 'daily' | 'weekly' | 'off'> {
  try {
    const { data } = await supabase
      .from('notification_preferences')
      .select('digest_frequency')
      .eq('user_id', user_id)
      .maybeSingle()
    return (data?.digest_frequency as 'instant' | 'daily' | 'weekly' | 'off' | undefined) ?? 'instant'
  } catch {
    return 'instant'
  }
}

/**
 * Send a notification to a user.
 * When recipientEmail is provided, also sends an email via Resend — subject
 * to the recipient's notification_preferences. The in-app notification is
 * always created regardless of digest preference; only email delivery is
 * gated. Never throws — notification failures are non-blocking.
 */
export async function sendNotification(
  user_id: string,
  type: string,
  title: string,
  body: string,
  link: string,
  metadata: Record<string, unknown>,
  supabase: SupabaseClient,
  recipientEmail?: string
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

  if (!recipientEmail || !resend) return

  const frequency = await readDigestFrequency(supabase, user_id)
  if (frequency === 'off') return
  // 'daily' / 'weekly' currently send instantly — when the digest flush
  // job ships, branch here to enqueue instead.

  try {
    await resend.emails.send({
      from: 'Plexus <notifications@plexus.science>',
      to: recipientEmail,
      subject: title,
      html: buildNotificationEmail(title, body, link),
    })
  } catch (err) {
    console.error('Email notification failed:', err)
  }
}

/**
 * Notify all active supervisor members of a workspace.
 * Also emails each supervisor when their email is available.
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
      .select('user_id, profile:profiles!user_id(email)')
      .eq('workspace_id', workspace_id)
      .eq('role', 'supervisor')
      .eq('status', 'active')

    if (!supervisors?.length) return

    await Promise.all(
      supervisors.map((s) => {
        const profile = s.profile as { email?: string } | null
        return sendNotification(s.user_id, type, title, body, link, metadata, supabase, profile?.email)
      })
    )
  } catch (err) {
    console.error('Supervisor notification failed:', err)
  }
}
