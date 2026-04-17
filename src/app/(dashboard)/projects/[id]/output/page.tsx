'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  ClipboardList, FileText, Link2, Package, CheckCircle2,
  Circle, ChevronDown, ChevronRight, Copy, Check,
  Loader2, AlertCircle, PackageOpen, RefreshCw, Download,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { logAudit } from '@/lib/audit'
import { toast } from 'sonner'
import type {
  ReportingChecklist,
  ChecklistGuideline,
  ChecklistItem,
  MethodsStatement,
  VerificationToken,
  OutputPackage,
} from '@/types/researchOutput'
import { PACKAGE_COMPONENTS } from '@/types/researchOutput'
import type { Dataset, DatasetVersion } from '@/types/database'

const GUIDELINES: ChecklistGuideline[] = ['STROBE', 'CONSORT', 'PRISMA', 'TRIPOD']

const STATUS_COLORS: Record<string, string> = {
  auto_populated: '#16a34a',
  manually_completed: '#2563eb',
  not_applicable: '#6b7280',
  incomplete: '#d97706',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  auto_populated: <CheckCircle2 className="h-4 w-4" style={{ color: '#16a34a' }} />,
  manually_completed: <CheckCircle2 className="h-4 w-4" style={{ color: '#2563eb' }} />,
  not_applicable: <Circle className="h-4 w-4" style={{ color: '#6b7280' }} />,
  incomplete: <Circle className="h-4 w-4" style={{ color: '#d97706' }} />,
}

export default function OutputPage() {
  const params = useParams()
  const projectId = params.id as string
  const { user, loading: authLoading } = useAuth()
  const supabase = createClient()

  // Datasets + version selection
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('')
  const [selectedVersionId, setSelectedVersionId] = useState<string>('')
  const [versions, setVersions] = useState<DatasetVersion[]>([])

  // Page state
  const [checklist, setChecklist] = useState<ReportingChecklist | null>(null)
  const [activeGuideline, setActiveGuideline] = useState<ChecklistGuideline>('STROBE')
  const [methods, setMethods] = useState<MethodsStatement | null>(null)
  const [activeToken, setActiveToken] = useState<VerificationToken | null>(null)
  const [packages, setPackages] = useState<OutputPackage[]>([])
  const [selectedComponents, setSelectedComponents] = useState<Set<string>>(
    new Set(PACKAGE_COMPONENTS.map(c => c.id))
  )
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  // Loading states
  const [generatingChecklist, setGeneratingChecklist] = useState(false)
  const [generatingMethods, setGeneratingMethods] = useState(false)
  const [generatingPackage, setGeneratingPackage] = useState(false)
  const [creatingToken, setCreatingToken] = useState(false)
  const [copiedMethods, setCopiedMethods] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [loadingDatasets, setLoadingDatasets] = useState(true)

  // Polling for package status
  const [pollingPackageId, setPollingPackageId] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // FETCH DATASETS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!user || !projectId) return
    ;(async () => {
      setLoadingDatasets(true)
      try {
        const { data: ds } = await supabase
          .from('datasets')
          .select('*')
          .eq('project_id', projectId)
          .is('deleted_at', null)
          .is('archived_at', null)
          .order('updated_at', { ascending: false })
        setDatasets(ds || [])
        if (ds?.[0]) setSelectedDatasetId(ds[0].id)
      } finally {
        setLoadingDatasets(false)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, projectId])

  // Fetch versions when dataset changes
  useEffect(() => {
    if (!selectedDatasetId) return
    ;(async () => {
      const { data: vs } = await supabase
        .from('dataset_versions')
        .select('*')
        .eq('dataset_id', selectedDatasetId)
        .order('version_number', { ascending: false })
      setVersions(vs || [])
      if (vs?.[0]) setSelectedVersionId(vs[0].id)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatasetId])

  // Fetch existing checklist for selected version + guideline
  useEffect(() => {
    if (!selectedVersionId) { setChecklist(null); return }
    ;(async () => {
      const { data } = await supabase
        .from('reporting_checklists')
        .select('*')
        .eq('version_id', selectedVersionId)
        .eq('guideline', activeGuideline)
        .order('created_at', { ascending: false })
        .limit(1)
      setChecklist(data?.[0] ? (data[0] as ReportingChecklist) : null)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVersionId, activeGuideline])

  // Fetch existing packages via API (service client bypasses RLS for project owners)
  useEffect(() => {
    if (!selectedVersionId) return
    ;(async () => {
      const res = await fetch(`/api/output/package?version_id=${selectedVersionId}`)
      if (res.ok) {
        const data = await res.json()
        setPackages((data || []) as OutputPackage[])
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVersionId])

  // Fetch existing token
  useEffect(() => {
    if (!selectedVersionId) return
    ;(async () => {
      const { data } = await supabase
        .from('verification_tokens')
        .select('*')
        .eq('resource_id', selectedVersionId)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
      setActiveToken(data?.[0] ? (data[0] as VerificationToken) : null)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVersionId])

  // ---------------------------------------------------------------------------
  // PACKAGE STATUS POLLING
  // ---------------------------------------------------------------------------
  const pollPackageStatus = useCallback(async (packageId: string) => {
    const res = await fetch(`/api/output/package/${packageId}/status`)
    if (!res.ok) return
    const data = await res.json()
    if (data.status === 'ready' || data.status === 'failed') {
      setPollingPackageId(null)
      setGeneratingPackage(false)
      setPackages(prev =>
        prev.map(p => p.id === packageId ? { ...p, ...data } : p)
      )
      if (data.status === 'ready') {
        toast.success('Submission package is ready for download!')
      } else {
        toast.error('Package generation failed. Please try again.')
      }
    }
  }, [])

  useEffect(() => {
    if (!pollingPackageId) return
    const interval = setInterval(() => pollPackageStatus(pollingPackageId), 3000)
    return () => clearInterval(interval)
  }, [pollingPackageId, pollPackageStatus])

  // ---------------------------------------------------------------------------
  // ACTIONS
  // ---------------------------------------------------------------------------
  const handleGenerateChecklist = async () => {
    if (!selectedVersionId || !selectedDatasetId) {
      toast.error('Please select a dataset and version')
      return
    }
    setGeneratingChecklist(true)
    try {
      const res = await fetch('/api/output/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          dataset_id: selectedDatasetId,
          version_id: selectedVersionId,
          guideline: activeGuideline,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setChecklist(data as ReportingChecklist)
      logAudit('output.checklist.generated', 'dataset_version', selectedVersionId, {
        summary: `${activeGuideline} checklist generated`,
        guideline: activeGuideline,
        auto_populated: data.auto_populated,
        dataset_id: selectedDatasetId,
      }, projectId)
      toast.success(`${activeGuideline} checklist generated — ${data.auto_populated} items auto-populated`)
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate checklist')
    } finally {
      setGeneratingChecklist(false)
    }
  }

  const handleUpdateItem = async (
    itemId: string,
    updates: Partial<ChecklistItem>
  ) => {
    if (!checklist) return
    try {
      const res = await fetch(
        `/api/output/checklist/${checklist.id}/items/${itemId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: updates.status ?? checklist.items[itemId]?.status,
            response: updates.response,
            page_reference: updates.page_reference,
            verified: updates.verified,
          }),
        }
      )
      if (!res.ok) throw new Error(await res.text())
      const result = await res.json()
      setChecklist(prev =>
        prev
          ? {
              ...prev,
              items: { ...prev.items, [itemId]: result.item },
              auto_populated: result.auto_populated,
              manually_completed: result.manually_completed,
              not_applicable: result.not_applicable,
              incomplete: result.incomplete,
              submission_ready: result.submission_ready,
            }
          : prev
      )
    } catch (err) {
      console.error(err)
      toast.error('Failed to save item')
    }
  }

  const handleGenerateMethods = async () => {
    if (!selectedVersionId) {
      toast.error('Please select a dataset version')
      return
    }
    setGeneratingMethods(true)
    try {
      const res = await fetch('/api/output/methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, version_id: selectedVersionId }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setMethods(data as MethodsStatement)
      logAudit('output.methods.generated', 'dataset_version', selectedVersionId, {
        summary: 'Methods statement generated',
        word_count: data.word_count,
        dataset_id: selectedDatasetId,
      }, projectId)
      toast.success(`Methods statement generated (${data.word_count} words)`)
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate methods statement')
    } finally {
      setGeneratingMethods(false)
    }
  }

  const handleCopyMethods = () => {
    if (!methods) return
    navigator.clipboard.writeText(methods.full_text)
    setCopiedMethods(true)
    setTimeout(() => setCopiedMethods(false), 2000)
    toast.success('Copied to clipboard')
  }

  const handleCreateToken = async () => {
    if (!selectedVersionId || !selectedDatasetId) {
      toast.error('Please select a dataset and version')
      return
    }
    setCreatingToken(true)
    try {
      const res = await fetch('/api/verify/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          dataset_id: selectedDatasetId,
          version_id: selectedVersionId,
          access_level: 'summary',
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setActiveToken(data.record as VerificationToken)
      toast.success('Verification token created')
    } catch (err) {
      console.error(err)
      toast.error('Failed to create verification token')
    } finally {
      setCreatingToken(false)
    }
  }

  const handleCopyToken = () => {
    if (!activeToken) return
    navigator.clipboard.writeText(activeToken.token)
    setCopiedToken(true)
    setTimeout(() => setCopiedToken(false), 2000)
    toast.success('Token copied')
  }

  const handleGeneratePackage = async () => {
    if (!selectedVersionId || !selectedDatasetId) {
      toast.error('Please select a dataset and version')
      return
    }
    if (selectedComponents.size === 0) {
      toast.error('Please select at least one component')
      return
    }
    setGeneratingPackage(true)
    try {
      const res = await fetch('/api/output/package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          dataset_id: selectedDatasetId,
          version_id: selectedVersionId,
          include_components: Array.from(selectedComponents),
          guideline: activeGuideline,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      // Add to packages list
      const newPkg: OutputPackage = {
        id: data.package_id,
        project_id: projectId,
        dataset_id: selectedDatasetId,
        version_id: selectedVersionId,
        manifest: { components: Array.from(selectedComponents) },
        package_hash: null,
        storage_path: null,
        status: 'generating',
        generated_by: user?.id || '',
        generated_at: new Date().toISOString(),
        expires_at: null,
      }
      setPackages(prev => [newPkg, ...prev])
      setPollingPackageId(data.package_id)
      logAudit('output.package.generated', 'dataset_version', selectedVersionId, {
        summary: 'Output package generation started',
        package_id: data.package_id,
        components: Array.from(selectedComponents),
        guideline: activeGuideline,
        dataset_id: selectedDatasetId,
      }, projectId)
      toast.success('Package generation started...')
    } catch (err) {
      console.error(err)
      toast.error('Failed to start package generation')
      setGeneratingPackage(false)
    }
  }

  const toggleComponent = (id: string) => {
    setSelectedComponents(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  // ---------------------------------------------------------------------------
  // DERIVED STATE
  // ---------------------------------------------------------------------------
  const groupedItems = checklist
    ? Object.values(checklist.items).reduce<Record<string, ChecklistItem[]>>((acc, item) => {
        const section = item.section
        if (!acc[section]) acc[section] = []
        acc[section].push(item)
        return acc
      }, {})
    : {}

  const completionPct = checklist
    ? Math.round(
        ((checklist.auto_populated + checklist.manually_completed + checklist.not_applicable) /
          Math.max(checklist.total_items, 1)) *
          100
      )
    : 0

  const latestPackage = packages[0]

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  if (authLoading || loadingDatasets) {
    return (
      <div className="page-shell">
        <div className="px-6 pt-6 pb-4 flex-shrink-0 space-y-3">
          <div className="skeleton h-5 w-20 rounded" />
          <div className="skeleton h-3 w-48 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell">

      {/* Page header */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="page-title">Report</h1>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Reporting checklist, methods text, and submission package
            </p>
          </div>
          {/* Dataset + Version selectors */}
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <select
              value={selectedDatasetId}
              onChange={e => setSelectedDatasetId(e.target.value)}
              className="text-xs border border-[var(--border-strong)] rounded px-2.5 py-1.5 bg-white text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]/30"
            >
              {datasets.length === 0 && <option value="">No datasets</option>}
              {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select
              value={selectedVersionId}
              onChange={e => setSelectedVersionId(e.target.value)}
              className="text-xs border border-[var(--border-strong)] rounded px-2.5 py-1.5 bg-white text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]/30"
            >
              {versions.length === 0 && <option value="">No versions</option>}
              {versions.map(v => (
                <option key={v.id} value={v.id}>
                  v{v.version_number} ({v.row_count?.toLocaleString() ?? '?'} rows)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto border-t border-[var(--border-row)]">

        {!selectedVersionId && (
          <div className="px-6 py-4 flex items-center gap-2 bg-amber-50 border-b border-amber-100">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700">Select a dataset and version above to get started.</p>
          </div>
        )}

        {/* ── 1. Reporting Checklist ───────────────────────────────── */}
        <div>
          <div className="px-6 py-3 flex items-center justify-between border-b border-[var(--border-row)]">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
              <span className="text-xs font-medium text-[var(--text-primary)]">Reporting Checklist</span>
              {checklist && (
                <span className="data-mono-xs text-[var(--text-tertiary)]">
                  {completionPct}% · {checklist.incomplete} incomplete
                </span>
              )}
              {checklist?.submission_ready && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--timeline-verified)]">
                  <CheckCircle2 className="h-3 w-3" /> Ready
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Guideline tabs */}
              <div className="flex gap-1">
                {GUIDELINES.map(g => (
                  <button key={g} onClick={() => setActiveGuideline(g)}
                    className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                      g === activeGuideline
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                    }`}
                  >{g}</button>
                ))}
              </div>
              <button
                onClick={handleGenerateChecklist}
                disabled={generatingChecklist || !selectedVersionId}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-row-hover)] disabled:opacity-50 transition-colors"
              >
                {generatingChecklist
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
                  : <><RefreshCw className="h-3 w-3" /> {checklist ? 'Regenerate' : 'Generate'}</>
                }
              </button>
            </div>
          </div>

          {checklist && (
            <>
              {/* Progress bar */}
              <div className="px-6 py-2 border-b border-[var(--border-row)]">
                <div className="h-1 bg-[var(--bg-row-hover)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--accent-primary)] rounded-full transition-all duration-500"
                    style={{ width: `${completionPct}%` }} />
                </div>
              </div>

              {/* Sections */}
              {Object.entries(groupedItems).map(([section, items]) => {
                const isExpanded = expandedSections.has(section)
                const sectionIncomplete = items.filter(i => i.status === 'incomplete').length
                return (
                  <div key={section} className="border-b border-[var(--border-row)] last:border-0">
                    <button
                      onClick={() => toggleSection(section)}
                      className="w-full flex items-center justify-between px-6 py-2.5 hover:bg-[var(--bg-row-hover)] transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                          : <ChevronRight className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />}
                        <span className="text-xs font-medium text-[var(--text-primary)]">{section}</span>
                        <span className="data-mono-xs text-[var(--text-tertiary)]">{items.length} items</span>
                      </div>
                      {sectionIncomplete > 0 && (
                        <span className="text-[10px] text-[var(--timeline-warning)]">{sectionIncomplete} incomplete</span>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-6 pb-3 space-y-2">
                        {items.map(item => (
                          <div key={item.item_id} className="py-2 border-b border-[var(--border-row)] last:border-0">
                            <div className="flex items-start gap-2.5">
                              {STATUS_ICONS[item.status]}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="data-mono-xs text-[var(--text-tertiary)]">#{item.item_number}</span>
                                  <span className="text-[10px] font-medium"
                                    style={{ color: STATUS_COLORS[item.status] }}>
                                    {item.status.replace('_', ' ')}
                                  </span>
                                </div>
                                <p className="text-xs text-[var(--text-primary)] leading-snug mb-1.5">{item.requirement}</p>

                                {item.status === 'auto_populated' && item.response && (
                                  <div className="surface-inset rounded px-3 py-2 mb-1.5">
                                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{item.response}</p>
                                    {item.source && (
                                      <p className="data-mono-xs text-[var(--text-tertiary)] mt-1">Source: {item.source}</p>
                                    )}
                                  </div>
                                )}

                                {item.status === 'incomplete' && (
                                  <textarea
                                    defaultValue={item.response || ''}
                                    placeholder="Enter your response…"
                                    rows={2}
                                    className="w-full text-xs border border-[var(--border-strong)] rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]/30 resize-none bg-white"
                                    onBlur={e => {
                                      const v = e.target.value.trim()
                                      if (v && v !== (item.response || ''))
                                        handleUpdateItem(item.item_id, { status: 'manually_completed', response: v })
                                    }}
                                  />
                                )}

                                <div className="flex items-center gap-3 mt-1.5">
                                  <input type="text" defaultValue={item.page_reference || ''}
                                    placeholder="Page ref (optional)"
                                    className="text-xs border border-[var(--border-strong)] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]/30 w-36 bg-white"
                                    onBlur={e => {
                                      if (e.target.value !== (item.page_reference || ''))
                                        handleUpdateItem(item.item_id, { ...item, page_reference: e.target.value })
                                    }}
                                  />
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input type="checkbox" defaultChecked={item.verified}
                                      className="h-3 w-3 rounded accent-[var(--accent-blue)]"
                                      onChange={e => handleUpdateItem(item.item_id, { ...item, verified: e.target.checked })}
                                    />
                                    <span className="text-xs text-[var(--text-tertiary)]">Verified</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Checklist footer */}
              <div className="px-6 py-3 border-t border-[var(--border-row)] flex items-center justify-between">
                <span className="text-xs text-[var(--text-tertiary)]">
                  {checklist.incomplete} item{checklist.incomplete !== 1 ? 's' : ''} need attention
                </span>
                <button onClick={() => window.print()}
                  className="flex items-center gap-1.5 text-xs text-[var(--accent-blue)] hover:underline">
                  <Download className="h-3 w-3" /> Export PDF
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── 2. Methods Statement ─────────────────────────────────── */}
        <div className="border-t border-[var(--border-row)]">
          <div className="px-6 py-3 flex items-center justify-between border-b border-[var(--border-row)]">
            <div className="flex items-center gap-3">
              <FileText className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
              <span className="text-xs font-medium text-[var(--text-primary)]">Methods Statement</span>
              {methods && (
                <span className="data-mono-xs text-[var(--text-tertiary)]">{methods.word_count} words</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {methods && (
                <button onClick={handleCopyMethods}
                  className="flex items-center gap-1 text-xs text-[var(--accent-blue)] hover:underline">
                  {copiedMethods ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedMethods ? 'Copied' : 'Copy'}
                </button>
              )}
              <button
                onClick={handleGenerateMethods}
                disabled={generatingMethods || !selectedVersionId}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-row-hover)] disabled:opacity-50 transition-colors"
              >
                {generatingMethods
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
                  : <><RefreshCw className="h-3 w-3" /> {methods ? 'Regenerate' : 'Generate'}</>
                }
              </button>
            </div>
          </div>

          {methods && (
            <div className="px-6 py-5 space-y-4">
              {Object.entries(methods.sections).map(([key, text]) => (
                <div key={key}>
                  <p className="subsection-label mb-1">{key.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 3. Verification Token ────────────────────────────────── */}
        <div className="border-t border-[var(--border-row)]">
          <div className="px-6 py-3 flex items-center justify-between border-b border-[var(--border-row)]">
            <div className="flex items-center gap-3">
              <Link2 className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
              <span className="text-xs font-medium text-[var(--text-primary)]">Verification Token</span>
              {activeToken && (
                <span className="data-mono-xs text-[var(--text-tertiary)]">
                  {activeToken.view_count} views · expires {new Date(activeToken.expires_at).toLocaleDateString()}
                </span>
              )}
            </div>
            {!activeToken && (
              <button
                onClick={handleCreateToken}
                disabled={creatingToken || !selectedVersionId}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-row-hover)] disabled:opacity-50 transition-colors"
              >
                {creatingToken ? <><Loader2 className="h-3 w-3 animate-spin" /> Creating…</> : 'Create Token'}
              </button>
            )}
          </div>

          {activeToken && (
            <div className="px-6 py-3 flex items-center gap-3">
              <code className="data-mono-xs text-[var(--accent-blue)] bg-blue-50 px-2.5 py-1 rounded">
                {activeToken.token}
              </code>
              <button onClick={handleCopyToken}
                className="text-[var(--text-tertiary)] hover:text-[var(--accent-blue)] transition-colors">
                {copiedToken ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
        </div>

        {/* ── 4. Output Package ────────────────────────────────────── */}
        <div className="border-t border-[var(--border-row)]">
          <div className="px-6 py-3 flex items-center justify-between border-b border-[var(--border-row)]">
            <div className="flex items-center gap-3">
              <Package className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
              <span className="text-xs font-medium text-[var(--text-primary)]">Output Package</span>
              <span className="data-mono-xs text-[var(--text-tertiary)]">{selectedComponents.size} components selected</span>
            </div>
            <button
              onClick={handleGeneratePackage}
              disabled={generatingPackage || !selectedVersionId || selectedComponents.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white disabled:opacity-50 btn-primary"
            >
              {generatingPackage
                ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
                : <><Package className="h-3 w-3" /> Generate Package</>
              }
            </button>
          </div>

          {/* Component rows */}
          {PACKAGE_COMPONENTS.map(component => {
            const isSelected = selectedComponents.has(component.id)
            return (
              <label key={component.id}
                className="flex items-center gap-3 px-6 py-2.5 border-b border-[var(--border-row)] last:border-0 hover:bg-[var(--bg-row-hover)] cursor-pointer transition-colors">
                <input type="checkbox" checked={isSelected} onChange={() => toggleComponent(component.id)}
                  className="h-3.5 w-3.5 rounded accent-[var(--accent-blue)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--text-primary)]">{component.label}</p>
                  <p className="data-mono-xs text-[var(--text-tertiary)] mt-0.5">{component.description}</p>
                </div>
                <span className="text-[10px] font-medium text-[var(--timeline-verified)]">Available</span>
              </label>
            )
          })}

          {/* Latest package status */}
          {latestPackage && (
            <div className="px-6 py-3 border-t border-[var(--border-row)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`status-dot ${
                  latestPackage.status === 'ready' ? 'status-dot--verified'
                  : latestPackage.status === 'failed' ? 'status-dot--flagged'
                  : 'status-dot--warning'
                }`} />
                <span className="text-xs text-[var(--text-secondary)]">
                  {latestPackage.status === 'ready' ? 'Package ready'
                    : latestPackage.status === 'failed' ? 'Generation failed'
                    : 'Generating…'}
                </span>
                {latestPackage.package_hash && (
                  <span className="data-mono-xs text-[var(--text-tertiary)] hidden sm:inline">
                    SHA-256: {latestPackage.package_hash.slice(0, 16)}…
                  </span>
                )}
              </div>
              {latestPackage.status === 'ready' && (
                <a href={`/api/output/package/${latestPackage.id}/download`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white btn-primary">
                  <Download className="h-3 w-3" /> Download
                </a>
              )}
              {latestPackage.status === 'generating' && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--timeline-warning)]" />
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
