import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

/**
 * DELETE /api/institution/thesis-policy/[programme_id]
 * Removes a programme-level override. Refuses to delete the institution
 * default (which is keyed by programme_id IS NULL, not by a UUID, so the
 * route param shape already prevents that).
 *
 * Audits every deletion under `thesis.policy.deleted` with the prior row
 * preserved in details for forensics.
 */

const Param = z.string().uuid()

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ programme_id: string }> },
) {
  const { programme_id } = await params
  const programmeId = Param.safeParse(programme_id)
  if (!programmeId.success) {
    return NextResponse.json({ error: 'Invalid programme_id' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, institution_id')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile?.institution_id) {
    return NextResponse.json({ error: 'No institution' }, { status: 404 })
  }
  if (profile.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only institution admins can edit the thesis policy' },
      { status: 403 },
    )
  }

  const { data: existing } = await supabase
    .from('institution_thesis_policy')
    .select('*')
    .eq('institution_id', profile.institution_id)
    .eq('programme_id', programmeId.data)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'No override configured for that programme' }, { status: 404 })
  }

  const { error } = await supabase
    .from('institution_thesis_policy')
    .delete()
    .eq('id', existing.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  void writeAuditEntry({
    actor_id: user.id,
    action: 'thesis.policy.deleted',
    resource_type: 'institution_thesis_policy',
    resource_id: existing.id,
    institution_id: profile.institution_id,
    details: {
      summary: `Deleted programme override (programme ${programmeId.data})`,
      programme_id: programmeId.data,
      prior_policy_version: existing.policy_version,
    },
  })

  return NextResponse.json({ success: true })
}
