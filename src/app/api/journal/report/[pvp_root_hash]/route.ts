import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/journal/report/[pvp_root_hash]
 *
 * Public — no authentication required.
 * Returns the SharedVerificationResult for a previously verified .pvp package.
 * Powers the public /verify/[pvp_root_hash] page.
 *
 * Uses the service-role Supabase client to read verification_certificates,
 * which has public SELECT RLS — anon access would also work, but service
 * role is consistent with the existing API-route pattern and future-proofs
 * against RLS changes.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pvp_root_hash: string }> },
) {
  const { pvp_root_hash } = await params
  const supabase = createServiceClient()

  const { data: rows, error } = await supabase
    .from('verification_certificates')
    .select('*')
    .eq('root_hash', pvp_root_hash)
    .order('issued_at', { ascending: false })
    .limit(1)

  if (error || !rows || rows.length === 0) {
    return NextResponse.json(
      {
        error: 'No verification record found for this package.',
        hint: 'The package must be verified first via POST /api/journal/verify',
      },
      { status: 404 },
    )
  }

  const row = rows[0]
  const aadFlags: { risk?: string; triggered?: boolean }[] = row.aad_flags ?? []

  // Derive aad_risk from triggered flags
  const triggeredRisks = aadFlags
    .filter((f) => f.triggered)
    .map((f) => f.risk ?? 'LOW')

  let aadRisk = 'LOW'
  if (triggeredRisks.includes('HIGH')) aadRisk = 'HIGH'
  else if (triggeredRisks.includes('MEDIUM')) aadRisk = 'MEDIUM'

  // overall_status
  let overallStatus = 'PASS'
  if (row.trust_level === 0) overallStatus = 'FAIL'
  else if (aadRisk === 'HIGH' || aadRisk === 'MEDIUM') overallStatus = 'REVIEW'

  // submission_mode — parse SUBMISSION_MODE: marker from human_readable
  const modeMatch = (row.human_readable as string)?.match(
    /SUBMISSION_MODE:\s*(\w+)/,
  )
  const submissionMode = modeMatch ? modeMatch[1] : 'individual'

  // certificate_hash — SHA-256 of certificate_id via Web Crypto
  const encoder = new TextEncoder()
  const hashBuf = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(String(row.certificate_id)),
  )
  const certHash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://plexus.science'
  const shareUrl = `${baseUrl}/verify/${pvp_root_hash}`

  // Institution wordmark — if this certificate belongs to a project with a
  // thesis that snapshotted its institution at submission time, expose the
  // frozen branding so the verify page can stamp it. Snapshots are immutable
  // (see migration 20260528000002), so a certificate's institution stamp never
  // shifts even if the author later moves institutions.
  let institutionBranding: {
    slug: string
    name: string
    short_name: string | null
    logo_url: string | null
    brand_color: string | null
    verification_tier: string | null
  } | null = null
  if (row.project_id) {
    const { data: thesis } = await supabase
      .from('thesis_metadata')
      .select('institution_branding_snapshot')
      .eq('project_id', row.project_id)
      .maybeSingle()
    const snap = thesis?.institution_branding_snapshot as Record<string, unknown> | null
    if (snap && typeof snap.slug === 'string') {
      institutionBranding = {
        slug: snap.slug,
        name: (snap.name as string) ?? '',
        short_name: (snap.short_name as string | null) ?? null,
        logo_url: (snap.logo_url as string | null) ?? null,
        brand_color: (snap.brand_color as string | null) ?? null,
        verification_tier: (snap.verification_tier as string | null) ?? null,
      }
    }
  }

  return NextResponse.json({
    pvp_root_hash,
    trust_level: row.trust_level,
    trust_label: row.trust_label,
    overall_status: overallStatus,
    aad_risk: aadRisk,
    submission_mode: submissionMode,
    ptls_version: '0.1',
    verified_at: row.issued_at,
    valid_until: row.expires_at,
    certificate_hash: certHash,
    human_readable: row.human_readable,
    share_url: shareUrl,
    aad_flags: row.aad_flags,
    integrity_passed: row.integrity_passed,
    institution_branding: institutionBranding,
  })
}
