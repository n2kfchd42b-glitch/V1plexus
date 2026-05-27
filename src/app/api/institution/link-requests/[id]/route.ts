import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { linkUserToInstitution } from '@/lib/institutionLinking'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * Admin approve / decline endpoint for an institution_link_requests row.
 * The caller must be an admin or coordinator of the same institution as the
 * request. On approve, the user's profile.institution_id is set and a
 * workspace_memberships row is upserted in the institutional workspace.
 */

const bodySchema = z.object({
  action: z.enum(['approve', 'decline']),
  decline_reason: z.string().trim().max(500).optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('id, role, institution_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!callerProfile?.institution_id) {
    return NextResponse.json({ error: 'No institution' }, { status: 404 })
  }
  if (callerProfile.role !== 'admin' && callerProfile.role !== 'coordinator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data: requestRow, error: reqErr } = await svc
    .from('institution_link_requests')
    .select('id, user_id, institution_id, status, institution:institutions(id, name)')
    .eq('id', id)
    .maybeSingle()

  if (reqErr || !requestRow) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }
  if (requestRow.institution_id !== callerProfile.institution_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (requestRow.status !== 'pending') {
    return NextResponse.json({ error: `Request is already ${requestRow.status}` }, { status: 409 })
  }

  if (parsed.data.action === 'approve') {
    // Reject if the user is meanwhile linked to a different institution.
    const { data: targetProfile } = await svc
      .from('profiles')
      .select('id, institution_id, full_name, email')
      .eq('id', requestRow.user_id)
      .maybeSingle()

    if (targetProfile?.institution_id && targetProfile.institution_id !== requestRow.institution_id) {
      return NextResponse.json(
        { error: 'User is linked to a different institution. Ask them to unlink first.' },
        { status: 409 },
      )
    }

    const linked = await linkUserToInstitution({
      svc,
      userId: requestRow.user_id,
      institutionId: requestRow.institution_id,
      decidedBy: user.id,
      autoApproved: false,
      requestId: requestRow.id,
    })

    if ('error' in linked) {
      return NextResponse.json({ error: linked.error }, { status: 500 })
    }

    const institutionName = (requestRow.institution as { name?: string } | null)?.name ?? 'institution'
    void writeAuditEntry({
      actor_id: user.id,
      action: 'institution.link.approved',
      resource_type: 'institution',
      resource_id: requestRow.institution_id,
      institution_id: requestRow.institution_id,
      details: {
        summary: `Approved link request for ${targetProfile?.full_name ?? targetProfile?.email ?? requestRow.user_id} → ${institutionName}`,
        request_id: requestRow.id,
        target_user_id: requestRow.user_id,
      },
    })

    return NextResponse.json({ success: true, status: 'approved' })
  }

  // decline
  const { error: declineErr } = await svc
    .from('institution_link_requests')
    .update({
      status: 'declined',
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      decline_reason: parsed.data.decline_reason?.trim() || null,
    })
    .eq('id', requestRow.id)
    .eq('status', 'pending')

  if (declineErr) {
    return NextResponse.json({ error: declineErr.message }, { status: 500 })
  }

  void writeAuditEntry({
    actor_id: user.id,
    action: 'institution.link.declined',
    resource_type: 'institution',
    resource_id: requestRow.institution_id,
    institution_id: requestRow.institution_id,
    details: {
      summary: `Declined link request ${requestRow.id}`,
      request_id: requestRow.id,
      target_user_id: requestRow.user_id,
      reason: parsed.data.decline_reason?.trim() || null,
    },
  })

  return NextResponse.json({ success: true, status: 'declined' })
}
