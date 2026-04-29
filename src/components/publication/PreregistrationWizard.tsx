"use client"

import { useState } from 'react'
import { X, Shield, ChevronRight, ChevronLeft, CheckCircle, Plus, Trash2 } from 'lucide-react'

interface Author {
  name: string
  institution: string
  orcid: string
}

interface PreregistrationData {
  title: string
  authors: Author[]
  abstract: string
  study_design: string
  is_public: boolean
}

interface PreregistrationWizardProps {
  documentTitle: string
  defaultAuthors?: Author[]
  onRegister: (data: PreregistrationData) => Promise<{ registration_id: string }>
  onClose: () => void
}

const STEPS = ['Details', 'Authors', 'Review & Register']

export function PreregistrationWizard({ documentTitle, defaultAuthors = [], onRegister, onClose }: PreregistrationWizardProps) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState<string | null>(null)
  const [data, setData] = useState<PreregistrationData>({
    title: documentTitle,
    authors: defaultAuthors.length > 0 ? defaultAuthors : [{ name: '', institution: '', orcid: '' }],
    abstract: '',
    study_design: '',
    is_public: true,
  })

  function updateAuthor(i: number, field: keyof Author, value: string) {
    setData(d => ({
      ...d,
      authors: d.authors.map((a, idx) => idx === i ? { ...a, [field]: value } : a)
    }))
  }

  function addAuthor() {
    setData(d => ({ ...d, authors: [...d.authors, { name: '', institution: '', orcid: '' }] }))
  }

  function removeAuthor(i: number) {
    setData(d => ({ ...d, authors: d.authors.filter((_, idx) => idx !== i) }))
  }

  async function handleRegister() {
    setLoading(true)
    try {
      const result = await onRegister(data)
      setRegistered(result.registration_id)
    } finally {
      setLoading(false)
    }
  }

  if (registered) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Protocol Registered!</h2>
          <p className="text-sm text-gray-500 mb-4">Your protocol has been timestamped and is publicly verifiable.</p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
            <p className="text-xs text-gray-500 mb-1">Registration ID</p>
            <p className="text-xl font-mono font-bold text-blue-600">{registered}</p>
            <p className="text-xs text-gray-400 mt-2">
              Public URL: <span className="text-blue-500">plexus.science/registry/{registered}</span>
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigator.clipboard.writeText(`https://plexus.science/registry/${registered}`)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 px-4 py-2 border border-blue-200 rounded-xl"
            >
              Copy URL
            </button>
            <button
              onClick={onClose}
              className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-600" />
            <h2 className="font-semibold text-gray-900 text-sm">Preregister Protocol</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Steps */}
        <div className="flex px-5 pt-4 gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                i < step ? 'bg-blue-600 text-white' : i === step ? 'bg-blue-100 text-blue-600 border-2 border-blue-500' : 'bg-gray-100 text-gray-400'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-medium ${i === step ? 'text-blue-600' : 'text-gray-400'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? 'bg-blue-300' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 min-h-[320px]">
          {/* Step 0: Details */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Registration Title *</label>
                <input
                  type="text"
                  value={data.title}
                  onChange={e => setData(d => ({ ...d, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Abstract *</label>
                <textarea
                  rows={5}
                  value={data.abstract}
                  onChange={e => setData(d => ({ ...d, abstract: e.target.value }))}
                  placeholder="Summarize the background, methods, and expected outcomes of your study…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Study Design *</label>
                <input
                  type="text"
                  value={data.study_design}
                  onChange={e => setData(d => ({ ...d, study_design: e.target.value }))}
                  placeholder="e.g. Community-based cross-sectional study"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_public"
                  checked={data.is_public}
                  onChange={e => setData(d => ({ ...d, is_public: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <label htmlFor="is_public" className="text-xs text-gray-700">Make this registration publicly visible</label>
              </div>
            </div>
          )}

          {/* Step 1: Authors */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Add all study authors with their ORCID IDs where available.</p>
              {data.authors.map((author, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">Author {i + 1}</span>
                    {data.authors.length > 1 && (
                      <button onClick={() => removeAuthor(i)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Full name *"
                    value={author.name}
                    onChange={e => updateAuthor(i, 'name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Institution"
                      value={author.institution}
                      onChange={e => updateAuthor(i, 'institution', e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="ORCID (0000-0000-0000-0000)"
                      value={author.orcid}
                      onChange={e => updateAuthor(i, 'orcid', e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={addAuthor}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add another author
              </button>
            </div>
          )}

          {/* Step 2: Review */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
                <p className="font-semibold mb-1">Important: This action is irreversible</p>
                <p>Once registered, the protocol content is frozen and a SHA-256 hash is stored. Amendments can be added later but the original registration cannot be modified.</p>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Title</span>
                  <span className="text-gray-900 font-medium max-w-xs text-right">{data.title}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Authors</span>
                  <span className="text-gray-900 font-medium">{data.authors.filter(a => a.name).map(a => a.name).join(', ')}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Study design</span>
                  <span className="text-gray-900 font-medium">{data.study_design || '—'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Visibility</span>
                  <span className={`font-medium ${data.is_public ? 'text-green-600' : 'text-gray-600'}`}>
                    {data.is_public ? 'Public' : 'Private'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Content hash</span>
                  <span className="text-gray-400 font-mono">Will be computed at registration</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : onClose()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
          >
            <ChevronLeft className="h-4 w-4" />
            {step > 0 ? 'Back' : 'Cancel'}
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 0 && (!data.title || !data.abstract || !data.study_design)}
              className="flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleRegister}
              disabled={loading}
              className="flex items-center gap-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              <Shield className="h-4 w-4" />
              {loading ? 'Registering…' : 'Register Protocol'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
