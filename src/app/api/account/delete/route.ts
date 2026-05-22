import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { writeAuditEntry } from '@/lib/audit/auditLogger'

export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const svc = createServiceClient()

    // Write audit entry BEFORE deletion — actor_id won't exist after the RPC runs
    await writeAuditEntry({
      actor_id: user.id,
      action: 'auth.account.deleted',
      resource_type: 'profile',
      resource_id: user.id,
      details: { summary: 'User initiated account deletion' },
    }, svc)

    // Calls the delete_user_account SQL function which handles all cleanup
    // and deletes directly from auth.users, bypassing GoTrue's own deletion
    // logic which fails due to the immutable audit_logs trigger.
    const { error } = await svc.rpc('delete_user_account', { target_user_id: user.id })

    if (error) {
      console.error('Failed to delete account:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete account error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
