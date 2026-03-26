"use client"

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getInitials } from '@/lib/utils'
import { LanguageSelector } from '@/components/i18n/LanguageSelector'
import { AlertTriangle, ExternalLink, ChevronRight, CheckCircle2, Globe } from 'lucide-react'
import type { Profile } from '@/types/database'
import type { User } from '@supabase/supabase-js'

/* ── helpers ─────────────────────────────────────────────────────────────── */
const ROLE_LABELS: Record<string, string> = {
  researcher: 'Researcher',
  pi: 'Principal Investigator',
  coordinator: 'Coordinator',
  admin: 'Administrator',
}

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-blue-50 text-blue-700',
  draft:     'bg-slate-100 text-slate-600',
  completed: 'bg-emerald-50 text-emerald-700',
  archived:  'bg-slate-100 text-slate-500',
  on_hold:   'bg-amber-50 text-amber-700',
}

const PLAN_FEATURES: Record<string, string[]> = {
  free: ['Up to 3 active projects', '500 MB storage', 'Basic analytics', 'Community support'],
  pro:  ['Unlimited projects', '50 GB storage', 'Advanced analytics & exports', 'Priority email support', 'Team collaboration'],
  institution: ['Everything in Pro', 'Unlimited storage', 'Institutional workspace', 'Admin dashboard', 'Dedicated support', 'SSO / SAML'],
}

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

  // Security
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [changingPw, setChangingPw] = useState(false)

  // Danger
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting]           = useState(false)

  const fileInputRef  = useRef<HTMLInputElement>(null)
  const credInputRef  = useRef<HTMLInputElement>(null)

  /* ── load ──────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setAuthUser(user)

      const [profileRes, projectsRes, reviewsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*, institution:institutions(id,name,country), department:departments(id,name)')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('projects')
          .select('id, title, status, phase, updated_at')
          .eq('created_by', user.id)
          .order('updated_at', { ascending: false })
          .limit(5),
        supabase
          .from('review_requests')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', user.id)
          .in('status', ['pending', 'in_review']),
      ])

      if (profileRes.data) {
        setProfile(profileRes.data)
        setAvatarUrl(profileRes.data.avatar_url ?? null)
      }

      const { count: totalProjects } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', user.id)

      setProjectCount(totalProjects ?? 0)
      setReviewCount(reviewsRes.count ?? 0)
      setRecentProjects(projectsRes.data ?? [])
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
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', authUser.id)
    setAvatarUrl(publicUrl)
    setProfile(p => ({ ...p, avatar_url: publicUrl }))
    toast.success('Profile picture updated')
    setAvatarUploading(false)
  }

  /* ── save profile ───────────────────────────────────────────────────────── */
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authUser) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      full_name: profile.full_name,
      title:     profile.title,
      bio:       profile.bio,
      orcid_id:  profile.orcid_id,
      phone:     profile.phone,
      website:   profile.website,
    }).eq('id', authUser.id)
    if (error) toast.error(error.message)
    else toast.success('Profile saved')
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
    else { toast.success('Password updated'); setCurrentPw(''); setNewPw(''); setConfirmPw('') }
    setChangingPw(false)
  }

  /* ── credential upload ──────────────────────────────────────────────────── */
  const handleCredentialUpload = async () => {
    if (!credFile || !authUser) return
    setUploading(true)
    const path = `${authUser.id}/credentials/${Date.now()}_${credFile.name}`
    const { error } = await supabase.storage.from('avatars').upload(path, credFile)
    if (error) toast.error(error.message)
    else toast.success('Credential document uploaded — pending verification')
    setCredFile(null)
    setUploading(false)
    setCredentialsOpen(false)
  }

  /* ── delete account ─────────────────────────────────────────────────────── */
  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    toast.error('Account deletion requires contacting support@plexus.research — your data will be removed within 30 days.')
    setDeleting(false)
    setDeleteConfirm('')
  }

  /* ── loading skeleton ───────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center min-h-[400px]">
        <div className="h-6 w-6 rounded-full border-2 border-[#0052cc] border-t-transparent animate-spin" />
      </div>
    )
  }

  const displayName = [profile.title, profile.full_name].filter(Boolean).join(' ') || 'Your Name'
  const roleLabel   = ROLE_LABELS[profile.role ?? ''] ?? profile.role ?? '—'
  const tier        = (profile.subscription_tier ?? 'free') as string
  const institution = (profile as any).institution?.name ?? profile.institution_id ?? '—'
  const department  = (profile as any).department?.name ?? '—'
  const lastSignIn  = authUser?.last_sign_in_at
    ? new Date(authUser.last_sign_in_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : '—'

  return (
    <div className="flex min-h-full bg-[#f7f9fb]">
      {/* ── Left mini-nav ────────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 border-r border-slate-100 flex flex-col pt-6 px-3 gap-1">
        <p className="px-2 mb-3 text-[10px] font-bold uppercase tracking-widest text-[#003d9b] font-manrope">
          My Profile
        </p>

        {NAV.map(({ id, label, icon }) => {
          const isActive   = activeTab === id
          const isDanger   = id === 'danger'
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 font-manrope w-full text-left',
                isActive && !isDanger ? 'bg-white text-[#0052CC] shadow-sm'
                : isDanger            ? 'text-red-500 hover:bg-red-50 hover:text-red-600 mt-4'
                : 'text-slate-500 hover:text-[#003d9b] hover:bg-slate-100/60',
              ].join(' ')}
            >
              <span className="material-symbols-outlined text-[18px]">{icon}</span>
              {label}
            </button>
          )
        })}

        <div className="mt-auto pb-4 px-2 border-t border-slate-100 pt-4">
          <button
            onClick={() => setCredentialsOpen(true)}
            className="w-full flex items-center gap-2 text-xs font-bold text-[#0052CC] hover:bg-blue-50 px-2 py-2 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">verified</span>
            Manage Credentials
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 p-8 overflow-y-auto">

        {/* ══ OVERVIEW TAB ══════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="max-w-5xl space-y-8">

            {/* Profile header */}
            <header className="flex justify-between items-end pb-8 border-b border-slate-200">
              <div className="flex items-center gap-6">
                <div className="relative">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-28 h-28 rounded-xl object-cover shadow-lg"
                    />
                  ) : (
                    <div className="w-28 h-28 rounded-xl bg-gradient-to-br from-[#003d9b] to-[#0052cc] flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                      {getInitials(profile.full_name)}
                    </div>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-white border-2 border-white shadow flex items-center justify-center text-slate-500 hover:text-[#0052cc] transition-colors"
                    title="Change photo"
                  >
                    {avatarUploading
                      ? <div className="h-3 w-3 rounded-full border border-current border-t-transparent animate-spin" />
                      : <span className="material-symbols-outlined text-[16px]">photo_camera</span>}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>

                <div>
                  <h1 className="text-3xl font-extrabold text-[#191c1e] tracking-tight font-manrope">
                    {displayName}
                  </h1>
                  <p className="text-lg text-[#003d9b] font-medium mt-0.5">{roleLabel}</p>
                  <div className="flex items-center gap-3 mt-2 text-sm text-slate-500 font-medium">
                    {department !== '—' && (
                      <>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">domain</span>
                          {department}
                        </span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                      </>
                    )}
                    <span className="uppercase tracking-wide">{institution}</span>
                    {profile.orcid_id && (
                      <>
                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                        <a
                          href={`https://orcid.org/${profile.orcid_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-emerald-600 hover:underline"
                        >
                          <span className="material-symbols-outlined text-[14px]">verified</span>
                          ORCID
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('edit')}
                className="bg-gradient-to-r from-[#003d9b] to-[#0052cc] text-white px-6 py-2.5 rounded-lg font-semibold text-sm shadow-md hover:shadow-lg transition-all active:scale-95"
              >
                Edit Profile
              </button>
            </header>

            {/* Metrics bento */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Projects', value: projectCount, icon: 'biotech', color: '#003d9b' },
                { label: 'Pending Reviews', value: reviewCount, icon: 'rate_review', color: '#0052cc' },
                { label: 'Plan', value: tier.charAt(0).toUpperCase() + tier.slice(1), icon: 'workspace_premium', color: '#003d9b' },
                { label: 'ORCID', value: profile.orcid_id ? 'Linked' : 'Not linked', icon: 'fingerprint', color: profile.orcid_id ? '#059669' : '#9ca3af' },
              ].map(({ label, value, icon, color }) => (
                <div
                  key={label}
                  className="bg-white p-5 rounded-xl border border-transparent hover:border-[#0052cc]/20 transition-all shadow-[0_4px_20px_rgba(0,24,72,0.04)]"
                >
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-manrope">
                    {label}
                  </p>
                  <p className="text-3xl font-extrabold font-manrope" style={{ color }}>
                    {value}
                  </p>
                </div>
              ))}
            </section>

            {/* Projects + Security 2-col */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Recent projects */}
              <section className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-[#191c1e] font-manrope">Recent Projects</h2>
                  <button
                    onClick={() => window.location.href = '/projects'}
                    className="text-[#0052CC] font-semibold text-sm hover:underline"
                  >
                    View All
                  </button>
                </div>

                {recentProjects.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400 text-sm">
                    No projects yet.{' '}
                    <a href="/projects" className="text-[#0052CC] hover:underline font-medium">
                      Start one →
                    </a>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentProjects.map(p => (
                      <a
                        key={p.id}
                        href={`/projects/${p.id}`}
                        className="flex items-center gap-4 bg-white p-5 rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:bg-slate-50 transition-colors group"
                      >
                        <div className="h-10 w-10 flex-shrink-0 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200">
                          <span className="material-symbols-outlined text-slate-400 text-[18px]">biotech</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 text-sm leading-tight truncate group-hover:text-[#003d9b] transition-colors">
                            {p.title}
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-0.5 capitalize">{p.phase?.replace('_', ' ')}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase flex-shrink-0 ${STATUS_COLORS[p.status] ?? 'bg-slate-100 text-slate-500'}`}>
                          {p.status}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </section>

              {/* Security & bio sidebar */}
              <aside className="space-y-5">
                {/* Bio */}
                {profile.bio && (
                  <div className="bg-white p-5 rounded-xl border border-slate-100">
                    <h2 className="text-sm font-bold text-[#191c1e] font-manrope mb-2">About</h2>
                    <p className="text-sm text-slate-600 leading-relaxed">{profile.bio}</p>
                  </div>
                )}

                {/* Security panel */}
                <section className="bg-white p-5 rounded-xl border border-slate-100 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#003d9b] text-[20px]">shield_lock</span>
                    <h2 className="text-sm font-bold text-[#191c1e] font-manrope">Security &amp; Access</h2>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Email</p>
                      <p className="text-sm font-medium text-slate-700 truncate">{profile.email ?? '—'}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Last Sign-in</p>
                      <p className="text-sm font-medium text-slate-700">{lastSignIn}</p>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Session</p>
                        <p className="text-sm font-semibold text-emerald-600">Active — this device</p>
                      </div>
                      <span className="material-symbols-outlined text-emerald-600 text-[20px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('security')}
                    className="w-full text-left text-xs font-bold text-[#0052CC] hover:underline mt-1"
                  >
                    Manage security →
                  </button>
                </section>

                {/* Contact info */}
                {(profile.website || profile.phone) && (
                  <section className="bg-white p-5 rounded-xl border border-slate-100 space-y-3">
                    <h2 className="text-sm font-bold text-[#191c1e] font-manrope">Contact</h2>
                    {profile.website && (
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-[#0052CC] hover:underline"
                      >
                        <span className="material-symbols-outlined text-[16px]">link</span>
                        {profile.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    {profile.phone && (
                      <p className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="material-symbols-outlined text-[16px] text-slate-400">phone</span>
                        {profile.phone}
                      </p>
                    )}
                  </section>
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
              <p className="text-sm text-slate-500 mt-0.5">How you appear on PLEXUS Research.</p>
            </div>

            {/* Avatar */}
            <div className="flex items-center gap-5">
              <div className="relative">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-20 w-20 rounded-xl object-cover ring-2 ring-slate-200" />
                ) : (
                  <div className="h-20 w-20 rounded-xl bg-gradient-to-br from-[#003d9b] to-[#0052cc] flex items-center justify-center text-white text-2xl font-bold">
                    {getInitials(profile.full_name)}
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center shadow-sm text-slate-500 hover:text-[#0052cc] transition-colors"
                >
                  {avatarUploading
                    ? <div className="h-3 w-3 rounded-full border border-current border-t-transparent animate-spin" />
                    : <span className="material-symbols-outlined text-[16px]">photo_camera</span>}
                </button>
              </div>
              <div>
                <button onClick={() => fileInputRef.current?.click()} className="text-sm font-semibold text-[#0052CC] hover:underline">
                  {avatarUploading ? 'Uploading…' : 'Upload photo'}
                </button>
                <p className="text-xs text-slate-400 mt-0.5">JPG, PNG · max 5 MB</p>
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
                <Input id="email" value={profile.email ?? ''} disabled className="mt-1 opacity-60 cursor-not-allowed" />
                <p className="text-xs text-slate-400 mt-1">Email is managed via your sign-in provider.</p>
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
                    <a href={`https://orcid.org/${profile.orcid_id}`} target="_blank" rel="noopener noreferrer" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0052cc]">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
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

              <Button type="submit" disabled={saving} className="bg-[#0052CC] hover:bg-[#003d9b]">
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </form>

            <div className="border-t border-slate-100 pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-[#191c1e]">Interface Language</h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">Applies to navigation, labels, and status messages.</p>
              <LanguageSelector />
            </div>
          </div>
        )}

        {/* ══ SECURITY TAB ═════════════════════════════════════════════════ */}
        {activeTab === 'security' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-xl font-bold text-[#191c1e] font-manrope">Security</h1>
              <p className="text-sm text-slate-500 mt-0.5">Manage your password and account access.</p>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl p-6 space-y-5">
              <h2 className="text-sm font-bold text-[#191c1e] font-manrope">Change Password</h2>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <Label htmlFor="currentPw">Current Password</Label>
                  <Input id="currentPw" type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="newPw">New Password</Label>
                  <Input id="newPw" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required minLength={8} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="confirmPw">Confirm New Password</Label>
                  <Input id="confirmPw" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required className="mt-1" />
                </div>
                <Button type="submit" disabled={changingPw} className="bg-[#0052CC] hover:bg-[#003d9b]">
                  {changingPw ? 'Updating…' : 'Update Password'}
                </Button>
              </form>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl p-6 space-y-4">
              <h2 className="text-sm font-bold text-[#191c1e] font-manrope">Active Session</h2>
              <div className="space-y-2">
                <p className="text-sm text-slate-600">Signed in as <span className="font-medium text-[#191c1e]">{profile.email}</span></p>
                <p className="text-sm text-slate-500">Last sign-in: {lastSignIn}</p>
              </div>
              <Button variant="outline" className="text-sm" onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}>
                Sign out of all devices
              </Button>
            </div>
          </div>
        )}

        {/* ══ BILLING TAB ══════════════════════════════════════════════════ */}
        {activeTab === 'billing' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-xl font-bold text-[#191c1e] font-manrope">Subscription & Billing</h1>
              <p className="text-sm text-slate-500 mt-0.5">Manage your plan and payment details.</p>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Current plan</p>
                  <p className="text-2xl font-bold text-[#191c1e] font-manrope capitalize">{tier}</p>
                </div>
                <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-blue-50 text-[#0052CC] uppercase tracking-wide">
                  {tier}
                </span>
              </div>
              <ul className="mt-4 space-y-2">
                {(PLAN_FEATURES[tier] ?? PLAN_FEATURES.free).map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
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
                    <p className="text-sm text-slate-500 mt-0.5">Unlimited projects, storage & collaboration</p>
                  </div>
                  <Button size="sm" className="bg-[#0052CC] hover:bg-[#003d9b] flex items-center gap-1">
                    Upgrade <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <ul className="space-y-1.5">
                  {PLAN_FEATURES.pro.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
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
              <p className="text-sm text-slate-500 mt-0.5">Irreversible actions. Proceed with caution.</p>
            </div>

            <div className="border border-red-200 rounded-xl overflow-hidden">
              <div className="bg-red-50 px-5 py-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Delete your account</p>
                  <p className="text-sm text-slate-600 mt-0.5">
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
                  <Input id="deleteConfirm" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" className="mt-1 font-mono" />
                </div>
                <Button variant="destructive" disabled={deleteConfirm !== 'DELETE' || deleting} onClick={handleDeleteAccount}>
                  {deleting ? 'Processing…' : 'Permanently Delete Account'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ══ CREDENTIALS MODAL ════════════════════════════════════════════════ */}
      {credentialsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setCredentialsOpen(false)} />
          <div className="relative bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col">

            {/* Modal header */}
            <div className="px-7 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#0052CC] text-2xl">verified_user</span>
                <h2 className="text-lg font-extrabold text-[#191c1e] font-manrope uppercase tracking-tight">
                  Credential Documents
                </h2>
              </div>
              <button onClick={() => setCredentialsOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <span className="material-symbols-outlined text-slate-500">close</span>
              </button>
            </div>

            {/* Modal body */}
            <div className="p-7 space-y-6">
              <p className="text-sm text-slate-500">
                Upload institutional credential documents (degree certificates, professional certifications) for verification.
                Supported formats: PDF, JPEG, PNG (max 10 MB).
              </p>

              {/* Upload zone */}
              <div
                onClick={() => credInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-blue-50/30 hover:border-[#0052CC] transition-all cursor-pointer group"
              >
                <div className="h-12 w-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[#0052CC]">upload_file</span>
                </div>
                {credFile ? (
                  <p className="text-sm font-bold text-[#0052CC]">{credFile.name}</p>
                ) : (
                  <>
                    <p className="text-sm font-bold text-slate-700">Click to upload or drag and drop</p>
                    <p className="text-xs text-slate-400 mt-1">Institutional PDF or Secure Image (Max. 10 MB)</p>
                  </>
                )}
                <input
                  ref={credInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={e => setCredFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <Button
                onClick={handleCredentialUpload}
                disabled={!credFile || uploading}
                className="w-full bg-[#0052CC] hover:bg-[#003d9b] flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">upload</span>
                {uploading ? 'Uploading…' : 'Submit for Verification'}
              </Button>
            </div>

            {/* Modal footer */}
            <div className="px-7 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setCredentialsOpen(false)}
                className="px-5 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
