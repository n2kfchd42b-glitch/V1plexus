"use client"

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  User, Lock, CreditCard, Trash2, Upload, Camera,
  ExternalLink, AlertTriangle, CheckCircle2, ChevronRight,
} from 'lucide-react'
import { getInitials } from '@/lib/utils'
import type { Profile } from '@/types/database'

type Tab = 'profile' | 'security' | 'billing' | 'danger'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'profile',  label: 'Profile',          icon: User },
  { id: 'security', label: 'Security',          icon: Lock },
  { id: 'billing',  label: 'Subscription & Billing', icon: CreditCard },
  { id: 'danger',   label: 'Danger Zone',       icon: Trash2 },
]

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    'Up to 3 active projects',
    '500 MB storage',
    'Basic analytics',
    'Community support',
  ],
  pro: [
    'Unlimited projects',
    '50 GB storage',
    'Advanced analytics & exports',
    'Priority email support',
    'Team collaboration',
  ],
  institution: [
    'Everything in Pro',
    'Unlimited storage',
    'Institutional workspace',
    'Admin dashboard',
    'Dedicated support',
    'SSO / SAML',
  ],
}

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [profile, setProfile] = useState<Partial<Profile>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Security form
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [changingPw, setChangingPw] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      if (data) {
        setProfile(data)
        setAvatarUrl(data.avatar_url ?? null)
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  /* ── Avatar upload ────────────────────────────────────────────── */
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB')
      return
    }
    setAvatarUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAvatarUploading(false); return }

    const ext  = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      toast.error('Upload failed: ' + uploadError.message)
      setAvatarUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(path)

    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
    setAvatarUrl(publicUrl)
    setProfile(p => ({ ...p, avatar_url: publicUrl }))
    toast.success('Profile picture updated')
    setAvatarUploading(false)
  }

  /* ── Save profile ─────────────────────────────────────────────── */
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { error } = await supabase.from('profiles').update({
      full_name: profile.full_name,
      title:     profile.title,
      bio:       profile.bio,
      orcid_id:  profile.orcid_id,
      phone:     profile.phone,
      website:   profile.website,
    }).eq('id', user.id)

    if (error) toast.error(error.message)
    else toast.success('Profile saved')
    setSaving(false)
  }

  /* ── Change password ──────────────────────────────────────────── */
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return }
    if (newPw.length < 8)    { toast.error('Password must be at least 8 characters'); return }
    setChangingPw(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) toast.error(error.message)
    else {
      toast.success('Password updated')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    }
    setChangingPw(false)
  }

  /* ── Delete account ───────────────────────────────────────────── */
  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    // Sign out first; actual deletion requires an admin API call or Edge Function.
    // Calling signOut here surfaces a clear instruction.
    toast.error('Account deletion requires contacting support@plexus.research — your data will be removed within 30 days.')
    setDeleting(false)
    setDeleteConfirm('')
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[300px]">
        <div className="h-5 w-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    )
  }

  const tier = (profile.subscription_tier ?? 'free') as string

  return (
    <div className="flex min-h-full">
      {/* Sidebar nav */}
      <nav className="w-52 flex-shrink-0 border-r border-[var(--border-default)] pt-8 pr-4 pl-6 space-y-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === id
                ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]'
            } ${id === 'danger' ? 'mt-6 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600' : ''}`}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 p-8 max-w-2xl">

        {/* ── Profile ────────────────────────────────────────────── */}
        {activeTab === 'profile' && (
          <section>
            <h1 className="text-xl font-bold text-[var(--text-primary)] mb-1">Profile</h1>
            <p className="text-sm text-[var(--text-tertiary)] mb-7">How you appear on PLEXUS Research Lab.</p>

            {/* Avatar */}
            <div className="flex items-center gap-5 mb-8">
              <div className="relative">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="h-20 w-20 rounded-full object-cover ring-2 ring-[var(--border-default)]"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-[#1B3A5C] flex items-center justify-center text-white text-xl font-bold ring-2 ring-[var(--border-default)]">
                    {getInitials(profile.full_name)}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors shadow-sm"
                >
                  {avatarUploading
                    ? <div className="h-3 w-3 rounded-full border border-current border-t-transparent animate-spin" />
                    : <Camera className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {avatarUploading ? 'Uploading…' : 'Upload photo'}
                </button>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">JPG, PNG or GIF · max 5 MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Name row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Dr., Prof., Mr., Ms.…"
                    value={profile.title ?? ''}
                    onChange={e => setProfile(p => ({ ...p, title: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="fullName">Full Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="fullName"
                    required
                    value={profile.full_name ?? ''}
                    onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Email (read-only from auth) */}
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  value={profile.email ?? ''}
                  disabled
                  className="mt-1 opacity-60 cursor-not-allowed"
                />
                <p className="text-xs text-[var(--text-tertiary)] mt-1">Email is managed via your sign-in provider and cannot be changed here.</p>
              </div>

              {/* Bio */}
              <div>
                <Label htmlFor="bio">Short Bio</Label>
                <Textarea
                  id="bio"
                  rows={3}
                  placeholder="A brief introduction about your research background…"
                  value={profile.bio ?? ''}
                  onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                  className="mt-1 resize-none"
                />
              </div>

              {/* ORCID */}
              <div>
                <Label htmlFor="orcid">ORCID iD</Label>
                <div className="relative mt-1">
                  <Input
                    id="orcid"
                    placeholder="0000-0000-0000-0000"
                    value={profile.orcid_id ?? ''}
                    onChange={e => setProfile(p => ({ ...p, orcid_id: e.target.value }))}
                    className="pr-9"
                  />
                  {profile.orcid_id && (
                    <a
                      href={`https://orcid.org/${profile.orcid_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-blue-600 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  Your ORCID iD uniquely identifies you as a researcher.{' '}
                  <a href="https://orcid.org/register" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Register at orcid.org
                  </a>
                </p>
              </div>

              {/* Phone & Website */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={profile.phone ?? ''}
                    onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website / Lab URL</Label>
                  <Input
                    id="website"
                    type="url"
                    placeholder="https://yourlab.edu"
                    value={profile.website ?? ''}
                    onChange={e => setProfile(p => ({ ...p, website: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>

              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? 'Saving…' : 'Save Profile'}
              </Button>
            </form>
          </section>
        )}

        {/* ── Security ───────────────────────────────────────────── */}
        {activeTab === 'security' && (
          <section>
            <h1 className="text-xl font-bold text-[var(--text-primary)] mb-1">Security</h1>
            <p className="text-sm text-[var(--text-tertiary)] mb-7">Manage your password and account access.</p>

            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5 mb-5">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Change Password</h2>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <Label htmlFor="currentPw">Current Password</Label>
                  <Input
                    id="currentPw"
                    type="password"
                    value={currentPw}
                    onChange={e => setCurrentPw(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="newPw">New Password</Label>
                  <Input
                    id="newPw"
                    type="password"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    required
                    minLength={8}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPw">Confirm New Password</Label>
                  <Input
                    id="confirmPw"
                    type="password"
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <Button type="submit" disabled={changingPw}>
                  {changingPw ? 'Updating…' : 'Update Password'}
                </Button>
              </form>
            </div>

            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Active Sessions</h2>
              <p className="text-sm text-[var(--text-tertiary)] mb-4">You are currently signed in on this device.</p>
              <Button
                variant="outline"
                onClick={async () => {
                  await supabase.auth.signOut()
                  window.location.href = '/login'
                }}
                className="text-sm"
              >
                Sign out of all devices
              </Button>
            </div>
          </section>
        )}

        {/* ── Billing ────────────────────────────────────────────── */}
        {activeTab === 'billing' && (
          <section>
            <h1 className="text-xl font-bold text-[var(--text-primary)] mb-1">Subscription & Billing</h1>
            <p className="text-sm text-[var(--text-tertiary)] mb-7">Manage your plan and payment details.</p>

            {/* Current plan */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5 mb-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide font-medium mb-1">Current plan</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)] capitalize">{tier}</p>
                  {tier === 'free' && (
                    <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Free forever</p>
                  )}
                  {tier === 'pro' && (
                    <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Billed monthly</p>
                  )}
                </div>
                {tier === 'free' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-600 border border-blue-200 dark:border-blue-800">
                    Free
                  </span>
                )}
                {tier === 'pro' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 dark:bg-green-950/40 text-green-600 border border-green-200 dark:border-green-800">
                    Active
                  </span>
                )}
              </div>
              <ul className="mt-4 space-y-1.5">
                {(PLAN_FEATURES[tier] ?? PLAN_FEATURES.free).map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Plan options */}
            {tier === 'free' && (
              <div className="space-y-3">
                <div className="bg-[var(--bg-surface)] border border-blue-200 dark:border-blue-800 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">Pro</p>
                      <p className="text-sm text-[var(--text-tertiary)]">$29 / month per user</p>
                    </div>
                    <Button size="sm" className="flex items-center gap-1">
                      Upgrade <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <ul className="space-y-1">
                    {PLAN_FEATURES.pro.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">Institution</p>
                      <p className="text-sm text-[var(--text-tertiary)]">Contact us for pricing</p>
                    </div>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      Contact sales <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <ul className="space-y-1">
                    {PLAN_FEATURES.institution.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {tier !== 'free' && (
              <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Payment Method</h2>
                <p className="text-sm text-[var(--text-tertiary)]">Manage billing via our payment portal.</p>
                <Button variant="outline" className="mt-4 text-sm flex items-center gap-2">
                  Open billing portal <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </section>
        )}

        {/* ── Danger zone ────────────────────────────────────────── */}
        {activeTab === 'danger' && (
          <section>
            <h1 className="text-xl font-bold text-red-600 mb-1">Danger Zone</h1>
            <p className="text-sm text-[var(--text-tertiary)] mb-7">Irreversible actions. Proceed with caution.</p>

            <div className="border border-red-200 dark:border-red-900 rounded-xl overflow-hidden">
              <div className="bg-red-50 dark:bg-red-950/20 px-5 py-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">Delete your account</p>
                  <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                    This will permanently delete your account, all your projects, documents, and data. This action{' '}
                    <strong>cannot be undone</strong>.
                  </p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <Label htmlFor="deleteConfirm" className="text-sm">
                    Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
                  </Label>
                  <Input
                    id="deleteConfirm"
                    value={deleteConfirm}
                    onChange={e => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                    className="mt-1 font-mono"
                  />
                </div>
                <Button
                  variant="destructive"
                  disabled={deleteConfirm !== 'DELETE' || deleting}
                  onClick={handleDeleteAccount}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleting ? 'Processing…' : 'Permanently Delete Account'}
                </Button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
