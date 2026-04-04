import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Require password re-confirmation to prevent session-hijacking → deletion
    const body = await request.json().catch(() => null)
    const password: string | undefined = body?.password
    if (!password) {
      return NextResponse.json({ error: 'Password confirmation required' }, { status: 400 })
    }

    const email = user.email
    if (!email) {
      return NextResponse.json({ error: 'Cannot verify identity: no email on account' }, { status: 400 })
    }

    // Re-authenticate with the provided password before allowing deletion
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 403 })
    }

    // Use service role client to delete the auth user
    // ON DELETE CASCADE handles all related data in the database
    const serviceClient = createServiceClient()
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id)

    if (deleteError) {
      console.error('Failed to delete user:', deleteError)
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete account error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
