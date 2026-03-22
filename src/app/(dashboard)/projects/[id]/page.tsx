"use client"

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, FileText, BarChart2, Shield, Clock, ExternalLink, FolderOpen
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ApprovalGateList } from '@/components/approval/ApprovalGateList'
import { AnalysisHub } from '@/components/analysis/AnalysisHub'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { cn, formatRelative, statusLabel } from '@/lib/utils'
import { toast } from 'sonner'
import { logAudit } from '@/lib/audit'
import type { Project, Document } from '@/types/database'

const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
  draft:     { bg: 'bg-[#F4F4F5]', text: 'text-[#71717A]', dot: 'bg-[#A1A1AA]' },
  active:    { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', dot: 'bg-[#3B82F6]' },
  completed: { bg: 'bg-[#F0FDF4]', text: 'text-[#16A34A]', dot: 'bg-[#22C55E]' },
  archived:  { bg: 'bg-[#FAFAFA]', text: 'text-[#A1A1AA]', dot: 'bg-[#D4D4D8]' },
  // document statuses
  in_review:           { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', dot: 'bg-[#3B82F6]' },
  revision_requested:  { bg: 'bg-[#FFF7ED]', text: 'text-[#C2410C]', dot: 'bg-[#F97316]' },
  approved:            { bg: 'bg-[#F0FDF4]', text: 'text-[#16A34A]', dot: 'bg-[#22C55E]' },
}

function StatusBadge({ status }: { status: string }) {
  const s = statusStyles[status] ?? statusStyles.draft
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium',
      s.bg, s.text
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', s.dot)} />
      {statusLabel(status)}
    </span>
  )
}

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const { profile } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [showNewDoc, setShowNewDoc] = useState(false)
  const [docTitle, setDocTitle] = useState('')
  const [docType, setDocType] = useState('general')
  const [creating, setCreating] = useState(false)
  const [loadingProject, setLoadingProject] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectRes, docsRes] = await Promise.all([
          supabase.from('projects').select('*').eq('id', projectId).single(),
          supabase.from('documents').select('*').eq('project_id', projectId).order('updated_at', { ascending: false }),
        ])
        if (projectRes.data) setProject(projectRes.data)
        if (docsRes.data) setDocuments(docsRes.data)
      } finally {
        setLoadingProject(false)
      }
    }
    fetchData()
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateDoc = async () => {
    if (!docTitle.trim() || !profile) return
    setCreating(true)
    const { data, error } = await supabase
      .from('documents')
      .insert({
        project_id: projectId,
        title: docTitle.trim(),
        document_type: docType,
        created_by: profile.id,
      })
      .select()
      .single()
    if (error) {
      toast.error('Failed to create document')
    } else if (data) {
      await logAudit('document.create', 'document', data.id, { title: data.title, document_type: docType }, projectId)
      router.push(`/projects/${projectId}/documents/${data.id}`)
    }
    setCreating(false)
  }

  if (loadingProject) {
    return (
      <div className="px-6 py-5 max-w-5xl mx-auto space-y-5">
        <div className="skeleton h-7 w-64 mb-1.5" />
        <div className="skeleton h-4 w-48" />
        <div className="flex gap-2 mt-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-8 w-24 rounded-md" />)}
        </div>
        <div className="space-y-2 mt-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-4">
              <div className="skeleton h-4 w-56 mb-2" />
              <div className="skeleton h-3 w-32" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <FolderOpen className="h-12 w-12 mx-auto text-[var(--text-tertiary)] mb-3" />
          <p className="text-base font-semibold text-[var(--text-primary)]">Project not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-5 max-w-5xl mx-auto">
      {/* Project header */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight truncate">
              {project.title}
            </h1>
            {project.description && (
              <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">{project.description}</p>
            )}
          </div>
          <StatusBadge status={project.status} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="documents">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="h-9 bg-[var(--bg-inset)] p-0.5 rounded-lg gap-0.5">
            <TabsTrigger
              value="documents"
              className="h-8 px-3 text-sm rounded-md data-[state=active]:bg-[var(--bg-surface)] data-[state=active]:shadow-xs"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Documents
              <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">{documents.length}</span>
            </TabsTrigger>
            <TabsTrigger
              value="analysis"
              className="h-8 px-3 text-sm rounded-md data-[state=active]:bg-[var(--bg-surface)] data-[state=active]:shadow-xs"
            >
              <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
              Analysis
            </TabsTrigger>
            <TabsTrigger
              value="gates"
              className="h-8 px-3 text-sm rounded-md data-[state=active]:bg-[var(--bg-surface)] data-[state=active]:shadow-xs"
            >
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              Approval Gates
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="documents" className="mt-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Documents</h2>
            <button
              onClick={() => setShowNewDoc(true)}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-[var(--accent-blue)] text-white text-xs font-medium hover:bg-blue-600 transition-colors btn-press"
            >
              <Plus className="h-3 w-3" />
              New Document
            </button>
          </div>

          {documents.length === 0 ? (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg py-14 text-center">
              <FileText className="h-10 w-10 mx-auto text-[var(--text-tertiary)] mb-3" />
              <p className="text-base font-semibold text-[var(--text-primary)] mb-1">No documents yet</p>
              <p className="text-sm text-[var(--text-secondary)] max-w-xs mx-auto mb-4">
                Create a protocol, manuscript, or thesis chapter to get started.
              </p>
              <button
                onClick={() => setShowNewDoc(true)}
                className="inline-flex items-center gap-1.5 h-8 px-4 rounded-md bg-[var(--accent-blue)] text-white text-sm font-medium hover:bg-blue-600 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Document
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {documents.map(doc => (
                <Link key={doc.id} href={`/projects/${projectId}/documents/${doc.id}`}>
                  <div className="group bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-4 py-3 flex items-center justify-between gap-3 hover:border-[var(--border-strong)] hover:shadow-sm transition-all duration-150">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-7 w-7 rounded-md bg-[var(--bg-inset)] flex items-center justify-center flex-shrink-0">
                        <FileText className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{doc.title}</p>
                        <p className="text-xs text-[var(--text-tertiary)] flex items-center gap-1.5 mt-0.5">
                          <span className="capitalize">{doc.document_type.replace('_', ' ')}</span>
                          <span>·</span>
                          <Clock className="h-3 w-3" />
                          {formatRelative(doc.updated_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge status={doc.status} />
                      <ExternalLink className="h-3.5 w-3.5 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analysis" className="mt-0">
          <AnalysisHub projectId={projectId} />
        </TabsContent>

        <TabsContent value="gates" className="mt-0">
          <div className="max-w-2xl">
            <ApprovalGateList projectId={projectId} currentProfile={profile} />
          </div>
        </TabsContent>
      </Tabs>

      {/* New Document Dialog */}
      <Dialog open={showNewDoc} onOpenChange={setShowNewDoc}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Document</DialogTitle>
            <DialogDescription>Create a new document in this project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm font-medium text-[var(--text-primary)]">Document Title</Label>
              <input
                placeholder="e.g. Research Protocol v1"
                value={docTitle}
                onChange={e => setDocTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateDoc()}
                className="mt-1.5 w-full h-9 px-3 text-sm bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-blue)]/20 placeholder:text-[var(--text-tertiary)] text-[var(--text-primary)] transition-all"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-[var(--text-primary)]">Document Type</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="protocol">Protocol</SelectItem>
                  <SelectItem value="consent_form">Consent Form</SelectItem>
                  <SelectItem value="ethics_application">Ethics Application</SelectItem>
                  <SelectItem value="report">Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <button
              onClick={() => setShowNewDoc(false)}
              className="h-8 px-3 rounded-md text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-default)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateDoc}
              disabled={creating || !docTitle.trim()}
              className="h-8 px-4 rounded-md bg-[var(--accent-blue)] text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors btn-press"
            >
              {creating ? 'Creating…' : 'Create Document'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
