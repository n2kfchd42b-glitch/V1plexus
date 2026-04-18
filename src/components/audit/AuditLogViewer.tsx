"use client"

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuditLog } from '@/types/database'
import { AuditEntry } from './AuditEntry'
import { AuditFilters, type AuditFilterValues } from './AuditFilters'
import { AuditExportButton } from './AuditExportButton'
import { HashVerificationBadge } from './HashVerificationBadge'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'

// Fetch PAGE_SIZE+1 rows — if the extra row exists, there are more pages.
const PAGE_SIZE = 50

interface AuditLogViewerProps {
  projectId?: string
  institutionId?: string
  actorId?: string
  compact?: boolean
}

export function AuditLogViewer({ projectId, institutionId, actorId, compact = false }: AuditLogViewerProps) {
  const [entries, setEntries] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [filters, setFilters] = useState<AuditFilterValues>({
    search: '', action: '', resourceType: '', dateFrom: '', dateTo: ''
  })
  const supabase = createClient()

  function buildQuery(currentOffset: number, limit: number) {
    let query = supabase
      .from('audit_logs')
      .select('*, actor:profiles(id, full_name, email, avatar_url, role, created_at, updated_at)')
      .order('timestamp', { ascending: false })
      .range(currentOffset, currentOffset + limit - 1)

    if (projectId)            query = query.eq('project_id', projectId)
    if (institutionId)        query = query.eq('institution_id', institutionId)
    if (actorId)              query = query.eq('actor_id', actorId)
    if (filters.action)       query = query.eq('action', filters.action)
    if (filters.resourceType) query = query.eq('resource_type', filters.resourceType)
    if (filters.dateFrom)     query = query.gte('timestamp', filters.dateFrom)
    if (filters.dateTo) {
      const upper = /^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo)
        ? filters.dateTo + 'T23:59:59.999Z'
        : filters.dateTo
      query = query.lte('timestamp', upper)
    }
    if (filters.search) {
      // Search the human-readable summary field stored in details JSONB
      query = query.ilike('details->>summary', `%${filters.search}%`)
    }
    return query
  }

  const fetchEntries = useCallback(async (reset = false) => {
    setLoading(true)
    const currentOffset = reset ? 0 : offset

    // Fetch one extra row to determine whether another page exists
    const { data } = await buildQuery(currentOffset, PAGE_SIZE + 1)
    const raw = (data ?? []) as AuditLog[]

    const hasNextPage = raw.length > PAGE_SIZE
    const page = hasNextPage ? raw.slice(0, PAGE_SIZE) : raw

    if (reset) {
      setEntries(page)
      setOffset(PAGE_SIZE)
    } else {
      setEntries(prev => [...prev, ...page])
      setOffset(prev => prev + PAGE_SIZE)
    }

    setHasMore(hasNextPage)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, institutionId, actorId, filters, offset])

  useEffect(() => {
    fetchEntries(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, projectId, institutionId, actorId])

  // Fetch every page for CSV export — returns all matching entries.
  const fetchAllForExport = useCallback(async (): Promise<AuditLog[]> => {
    const all: AuditLog[] = []
    let page = 0
    const batchSize = 200
    while (true) {
      const { data } = await buildQuery(page * batchSize, batchSize)
      const batch = (data ?? []) as AuditLog[]
      all.push(...batch)
      if (batch.length < batchSize) break
      page++
    }
    return all
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, institutionId, actorId, filters])

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
          <AuditExportButton
            entries={entries}
            fetchAll={fetchAllForExport}
            filename={projectId ? `project-audit-${projectId.slice(0, 8)}` : actorId ? 'personal-audit' : 'audit-log'}
          />
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {loading && entries.length === 0 && (
          <p className="text-xs text-muted-foreground p-6 text-center">Loading audit log...</p>
        )}
        {entries.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground p-6 text-center">No audit entries found.</p>
        )}
        <div className="overflow-y-auto max-h-[600px] divide-y">
          {entries.map(e => (
            <AuditEntry key={e.id} entry={e} showHash />
          ))}
        </div>
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
