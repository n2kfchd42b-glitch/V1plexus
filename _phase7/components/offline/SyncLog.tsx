'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Clock, RefreshCw, Trash2 } from 'lucide-react'
import { getQueueItems, clearSyncedItems } from '@/lib/offline/queue'
import type { OfflineQueueItem } from '@/lib/offline/db'
import { Button } from '@/components/ui/button'

export function SyncLog() {
  const [items, setItems] = useState<OfflineQueueItem[]>([])

  const load = async () => {
    const list = await getQueueItems()
    setItems(list)
  }

  useEffect(() => { load() }, [])

  const handleClear = async () => {
    await clearSyncedItems()
    load()
  }

  if (items.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-8 text-center">
        No offline mutations queued.
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-700">{items.length} queued operations</p>
        <Button variant="ghost" size="sm" onClick={handleClear} className="text-xs">
          <Trash2 className="h-3 w-3 mr-1" /> Clear synced
        </Button>
      </div>
      {items.map(item => (
        <div
          key={item.id}
          className="flex items-start gap-3 p-2.5 rounded-lg border border-gray-200 bg-white"
        >
          {item.status === 'synced' && <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />}
          {item.status === 'failed' && <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />}
          {item.status === 'pending' && <Clock className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />}
          {item.status === 'conflict' && <RefreshCw className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />}
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-800 capitalize">
              {item.action} → {item.table}
            </p>
            <p className="text-[11px] text-gray-500">
              {new Date(item.timestamp).toLocaleString()}
            </p>
            {item.error && (
              <p className="text-[11px] text-red-600 mt-0.5">{item.error}</p>
            )}
          </div>
          <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
            item.status === 'synced' ? 'bg-emerald-100 text-emerald-700' :
            item.status === 'failed' ? 'bg-red-100 text-red-700' :
            item.status === 'pending' ? 'bg-amber-100 text-amber-700' :
            'bg-orange-100 text-orange-700'
          }`}>
            {item.status}
          </span>
        </div>
      ))}
    </div>
  )
}
