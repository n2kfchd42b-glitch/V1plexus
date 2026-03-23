"use client"

import { useState } from 'react'
import { X, Database, ChevronRight, ChevronLeft, CheckCircle, Plus, Trash2 } from 'lucide-react'

interface Author {
  name: string
  orcid: string
  affiliation: string
}

interface DOIFormData {
  title: string
  authors: Author[]
  description: string
  license: 'CC-BY-4.0' | 'CC-BY-SA-4.0' | 'CC-BY-NC-4.0' | 'CC0' | 'custom'
  keywords: string
  geographic_scope: string
  embargo_until: string
}

interface DOIMintingWizardProps {
  datasetTitle: string
  datasetId: string
  versionId: string
  onMint: (data: DOIFormData) => Promise<{ doi?: string; reserved_doi?: string }>
  onClose: () => void
}

const STEPS = ['Metadata', 'Authors', 'License & Access', 'Confirm']

export function DOIMintingWizard({ datasetTitle, datasetId, versionId, onMint, onClose }: DOIMintingWizardProps) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ doi?: string; reserved_doi?: string } | null>(null)
  const [form, setForm] = useState<DOIFormData>({
    title: datasetTitle,
    authors: [{ name: '', orcid: '', affiliation: '' }],
    description: '',
    license: 'CC-BY-4.0',
    keywords: '',
    geographic_scope: '',
    embargo_until: '',
  })

  function updateAuthor(i: number, field: keyof Author, value: string) {
    setForm(f => ({ ...f, authors: f.authors.map((a, idx) => idx === i ? { ...a, [field]: value } : a) }))
  }

  async function handleMint() {
    setLoading(true)
    try {
      const r = await onMint(form)
      setResult(r)
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    const identifier = result.doi ?? result.reserved_doi
    const isReserved = !result.doi
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 p-8 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isReserved ? 'bg-amber-50' : 'bg-green-100'}`}>
            <CheckCircle className={`h-8 w-8 ${isReserved ? 'text-amber-500' : 'text-green-600'}`} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isReserved ? 'DOI Reserved' : 'Dataset Published!'}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            {isReserved
              ? 'Your DOI has been reserved. It will be activated when DataCite membership is confirmed.'
              : 'Your dataset is now publicly accessible with a permanent DOI.'}
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
            <p className="text-xs text-gray-500 mb-1">{isReserved ? 'Reserved DOI' : 'DOI'}</p>
            <p className="text-lg font-mono font-bold text-blue-600">{identifier}</p>
            <p className="text-xs text-gray-400 mt-1">https://doi.org/{identifier}</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigator.clipboard.writeText(`https://doi.org/${identifier}`)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 px-4 py-2 border border-blue-200 rounded-xl"
            >
              Copy DOI URL
            </button>
            <button
              onClick={onClose}
              className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl"
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
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-600" />
            <h2 className="font-semibold text-gray-900 text-sm">Publish Dataset with DOI</h2>
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
              }`}>{i < step ? '✓' : i + 1}</div>
              <span className={`text-xs font-medium ${i === step ? 'text-blue-600' : 'text-gray-400'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? 'bg-blue-300' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 min-h-[320px]">
          {/* Step 0: Metadata */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Dataset Title *</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
                <textarea rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the dataset contents, collection methods, and intended use…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Keywords</label>
                  <input type="text" value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                    placeholder="malaria, Ghana, children (comma separated)"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Geographic Scope</label>
                  <input type="text" value={form.geographic_scope} onChange={e => setForm(f => ({ ...f, geographic_scope: e.target.value }))}
                    placeholder="e.g. Northern Ghana"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Authors */}
          {step === 1 && (
            <div className="space-y-3">
              {form.authors.map((author, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">Author {i + 1}</span>
                    {form.authors.length > 1 && (
                      <button onClick={() => setForm(f => ({ ...f, authors: f.authors.filter((_, idx) => idx !== i) }))}
                        className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                  <input type="text" placeholder="Full name *" value={author.name} onChange={e => updateAuthor(i, 'name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Affiliation" value={author.affiliation} onChange={e => updateAuthor(i, 'affiliation', e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input type="text" placeholder="ORCID" value={author.orcid} onChange={e => updateAuthor(i, 'orcid', e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              ))}
              <button onClick={() => setForm(f => ({ ...f, authors: [...f.authors, { name: '', orcid: '', affiliation: '' }] }))}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700">
                <Plus className="h-3.5 w-3.5" />Add another author
              </button>
            </div>
          )}

          {/* Step 2: License */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">License *</label>
                <div className="space-y-2">
                  {[
                    ['CC-BY-4.0', 'CC BY 4.0', 'Free to share and adapt with attribution'],
                    ['CC-BY-SA-4.0', 'CC BY-SA 4.0', 'Share-alike: derivatives must use same license'],
                    ['CC-BY-NC-4.0', 'CC BY-NC 4.0', 'Non-commercial use only'],
                    ['CC0', 'CC0 1.0', 'Public domain — no rights reserved'],
                  ].map(([value, label, desc]) => (
                    <label key={value} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                      form.license === value ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                      <input type="radio" name="license" value={value} checked={form.license === value}
                        onChange={e => setForm(f => ({ ...f, license: e.target.value as DOIFormData['license'] }))}
                        className="mt-0.5 text-blue-600" />
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{label}</p>
                        <p className="text-xs text-gray-500">{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Embargo Until <span className="text-gray-400">(optional)</span></label>
                <input type="date" value={form.embargo_until} onChange={e => setForm(f => ({ ...f, embargo_until: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">Dataset will only be accessible after this date</p>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
                <p className="font-semibold mb-1">DataCite DOI Registration</p>
                <p>A permanent Digital Object Identifier will be minted for this dataset. If DataCite is not yet configured, a reserved DOI will be generated and queued for activation.</p>
              </div>
              <div className="space-y-1.5 text-xs">
                {[
                  ['Title', form.title],
                  ['Authors', form.authors.filter(a => a.name).map(a => a.name).join(', ')],
                  ['License', form.license],
                  ['Geographic scope', form.geographic_scope || '—'],
                  ['Embargo', form.embargo_until || 'None'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-gray-900 font-medium text-right max-w-xs">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
          <button onClick={() => step > 0 ? setStep(s => s - 1) : onClose()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
            <ChevronLeft className="h-4 w-4" />
            {step > 0 ? 'Back' : 'Cancel'}
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)}
              disabled={step === 0 && (!form.title || !form.description)}
              className="flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl disabled:opacity-50">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={handleMint} disabled={loading}
              className="flex items-center gap-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-xl disabled:opacity-50">
              <Database className="h-4 w-4" />
              {loading ? 'Minting DOI…' : 'Publish Dataset'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
