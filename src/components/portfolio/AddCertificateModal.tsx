/**
 * Add Certificate Modal
 * Form for adding a research certificate to portfolio
 */

'use client'

import React, { useState } from 'react'
import type { AddCertificateRequest, PortfolioPublicCert } from '@/types/portfolio'

interface AddCertificateModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (data: AddCertificateRequest) => Promise<void>
  datasets: Array<{ id: string; name: string }>
}

export function AddCertificateModal({
  isOpen,
  onClose,
  onAdd,
  datasets,
}: AddCertificateModalProps) {
  const [formData, setFormData] = useState({
    dataset_id: '',
    version_id: '',
    display_title: '',
    context_note: '',
    is_public: true,
  })

  const [versions, setVersions] = useState<
    Array<{ id: string; version_number: number; commit_message: string }>
  >([])
  const [integritySnapshot, setIntegritySnapshot] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDatasetChange = async (datasetId: string) => {
    setFormData((prev) => ({ ...prev, dataset_id: datasetId, version_id: '' }))
    setVersions([])
    setIntegritySnapshot(null)

    if (!datasetId) return

    try {
      const response = await fetch(
        `/api/datasets/${datasetId}/versions?limit=10`
      )
      if (response.ok) {
        const data = await response.json()
        setVersions(data || [])
      }
    } catch (err) {
      console.error('Failed to fetch versions:', err)
    }
  }

  const handleVersionChange = async (versionId: string) => {
    setFormData((prev) => ({ ...prev, version_id: versionId }))
    setIntegritySnapshot(null)

    if (!versionId || !formData.dataset_id) return

    try {
      const response = await fetch(
        `/api/datasets/${formData.dataset_id}/versions/${versionId}/integrity`
      )
      if (response.ok) {
        const data = await response.json()
        setIntegritySnapshot(data)
      }
    } catch (err) {
      console.error('Failed to fetch integrity:', err)
    }
  }

  const handleAdd = async () => {
    try {
      if (!formData.dataset_id || !formData.version_id) {
        setError('Please select dataset and version')
        return
      }

      setSaving(true)
      setError(null)

      await onAdd(formData)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add certificate')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-surface-container-low p-6">
          <h2 className="text-xl font-bold text-on-surface">
            Add Research Certificate
          </h2>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Dataset Selector */}
          <div>
            <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
              Select Dataset
            </label>
            <select
              value={formData.dataset_id}
              onChange={(e) => handleDatasetChange(e.target.value)}
              className="w-full px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Choose a dataset...</option>
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.name}
                </option>
              ))}
            </select>
          </div>

          {/* Version Selector */}
          {formData.dataset_id && versions.length > 0 && (
            <div>
              <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
                Dataset Version Used
              </label>
              <select
                value={formData.version_id}
                onChange={(e) => handleVersionChange(e.target.value)}
                className="w-full px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select version...</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    Version {v.version_number}
                    {v.commit_message ? ` — ${v.commit_message}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Integrity Preview */}
          {integritySnapshot && (
            <div className="bg-surface-container-low rounded-lg p-4">
              <p className="text-xs font-bold uppercase text-on-surface-variant mb-3">
                Integrity Markers for This Version
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant">
                    DQI Score
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1 bg-surface-container rounded-full">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{
                          width: `${(integritySnapshot.dqi_score || 0) / 100 * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono font-semibold">
                      {integritySnapshot.dqi_score || 0}/100
                    </span>
                  </div>
                </div>

                {integritySnapshot.supervisor_approved && (
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 text-xs">✓</span>
                    <span className="text-xs text-on-surface-variant">
                      Supervisor approved
                    </span>
                  </div>
                )}

                {integritySnapshot.assumption_checks_conducted && (
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 text-xs">✓</span>
                    <span className="text-xs text-on-surface-variant">
                      Assumption checks conducted
                    </span>
                  </div>
                )}

                {integritySnapshot.reentry_conducted && (
                  <div className="flex items-center gap-2">
                    <span className="text-teal-600 text-xs">✓</span>
                    <span className="text-xs text-on-surface-variant">
                      Re-entry validated
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-on-surface-variant italic mt-3">
                A verification token will be created automatically
              </p>
            </div>
          )}

          {/* Display Title */}
          <div>
            <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
              Display Title (optional)
            </label>
            <input
              type="text"
              value={formData.display_title}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  display_title: e.target.value,
                }))
              }
              placeholder="Leave empty to use dataset name"
              className="w-full px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Context Note */}
          <div>
            <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
              Context Note (optional)
            </label>
            <textarea
              value={formData.context_note}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  context_note: e.target.value,
                }))
              }
              placeholder="e.g. Dataset used for my PhD thesis chapter 3. Data collected in Northern Ghana, January–August 2024."
              rows={4}
              className="w-full px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Visibility */}
          <div>
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
            disabled={saving || !formData.dataset_id || !formData.version_id}
            className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add to Portfolio →'}
          </button>
        </div>
      </div>
    </div>
  )
}
