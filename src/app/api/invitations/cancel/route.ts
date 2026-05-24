import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/invitations/cancel?invitation_id=
// Inviter cancels a pending workspace invitation they sent (e.g. an
// email-invite for a supervisor that hasn't been accepted yet). RLS already
// scopes deletion to invited_by = auth.uid().
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const invitation_id = new URL(req.url).searchParams.get('invitation_id')
  if (!invitation_id) return NextResponse.json({ error: 'invitation_id required' }, { status: 400 })

  const { error, count } = await supabase
    .from('workspace_invitations')
    .delete({ count: 'exact' })
    .eq('id', invitation_id)
    .eq('invited_by', user.id)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!count) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })

  return NextResponse.json({ success: true })
}
