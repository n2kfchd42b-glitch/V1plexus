"use client"

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getProfile,
  getRecentProjectsByOwner,
  countProjectsByOwner,
  updateProfile,
  updateProfileAvatar,
} from '@/lib/data'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getInitials } from '@/lib/utils'
import { LanguageSelector } from '@/components/i18n/LanguageSelector'
import { AlertTriangle, ExternalLink, ChevronRight, CheckCircle2, Globe, MapPin, Loader2, ChevronDown } from 'lucide-react'
import type { Profile } from '@/types/database'
import type { User } from '@supabase/supabase-js'

/* ── helpers ─────────────────────────────────────────────────────────────── */
const ROLE_LABELS: Record<string, string> = {
  researcher:   'Researcher',
  pi:           'Principal Investigator',
  coordinator:  'Coordinator',
  admin:        'Administrator',
}

const PHASE_LABELS: Record<string, string> = {
  concept:     'Concept',
  protocol:    'Protocol',
  ethics:      'Ethics Review',
  data:        'Data Collection',
  analysis:    'Analysis',
  writing:     'Writing',
  publication: 'Publication',
}

const PHASE_COLORS: Record<string, string> = {
  concept:     '#A1A1AA',
  protocol:    '#3B82F6',
  ethics:      '#F59E0B',
  data:        '#8B5CF6',
  analysis:    '#EC4899',
  writing:     '#14B8A6',
  publication: '#22C55E',
}

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-blue-50 text-blue-700',
  draft:     'bg-slate-100 text-slate-600',
  completed: 'bg-emerald-50 text-emerald-700',
  archived:  'bg-slate-100 text-slate-500',
  on_hold:   'bg-amber-50 text-amber-700',
}

const PLAN_FEATURES: Record<string, string[]> = {
  free:        ['Up to 3 active projects', '500 MB storage', 'Basic analytics', 'Community support'],
  pro:         ['Unlimited projects', '50 GB storage', 'Advanced analytics & exports', 'Priority email support', 'Team collaboration'],
  institution: ['Everything in Pro', 'Unlimited storage', 'Institutional workspace', 'Admin dashboard', 'Dedicated support', 'SSO / SAML'],
}

const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Angola', 'Argentina', 'Armenia', 'Australia',
  'Austria', 'Azerbaijan', 'Bangladesh', 'Belgium', 'Benin', 'Bolivia', 'Bosnia and Herzegovina',
  'Botswana', 'Brazil', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada',
  'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Congo', 'Costa Rica',
  "Côte d'Ivoire", 'Croatia', 'Cuba', 'Czech Republic', 'DR Congo', 'Denmark', 'Dominican Republic',
  'Ecuador', 'Egypt', 'El Salvador', 'Eritrea', 'Ethiopia', 'Finland', 'France', 'Gabon',
  'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Guatemala', 'Guinea', 'Guinea-Bissau',
  'Haiti', 'Honduras', 'Hungary', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel',
  'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kosovo', 'Laos', 'Lebanon',
  'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Malaysia', 'Mali', 'Mauritania',
  'Mexico', 'Moldova', 'Mongolia', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nepal',
  'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'Norway',
  'Pakistan', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines',
  'Poland', 'Portugal', 'Romania', 'Russia', 'Rwanda', 'Saudi Arabia', 'Senegal', 'Sierra Leone',
  'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan',
  'Sweden', 'Switzerland', 'Syria', 'Tanzania', 'Thailand', 'Togo', 'Tunisia', 'Turkey',
  'Uganda', 'Ukraine', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Venezuela',
  'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
]

type Tab = 'overview' | 'edit' | 'security' | 'billing' | 'danger'

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview',  label: 'Profile Overview', icon: 'account_circle' },
  { id: 'edit',      label: 'Edit Profile',      icon: 'edit' },
  { id: 'security',  label: 'Security',          icon: 'shield_lock' },
  { id: 'billing',   label: 'Billing',           icon: 'credit_card' },
  { id: 'danger',    label: 'Danger Zone',       icon: 'warning' },
]

/* ── page ────────────────────────────────────────────────────────────────── */
export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), [])

  const [activeTab, setActiveTab]           = useState<Tab>('overview')
  const [profile, setProfile]               = useState<Partial<Profile>>({})
  const [authUser, setAuthUser]             = useState<User | null>(null)
  const [loading, setLoading]               = useState(true)
  const [saving, setSaving]                 = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarUrl, setAvatarUrl]           = useState<string | null>(null)
  const [projectCount, setProjectCount]     = useState(0)
  const [reviewCount, setReviewCount]       = useState(0)
  const [recentProjects, setRecentProjects] = useState<{ id: string; title: string; status: string; phase: string; updated_at: string }[]>([])
  const [credentialsOpen, setCredentialsOpen] = useState(false)
  const [credFile, setCredFile]             = useState<File | null>(null)
  const [uploading, setUploading]           = useState(false)
  const [credUploads, setCredUploads]       = useState<{ id: string; file_name: string; status: string; uploaded_at: string }[]>([])

  // Security
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [changingPw, setChangingPw] = useState(false)

  // Danger
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting]           = useState(false)

  // Research Presence
  const [city, setCity]               = useState('')
  const [country, setCountry]         = useState('')
  const [presenceLat, setPresenceLat] = useState<number | null>(null)
  const [presenceLng, setPresenceLng] = useState<number | null>(null)
  const [showOnGlobe, setShowOnGlobe] = useState(true)
  const [geoState, setGeoState]       = useState<'idle' | 'detecting' | 'detected' | 'denied'>('idle')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const credInputRef = useRef<HTMLInputElement>(null)

  /* ── load ──────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setAuthUser(user)

      const [profileResult, projectsResult, reviewsRes, countResult, credRes] = await Promise.all([
        getProfile(supabase, user.id),
        getRecentProjectsByOwner(supabase, user.id),
        supabase
          .from('review_requests')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', user.id)
          .in('status', ['pending', 'in_review']),
        countProjectsByOwner(supabase, user.id),
        supabase
          .from('credential_uploads')
          .select('id, file_name, status, uploaded_at')
          .eq('user_id', user.id)
          .order('uploaded_at', { ascending: false }),
      ])

      if (profileResult.status === 'error') {
        toast.error('Failed to load profile — please refresh the page')
      } else if (profileResult.data) {
        setProfile(profileResult.data)
        setAvatarUrl(profileResult.data.avatar_url ?? null)
        const p = profileResult.data as unknown as Record<string, unknown>
        setCity((p.city as string | null) ?? '')
        setCountry((p.country as string | null) ?? '')
        setPresenceLat((p.lat as number | null) ?? null)
        setPresenceLng((p.lng as number | null) ?? null)
        setShowOnGlobe((p.show_on_globe as boolean | null) ?? true)
      }
      setProjectCount(countResult.data ?? 0)
      setReviewCount(reviewsRes.count ?? 0)
      setRecentProjects((projectsResult.data ?? []).map(p => ({ ...p, phase: p.phase ?? '', status: p.status })))
      setCredUploads(credRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [supabase])

  /* ── avatar ────────────────────────────────────────────────────────────── */
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !authUser) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return }
    setAvatarUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `${authUser.id}/avatar.${ext}`
    const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadErr) { toast.error(uploadErr.message); setAvatarUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await updateProfileAvatar(supabase, authUser.id, publicUrl)
    setAvatarUrl(publicUrl)
    setProfile(p => ({ ...p, avatar_url: publicUrl }))
    toast.success('Profile picture updated')
    setAvatarUploading(false)
  }

  /* ── location detect ────────────────────────────────────────────────────── */
  const detectLocation = () => {
    if (!navigator.geolocation) return
    setGeoState('detecting')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        setPresenceLat(latitude)
        setPresenceLng(longitude)
        try {
          const res = await fetch(`/api/reverse-geocode?lat=${latitude}&lng=${longitude}`)
          if (res.ok) {
            const data = await res.json() as { city: string | null; country: string | null }
            setCity(data.city ?? '')
            setCountry(data.country ?? '')
            setGeoState('detected')
          } else {
            toast.error('Could not detect location — enter it manually')
            setGeoState('idle')
          }
        } catch {
          toast.error('Could not detect location — enter it manually')
          setGeoState('idle')
        }
      },
      () => setGeoState('denied'),
      { timeout: 8000 }
    )
  }

  /* ── save profile ───────────────────────────────────────────────────────── */
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authUser || saving) return
    setSaving(true)

    // Geocode city/country — always attempt so we have fresh coordinates.
    // If geocoding fails, keep whatever coordinates are already stored (never write null).
    let finalLat = presenceLat
    let finalLng = presenceLng
    if (city && country) {
      try {
        const res = await fetch(`/api/geocode?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`)
        if (res.ok) {
          const geo = await res.json() as { lat: number; lng: number }
          finalLat = geo.lat
          finalLng = geo.lng
        }
      } catch { /* non-fatal — keep existing coords */ }
    }

    const locationCoords = finalLat !== null && finalLng !== null
      ? { lat: finalLat, lng: finalLng }
      : {}   // don't overwrite existing coordinates with null

    const result = await updateProfile(supabase, authUser.id, {
      full_name:     profile.full_name,
      title:         profile.title,
      bio:           profile.bio,
      orcid_id:      profile.orcid_id,
      phone:         profile.phone,
      website:       profile.website,
      city:          city || null,
      country:       country || null,
      show_on_globe: showOnGlobe,
      ...locationCoords,
    })

    if (result.status === 'error') {
      toast.error(result.error ?? 'Failed to save')
      setSaving(false)
      return
    }

    // Sync all local state from the server's confirmed response
    if (result.data) {
      const saved = result.data as unknown as Record<string, unknown>
      setProfile(result.data)
      setAvatarUrl((saved.avatar_url as string | null) ?? avatarUrl)
      setCity((saved.city as string | null) ?? '')
      setCountry((saved.country as string | null) ?? '')
      setPresenceLat((saved.lat as number | null) ?? null)
      setPresenceLng((saved.lng as number | null) ?? null)
      setShowOnGlobe((saved.show_on_globe as boolean | null) ?? true)
    }

    toast.success('Profile saved')
    setSaving(false)
  }

  /* ── change password ────────────────────────────────────────────────────── */
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return }
    if (newPw.length < 8)    { toast.error('Minimum 8 characters'); return }
    setChangingPw(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) toast.error(error.message)
    else { toast.success('Password updated'); setNewPw(''); setConfirmPw('') }
    setChangingPw(false)
  }

  /* ── credential upload ──────────────────────────────────────────────────── */
  const handleCredentialUpload = async () => {
    if (!credFile || !authUser) return
    setUploading(true)
    const storagePath = `${authUser.id}/${Date.now()}_${credFile.name}`
    const { error: storageErr } = await supabase.storage
      .from('credentials')
      .upload(storagePath, credFile)
    if (storageErr) {
      toast.error(storageErr.message)
      setUploading(false)
      return
    }
    // Record the upload in credential_uploads for verification tracking
    const { error: dbErr } = await supabase.from('credential_uploads').insert({
      user_id:        authUser.id,
      file_name:      credFile.name,
      storage_path:   storagePath,
      file_size_bytes: credFile.size,
      mime_type:      credFile.type,
      status:         'pending',
    })
    if (dbErr) {
      toast.error('Uploaded but failed to record: ' + dbErr.message)
    } else {
      toast.success('Credential uploaded — pending verification')
      // Refresh the uploads list immediately
      const { data: fresh } = await supabase
        .from('credential_uploads')
        .select('id, file_name, status, uploaded_at')
        .eq('user_id', authUser.id)
        .order('uploaded_at', { ascending: false })
      setCredUploads(fresh ?? [])
    }
    setCredFile(null)
    setUploading(false)
    setCredentialsOpen(false)
  }

  /* ── delete account ─────────────────────────────────────────────────────── */
  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    try {
      const res = await fetch('/api/account/delete', { method: 'DELETE' })
      if (!res.ok) {
        const { error } = await res.json()
        toast.error(error ?? 'Failed to delete account. Please try again.')
        setDeleting(false)
        return
      }
      // Sign out and redirect to home
      await supabase.auth.signOut()
      window.location.href = '/'
    } catch {
      toast.error('Something went wrong. Please try again.')
      setDeleting(false)
    }
  }

  /* ── loading skeleton ───────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center min-h-[400px]">
        <div className="h-6 w-6 rounded-full border-2 border-[#0052cc] border-t-transparent animate-spin" />
      </div>
    )
  }

  // Name: profile > auth metadata > email username
  const displayName = [profile.title, profile.full_name].filter(Boolean).join(' ')
    || (authUser?.user_metadata?.full_name as string | undefined)
    || authUser?.email?.split('@')[0]
    || 'Your Name'

  const roleLabel   = ROLE_LABELS[profile.role ?? ''] ?? profile.role ?? 'Researcher'
  const tier        = (profile.subscription_tier ?? 'free') as string
  const institution = (profile as any).institution?.name ?? '—'
  const department  = (profile as any).department?.name ?? null
  const lastSignIn  = authUser?.last_sign_in_at
    ? new Date(authUser.last_sign_in_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : '—'

  return (
    <div className="flex min-h-full bg-[#f7f9fb]">

      {/* ── Left mini-nav ─────────────────────────────────────────────────── */}
      <aside className="w-52 flex-shrink-0 border-r border-[#E4E4E7] bg-white flex flex-col pt-6 px-3 gap-1">
        <p className="px-2 mb-3 text-[10px] font-bold uppercase tracking-widest text-[#52525B]">
          Navigation
        </p>

        {NAV.map(({ id, label, icon }) => {
          const isActive = activeTab === id
          const isDanger = id === 'danger'
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={[
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 w-full text-left',
                isActive && !isDanger ? 'bg-[#EFF6FF] text-[#0052CC]'
                : isDanger            ? 'text-red-500 hover:bg-red-50 hover:text-red-600 mt-4'
                : 'text-[#52525B] hover:text-[#0052CC] hover:bg-[#F4F7FF]',
              ].join(' ')}
            >
              <span className="material-symbols-outlined text-[18px]">{icon}</span>
              {label}
            </button>
          )
        })}

        <div className="mt-auto pb-4 px-2 border-t border-[#E4E4E7] pt-4">
          <button
            onClick={() => setCredentialsOpen(true)}
            className="w-full flex items-center gap-2 text-xs font-semibold text-[#0052CC] hover:bg-[#EFF6FF] px-2 py-2 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">verified</span>
            Manage Credentials
          </button>
          <a
            href="/dashboard"
            className="w-full flex items-center gap-2 text-xs font-medium text-[#52525B] hover:bg-[#F4F7FF] px-2 py-2 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">help_outline</span>
            Support
          </a>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="flex-1 p-6 overflow-y-auto">

        {/* ══ OVERVIEW TAB ══════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="max-w-4xl space-y-5">

            {/* Profile header */}
            <header className="flex justify-between items-start pb-5 border-b border-[#E4E4E7]">
              <div className="flex items-center gap-5">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-20 h-20 rounded-xl object-cover shadow-sm border border-[#E4E4E7]"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#003d9b] to-[#0052cc] flex items-center justify-center text-white text-2xl font-bold shadow-sm">
                      {getInitials(profile.full_name ?? authUser?.user_metadata?.full_name as string)}
                    </div>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full bg-white border border-[#E4E4E7] shadow-sm flex items-center justify-center text-[#52525B] hover:text-[#0052cc] transition-colors"
                    title="Change photo"
                  >
                    {avatarUploading
                      ? <div className="h-3 w-3 rounded-full border border-current border-t-transparent animate-spin" />
                      : <span className="material-symbols-outlined text-[14px]">photo_camera</span>}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>

                {/* Name + role + institution */}
                <div>
                  <h1 className="text-2xl font-extrabold text-[#191c1e] tracking-tight font-manrope">
                    {displayName}
                  </h1>
                  <p className="text-sm font-semibold text-[#0052CC] mt-0.5">{roleLabel}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-[#52525B]">
                    {department && (
                      <>
                        <span className="flex items-center gap-1 uppercase tracking-wide font-medium">
                          <span className="material-symbols-outlined text-[13px]">domain</span>
                          {department}
                        </span>
                        <span className="text-[#D4D4D8]">·</span>
                      </>
                    )}
                    <span className="uppercase tracking-wide font-medium">{institution}</span>
                    {profile.orcid_id && (
                      <>
                        <span className="text-[#D4D4D8]">·</span>
                        <a
                          href={`https://orcid.org/${profile.orcid_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-emerald-600 font-semibold hover:underline"
                        >
                          <span className="material-symbols-outlined text-[13px]">verified</span>
                          ORCID
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('edit')}
                className="bg-[#0052CC] text-white px-5 py-2 rounded-lg font-semibold text-sm shadow-sm hover:bg-[var(--accent-primary)] transition-colors flex-shrink-0"
              >
                Edit Profile
              </button>
            </header>

            {/* Metrics row — smaller cards */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Projects',  value: projectCount,  sub: null },
                { label: 'Pending Reviews', value: reviewCount,   sub: null },
                { label: 'Plan',            value: tier.charAt(0).toUpperCase() + tier.slice(1), sub: null },
                { label: 'ORCID',           value: profile.orcid_id ? 'Linked' : 'Not linked',  sub: profile.orcid_id ? 'Verified' : null },
              ].map(({ label, value, sub }) => (
                <div
                  key={label}
                  className="bg-white p-4 rounded-xl border border-[#E4E4E7] hover:border-[#0052CC]/30 transition-all"
                >
                  <p className="text-[9px] font-bold text-[#A1A1AA] uppercase tracking-widest mb-1 font-manrope">{label}</p>
                  <p className="text-xl font-extrabold text-[#0052CC] font-manrope leading-tight">{value}</p>
                  {sub && <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">{sub}</p>}
                </div>
              ))}
            </section>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* ── Left: Recent Projects ──────────────────────────────────── */}
              <section className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-[#191c1e] font-manrope">Recent Projects</h2>
                  <a href="/projects" className="text-xs font-semibold text-[#0052CC] hover:underline">View All</a>
                </div>

                {recentProjects.length === 0 ? (
                  <div className="bg-white rounded-xl border border-[#E4E4E7] p-6 text-center">
                    <p className="text-sm text-[#A1A1AA]">No projects yet.{' '}
                      <a href="/projects" className="text-[#0052CC] hover:underline font-medium">Start one →</a>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentProjects.map(p => (
                      <a
                        key={p.id}
                        href={`/projects/${p.id}`}
                        className="flex items-center gap-3 bg-white p-4 rounded-xl border border-[#E4E4E7] hover:border-[#0052CC]/40 hover:bg-[#F8FAFF] transition-all group"
                      >
                        {/* Phase color pill */}
                        <div
                          className="w-1 h-10 rounded-full flex-shrink-0"
                          style={{ background: PHASE_COLORS[p.phase] ?? '#A1A1AA' }}
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-[#191c1e] text-sm leading-tight truncate group-hover:text-[#0052CC] transition-colors">
                            {p.title}
                          </h3>
                          <p className="text-[11px] text-[#A1A1AA] mt-0.5">
                            {PHASE_LABELS[p.phase] ?? p.phase?.replace('_', ' ')}
                            {' · '}
                            {new Date(p.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-1 rounded-md uppercase flex-shrink-0 ${STATUS_COLORS[p.status] ?? 'bg-slate-100 text-slate-500'}`}>
                          {p.status}
                        </span>
                      </a>
                    ))}
                  </div>
                )}

                {/* Bio card */}
                {profile.bio && (
                  <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] mt-3">
                    <h2 className="text-xs font-bold text-[#191c1e] font-manrope mb-2 uppercase tracking-wide">About</h2>
                    <p className="text-sm text-[#52525B] leading-relaxed">{profile.bio}</p>
                  </div>
                )}
              </section>

              {/* ── Right column ───────────────────────────────────────────── */}
              <aside className="space-y-4">

                {/* Active Contributions — real phase-based progress */}
                {recentProjects.length > 0 && (
                  <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] space-y-3">
                    <h3 className="text-xs font-bold text-[#191c1e] font-manrope uppercase tracking-wide">Active Contributions</h3>
                    <div className="space-y-2.5">
                      {recentProjects.slice(0, 3).map(p => {
                        // Phase order index → real progress percentage
                        const PHASE_ORDER = ['concept','protocol','ethics','data','analysis','writing','publication']
                        const phaseIdx   = PHASE_ORDER.indexOf(p.phase ?? '')
                        const totalPhases = PHASE_ORDER.length
                        // completed phases + partial credit for current phase based on status
                        const statusBonus = p.status === 'completed' ? 1 : p.status === 'active' ? 0.5 : 0.1
                        const pct = Math.round(
                          phaseIdx < 0
                            ? 5
                            : Math.min(((phaseIdx + statusBonus) / totalPhases) * 100, 99)
                        )
                        const color = PHASE_COLORS[p.phase] ?? '#3B82F6'
                        return (
                          <div key={p.id}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-[#52525B] truncate max-w-[140px]">{p.title}</span>
                              <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
                            </div>
                            <div className="h-1.5 bg-[#F4F4F5] rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Security & Access */}
                <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#0052CC] text-[18px]">shield_lock</span>
                    <h3 className="text-xs font-bold text-[#191c1e] font-manrope uppercase tracking-wide">Security &amp; Access</h3>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <p className="text-[9px] font-bold text-[#A1A1AA] uppercase tracking-wide">Email</p>
                      <p className="text-xs font-medium text-[#52525B] truncate">{profile.email ?? authUser?.email ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-[#A1A1AA] uppercase tracking-wide">Last Sign-In</p>
                      <p className="text-xs font-medium text-[#52525B]">{lastSignIn}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-bold text-[#A1A1AA] uppercase tracking-wide">Session</p>
                        <p className="text-xs font-semibold text-emerald-600">Active — this device</p>
                      </div>
                      <span className="material-symbols-outlined text-emerald-500 text-[18px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('security')}
                    className="text-xs font-semibold text-[#0052CC] hover:underline"
                  >
                    Manage security →
                  </button>
                </div>

                {/* Peer Review Portal — dark card */}
                <div className="bg-[var(--accent-primary)] p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-white text-[20px]">rate_review</span>
                    <h3 className="text-sm font-bold text-white font-manrope">Peer Review Portal</h3>
                  </div>
                  {reviewCount > 0 ? (
                    <p className="text-xs text-blue-200 leading-relaxed">
                      {reviewCount} pending review {reviewCount === 1 ? 'request' : 'requests'} awaiting your attention.
                    </p>
                  ) : (
                    <p className="text-xs text-blue-200 leading-relaxed">
                      No pending review requests at this time.
                    </p>
                  )}
                  <a
                    href="/reviews"
                    className="block w-full text-center bg-white/15 hover:bg-white/25 text-white text-xs font-semibold py-2 rounded-lg transition-colors border border-white/20"
                  >
                    Launch Dashboard
                  </a>
                </div>

                {/* Contact */}
                {(profile.website || profile.phone) && (
                  <div className="bg-white p-4 rounded-xl border border-[#E4E4E7] space-y-2">
                    <h3 className="text-xs font-bold text-[#191c1e] font-manrope uppercase tracking-wide">Contact</h3>
                    {profile.website && (
                      <a href={profile.website} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-[#0052CC] hover:underline">
                        <span className="material-symbols-outlined text-[14px]">link</span>
                        {profile.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    {profile.phone && (
                      <p className="flex items-center gap-2 text-xs text-[#52525B]">
                        <span className="material-symbols-outlined text-[14px] text-[#A1A1AA]">phone</span>
                        {profile.phone}
                      </p>
                    )}
                  </div>
                )}
              </aside>
            </div>
          </div>
        )}

        {/* ══ EDIT PROFILE TAB ═════════════════════════════════════════════ */}
        {activeTab === 'edit' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-xl font-bold text-[#191c1e] font-manrope">Edit Profile</h1>
              <p className="text-sm text-[#52525B] mt-0.5">How you appear on PLEXUS Research.</p>
            </div>

            {/* Avatar */}
            <div className="flex items-center gap-5">
              <div className="relative">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-20 w-20 rounded-xl object-cover ring-1 ring-[#E4E4E7]" />
                ) : (
                  <div className="h-20 w-20 rounded-xl bg-gradient-to-br from-[#003d9b] to-[#0052cc] flex items-center justify-center text-white text-2xl font-bold">
                    {getInitials(profile.full_name ?? authUser?.user_metadata?.full_name as string)}
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full bg-white border border-[#E4E4E7] flex items-center justify-center shadow-sm text-[#52525B] hover:text-[#0052cc] transition-colors"
                >
                  {avatarUploading
                    ? <div className="h-3 w-3 rounded-full border border-current border-t-transparent animate-spin" />
                    : <span className="material-symbols-outlined text-[14px]">photo_camera</span>}
                </button>
              </div>
              <div>
                <button onClick={() => fileInputRef.current?.click()} className="text-sm font-semibold text-[#0052CC] hover:underline">
                  {avatarUploading ? 'Uploading…' : 'Upload photo'}
                </button>
                <p className="text-xs text-[#A1A1AA] mt-0.5">JPG, PNG · max 5 MB</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" placeholder="Dr., Prof.…" value={profile.title ?? ''} onChange={e => setProfile(p => ({ ...p, title: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="fullName">Full Name <span className="text-red-500">*</span></Label>
                  <Input id="fullName" required value={profile.full_name ?? ''} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} className="mt-1" />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email address</Label>
                <Input id="email" value={profile.email ?? authUser?.email ?? ''} disabled className="mt-1 opacity-60 cursor-not-allowed" />
                <p className="text-xs text-[#A1A1AA] mt-1">Email is managed via your sign-in provider.</p>
              </div>

              <div>
                <Label htmlFor="bio">Short Bio</Label>
                <Textarea id="bio" rows={3} placeholder="A brief introduction about your research background…" value={profile.bio ?? ''} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} className="mt-1 resize-none" />
              </div>

              <div>
                <Label htmlFor="orcid">ORCID iD</Label>
                <div className="relative mt-1">
                  <Input id="orcid" placeholder="0000-0000-0000-0000" value={profile.orcid_id ?? ''} onChange={e => setProfile(p => ({ ...p, orcid_id: e.target.value }))} className="pr-9" />
                  {profile.orcid_id && (
                    <a href={`https://orcid.org/${profile.orcid_id}`} target="_blank" rel="noopener noreferrer" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#0052cc]">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-[#A1A1AA] mt-1">
                  Your unique researcher ID.{' '}
                  <a href="https://orcid.org/register" target="_blank" rel="noopener noreferrer" className="text-[#0052cc] hover:underline">Register at orcid.org</a>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" placeholder="+1 (555) 000-0000" value={profile.phone ?? ''} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="website">Website / Lab URL</Label>
                  <Input id="website" type="url" placeholder="https://yourlab.edu" value={profile.website ?? ''} onChange={e => setProfile(p => ({ ...p, website: e.target.value }))} className="mt-1" />
                </div>
              </div>

              {/* Research Presence */}
              <div className="border border-[#E4E4E7] rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-[#0052CC]" />
                  <h2 className="text-sm font-semibold text-[#191c1e]">Research Presence</h2>
                  <span className="ml-auto text-[10px] text-[#A1A1AA] font-medium uppercase tracking-wide">Country shown on global map</span>
                </div>

                {/* Location */}
                <div>
                  <Label>Location</Label>
                  <div className="mt-2 space-y-2">
                    {/* Confirmed state — shown whenever city or country is set */}
                    {(city || country) && geoState !== 'denied' ? (
                      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                          <strong>{[city, country].filter(Boolean).join(', ')}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => { setCity(''); setCountry(''); setPresenceLat(null); setPresenceLng(null); setGeoState('denied') }}
                          className="text-xs text-emerald-600 hover:underline ml-3 flex-shrink-0"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Auto-detect button */}
                        <button
                          type="button"
                          onClick={detectLocation}
                          disabled={geoState === 'detecting'}
                          className="flex items-center gap-2 rounded-lg border border-[#0052CC]/30 bg-[#EFF6FF] px-4 py-2 text-sm font-medium text-[#0052CC] hover:bg-[#DBEAFE] transition-colors disabled:opacity-60"
                        >
                          {geoState === 'detecting'
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <MapPin className="h-4 w-4" />}
                          {geoState === 'detecting' ? 'Detecting…' : 'Detect my location'}
                        </button>

                        {/* Manual city + country */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="settingsCity" className="text-xs text-[#52525B]">City</Label>
                            <Input
                              id="settingsCity"
                              placeholder="Accra"
                              value={city}
                              onChange={e => setCity(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="settingsCountry" className="text-xs text-[#52525B]">Country</Label>
                            <div className="relative mt-1">
                              <select
                                id="settingsCountry"
                                value={country}
                                onChange={e => setCountry(e.target.value)}
                                className="w-full rounded-md border border-[#E4E4E7] px-3 py-2 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#0052CC] bg-white"
                              >
                                <option value="">Select…</option>
                                {COUNTRIES.map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#A1A1AA] pointer-events-none" />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Show on globe toggle */}
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-[#191c1e]">Show my country on the global researcher map</p>
                    <p className="text-xs text-[#A1A1AA]">Only your country is shown — your exact address is never shared.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOnGlobe(v => !v)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${showOnGlobe ? 'bg-[#0052CC]' : 'bg-[#D4D4D8]'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${showOnGlobe ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </label>
              </div>

              <Button type="submit" disabled={saving} className="bg-[#0052CC] hover:bg-[var(--accent-primary)]">
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </form>

            <div className="border-t border-[#E4E4E7] pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="h-4 w-4 text-[#A1A1AA]" />
                <h2 className="text-sm font-semibold text-[#191c1e]">Interface Language</h2>
              </div>
              <p className="text-xs text-[#A1A1AA] mb-4">Applies to navigation, labels, and status messages.</p>
              <LanguageSelector />
            </div>
          </div>
        )}

        {/* ══ SECURITY TAB ═════════════════════════════════════════════════ */}
        {activeTab === 'security' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-xl font-bold text-[#191c1e] font-manrope">Security</h1>
              <p className="text-sm text-[#52525B] mt-0.5">Manage your password and account access.</p>
            </div>

            <div className="bg-white border border-[#E4E4E7] rounded-xl p-6 space-y-5">
              <h2 className="text-sm font-bold text-[#191c1e] font-manrope">Change Password</h2>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <Label htmlFor="newPw">New Password</Label>
                  <Input id="newPw" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required minLength={8} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="confirmPw">Confirm New Password</Label>
                  <Input id="confirmPw" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required className="mt-1" />
                </div>
                <Button type="submit" disabled={changingPw} className="bg-[#0052CC] hover:bg-[var(--accent-primary)]">
                  {changingPw ? 'Updating…' : 'Update Password'}
                </Button>
              </form>
            </div>

            <div className="bg-white border border-[#E4E4E7] rounded-xl p-6 space-y-4">
              <h2 className="text-sm font-bold text-[#191c1e] font-manrope">Active Session</h2>
              <div className="space-y-2">
                <p className="text-sm text-[#52525B]">Signed in as <span className="font-medium text-[#191c1e]">{profile.email ?? authUser?.email}</span></p>
                <p className="text-sm text-[#A1A1AA]">Last sign-in: {lastSignIn}</p>
              </div>
              <Button variant="outline" className="text-sm" onClick={() => {
                document.cookie = 'workspace_ready=; path=/; max-age=0'
                supabase.auth.signOut()   // global scope — revokes all sessions
                window.location.href = '/login'
              }}>
                Sign out of all devices
              </Button>
            </div>
          </div>
        )}

        {/* ══ BILLING TAB ══════════════════════════════════════════════════ */}
        {activeTab === 'billing' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-xl font-bold text-[#191c1e] font-manrope">Subscription &amp; Billing</h1>
              <p className="text-sm text-[#52525B] mt-0.5">Manage your plan and payment details.</p>
            </div>

            <div className="bg-white border border-[#E4E4E7] rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wide mb-1">Current plan</p>
                  <p className="text-2xl font-bold text-[#191c1e] font-manrope capitalize">{tier}</p>
                </div>
                <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-[#EFF6FF] text-[#0052CC] uppercase tracking-wide">
                  {tier}
                </span>
              </div>
              <ul className="mt-4 space-y-2">
                {(PLAN_FEATURES[tier] ?? PLAN_FEATURES.free).map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#52525B]">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {tier === 'free' && (
              <div className="bg-white border border-[#0052CC]/30 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-bold text-[#191c1e] font-manrope">Pro — $29 / month</p>
                    <p className="text-sm text-[#52525B] mt-0.5">Unlimited projects, storage &amp; collaboration</p>
                  </div>
                  <Button size="sm" className="bg-[#0052CC] hover:bg-[var(--accent-primary)] flex items-center gap-1">
                    Upgrade <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <ul className="space-y-1.5">
                  {PLAN_FEATURES.pro.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[#52525B]">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#0052CC] flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ══ DANGER ZONE TAB ══════════════════════════════════════════════ */}
        {activeTab === 'danger' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-xl font-bold text-red-600 font-manrope">Danger Zone</h1>
              <p className="text-sm text-[#52525B] mt-0.5">Irreversible actions. Proceed with caution.</p>
            </div>

            <div className="border border-red-200 rounded-xl overflow-hidden">
              <div className="bg-red-50 px-5 py-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Delete your account</p>
                  <p className="text-sm text-[#52525B] mt-0.5">
                    This will permanently delete your account, all projects, documents, and data.{' '}
                    <strong>This cannot be undone.</strong>
                  </p>
                </div>
              </div>
              <div className="p-5 space-y-4 bg-white">
                <div>
                  <Label htmlFor="deleteConfirm" className="text-sm">
                    Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
                  </Label>
                  <Input
                    id="deleteConfirm"
                    value={deleteConfirm}
                    onChange={e => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                    className="mt-1 border-red-200 focus:ring-red-500"
                  />
                </div>
                <Button
                  variant="destructive"
                  disabled={deleteConfirm !== 'DELETE' || deleting}
                  onClick={handleDeleteAccount}
                >
                  {deleting ? 'Processing…' : 'Delete Account'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Credentials modal ────────────────────────────────────────────── */}
      {credentialsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCredentialsOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#0052CC] text-[24px]">verified</span>
              <div>
                <h2 className="text-lg font-bold text-[#191c1e] font-manrope">Manage Credentials</h2>
                <p className="text-xs text-[#52525B]">Upload institutional documents for verification</p>
              </div>
            </div>

            <div className="border-2 border-dashed border-[#E4E4E7] rounded-xl p-6 text-center">
              {credFile ? (
                <div className="space-y-2">
                  <span className="material-symbols-outlined text-[#0052CC] text-[32px]">description</span>
                  <p className="text-sm font-medium text-[#191c1e]">{credFile.name}</p>
                  <p className="text-xs text-[#A1A1AA]">{(credFile.size / 1024).toFixed(0)} KB</p>
                  <button onClick={() => setCredFile(null)} className="text-xs text-red-500 hover:underline">Remove</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="material-symbols-outlined text-[#A1A1AA] text-[32px]">upload_file</span>
                  <p className="text-sm text-[#52525B]">Drop a file or click to browse</p>
                  <p className="text-xs text-[#A1A1AA]">PDF, JPG, PNG · max 10 MB</p>
                  <button
                    onClick={() => credInputRef.current?.click()}
                    className="text-xs font-semibold text-[#0052CC] hover:underline"
                  >
                    Browse files
                  </button>
                </div>
              )}
              <input
                ref={credInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => setCredFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setCredentialsOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-[#0052CC] hover:bg-[var(--accent-primary)]"
                disabled={!credFile || uploading}
                onClick={handleCredentialUpload}
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </Button>
            </div>

            {/* Past uploads with real verification status */}
            {credUploads.length > 0 && (
              <div className="border-t border-[#E4E4E7] pt-4 space-y-2">
                <p className="text-xs font-bold text-[#52525B] uppercase tracking-wide">Previous Uploads</p>
                {credUploads.map(u => {
                  const statusConfig: Record<string, { label: string; cls: string }> = {
                    pending:      { label: 'Pending',      cls: 'bg-amber-50 text-amber-700' },
                    under_review: { label: 'Under Review', cls: 'bg-blue-50 text-blue-700' },
                    approved:     { label: 'Approved',     cls: 'bg-emerald-50 text-emerald-700' },
                    rejected:     { label: 'Rejected',     cls: 'bg-red-50 text-red-600' },
                  }
                  const sc = statusConfig[u.status] ?? statusConfig.pending
                  return (
                    <div key={u.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[#A1A1AA] text-[16px]">description</span>
                        <span className="text-xs text-[#52525B] truncate">{u.file_name}</span>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${sc.cls}`}>
                        {sc.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
