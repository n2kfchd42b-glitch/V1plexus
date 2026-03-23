'use client'

import { useParams } from 'next/navigation'
import { IntegrationMarketplace } from '@/components/integrations/IntegrationMarketplace'

export default function IntegrationsPage() {
  const params = useParams()
  const projectId = params.id as string

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <IntegrationMarketplace projectId={projectId} />
    </div>
  )
}
