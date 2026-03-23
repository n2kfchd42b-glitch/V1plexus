'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { INSTITUTIONAL_INTELLIGENCE_ENABLED } from '@/lib/flags'
import { GrantDetailPanel } from '@/components/grants/GrantDetailPanel'
import { redirect } from 'next/navigation'

export default function GrantDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params?.id as string
  const tab = searchParams?.get('tab') ?? 'overview'

  if (!INSTITUTIONAL_INTELLIGENCE_ENABLED) {
    redirect('/institution/grants')
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <GrantDetailPanel grantId={id} defaultTab={tab} />
    </div>
  )
}
