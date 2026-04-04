import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { sendNotification } from '@/lib/notifications/notificationService'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, email, role, workspaceId, projectId, departmentId, message, workspaceName, projectTitle } = body

    if (!type || !email || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Service client to bypass RLS for cross-user operations (notifications)
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Look up inviter's name for the email copy
    const { data: inviterProfile } = await serviceClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const inviterName = inviterProfile?.full_name ?? inviterProfile?.email ?? 'A colleague'

    const token = crypto.randomUUID().replace(/-/g, '')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://plexus.app'
    const inviteLink = `${appUrl}/invite/${token}`
    const normalizedEmail = email.trim().toLowerCase()

    // Insert into the correct invitations table
    if (type === 'workspace') {
      if (!workspaceId) {
        return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })
      }
      const { error: insertError } = await serviceClient
        .from('workspace_invitations')
        .insert({
          workspace_id: workspaceId,
          email: normalizedEmail,
          role,
          department_id: departmentId || null,
          token,
          invited_by: user.id,
          status: 'pending',
        })
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    } else if (type === 'project') {
      if (!projectId) {
        return NextResponse.json({ error: 'projectId required' }, { status: 400 })
      }
      const { error: insertError } = await serviceClient
        .from('project_invitations')
        .insert({
          project_id: projectId,
          email: normalizedEmail,
          role,
          message: message || null,
          token,
          invited_by: user.id,
          status: 'pending',
        })
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: 'Invalid invitation type' }, { status: 400 })
    }

    // Send email via Resend
    const resourceName = type === 'workspace' ? workspaceName : projectTitle
    const roleLabel = (role as string).replace(/_/g, ' ')

    await resend.emails.send({
      from: 'Plexus <invitations@plexus.science>',
      to: normalizedEmail,
      subject: `${inviterName} invited you to ${resourceName} on Plexus`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#111827;">
          <div style="margin-bottom:32px;">
            <span style="font-size:22px;font-weight:700;color:#1D4ED8;">PLEXUS</span>
          </div>
          <h1 style="font-size:22px;font-weight:700;margin:0 0 12px;">You've been invited</h1>
          <p style="font-size:15px;color:#374151;margin:0 0 8px;">
            <strong>${inviterName}</strong> has invited you to join
            <strong>${resourceName}</strong> as a <strong>${roleLabel}</strong>.
          </p>
          ${message ? `
          <div style="margin:20px 0;padding:14px 16px;background:#F0F7FF;border-left:3px solid #3B82F6;border-radius:4px;font-size:14px;color:#374151;">
            ${message}
          </div>` : ''}
          <a href="${inviteLink}"
            style="display:inline-block;margin-top:28px;padding:12px 28px;background:#2563EB;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">
            Accept Invitation
          </a>
          <p style="margin-top:28px;font-size:12px;color:#9CA3AF;">
            Or paste this link in your browser:<br/>
            <a href="${inviteLink}" style="color:#6B7280;word-break:break-all;">${inviteLink}</a>
          </p>
          <hr style="border:none;border-top:1px solid #E5E7EB;margin:32px 0 20px;" />
          <p style="font-size:11px;color:#9CA3AF;margin:0;">
            Plexus Research Platform &mdash; You received this because someone invited you.
          </p>
        </div>
      `,
    })

    // In-app notification if the invited person already has an account
    const { data: existingUser } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingUser) {
      const notifTitle = type === 'workspace'
        ? `You've been invited to ${resourceName}`
        : `You've been invited to collaborate on ${resourceName}`
      await sendNotification(
        existingUser.id,
        'invitation_received',
        notifTitle,
        `${inviterName} invited you as ${roleLabel}`,
        `/invite/${token}`,
        {
          resource_type: type,
          resource_id: type === 'workspace' ? workspaceId : projectId,
        },
        serviceClient
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Invitation send error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
