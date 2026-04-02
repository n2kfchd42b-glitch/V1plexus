/**
 * Add Publication Modal
 * Form for adding a publication to portfolio
 */

'use client'

import React, { useState } from 'react'
import type { AddPublicationRequest } from '@/types/portfolio'

interface AddPublicationModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (data: AddPublicationRequest) => Promise<void>
  datasets: Array<{ id: string; name: string }>
  datasetVersions?: Array<{ id: string; version_number: number; commit_message: string }>
}

export function AddPublicationModal({
  isOpen,
  onClose,
  onAdd,
  datasets,
  datasetVersions = [],
}: AddPublicationModalProps) {
  const [doi, setDoi] = useState('')
  const [importing, setImporting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    journal: '',
    year: new Date().getFullYear(),
    doi: '',
    authors: [] as string[],
    abstract: '',
    study_type: '',
    study_population: '',
    sample_size: undefined as number | undefined,
    reporting_guideline: '',
    dataset_id: '',
    version_id: '',
    is_public: true,
  })

  const [newAuthor, setNewAuthor] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doiLookupDone, setDoiLookupDone] = useState(false)

  const handleDoiLookup = async () => {
    if (!doi.trim()) {
      setError('Please enter a DOI')
      return
    }

    setImporting(true)
    setError(null)

    try {
      const response = await fetch(
        `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
        { headers: { 'User-Agent': 'PLEXUS Research Platform' } }
      )

      if (!response.ok) {
        setError('DOI not found — enter details manually')
        setImporting(false)
        return
      }

      const data = await response.json()
      const work = data.message

      setFormData((prev) => ({
        ...prev,
        title: work.title?.[0] || prev.title,
        journal: work.container_title || prev.journal,
        year: work.published_online?.date_parts?.[0]?.[0] || prev.year,
        doi: work.doi || doi,
        authors: work.author?.map((a: any) => `${a.given || ''} ${a.family}`.trim()).filter(Boolean) || prev.authors,
        abstract: work.abstract || prev.abstract,
      }))

      setDoiLookupDone(true)
    } catch (err) {
      setError('Failed to lookup DOI — enter details manually')
    } finally {
      setImporting(false)
    }
  }

  const handleAdd = async () => {
    try {
      if (!formData.title.trim()) {
        setError('Title is required')
        return
      }

      setSaving(true)
      setError(null)

      await onAdd(formData)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add publication')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl max-w-xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-surface-container-low p-6">
          <h2 className="text-xl font-bold text-on-surface">
            Add Publication
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Link a published paper to your PLEXUS research certificate
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* DOI Lookup */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs font-bold uppercase text-blue-700 mb-2">
              Have a DOI? Import automatically
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                placeholder="10.1371/journal.pmed.1234567"
                className="flex-1 px-3 py-2 border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleDoiLookup}
                disabled={importing}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {importing ? 'Looking up...' : 'Import'}
              </button>
            </div>
            {doiLookupDone && (
              <p className="text-xs text-green-600 mt-2">
                ✓ Imported from CrossRef
              </p>
            )}
          </div>

          <div className="text-center">
            <div className="text-xs text-on-surface-variant uppercase tracking-wider">
              or enter manually
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              className="w-full px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Authors */}
          <div>
            <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
              Authors
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newAuthor}
                onChange={(e) => setNewAuthor(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newAuthor.trim()) {
                    setFormData((prev) => ({
                      ...prev,
                      authors: [...prev.authors, newAuthor.trim()],
                    }))
                    setNewAuthor('')
                  }
                }}
                placeholder="e.g. Abrokwa SK"
                className="flex-1 px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.authors.map((author, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 text-xs bg-primary text-white rounded-full flex items-center gap-1"
                >
                  {author}
                  <button
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        authors: prev.authors.filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Journal, Year, DOI */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
                Journal
              </label>
              <input
                type="text"
                value={formData.journal}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, journal: e.target.value }))
                }
                className="w-full px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
                Year
              </label>
              <input
                type="number"
                value={formData.year}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    year: parseInt(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
              DOI
            </label>
            <input
              type="text"
              value={formData.doi}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, doi: e.target.value }))
              }
              placeholder="10.1371/journal.pmed.1234567"
              className="w-full px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Study Details */}
          <div className="border-t border-surface-container-low pt-4">
            <h3 className="font-bold text-sm text-on-surface mb-4">
              Study Details
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
                  Study Type
                </label>
                <select
                  value={formData.study_type}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      study_type: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select...</option>
                  <option>Cross-sectional</option>
                  <option>Cohort study</option>
                  <option>Case-control</option>
                  <option>RCT</option>
                  <option>Systematic review</option>
                  <option>Meta-analysis</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
                  Sample Size
                </label>
                <input
                  type="number"
                  value={formData.sample_size || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      sample_size: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    }))
                  }
                  className="w-full px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
                Study Population
              </label>
              <input
                type="text"
                value={formData.study_population}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    study_population: e.target.value,
                  }))
                }
                placeholder="e.g. Children under 5, Ghana"
                className="w-full px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Abstract */}
          <div>
            <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
              Abstract
            </label>
            <textarea
              value={formData.abstract}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  abstract: e.target.value,
                }))
              }
              rows={3}
              className="w-full px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Visibility */}
          <div className="border-t border-surface-container-low pt-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_public}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    is_public: e.target.checked,
                  }))
                }
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-on-surface">
                Make this public
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-surface-container-low p-6 flex items-center justify-between gap-4 bg-surface-container-lowest">
          <button
            onClick={onClose}
            className="text-sm font-semibold text-on-surface-variant hover:text-on-surface"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={saving || !formData.title.trim()}
            className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add Publication →'}
          </button>
        </div>
      </div>
    </div>
  )
}
