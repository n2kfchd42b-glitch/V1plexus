import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/output/package/[packageId]/download
 * Authenticated. Generates a signed Supabase Storage URL and redirects.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ packageId: string }> }
) {
  const { packageId } = await params

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Look up the package record
    const { data: pkg, error: pkgError } = await supabase
      .from('output_packages')
      .select('id, storage_path, status, project_id')
      .eq('id', packageId)
      .single()

    if (pkgError || !pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    // Verify project membership
    const { data: member } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', pkg.project_id)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (pkg.status !== 'ready' || !pkg.storage_path) {
      return NextResponse.json(
        { error: 'Package is not ready for download' },
        { status: 409 }
      )
    }

    // Generate signed URL valid for 1 hour
    const { data: signed, error: signedError } = await supabase
      .storage
      .from('research-packages')
      .createSignedUrl(pkg.storage_path, 3600)

    if (signedError || !signed?.signedUrl) {
      console.error('[GET /api/output/package/[packageId]/download] signed URL error', signedError)
      return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
    }

    return NextResponse.redirect(signed.signedUrl)
  } catch (err) {
    console.error('[GET /api/output/package/[packageId]/download]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
