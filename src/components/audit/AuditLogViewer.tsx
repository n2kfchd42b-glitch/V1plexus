"use client"

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuditLog } from '@/types/database'
import { AuditEntry } from './AuditEntry'
import { AuditFilters, type AuditFilterValues } from './AuditFilters'
import { AuditExportButton } from './AuditExportButton'
import { HashVerificationBadge } from './HashVerificationBadge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'

const PAGE_SIZE = 50

interface AuditLogViewerProps {
  projectId?: string
  institutionId?: string
  compact?: boolean
}

export function AuditLogViewer({ projectId, institutionId, compact = false }: AuditLogViewerProps) {
  const [entries, setEntries] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [filters, setFilters] = useState<AuditFilterValues>({
    search: '', action: '', resourceType: '', dateFrom: '', dateTo: ''
  })
  const supabase = createClient()

  const fetchEntries = useCallback(async (reset = false) => {
    setLoading(true)
    const currentOffset = reset ? 0 : offset

    let query = supabase
      .from('audit_logs')
      .select('*, actor:profiles(id, full_name, email, avatar_url, role, created_at, updated_at)')
      .order('timestamp', { ascending: false })
      .range(currentOffset, currentOffset + PAGE_SIZE - 1)

    if (projectId) query = query.eq('project_id', projectId)
    if (institutionId) query = query.eq('institution_id', institutionId)
    if (filters.action) query = query.eq('action', filters.action)
    if (filters.resourceType) query = query.eq('resource_type', filters.resourceType)
    if (filters.dateFrom) query = query.gte('timestamp', filters.dateFrom)
    if (filters.dateTo) query = query.lte('timestamp', filters.dateTo + 'T23:59:59Z')
    // Push text search to the database using ilike on action and resource_type
    if (filters.search) {
      const term = `%${filters.search}%`
      query = query.or(`action.ilike.${term},resource_type.ilike.${term}`)
    }

    const { data } = await query
    const filtered = (data ?? []) as AuditLog[]

    if (reset) {
      setEntries(filtered)
      setOffset(PAGE_SIZE)
    } else {
      setEntries(prev => [...prev, ...filtered])
      setOffset(prev => prev + PAGE_SIZE)
    }

    setHasMore(results.length === PAGE_SIZE)
    setLoading(false)
  }, [supabase, projectId, institutionId, filters, offset])

  useEffect(() => {
    fetchEntries(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, projectId, institutionId])

  if (compact) {
    return (
      <div className="space-y-0 divide-y">
        {loading && entries.length === 0 && (
          <p className="text-xs text-muted-foreground p-4">Loading activity...</p>
        )}
        {entries.slice(0, 20).map(e => (
          <AuditEntry key={e.id} entry={e} />
        ))}
        {entries.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground p-4">No activity yet.</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <AuditFilters filters={filters} onChange={f => { setFilters(f); setOffset(0) }} />
        <div className="flex items-center gap-2">
          <HashVerificationBadge projectId={projectId} />
          <AuditExportButton entries={entries} filename={projectId ? `project-audit-${projectId.slice(0, 8)}` : 'institution-audit'} />
        </div>
      </div>

      <div className="border rounded-lg divide-y">
        {loading && entries.length === 0 && (
          <p className="text-xs text-muted-foreground p-6 text-center">Loading audit log...</p>
        )}
        {entries.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground p-6 text-center">No audit entries found.</p>
        )}
        <ScrollArea className="max-h-[600px]">
          {entries.map(e => (
            <AuditEntry key={e.id} entry={e} showHash />
          ))}
        </ScrollArea>
      </div>

      {hasMore && (
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => fetchEntries(false)}
            disabled={loading}
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
