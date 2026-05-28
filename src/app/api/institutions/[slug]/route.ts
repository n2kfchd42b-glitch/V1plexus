import { NextResponse } from 'next/server'
import { loadPublicInstitution } from '@/lib/institutions/publicInstitution'

/**
 * GET /api/institutions/[slug]
 *
 * Public, unauthenticated. Thin wrapper over loadPublicInstitution()
 * (shared with the server page so renders skip the API hop).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 })

  const payload = await loadPublicInstitution(slug)
  if (!payload) return NextResponse.json({ error: 'Institution not found' }, { status: 404 })

  return NextResponse.json(payload, {
    headers: {
      // Public page; modest cache to absorb crawler / share traffic.
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  })
}
