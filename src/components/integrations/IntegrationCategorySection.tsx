'use client'

import { IntegrationProviderCard, type ProviderDefinition } from './IntegrationProviderCard'
import type { IntegrationConnection } from '@/types/database'

interface IntegrationCategorySectionProps {
  title: string
  description?: string
  providers: ProviderDefinition[]
  connections: IntegrationConnection[]
  onConnect: (providerId: string) => void
  onManage: (connection: IntegrationConnection) => void
}

export function IntegrationCategorySection({
  title,
  description,
  providers,
  connections,
  onConnect,
  onManage,
}: IntegrationCategorySectionProps) {
  const getConnection = (providerId: string) =>
    connections.find(c => c.provider === providerId && c.status !== 'disconnected')

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {providers.map(p => {
          const conn = getConnection(p.id)
          return (
            <IntegrationProviderCard
              key={p.id}
              provider={p}
              connection={conn}
              onConnect={() => onConnect(p.id)}
              onManage={() => conn && onManage(conn)}
            />
          )
        })}
      </div>
    </div>
  )
}
