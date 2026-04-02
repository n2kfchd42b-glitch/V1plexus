/**
 * Profile Setup Page
 * Initial profile configuration for new researchers
 * GET/POST /profile/setup
 */

'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EditProfileModal } from '@/components/portfolio/EditProfileModal'

export default function ProfileSetupPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [datasets, setDatasets] = useState<any[]>([])

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (!response.ok) {
          router.push('/auth/signin')
          return
        }

        const { user: authUser } = await response.json()
        setUser(authUser)

        // Fetch user's datasets for context
        const datasetsResponse = await fetch('/api/datasets/my')
        if (datasetsResponse.ok) {
          const data = await datasetsResponse.json()
          setDatasets(data || [])
        }

        setShowModal(true)
      } catch (error) {
        console.error('Failed to load user:', error)
        router.push('/auth/signin')
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [router])

  const handleProfileSaved = async () => {
    // Fetch updated profile to get username
    const response = await fetch('/api/auth/me')
    if (response.ok) {
      const { user: updatedUser } = await response.json()
      if (updatedUser?.user_metadata?.username) {
        router.push(`/profile/${updatedUser.user_metadata.username}`)
      } else {
        router.push('/profile/me')
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-on-surface-variant">Setting up your profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-on-surface mb-2">
          Welcome to PLEXUS
        </h1>
        <p className="text-on-surface-variant mb-8">
          Let's set up your research profile. This will help collaborators find
          and verify your research practices.
        </p>

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-surface-container">
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-on-surface">
                  Create your profile
                </p>
                <p className="text-xs text-on-surface-variant">
                  Name, bio, and research areas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-container text-primary text-sm font-bold flex items-center justify-center">
                2
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-on-surface">
                  Generate your URL
                </p>
                <p className="text-xs text-on-surface-variant">
                  plexus.health/profile/your-name
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-container text-primary text-sm font-bold flex items-center justify-center">
                3
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-on-surface">
                  Share your integrity
                </p>
                <p className="text-xs text-on-surface-variant">
                  Let others verify your research
                </p>
              </div>
            </div>
          </div>

          {datasets.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-8 text-left">
              <p className="text-xs font-semibold text-blue-900">
                You have {datasets.length} dataset{datasets.length !== 1 ? 's' : ''} ready
              </p>
              <p className="text-xs text-blue-800 mt-1">
                Once you create your profile, you can add them to your portfolio.
              </p>
            </div>
          )}

          <button
            onClick={() => setShowModal(true)}
            className="w-full px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark transition-colors"
          >
            Get Started →
          </button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {user && (
        <EditProfileModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSave={handleProfileSaved}
          profile={{
            id: user.id ?? '',
            username: user.user_metadata?.username ?? null,
            full_name: user.user_metadata?.full_name ?? user.email ?? '',
            bio: null,
            institution: null,
            role: null,
            research_areas: [],
            orcid_id: null,
            google_scholar_url: null,
            researchgate_url: null,
            personal_website: null,
            portfolio_headline: null,
            avatar_color: '#6366f1',
            initials: '',
            joined_at: new Date().toISOString(),
            portfolio_public: true,
          }}
        />
      )}
    </div>
  )
}
