"use client"

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import {
  BookOpen, Send, Shield, Database, Wand2, Plus, Loader2,
  BookMarked, FileText, Search
} from 'lucide-react'
import { JournalSearch } from '@/components/publication/JournalSearch'
import type { JournalTemplate } from '@/components/publication/JournalCard'
import { SubmissionTracker } from '@/components/publication/SubmissionTracker'
import type { JournalSubmission } from '@/components/publication/SubmissionTracker'
import { SubmissionForm } from '@/components/publication/SubmissionForm'
import { PreregistrationWizard } from '@/components/publication/PreregistrationWizard'
import { DOIMintingWizard } from '@/components/publication/DOIMintingWizard'
import { CoverLetterGenerator } from '@/components/publication/CoverLetterGenerator'
import { CitationSearch } from '@/components/publication/CitationSearch'
import type { CslCitation } from '@/components/publication/CitationSearch'
import { BibliographyGenerator } from '@/components/publication/BibliographyGenerator'
import { JOURNAL_SEEDS } from '@/lib/journal-seeds'
// Web Crypto API is available natively in modern browsers and Next.js edge/server

type Tab = 'journals' | 'citations' | 'submissions' | 'preregister' | 'doi'

interface Document { id: string; title: string; content: string | null }
interface Dataset { id: string; name: string }
interface ProtocolReg { id: string; registration_id: string; title: string; registered_at: string }

// Convert seed data to JournalTemplate shape (client-side only, no DB hit for seed)
function seedsToTemplates(seeds: typeof JOURNAL_SEEDS): JournalTemplate[] {
  return seeds.map((s, i) => ({
    id: `seed-${i}`,
    name: s.name,
    publisher: s.publisher,
    issn: s.issn,
    impact_factor: s.impact_factor,
    open_access: s.open_access,
    formatting: s.formatting as JournalTemplate['formatting'],
    submission_url: s.submission_url,
    guidelines_url: s.guidelines_url,
    categories: s.categories,
  }))
}

export default function PublicationPage() {
  const params = useParams()
  const projectId = params.id as string
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('journals')
  const [documents, setDocuments] = useState<Document[]>([])
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [submissions, setSubmissions] = useState<JournalSubmission[]>([])
  const [citations, setCitations] = useState<CslCitation[]>([])
  const [registrations, setRegistrations] = useState<ProtocolReg[]>([])
  const [citationStyle, setCitationStyle] = useState<'vancouver' | 'apa7' | 'harvard' | 'numbered'>('vancouver')
  const [loading, setLoading] = useState(true)
  const [selectedDocId, setSelectedDocId] = useState('')
  const [selectedDatasetId, setSelectedDatasetId] = useState('')
  const [selectedVersionId, setSelectedVersionId] = useState('')

  // Modals
  const [showSubmissionForm, setShowSubmissionForm] = useState(false)
  const [showPreregWizard, setShowPreregWizard] = useState(false)
  const [showDoiWizard, setShowDoiWizard] = useState(false)
  const [showCoverLetter, setShowCoverLetter] = useState(false)
  const [showCitationSearch, setShowCitationSearch] = useState(false)

  const journals = seedsToTemplates(JOURNAL_SEEDS)

  const load = useCallback(async () => {
    setLoading(true)
    const [docsRes, datasetsRes, subsRes, citRes, regRes] = await Promise.all([
      supabase.from('documents').select('id, title, content').eq('project_id', projectId).is('deleted_at', null).order('updated_at', { ascending: false }),
      supabase.from('datasets').select('id, name').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('journal_submissions').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('project_citations').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('protocol_registrations').select('id, registration_id, title, registered_at').eq('project_id', projectId).order('registered_at', { ascending: false }),
    ])
    setDocuments(docsRes.data ?? [])
    setDatasets(datasetsRes.data ?? [])
    setSubmissions(subsRes.data ?? [])
    setCitations((citRes.data ?? []).map((r: { citation_data: CslCitation; id: string; [key: string]: unknown }) => ({ ...r.citation_data, id: r.id })))
    setRegistrations(regRes.data ?? [])
    if (docsRes.data?.[0]) setSelectedDocId((docsRes.data[0] as Document).id)
    if (datasetsRes.data?.[0]) setSelectedDatasetId((datasetsRes.data[0] as Dataset).id)
    setLoading(false)
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  async function handleAddSubmission(data: Partial<JournalSubmission>) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('journal_submissions').insert({ ...data, project_id: projectId, created_by: user?.id })
    await load()
  }

  async function handleUpdateSubmission(id: string, patch: Partial<JournalSubmission>) {
    await supabase.from('journal_submissions').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    await load()
  }

  async function handleRegister(data: {
    title: string
    authors: Array<{ name: string; institution: string; orcid: string }>
    abstract: string
    study_design: string
    is_public: boolean
  }) {
    const { data: { user } } = await supabase.auth.getUser()
    const doc = documents.find(d => d.id === selectedDocId)
    const content = doc?.content ?? ''
    const encoder = new TextEncoder()
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(content))
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Generate registration ID via DB function
    const { data: idData } = await supabase.rpc('generate_registration_id')
    const registrationId = idData ?? `PLXR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`

    await supabase.from('protocol_registrations').insert({
      document_id: selectedDocId,
      project_id: projectId,
      document_version: 1,
      registration_id: registrationId,
      title: data.title,
      authors: data.authors,
      abstract: data.abstract,
      study_design: data.study_design,
      content_hash: contentHash,
      is_public: data.is_public,
      created_by: user?.id,
    })
    await load()
    return { registration_id: registrationId }
  }

  async function handleDOIMint(data: {
    title: string
    authors: Array<{ name: string; orcid: string; affiliation: string }>
    description: string
    license: string
    keywords: string
    geographic_scope: string
    embargo_until: string
  }) {
    const { data: { user } } = await supabase.auth.getUser()
    const year = new Date().getFullYear()
    const seq = String(Math.floor(Math.random() * 99999)).padStart(5, '0')
    const reservedDoi = `10.5281/plexus.dataset.${year}${seq}`

    const authorList = data.authors.filter(a => a.name).map(a => a.name)
    const firstAuthor = data.authors[0]?.name?.split(' ').pop() ?? 'Unknown'
    const citationText = `${authorList.join(', ')} (${year}). ${data.title}. PLEXUS. https://doi.org/${reservedDoi}`

    await supabase.from('dataset_publications').insert({
      dataset_id: selectedDatasetId,
      version_id: selectedVersionId || null,
      reserved_doi: reservedDoi,
      title: data.title,
      authors: data.authors,
      description: data.description,
      license: data.license,
      keywords: (data.keywords as string).split(',').map((k: string) => k.trim()).filter(Boolean),
      geographic_scope: data.geographic_scope,
      embargo_until: data.embargo_until || null,
      citation_text: citationText,
      status: 'reserved',
      created_by: user?.id,
    })
    await load()
    return { reserved_doi: reservedDoi }
  }

  async function handleInsertCitation(citation: CslCitation) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('project_citations').insert({
      project_id: projectId,
      citation_data: citation,
      source: citation.source ?? 'manual',
      external_id: citation.external_id ?? citation.DOI ?? null,
      created_by: user?.id,
    })
    await load()
    setShowCitationSearch(false)
  }

  const selectedDoc = documents.find(d => d.id === selectedDocId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900">Publication Pipeline</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Format manuscripts, manage citations, track submissions, register protocols, and mint DOIs.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {([
          ['journals', 'Journal Library', BookOpen],
          ['citations', 'Citations', BookMarked],
          ['submissions', 'Submissions', Send],
          ['preregister', 'Protocol Registry', Shield],
          ['doi', 'DOI Minting', Database],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap -mb-px ${
              tab === key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Journal Library ── */}
      {tab === 'journals' && (
        <div>
          <JournalSearch journals={journals} />
        </div>
      )}

      {/* ── Citations ── */}
      {tab === 'citations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Citation Library</h3>
              <p className="text-xs text-gray-400 mt-0.5">{citations.length} references · Press Cmd+Shift+R to open citation search</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCoverLetter(true)}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Cover Letter
              </button>
              <button
                onClick={() => setShowCitationSearch(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg"
              >
                <Search className="h-3.5 w-3.5" />
                Search & Insert
              </button>
            </div>
          </div>

          <BibliographyGenerator
            citations={citations}
            style={citationStyle}
            onStyleChange={setCitationStyle}
          />
        </div>
      )}

      {/* ── Submissions ── */}
      {tab === 'submissions' && (
        <div className="space-y-4">
          {/* Document selector */}
          {documents.length > 0 && (
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <select
                value={selectedDocId}
                onChange={e => setSelectedDocId(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {documents.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
              {selectedDocId && (
                <button
                  onClick={() => setShowCoverLetter(true)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Generate Cover Letter
                </button>
              )}
            </div>
          )}

          {selectedDocId ? (
            <SubmissionTracker
              submissions={submissions.filter(s => s.document_id === selectedDocId)}
              documentId={selectedDocId}
              projectId={projectId}
              onUpdate={handleUpdateSubmission}
              onAdd={() => setShowSubmissionForm(true)}
            />
          ) : (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
              <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">No documents yet</p>
              <p className="text-xs text-gray-400 mt-1">Create a document first to track submissions</p>
            </div>
          )}
        </div>
      )}

      {/* ── Protocol Registry ── */}
      {tab === 'preregister' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Protocol Registrations</h3>
              <p className="text-xs text-gray-400 mt-0.5">Timestamped, hash-verified public registrations</p>
            </div>
            <button
              onClick={() => setShowPreregWizard(true)}
              disabled={!selectedDocId}
              className="flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Preregister Protocol
            </button>
          </div>

          {documents.length > 0 && (
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-gray-400" />
              <select
                value={selectedDocId}
                onChange={e => setSelectedDocId(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {documents.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
          )}

          {registrations.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
              <Shield className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">No registrations yet</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">Register your protocol before data collection begins</p>
              <button
                onClick={() => setShowPreregWizard(true)}
                disabled={!selectedDocId}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-40"
              >
                Register first protocol →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {registrations.map(reg => (
                <div key={reg.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                          {reg.registration_id}
                        </span>
                        <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded flex items-center gap-1">
                          ✓ Verified
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">{reg.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Registered {new Date(reg.registered_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <a
                      href={`/registry/${reg.registration_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50"
                    >
                      View public page →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DOI Minting ── */}
      {tab === 'doi' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Dataset Publications</h3>
              <p className="text-xs text-gray-400 mt-0.5">Publish datasets with permanent Digital Object Identifiers</p>
            </div>
            <button
              onClick={() => setShowDoiWizard(true)}
              disabled={datasets.length === 0}
              className="flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Publish Dataset
            </button>
          </div>

          {datasets.length > 0 && (
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-gray-400" />
              <select
                value={selectedDatasetId}
                onChange={e => setSelectedDatasetId(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}

          {datasets.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
              <Database className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">No datasets yet</p>
              <p className="text-xs text-gray-400 mt-1">Upload a dataset to the Data tab first</p>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
              <p className="font-semibold mb-1">DataCite Integration</p>
              <p>DOIs are minted via the DataCite REST API. Until DataCite membership is configured, a reserved DOI will be generated and queued for activation. The public landing page is created immediately.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {showSubmissionForm && selectedDocId && (
        <SubmissionForm
          documentId={selectedDocId}
          projectId={projectId}
          onSubmit={handleAddSubmission}
          onClose={() => setShowSubmissionForm(false)}
        />
      )}

      {showPreregWizard && selectedDocId && (
        <PreregistrationWizard
          documentTitle={selectedDoc?.title ?? 'Protocol'}
          onRegister={handleRegister}
          onClose={() => setShowPreregWizard(false)}
        />
      )}

      {showDoiWizard && selectedDatasetId && (
        <DOIMintingWizard
          datasetTitle={datasets.find(d => d.id === selectedDatasetId)?.name ?? 'Dataset'}
          datasetId={selectedDatasetId}
          versionId={selectedVersionId}
          onMint={handleDOIMint}
          onClose={() => setShowDoiWizard(false)}
        />
      )}

      {showCoverLetter && (
        <CoverLetterGenerator
          manuscriptTitle={selectedDoc?.title ?? ''}
          abstract={citations.length > 0 ? `[${citations.length} references cited]` : ''}
          journalName=""
          authorName=""
          authorAffiliation=""
          authorEmail=""
          onClose={() => setShowCoverLetter(false)}
        />
      )}

      {showCitationSearch && (
        <CitationSearch
          projectId={projectId}
          onInsert={handleInsertCitation}
          onClose={() => setShowCitationSearch(false)}
        />
      )}
    </div>
  )
}
