'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Shield, CheckCircle, AlertTriangle, Clock, Lock, Unlock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface AuditEntry {
  id: string
  timestamp: string
  action: string
  details: Record<string, unknown>
  actor_id: string | null
  profiles: { display_name: string | null } | null
}

interface EthicsStatus {
  status: string | null
  board_name: string | null
  application_ref: string | null
  approved_at: string | null
  expires_at: string | null
}

interface DocumentSecurityPanelProps {
  documentId: string
  projectId: string
  onClose: () => void
}

export function DocumentSecurityPanel({ documentId, projectId, onClose }: DocumentSecurityPanelProps) {
  const supabase = createClient()
  const [ethics, setEthics] = useState<EthicsStatus | null>(null)
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [loadingEthics, setLoadingEthics] = useState(true)
  const [loadingAudit, setLoadingAudit] = useState(true)
  const [documentStatus, setDocumentStatus] = useState<string | null>(null)

  const fetchEthics = useCallback(async () => {
    setLoadingEthics(true)
    const { data } = await supabase
      .from('ethics_applications')
      .select('status, board_name, application_ref, approved_at, expires_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setEthics(data ?? null)
    setLoadingEthics(false)
  }, [projectId, supabase])

  const fetchAudit = useCallback(async () => {
    setLoadingAudit(true)
    const res = await fetch(`/api/documents/${documentId}/audit-log`)
    if (res.ok) {
      const json = await res.json()
      setAuditEntries(json.entries ?? [])
    }
    setLoadingAudit(false)
  }, [documentId])

  const fetchDocStatus = useCallback(async () => {
    const { data } = await supabase
      .from('documents')
      .select('status')
      .eq('id', documentId)
      .single()
    setDocumentStatus(data?.status ?? null)
  }, [documentId, supabase])

  useEffect(() => {
    fetchEthics()
    fetchAudit()
    fetchDocStatus()
  }, [fetchEthics, fetchAudit, fetchDocStatus])

  const ethicsColor = (status: string | null) => {
    switch (status) {
      case 'approved': return 'text-green-700 bg-green-50 border-green-200'
      case 'conditionally_approved': return 'text-yellow-700 bg-yellow-50 border-yellow-200'
      case 'under_review':
      case 'submitted': return 'text-blue-700 bg-blue-50 border-blue-200'
      case 'expired': return 'text-red-700 bg-red-50 border-red-200'
      case 'rejected': return 'text-red-700 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const ethicsIcon = (status: string | null) => {
    if (status === 'approved' || status === 'conditionally_approved') return <CheckCircle className="h-4 w-4 text-green-600" />
    if (status === 'expired' || status === 'rejected') return <AlertTriangle className="h-4 w-4 text-red-500" />
    if (status === 'under_review' || status === 'submitted') return <Clock className="h-4 w-4 text-blue-500" />
    return <AlertTriangle className="h-4 w-4 text-amber-500" />
  }

  const docLocked = documentStatus === 'locked' || documentStatus === 'approved'

  const formatAction = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
  }

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <aside className="w-80 shrink-0 border-l border-[var(--border-default)] bg-white flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[var(--color-clinical-blue)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">Security &amp; Ethics</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Document Lock Status */}
        <section>
          <h3 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Access Control</h3>
          <div className={cn(
            'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm',
            docLocked ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-green-50 border-green-200 text-green-800'
          )}>
            {docLocked
              ? <Lock className="h-4 w-4 text-amber-600 shrink-0" />
              : <Unlock className="h-4 w-4 text-green-600 shrink-0" />
            }
            <span className="font-medium">
              {docLocked ? 'Document is locked' : 'Document is editable'}
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
            {docLocked
              ? 'This document has been approved or locked. Editing is disabled to preserve integrity.'
              : 'Project members with access can view and edit this document.'}
          </p>
        </section>

        {/* Ethics Gate */}
        <section>
          <h3 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Ethics Gate</h3>
          {loadingEthics ? (
            <div className="h-14 bg-gray-50 animate-pulse rounded-lg border border-gray-200" />
          ) : ethics ? (
            <div className={cn('rounded-lg border px-3 py-2.5 space-y-1', ethicsColor(ethics.status))}>
              <div className="flex items-center gap-2">
                {ethicsIcon(ethics.status)}
                <span className="text-sm font-medium capitalize">{(ethics.status ?? 'Unknown').replace(/_/g, ' ')}</span>
                {ethics.application_ref && (
                  <Badge variant="outline" className="text-[10px] ml-auto">{ethics.application_ref}</Badge>
                )}
              </div>
              {ethics.board_name && (
                <p className="text-xs opacity-80">{ethics.board_name}</p>
              )}
              {ethics.approved_at && (
                <p className="text-[11px] opacity-70">Approved {new Date(ethics.approved_at).toLocaleDateString()}</p>
              )}
              {ethics.expires_at && (
                <p className="text-[11px] opacity-70">Expires {new Date(ethics.expires_at).toLocaleDateString()}</p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">No ethics application</span>
              </div>
              <p className="text-xs text-amber-700 mt-1">
                Export may be restricted until an ethics application is approved for this project.
              </p>
            </div>
          )}
        </section>

        {/* Audit Trail */}
        <section>
          <h3 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Audit Trail</h3>
          {loadingAudit ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-50 animate-pulse rounded border border-gray-100" />
              ))}
            </div>
          ) : auditEntries.length === 0 ? (
            <p className="text-xs text-[var(--text-tertiary)] italic">No audit entries recorded yet.</p>
          ) : (
            <div className="space-y-1.5">
              {auditEntries.map(entry => (
                <div key={entry.id} className="flex flex-col gap-0.5 rounded border border-[var(--border-default)] bg-[var(--surface-1)] px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {formatAction(entry.action)}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)] shrink-0">
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                  {entry.profiles?.display_name && (
                    <span className="text-[11px] text-[var(--text-tertiary)]">{entry.profiles.display_name}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  )
}
