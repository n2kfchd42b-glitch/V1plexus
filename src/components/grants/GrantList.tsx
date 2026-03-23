'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { GrantCard } from './GrantCard'
import { ReportingTimeline } from './ReportingTimeline'
import { Plus } from 'lucide-react'
import { daysUntil } from '@/lib/utils'
import type { Grant, ReportingScheduleItem } from '@/types/database'

interface EnrichedGrant extends Grant {
  _projectCount: number
  _nextReport?: { title: string; due_date: string }
}

export function GrantList() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [grants, setGrants] = useState<EnrichedGrant[]>([])
  const [loading, setLoading] = useState(true)

  const isEditor = profile?.role === 'admin' || profile?.role === 'pi' || profile?.role === 'coordinator'

  const fetchGrants = useCallback(async () => {
    if (!profile?.institution_id) { setLoading(false); return }
    const { data } = await supabase
      .from('grants')
      .select(`
        *,
        pi:profiles!grants_pi_id_fkey(id, full_name, email),
        grant_projects(count)
      `)
      .eq('institution_id', profile.institution_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (data) {
      const enriched = data.map((g: Grant & { grant_projects: { count: number }[] }) => {
        const schedule: ReportingScheduleItem[] = g.reporting_schedule ?? []
        const pending = schedule
          .filter(s => s.status === 'pending' && s.due_date)
          .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        const nextReport = pending[0]
        return {
          ...g,
          _projectCount: g.grant_projects?.[0]?.count ?? 0,
          _nextReport: nextReport ? { title: nextReport.title, due_date: nextReport.due_date } : undefined,
        } as EnrichedGrant
      })
      setGrants(enriched)
    }
    setLoading(false)
  }, [profile, supabase])

  useEffect(() => { fetchGrants() }, [fetchGrants])

  // Build deadlines for timeline
  const deadlines = grants
    .filter(g => g._nextReport)
    .map(g => ({
      reportTitle: g._nextReport!.title,
      grantTitle: g.title,
      funder: g.funder_name,
      dueDate: g._nextReport!.due_date,
      grantId: g.id,
    }))
    .filter(d => {
      const days = daysUntil(d.dueDate)
      return days !== null && days >= 0
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

  const totalFunding = grants.reduce((s, g) => s + (g.amount ?? 0), 0)

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 animate-pulse bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      {grants.length > 0 && (
        <p className="text-sm text-[var(--text-secondary)]">
          {grants.length} active grant{grants.length !== 1 ? 's' : ''} ·{' '}
          ${(totalFunding / 1e6).toFixed(2)}M total ·{' '}
          {deadlines.length} report{deadlines.length !== 1 ? 's' : ''} due soon
        </p>
      )}

      {/* Active grants */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Active Grants</h2>
          {isEditor && (
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/institution/grants/new">
                <Plus className="h-3.5 w-3.5" /> Add Grant
              </Link>
            </Button>
          )}
        </div>

        {grants.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-[var(--border-default)] rounded-xl">
            <p className="text-sm text-[var(--text-tertiary)]">No active grants yet.</p>
            {isEditor && (
              <Button asChild size="sm" className="mt-3" variant="outline">
                <Link href="/institution/grants/new">Add your first grant</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {grants.map(g => <GrantCard key={g.id} grant={g} />)}
          </div>
        )}
      </section>

      {/* Upcoming deadlines */}
      {deadlines.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Upcoming Deadlines</h2>
          <ReportingTimeline deadlines={deadlines} />
        </section>
      )}
    </div>
  )
}
