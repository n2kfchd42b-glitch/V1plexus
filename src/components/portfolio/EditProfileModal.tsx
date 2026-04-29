/**
 * Edit Profile Modal
 * Form for updating researcher profile details
 */

'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import type { ResearcherProfile } from '@/types/portfolio'

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: any[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}

interface EditProfileModalProps {
  profile: ResearcherProfile
  isOpen: boolean
  onClose: () => void
  onSave: (data: Record<string, any>) => Promise<void>
}

export function EditProfileModal({
  profile,
  isOpen,
  onClose,
  onSave,
}: EditProfileModalProps) {
  const [formData, setFormData] = useState({
    username: profile.username || '',
    portfolio_headline: profile.portfolio_headline || '',
    bio: profile.bio || '',
    institution: profile.institution || '',
    role: profile.position || profile.role || '',
    orcid_id: profile.orcid_id || '',
    google_scholar_url: profile.google_scholar_url || '',
    researchgate_url: profile.researchgate_url || '',
    personal_website: profile.personal_website || '',
    research_areas: profile.research_areas || [],
    portfolio_public: profile.portfolio_public,
  })

  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle')
  const [newArea, setNewArea] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (error && bodyRef.current) {
      bodyRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [error])

  const checkUsername = useCallback(
    debounce(async (username: string) => {
      if (!username || username === profile.username) {
        setUsernameStatus('idle')
        return
      }

      if (!/^[a-z0-9-]{3,30}$/.test(username.toLowerCase())) {
        setUsernameStatus('invalid')
        return
      }

      setUsernameStatus('checking')

      try {
        const response = await fetch(
          `/api/portfolio/username/check?username=${encodeURIComponent(username)}`
        )
        const data = await response.json()
        setUsernameStatus(data.available ? 'available' : 'taken')
      } catch (err) {
        setUsernameStatus('idle')
      }
    }, 400),
    [profile.username]
  )

  const handleUsernameChange = (value: string) => {
    setFormData((prev) => ({ ...prev, username: value }))
    checkUsername(value)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      if (
        formData.username &&
        formData.username !== profile.username &&
        usernameStatus !== 'available'
      ) {
        setError('Please choose an available username')
        return
      }

      await onSave(formData)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
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
          <h2 className="text-xl font-bold text-on-surface">Edit Profile</h2>
        </div>

        {/* Body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Username */}
          <div>
            <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
              Profile URL
            </label>
            <div className="relative flex">
              <span className="flex items-center px-3 bg-surface-container-low text-sm text-on-surface-variant">
                plexus.science/profile/
              </span>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="your-username"
                className="flex-1 px-3 py-2 border border-l-0 border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {usernameStatus === 'checking' && (
              <p className="text-xs text-on-surface-variant mt-1">Checking...</p>
            )}
            {usernameStatus === 'available' && (
              <p className="text-xs text-green-600 mt-1">✓ Available</p>
            )}
            {usernameStatus === 'taken' && (
              <p className="text-xs text-red-600 mt-1">✗ Already taken</p>
            )}
            {usernameStatus === 'invalid' && (
              <p className="text-xs text-red-600 mt-1">
                Must be 3-30 characters, letters, numbers, and hyphens only
              </p>
            )}
          </div>

          {/* Full Name (read-only for now) */}
          <div>
            <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={profile.full_name}
              disabled
              className="w-full px-3 py-2 bg-surface-container-low rounded text-sm text-on-surface-variant"
            />
          </div>

          {/* Portfolio Headline */}
          <div>
            <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
              Portfolio Headline
            </label>
            <input
              type="text"
              value={formData.portfolio_headline}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  portfolio_headline: e.target.value.slice(0, 120),
                }))
              }
              placeholder="One sentence about your research"
              maxLength={120}
              className="w-full px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-on-surface-variant mt-1">
              {formData.portfolio_headline.length}/120
            </p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
              Bio
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  bio: e.target.value.slice(0, 500),
                }))
              }
              placeholder="Tell us about your research"
              maxLength={500}
              rows={4}
              className="w-full px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            <p className="text-xs text-on-surface-variant mt-1">
              {formData.bio.length}/500
            </p>
          </div>

          {/* Institution */}
          <div>
            <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
              Institution
            </label>
            <input
              type="text"
              value={formData.institution}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  institution: e.target.value,
                }))
              }
              placeholder="e.g. University of Ghana"
              className="w-full px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
              Role
            </label>
            <input
              type="text"
              value={formData.role}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  role: e.target.value,
                }))
              }
              placeholder="e.g. PhD Candidate"
              className="w-full px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Research Areas */}
          <div>
            <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
              Research Areas
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newArea}
                onChange={(e) => setNewArea(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newArea.trim()) {
                    setFormData((prev) => ({
                      ...prev,
                      research_areas: [...prev.research_areas, newArea.trim()],
                    }))
                    setNewArea('')
                  }
                }}
                placeholder="Add research area..."
                className="flex-1 px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.research_areas.map((area, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 text-xs bg-primary text-white rounded-full flex items-center gap-1"
                >
                  {area}
                  <button
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        research_areas: prev.research_areas.filter(
                          (_, i) => i !== idx
                        ),
                      }))
                    }
                    className="text-xs ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* External Links Section */}
          <div className="border-t border-surface-container-low pt-6">
            <h3 className="font-bold text-sm text-on-surface mb-4">
              External Links
            </h3>

            <div>
              <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
                ORCID ID
              </label>
              <input
                type="text"
                value={formData.orcid_id}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    orcid_id: e.target.value,
                  }))
                }
                placeholder="0000-0000-0000-0000"
                className="w-full px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="mt-4">
              <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
                Google Scholar URL
              </label>
              <input
                type="url"
                value={formData.google_scholar_url}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    google_scholar_url: e.target.value,
                  }))
                }
                placeholder="https://scholar.google.com/citations?user=..."
                className="w-full px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="mt-4">
              <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
                ResearchGate URL
              </label>
              <input
                type="url"
                value={formData.researchgate_url}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    researchgate_url: e.target.value,
                  }))
                }
                placeholder="https://www.researchgate.net/profile/..."
                className="w-full px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="mt-4">
              <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
                Personal Website
              </label>
              <input
                type="url"
                value={formData.personal_website}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    personal_website: e.target.value,
                  }))
                }
                placeholder="https://yourwebsite.com"
                className="w-full px-3 py-2 border border-surface-container rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Privacy */}
          <div className="border-t border-surface-container-low pt-6">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.portfolio_public}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    portfolio_public: e.target.checked,
                  }))
                }
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-on-surface">
                Make portfolio public
              </span>
            </label>
            {!formData.portfolio_public && (
              <p className="text-xs text-amber-600 mt-2">
                Your portfolio will be private — only you can see it.
              </p>
            )}
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
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
