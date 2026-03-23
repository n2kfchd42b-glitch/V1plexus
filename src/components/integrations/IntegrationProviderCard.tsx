'use client'

import { CheckCircle2, Circle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { IntegrationConnection } from '@/types/database'

export interface ProviderDefinition {
  id: string
  label: string
  description: string
  color: string        // tailwind bg color class for badge
  textColor: string    // tailwind text color class
  borderColor: string  // tailwind border color class for hover
  type: 'data_source' | 'data_target' | 'reference_manager' | 'bidirectional'
  comingSoon?: boolean
  docsUrl?: string
}

interface IntegrationProviderCardProps {
  provider: ProviderDefinition
  connection?: IntegrationConnection   // undefined = not connected
  onConnect: () => void
  onManage: () => void
}

export function IntegrationProviderCard({ provider, connection, onConnect, onManage }: IntegrationProviderCardProps) {
  const isConnected = !!connection && connection.status !== 'disconnected'
  const isError = connection?.status === 'error'

  return (
    <div className={`relative flex flex-col p-4 border rounded-xl bg-white transition-all ${
      provider.comingSoon
        ? 'border-gray-100 opacity-60 cursor-not-allowed'
        : isError
          ? 'border-red-200 shadow-sm'
          : isConnected
            ? 'border-emerald-200 shadow-sm'
            : `border-gray-200 hover:${provider.borderColor} hover:shadow-sm cursor-pointer`
    }`}>
      {/* Status dot */}
      <div className="absolute top-3 right-3">
        {provider.comingSoon ? (
          <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Soon</span>
        ) : isError ? (
          <span className="h-2 w-2 rounded-full bg-red-400 block" title="Error" />
        ) : isConnected ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <Circle className="h-4 w-4 text-gray-300" />
        )}
      </div>

      {/* Provider identity */}
      <div className="mb-3">
        <span className={`text-sm font-bold ${provider.textColor}`}>{provider.label}</span>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed pr-5">{provider.description}</p>
      </div>

      {/* Connection info */}
      {isConnected && connection && (
        <div className="text-xs text-gray-400 mb-3 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {connection.last_sync_at
            ? `Synced ${new Date(connection.last_sync_at).toLocaleDateString()}`
            : 'Never synced'
          }
        </div>
      )}

      {/* Action */}
      {!provider.comingSoon && (
        <div className="mt-auto">
          {isConnected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onManage}
              className="w-full text-xs h-7"
            >
              Manage
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onConnect}
              className={`w-full text-xs h-7 text-white ${provider.color} hover:opacity-90`}
            >
              Connect
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
