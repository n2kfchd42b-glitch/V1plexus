import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { sendNotification } from '@/lib/notifications/notificationService'
import { checkRateLimit } from '@/lib/rateLimit'

// RFC 5321/5322-compatible email regex
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

export async function POST(request: NextRequest) {
  // 10 invitations per 15 minutes per IP
  const rateLimitResponse = checkRateLimit(request, { limit: 10, windowMs: 15 * 60 * 1000 })
  if (rateLimitResponse) return rateLimitResponse

  // Debug: Check if API key is loaded
  if (!process.env.RESEND_API_KEY) {
    console.error('[INVITATIONS] RESEND_API_KEY is not set')
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    console.log('[INVITATIONS] Request received')
    
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log('[INVITATIONS] Auth failed:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[INVITATIONS] User authenticated:', user.id)

    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('[INVITATIONS] Request body parsing error:', parseError)
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    
    const { type, email, role, workspaceId, projectId, departmentId, message, workspaceName, projectTitle } = body

    if (!type || !email || !role) {
      console.log('[INVITATIONS] Missing required fields:', { type, email, role })
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!EMAIL_REGEX.test(email)) {
      console.log('[INVITATIONS] Invalid email:', email)
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    // Service client to bypass RLS for cross-user operations (notifications)
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Look up inviter's name for the email copy
    console.log('[INVITATIONS] Looking up inviter profile for user:', user.id)
    const { data: inviterProfile, error: profileError } = await serviceClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[INVITATIONS] Profile lookup error:', profileError)
    }

    const inviterName = inviterProfile?.full_name ?? inviterProfile?.email ?? 'A colleague'
    console.log('[INVITATIONS] Inviter name:', inviterName)

    const token = crypto.randomUUID().replace(/-/g, '')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://plexus.science'
    const inviteLink = `${appUrl}/invite/${token}`
    const normalizedEmail = email.trim().toLowerCase()

    // Insert into the correct invitations table
    if (type === 'workspace') {
      if (!workspaceId) {
        console.log('[INVITATIONS] Missing workspaceId for workspace invitation')
        return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })
      }
      console.log('[INVITATIONS] Inserting workspace invitation for workspace:', workspaceId)
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
        console.error('[INVITATIONS] Workspace invitation insert error:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
      console.log('[INVITATIONS] Workspace invitation created successfully')
    } else if (type === 'project') {
      if (!projectId) {
        console.log('[INVITATIONS] Missing projectId for project invitation')
        return NextResponse.json({ error: 'projectId required' }, { status: 400 })
      }
      console.log('[INVITATIONS] Inserting project invitation for project:', projectId)
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
        console.error('[INVITATIONS] Project invitation insert error:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
      console.log('[INVITATIONS] Project invitation created successfully')
    } else {
      console.log('[INVITATIONS] Invalid invitation type:', type)
      return NextResponse.json({ error: 'Invalid invitation type' }, { status: 400 })
    }

    // Send email via Resend
    const resourceName = type === 'workspace' ? workspaceName : projectTitle
    const roleLabel = (role as string).replace(/_/g, ' ')

    console.log(`[INVITATIONS] Sending email to ${normalizedEmail} for ${type} "${resourceName}"`)

    const emailResponse = await resend.emails.send({
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

    if (emailResponse.error) {
      console.error('[INVITATIONS] Resend error:', emailResponse.error)
      return NextResponse.json({ error: `Failed to send invitation email: ${emailResponse.error.message}` }, { status: 500 })
    }

    console.log(`[INVITATIONS] Email sent successfully. Message ID: ${emailResponse.data?.id}`)


    // In-app notification if the invited person already has an account
    // Use case-insensitive profiles lookup via service role — avoids pagination limits
    const { data: existingProfile, error: profileLookupError } = await serviceClient
      .from('profiles')
      .select('id')
      .ilike('email', normalizedEmail)
      .maybeSingle()

    if (profileLookupError) {
      console.error('Profile lookup error:', profileLookupError)
    }

    if (existingProfile) {
      const notifTitle = type === 'workspace'
        ? `You've been invited to ${resourceName}`
        : `You've been invited to collaborate on ${resourceName}`
      try {
        await sendNotification(
          existingProfile.id,
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
      } catch (notifError) {
        console.error('Notification insert error:', notifError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[INVITATIONS] Unhandled error:', error instanceof Error ? error.message : String(error))
    if (error instanceof Error) {
      console.error('[INVITATIONS] Stack trace:', error.stack)
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
