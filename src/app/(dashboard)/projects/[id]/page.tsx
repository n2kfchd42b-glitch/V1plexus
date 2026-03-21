"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Link from 'next/link'
import {
  Plus, FileText, ArrowLeft, ExternalLink, Activity
  Plus, FileText, ArrowLeft, ExternalLink, Database, FlaskConical
  Plus, FileText, ArrowLeft, ExternalLink, BarChart2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ApprovalGateList } from '@/components/approval/ApprovalGateList'
import { ActivityFeed } from '@/components/audit/ActivityFeed'
import { AnalysisHub } from '@/components/analysis/AnalysisHub'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { cn, formatRelative, statusColor, statusLabel } from '@/lib/utils'
import { logAudit } from '@/lib/audit'
import type { Project, Document } from '@/types/database'

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
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      const [projectRes, docsRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('documents').select('*').eq('project_id', projectId).order('updated_at', { ascending: false }),
      ])
      if (projectRes.data) setProject(projectRes.data)
      if (docsRes.data) setDocuments(docsRes.data)
    }
    fetchData()
  }, [projectId, supabase])

  const handleCreateDoc = async () => {
    if (!docTitle.trim() || !profile) return
    setLoading(true)
    const { data } = await supabase
      .from('documents')
      .insert({
        project_id: projectId,
        title: docTitle.trim(),
        document_type: docType,
        created_by: profile.id,
      })
      .select()
      .single()
    if (data) {
      await logAudit('document.create', 'document', data.id, { title: data.title, document_type: docType }, projectId)
      router.push(`/projects/${projectId}/documents/${data.id}`)
    }
    setLoading(false)
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <p className="text-muted-foreground text-sm">Loading project...</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/projects">
          <Button variant="ghost" size="sm" className="mb-3 h-7 text-xs -ml-2">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            All Projects
          </Button>
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{project.title}</h1>
            {project.description && (
              <p className="text-muted-foreground text-sm mt-1">{project.description}</p>
            )}
          </div>
          <Badge className={cn('text-xs border', statusColor(project.status))}>
            {statusLabel(project.status)}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="documents">
        <TabsList className="mb-4">
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="analysis">
            <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
            Analysis
          </TabsTrigger>
          <TabsTrigger value="gates">Approval Gates</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Activity
          <TabsTrigger value="data">
            <Database className="h-3.5 w-3.5 mr-1.5" />
            Data
          </TabsTrigger>
          <TabsTrigger value="analysis">
            <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
            Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Documents</h2>
            <Button size="sm" onClick={() => setShowNewDoc(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Document
            </Button>
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/20">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground text-sm">No documents yet</p>
              <Button size="sm" className="mt-3" onClick={() => setShowNewDoc(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Create First Document
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => (
                <Link key={doc.id} href={`/projects/${projectId}/documents/${doc.id}`}>
                  <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{doc.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            v{doc.current_version} · Updated {formatRelative(doc.updated_at)} · {doc.document_type.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={cn('text-xs border', statusColor(doc.status))}>
                          {statusLabel(doc.status)}
                        </Badge>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analysis">
          <AnalysisHub projectId={projectId} />
        </TabsContent>

        <TabsContent value="gates">
          <div className="max-w-2xl">
            <ApprovalGateList projectId={projectId} currentProfile={profile} />
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <div className="border rounded-lg overflow-hidden">
            <ActivityFeed projectId={projectId} />
        <TabsContent value="data">
          <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/20 gap-3">
            <Database className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm font-medium">Manage datasets for this project</p>
            <Link href={`/projects/${projectId}/data`}>
              <button className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium">
                <ExternalLink className="h-3.5 w-3.5" />
                Open Data Manager
              </button>
            </Link>
          </div>
        </TabsContent>

        <TabsContent value="analysis">
          <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/20 gap-3">
            <FlaskConical className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm font-medium">Run R and Python scripts against your datasets</p>
            <Link href={`/projects/${projectId}/analysis`}>
              <button className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium">
                <ExternalLink className="h-3.5 w-3.5" />
                Open Analysis Workbench
              </button>
            </Link>
          </div>
        </TabsContent>
      </Tabs>

      {/* New Document Dialog */}
      <Dialog open={showNewDoc} onOpenChange={setShowNewDoc}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Document</DialogTitle>
            <DialogDescription>Create a new document in this project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Document Title</Label>
              <Input
                placeholder="e.g. Research Protocol v1"
                value={docTitle}
                onChange={e => setDocTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Document Type</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="mt-1">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDoc(false)}>Cancel</Button>
            <Button onClick={handleCreateDoc} disabled={loading || !docTitle.trim()}>
              {loading ? 'Creating...' : 'Create Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
