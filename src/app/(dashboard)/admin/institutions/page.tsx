import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isPlatformAdmin } from '@/lib/admin/platformAdmin'
import type { Institution, InstitutionInquiry } from '@/types/database'
import { InstitutionsAdminClient } from './InstitutionsAdminClient'

export const dynamic = 'force-dynamic'

export default async function InstitutionsAdminPage() {
  // Defence in depth: the parent layout already gates this, but the page
  // reads every inquiry's PII via the service client, so we re-verify
  // platform-admin membership here too. Don't rely on layout alone.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isPlatformAdmin(user.id)) redirect('/projects')

  const svc = createServiceClient()

  const [{ data: inquiries }, { data: institutions }] = await Promise.all([
    svc
      .from('institution_inquiries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    svc
      .from('institutions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-2">
          Platform admin
        </p>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-manrope)' }}>
          Institutions
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Review inquiries from prospective institutions and provision the ones you&apos;ve verified.
        </p>
      </header>

      <InstitutionsAdminClient
        inquiries={(inquiries ?? []) as InstitutionInquiry[]}
        institutions={(institutions ?? []) as Institution[]}
      />
    </div>
  )
}
