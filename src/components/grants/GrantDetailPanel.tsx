'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LinkProjectModal } from './LinkProjectModal'
import { BudgetTracker } from './BudgetTracker'
import { GrantReportGenerator } from './GrantReportGenerator'
import { formatDate } from '@/lib/utils'
import { Plus, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import type { Grant, GrantProject, GrantReport } from '@/types/database'

interface LinkedProject {
  id: string
  title: string
  status: string
  budget_allocated: number | null
}

interface GrantDetailPanelProps {
  grantId: string
  defaultTab?: string
}

export function GrantDetailPanel({ grantId, defaultTab = 'overview' }: GrantDetailPanelProps) {
  const { profile } = useAuth()
  const supabase = createClient()
  const [grant, setGrant] = useState<Grant | null>(null)
  const [linkedProjects, setLinkedProjects] = useState<LinkedProject[]>([])
  const [reports, setReports] = useState<GrantReport[]>([])
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const isEditor = profile?.role === 'admin' || profile?.role === 'pi' || profile?.role === 'coordinator'

  const fetchGrant = useCallback(async () => {
    const { data } = await supabase
      .from('grants')
      .select('*, pi:profiles!grants_pi_id_fkey(id, full_name, email)')
      .eq('id', grantId)
      .single()
    if (data) setGrant(data as Grant)
    setLoading(false)
  }, [supabase, grantId])

  const fetchLinkedProjects = useCallback(async () => {
    const { data } = await supabase
      .from('grant_projects')
      .select('budget_allocated, project:projects(id, title, status)')
      .eq('grant_id', grantId)
    if (data) {
      setLinkedProjects((data as unknown as Array<{ budget_allocated: number | null; project: { id: string; title: string; status: string } }>).map(row => ({
        id: row.project.id,
        title: row.project.title,
        status: row.project.status,
        budget_allocated: row.budget_allocated,
      })))
    }
  }, [supabase, grantId])

  const fetchReports = useCallback(async () => {
    const { data } = await supabase
      .from('grant_reports')
      .select('*')
      .eq('grant_id', grantId)
      .order('due_date')
    if (data) setReports(data)
  }, [supabase, grantId])

  useEffect(() => {
    fetchGrant()
    fetchLinkedProjects()
    fetchReports()
  }, [fetchGrant, fetchLinkedProjects, fetchReports])

  if (loading) {
    return <div className="h-64 animate-pulse bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl" />
  }

  if (!grant) return <p className="text-sm text-[var(--text-tertiary)]">Grant not found.</p>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] mb-1">
          <span>{grant.funder_name}</span>
          {grant.grant_number && <span>— {grant.grant_number}</span>}
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{grant.title}</h1>
        {grant.pi && (
          <p className="text-sm text-[var(--text-secondary)] mt-1">PI: {grant.pi.full_name ?? grant.pi.email}</p>
        )}
        {grant.start_date && grant.end_date && (
          <p className="text-sm text-[var(--text-tertiary)]">
            {formatDate(grant.start_date)} – {formatDate(grant.end_date)}
          </p>
        )}
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Projects ({linkedProjects.length})</TabsTrigger>
          <TabsTrigger value="reports">Reports ({reports.length})</TabsTrigger>
          <TabsTrigger value="report">Generate Report</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {grant.amount && (
            <BudgetTracker
              totalBudget={grant.amount}
              currency={grant.currency}
              linkedProjects={linkedProjects}
            />
          )}
          {grant.notes && (
            <div className="text-sm text-[var(--text-secondary)] bg-[var(--bg-inset)] rounded-lg p-3">
              {grant.notes}
            </div>
          )}
        </TabsContent>

        <TabsContent value="projects" className="mt-4 space-y-3">
          {linkedProjects.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No projects linked yet.</p>
          ) : (
            <div className="space-y-2">
              {linkedProjects.map(p => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{p.title}</p>
                    <p className="text-xs text-[var(--text-tertiary)] capitalize">{p.status}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {p.budget_allocated && (
                      <span className="text-xs text-[var(--text-secondary)]">
                        ${p.budget_allocated.toLocaleString()}
                      </span>
                    )}
                    <Link href={`/projects/${p.id}/overview`} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
          {isEditor && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLinkModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Link Project
            </Button>
          )}
          <LinkProjectModal
            grantId={grantId}
            alreadyLinkedIds={linkedProjects.map(p => p.id)}
            open={linkModalOpen}
            onOpenChange={setLinkModalOpen}
            onLinked={fetchLinkedProjects}
          />
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-3">
          {reports.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No reports yet.</p>
          ) : (
            <div className="space-y-2">
              {reports.map(r => (
                <div key={r.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{r.title}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {r.report_type} · {r.due_date ? `Due ${formatDate(r.due_date)}` : 'No due date'}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                    r.status === 'submitted' || r.status === 'accepted'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : r.status === 'draft'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="report" className="mt-4">
          <GrantReportGenerator grant={grant} onGenerated={fetchReports} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
