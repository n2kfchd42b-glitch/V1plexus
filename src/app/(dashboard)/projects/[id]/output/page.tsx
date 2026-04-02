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

  // Fetch existing packages
  useEffect(() => {
    if (!selectedVersionId) return
    ;(async () => {
      const { data } = await supabase
        .from('output_packages')
        .select('*')
        .eq('version_id', selectedVersionId)
        .order('generated_at', { ascending: false })
        .limit(5)
      setPackages((data || []) as OutputPackage[])
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
      // Fetch the full token record
      const { data: tokens } = await supabase
        .from('verification_tokens')
        .select('*')
        .eq('token', data.token)
        .single()
      setActiveToken(tokens as VerificationToken)
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
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="p-8 min-h-screen" style={{ background: '#f7f9fb' }}>
      {/* PAGE HEADER */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--bg-inset, #f1f5f9)' }}
          >
            <PackageOpen className="h-5 w-5" style={{ color: '#003d9b' }} />
          </div>
          <div>
            <h1 className="font-manrope text-3xl font-extrabold text-[#191c1e] tracking-tight">
              Research Output
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Prepare your dataset for submission — checklists, methods text, and submission packages
            </p>
          </div>
        </div>

        {/* Dataset + Version selectors */}
        <div className="mt-4 flex flex-wrap gap-3 items-center">
          <select
            value={selectedDatasetId}
            onChange={e => setSelectedDatasetId(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003d9b]/20"
          >
            {datasets.length === 0 && <option value="">No datasets</option>}
            {datasets.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            value={selectedVersionId}
            onChange={e => setSelectedVersionId(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003d9b]/20"
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

      {!selectedVersionId && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center mb-8">
          <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-amber-700 font-medium">
            Select a dataset and version above to get started
          </p>
        </div>
      )}

      {/* THREE CARD ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* CARD 1: Reporting Checklist */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="h-4 w-4 text-[#003d9b]" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Reporting Checklist
            </span>
          </div>

          {checklist ? (
            <div>
              {/* Completion ring */}
              <div className="flex items-center gap-4 mb-3">
                <div className="relative h-16 w-16 flex-shrink-0">
                  <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                    <circle
                      cx="32" cy="32" r="26"
                      fill="none"
                      stroke="#003d9b"
                      strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 26}`}
                      strokeDashoffset={`${2 * Math.PI * 26 * (1 - completionPct / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-[#003d9b]">{completionPct}%</span>
                  </div>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-600 inline-block" />
                    {checklist.auto_populated} auto-populated
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                    {checklist.manually_completed} manual
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    {checklist.incomplete} incomplete
                  </div>
                </div>
              </div>
              {checklist.submission_ready && (
                <div className="bg-green-50 text-green-700 text-xs font-semibold px-2 py-1 rounded-md inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Submission Ready
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-500 mb-3">
                Auto-generate your {activeGuideline} reporting checklist from project data
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {GUIDELINES.map(g => (
                  <button
                    key={g}
                    onClick={() => setActiveGuideline(g)}
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-all ${
                      g === activeGuideline
                        ? 'bg-[#003d9b] text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <button
                onClick={handleGenerateChecklist}
                disabled={generatingChecklist || !selectedVersionId}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#003d9b] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {generatingChecklist ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                ) : (
                  <><ClipboardList className="h-3.5 w-3.5" /> Generate Checklist</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* CARD 2: Methods Statement */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-[#003d9b]" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Methods Statement
            </span>
          </div>

          {methods ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700">
                  {methods.word_count} words
                </span>
                <button
                  onClick={handleCopyMethods}
                  className="flex items-center gap-1 text-xs text-[#003d9b] hover:opacity-80 font-semibold"
                >
                  {copiedMethods ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedMethods ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                {methods.full_text.slice(0, 200)}...
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-500 mb-3">
                Auto-generate ready-to-paste methods text from your project data
              </p>
              <button
                onClick={handleGenerateMethods}
                disabled={generatingMethods || !selectedVersionId}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#003d9b] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {generatingMethods ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                ) : (
                  <><FileText className="h-3.5 w-3.5" /> Generate Methods</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* CARD 3: Verification Token */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-4 w-4 text-[#003d9b]" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Verification Token
            </span>
          </div>

          {activeToken ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <code
                  className="text-xs font-bold text-[#003d9b] bg-blue-50 px-2 py-1 rounded font-mono tracking-wider"
                  style={{ fontFamily: 'JetBrains Mono, Menlo, monospace' }}
                >
                  {activeToken.token}
                </code>
                <button onClick={handleCopyToken} className="text-slate-400 hover:text-[#003d9b]">
                  {copiedToken ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Expires {new Date(activeToken.expires_at).toLocaleDateString()}
                {' · '}
                {activeToken.view_count} views
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-500 mb-3">
                Create a PLX-VRF token for third-party verification of this dataset
              </p>
              <button
                onClick={handleCreateToken}
                disabled={creatingToken || !selectedVersionId}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#003d9b] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {creatingToken ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating...</>
                ) : (
                  <><Link2 className="h-3.5 w-3.5" /> Create Token</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* REPORTING CHECKLIST SECTION */}
      {checklist && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm mb-8">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-semibold text-[#191c1e]">{checklist.guideline} Reporting Checklist</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {checklist.total_items} items · {checklist.auto_populated} auto-populated · {checklist.incomplete} need attention
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Guideline tabs */}
              <div className="flex gap-1.5">
                {GUIDELINES.map(g => (
                  <button
                    key={g}
                    onClick={() => setActiveGuideline(g)}
                    className={`text-xs px-3 py-1 rounded-full font-semibold transition-all ${
                      g === activeGuideline
                        ? 'bg-[#003d9b] text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <button
                onClick={handleGenerateChecklist}
                disabled={generatingChecklist}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:border-[#003d9b]/30 hover:text-[#003d9b] disabled:opacity-50 transition-all"
              >
                <RefreshCw className={`h-3 w-3 ${generatingChecklist ? 'animate-spin' : ''}`} />
                Regenerate
              </button>
              {checklist.submission_ready && (
                <span className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-semibold border border-green-200">
                  Submission Ready
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="px-6 py-3 border-b border-slate-100">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span>Completion</span>
              <span>{completionPct}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#003d9b] rounded-full transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>

          {/* Items grouped by section */}
          <div className="divide-y divide-slate-100">
            {Object.entries(groupedItems).map(([section, items]) => {
              const isExpanded = expandedSections.has(section)
              const sectionIncomplete = items.filter(i => i.status === 'incomplete').length
              return (
                <div key={section}>
                  <button
                    onClick={() => toggleSection(section)}
                    className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-slate-400" />
                        : <ChevronRight className="h-4 w-4 text-slate-400" />}
                      <span className="text-sm font-semibold text-[#191c1e]">{section}</span>
                      <span className="text-xs text-slate-400">({items.length} items)</span>
                    </div>
                    {sectionIncomplete > 0 && (
                      <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-semibold">
                        {sectionIncomplete} incomplete
                      </span>
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-6 pb-4 space-y-3">
                      {items.map(item => (
                        <div
                          key={item.item_id}
                          className="border border-slate-100 rounded-lg p-4 bg-slate-50/50"
                        >
                          <div className="flex items-start gap-3">
                            {STATUS_ICONS[item.status]}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-slate-500">
                                  Item {item.item_number}
                                </span>
                                <span
                                  className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                  style={{
                                    background: STATUS_COLORS[item.status] + '18',
                                    color: STATUS_COLORS[item.status],
                                  }}
                                >
                                  {item.status.replace('_', ' ')}
                                  {item.auto_populated_confidence && ` (${item.auto_populated_confidence})`}
                                </span>
                              </div>
                              <p className="text-xs font-medium text-[#191c1e] mb-2">
                                {item.requirement}
                              </p>

                              {/* Auto-populated response */}
                              {item.status === 'auto_populated' && item.response && (
                                <div className="bg-green-50 border border-green-100 rounded-md p-2.5 mb-2">
                                  <p className="text-xs text-green-800">{item.response}</p>
                                  {item.source && (
                                    <p className="text-xs text-green-600 mt-1 font-mono">
                                      Source: {item.source}
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Manual textarea for incomplete items */}
                              {item.status === 'incomplete' && (
                                <textarea
                                  defaultValue={item.response || ''}
                                  placeholder="Enter your response..."
                                  rows={3}
                                  className="w-full text-xs border border-slate-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-[#003d9b]/20 resize-none"
                                  onBlur={e => {
                                    const newResponse = e.target.value.trim()
                                    if (newResponse && newResponse !== (item.response || '')) {
                                      handleUpdateItem(item.item_id, {
                                        status: 'manually_completed',
                                        response: newResponse,
                                      })
                                    }
                                  }}
                                />
                              )}

                              {/* Page reference input */}
                              <div className="flex items-center gap-3 mt-2">
                                <input
                                  type="text"
                                  defaultValue={item.page_reference || ''}
                                  placeholder="Page reference (optional)"
                                  className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#003d9b]/20 w-40"
                                  onBlur={e => {
                                    if (e.target.value !== (item.page_reference || '')) {
                                      handleUpdateItem(item.item_id, {
                                        ...item,
                                        page_reference: e.target.value,
                                      })
                                    }
                                  }}
                                />
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    defaultChecked={item.verified}
                                    className="h-3.5 w-3.5 rounded"
                                    onChange={e => {
                                      handleUpdateItem(item.item_id, {
                                        ...item,
                                        verified: e.target.checked,
                                      })
                                    }}
                                  />
                                  <span className="text-xs text-slate-500">Verified</span>
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
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <div>
              {checklist.submission_ready ? (
                <span className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-full font-semibold border border-green-200 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ready for submission
                </span>
              ) : (
                <span className="text-xs text-slate-400">
                  {checklist.incomplete} item{checklist.incomplete !== 1 ? 's' : ''} still need attention
                </span>
              )}
            </div>
            <button
              onClick={() => window.print()}
              className="text-xs flex items-center gap-1.5 text-slate-500 hover:text-[#003d9b] font-semibold transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export Checklist PDF
            </button>
          </div>
        </div>
      )}

      {/* METHODS STATEMENT SECTION */}
      {methods && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm mb-8">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[#191c1e]">Methods Statement</h2>
              <p className="text-xs text-slate-400 mt-0.5">{methods.word_count} words · 5 sections</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopyMethods}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:border-[#003d9b]/30 hover:text-[#003d9b] transition-all"
              >
                {copiedMethods ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedMethods ? 'Copied!' : 'Copy All'}
              </button>
              <button
                onClick={handleGenerateMethods}
                disabled={generatingMethods}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:border-[#003d9b]/30 hover:text-[#003d9b] disabled:opacity-50 transition-all"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${generatingMethods ? 'animate-spin' : ''}`} />
                Regenerate
              </button>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {Object.entries(methods.sections).map(([key, text]) => (
              <div key={key}>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  {key.replace(/_/g, ' ')}
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OUTPUT PACKAGE SECTION */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-[#191c1e] flex items-center gap-2">
            <Package className="h-4 w-4 text-[#003d9b]" />
            Output Package
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Select components and generate a submission-ready .zip package
          </p>
        </div>

        {/* Component selector grid */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-2">
          {PACKAGE_COMPONENTS.map(component => {
            const isSelected = selectedComponents.has(component.id)
            return (
              <label
                key={component.id}
                className={`flex items-start gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[#003d9b] bg-blue-50/50'
                    : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleComponent(component.id)}
                  className="mt-0.5 h-4 w-4 rounded accent-[#003d9b]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#191c1e]">{component.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    {component.description}
                  </p>
                  <span className="inline-block mt-1.5 text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-semibold">
                    Available
                  </span>
                </div>
              </label>
            )
          })}
        </div>

        {/* Generate button */}
        <div className="px-6 pb-6">
          <button
            onClick={handleGeneratePackage}
            disabled={generatingPackage || !selectedVersionId || selectedComponents.size === 0}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-br from-[#003d9b] to-[#0052cc] text-white font-semibold rounded-xl shadow-lg hover:opacity-90 active:scale-[0.99] disabled:opacity-50 transition-all"
          >
            {generatingPackage ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating Submission Package...
              </>
            ) : (
              <>
                <Package className="h-5 w-5" />
                Generate Submission Package ({selectedComponents.size} components)
              </>
            )}
          </button>
        </div>

        {/* Latest package status */}
        {latestPackage && (
          <div className="px-6 pb-6 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      latestPackage.status === 'ready'
                        ? 'bg-green-50 text-green-700'
                        : latestPackage.status === 'failed'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {latestPackage.status === 'ready'
                      ? 'Ready'
                      : latestPackage.status === 'failed'
                      ? 'Failed'
                      : 'Generating...'}
                  </span>
                  <span className="text-xs text-slate-400">
                    Generated {new Date(latestPackage.generated_at).toLocaleString()}
                  </span>
                </div>
                {latestPackage.package_hash && (
                  <p className="text-xs text-slate-400 font-mono">
                    SHA-256: {latestPackage.package_hash.slice(0, 32)}...
                  </p>
                )}
              </div>
              {latestPackage.status === 'ready' && (
                <a
                  href={`/api/output/package/${latestPackage.id}/download`}
                  className="flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-[#003d9b] text-white rounded-lg hover:opacity-90 transition-all"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Package
                </a>
              )}
              {latestPackage.status === 'generating' && (
                <div className="flex items-center gap-2 text-xs text-amber-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Preparing files...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
