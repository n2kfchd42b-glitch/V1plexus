import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateVerificationToken } from '@/lib/verification/tokenService'
import { writeAuditEntry } from '@/lib/audit/auditLogger'
import { checkRateLimit } from '@/lib/rateLimit'

/**
 * POST /api/verify/token
 * Authenticated. Creates a verification token via Supabase directly.
 */
export async function POST(request: NextRequest) {
  // 20 tokens per hour per IP
  const rateLimitResponse = checkRateLimit(request, { limit: 20, windowMs: 60 * 60 * 1000 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      project_id,
      dataset_id,
      version_id,
      access_level = 'summary',
      restricted_to_email,
      expires_days = 365,
    } = body

    if (!project_id || !dataset_id || !version_id) {
      return NextResponse.json(
        { error: 'project_id, dataset_id, and version_id are required' },
        { status: 400 }
      )
    }

    // Verify user has project access (owner or member)
    const { data: project } = await supabase
      .from('projects')
      .select('id, owner_id')
      .eq('id', project_id)
      .single()

    const isOwner = project?.owner_id === user.id

    if (!isOwner) {
      const { data: member } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', project_id)
        .eq('user_id', user.id)
        .single()

      if (!member) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const token = generateVerificationToken()

    // Hash the token before storing in audit logs so plaintext never appears there
    const tokenHashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
    const tokenHash = Array.from(new Uint8Array(tokenHashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('')

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + (expires_days || 365))

    const tokenRecord: Record<string, unknown> = {
      resource_type: 'dataset_lineage',
      resource_id: version_id,
      project_id,
      token,
      access_level: access_level || 'summary',
      created_by: user.id,
      expires_at: expiresAt.toISOString(),
      view_count: 0,
    }

    if (restricted_to_email) {
      tokenRecord.restricted_to_email = restricted_to_email
    }

    const service = createServiceClient()
    const { data: inserted, error: insertError } = await service
      .from('verification_tokens')
      .insert(tokenRecord)
      .select()
      .single()

    if (insertError) {
      console.error('[POST /api/verify/token] insert error', {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
      })
      return NextResponse.json({ error: 'Failed to create token' }, { status: 500 })
    }

    // Write audit entry with hash chain
    await writeAuditEntry(
      {
        actor_id: user.id,
        action: 'dataset.verification.token_created',
        resource_type: 'dataset',
        resource_id: dataset_id,
        project_id,
        details: {
          summary: `Verification token created (hash: ${tokenHash.slice(0, 12)}...)`,
          operation: {
            token_hash: tokenHash,
            access_level,
            expires_at: expiresAt.toISOString(),
            version_id,
          },
        },
      },
      supabase
    )

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const verify_url = `${baseUrl}/verify?token=${token}`

    return NextResponse.json({
      token,
      verify_url,
      expires_at: expiresAt.toISOString(),
      access_level,
      id: inserted.id,
      record: inserted,
    })
  } catch (err) {
    console.error('[POST /api/verify/token]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
