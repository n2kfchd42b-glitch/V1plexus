'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { EditProfileModal } from '@/components/portfolio/EditProfileModal'

export default function ProfileSetupPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [datasets, setDatasets] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          router.push('/auth/signin')
          return
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileError || !profileData) {
          router.push('/auth/signin')
          return
        }

        // If they already have a username, go straight to portfolio
        if (profileData.username) {
          router.push(`/profile/${profileData.username}`)
          return
        }

        setProfile(profileData)

        const { data: datasetsData } = await supabase
          .from('datasets')
          .select('id, name')
          .eq('uploaded_by', user.id)
          .is('deleted_at', null)
          .limit(10)

        setDatasets(datasetsData ?? [])
      } catch (error) {
        console.error('Failed to load user:', error)
        router.push('/auth/signin')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router])

  const handleProfileSaved = async (data: Record<string, any>) => {
    const res = await fetch('/api/portfolio/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'Failed to save profile')
    }

    const saved = await res.json()
    const username = saved.username || data.username
    if (username) {
      router.push(`/profile/${username}`)
    } else {
      router.push('/profile/me')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-on-surface mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Welcome to PLEXUS
        </h1>
        <p className="text-on-surface-variant mb-8">
          Let's set up your research profile. This will help collaborators find
          and verify your research practices.
        </p>

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-surface-container">
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">1</div>
              <div className="text-left">
                <p className="text-sm font-semibold text-on-surface">Create your profile</p>
                <p className="text-xs text-on-surface-variant">Name, bio, and research areas</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-container text-primary text-sm font-bold flex items-center justify-center">2</div>
              <div className="text-left">
                <p className="text-sm font-semibold text-on-surface">Generate your URL</p>
                <p className="text-xs text-on-surface-variant">plexus.science/profile/your-name</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-container text-primary text-sm font-bold flex items-center justify-center">3</div>
              <div className="text-left">
                <p className="text-sm font-semibold text-on-surface">Share your integrity</p>
                <p className="text-xs text-on-surface-variant">Let others verify your research</p>
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
            className="w-full px-6 py-3 bg-primary text-white font-bold rounded-lg hover:opacity-90 transition-opacity"
          >
            Get Started →
          </button>
        </div>
      </div>

      {profile && (
        <EditProfileModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSave={handleProfileSaved}
          profile={{
            id: profile.id,
            username: profile.username ?? null,
            full_name: profile.full_name ?? '',
            bio: profile.bio ?? null,
            institution: profile.institution ?? null,
            role: profile.position ?? null,
            position: profile.position ?? null,
            research_areas: profile.research_areas ?? [],
            orcid_id: profile.orcid_id ?? null,
            google_scholar_url: profile.google_scholar_url ?? null,
            researchgate_url: profile.researchgate_url ?? null,
            personal_website: profile.personal_website ?? null,
            portfolio_headline: profile.portfolio_headline ?? null,
            avatar_color: profile.avatar_color ?? '#003d9b',
            initials: profile.full_name
              ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
              : '??',
            joined_at: profile.created_at ?? new Date().toISOString(),
            portfolio_public: profile.portfolio_public ?? true,
          }}
        />
      )}
    </div>
  )
}
